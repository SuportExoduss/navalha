// Worker do Navalha (Cloudflare, plano gratuito):
//  PUT  /fotos?tipo=…&refId=…  → recebe a foto já comprimida e grava no R2
//  GET  /fotos/<chave>         → serve a foto (fallback; em produção use o domínio público do bucket)
//  GET  /saude                 → verificação simples
//  cron a cada hora            → lembretes push de 24 h e 2 h pelo FCM (Firebase), sem conta Expo
//  POST /asaas/webhook         → reservado para a Fase 3 (pagamentos)
import { verificarIdToken } from './auth';
import { Firestore, tokenGoogle } from './firestore';
import { chaveFoto, janelasLembrete, mensagemFcm, mensagemLembrete, tipoDaImagem, TIPOS } from './util';

export interface Env {
  FOTOS: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  /** URL pública do bucket (r2.dev ou domínio próprio). Vazio = servir pelo Worker. */
  FOTOS_URL_PUBLICA?: string;
  ORIGENS_PERMITIDAS?: string;
  // Segredos (wrangler secret put):
  GOOGLE_SA_EMAIL?: string;
  GOOGLE_SA_PRIVATE_KEY?: string;
}

const MAX_BYTES = 1_500_000; // o app manda ~150 KB; recusa arquivos grandes

function cors(env: Env, req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? '';
  const permitidas = (env.ORIGENS_PERMITIDAS ?? '*').split(',').map(s => s.trim());
  const ok = permitidas.includes('*') || permitidas.includes(origem);
  return {
    'Access-Control-Allow-Origin': ok ? (origem || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    Vary: 'Origin',
  };
}

const json = (dados: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(dados), { status, headers: { ...h, 'Content-Type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/saude') return json({ ok: true }, 200, h);

    if (url.pathname === '/fotos' && req.method === 'PUT') {
      const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
      const uid = token ? await verificarIdToken(token, env.FIREBASE_PROJECT_ID) : null;
      if (!uid) return json({ erro: 'Entre na sua conta para enviar fotos.' }, 401, h);

      const tipo = url.searchParams.get('tipo') ?? '';
      const refId = url.searchParams.get('refId') ?? '';
      const chave = chaveFoto(tipo, uid, refId, crypto.randomUUID());
      if (!chave) return json({ erro: `Tipo deve ser um de: ${TIPOS.join(', ')}; refId alfanumérico.` }, 400, h);

      const tamanho = Number(req.headers.get('Content-Length') ?? 0);
      if (tamanho > MAX_BYTES) return json({ erro: 'Foto grande demais.' }, 413, h);
      const corpo = await req.arrayBuffer(); // ~150 KB: cabe com folga na memória
      if (corpo.byteLength === 0 || corpo.byteLength > MAX_BYTES) return json({ erro: 'Foto vazia ou grande demais.' }, 413, h);
      const tipoConteudo = tipoDaImagem(new Uint8Array(corpo, 0, Math.min(16, corpo.byteLength)));
      if (!tipoConteudo) return json({ erro: 'Envie uma imagem WebP, JPEG ou PNG.' }, 415, h);

      await env.FOTOS.put(chave, corpo, {
        httpMetadata: { contentType: tipoConteudo, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { uid },
      });
      const base = env.FOTOS_URL_PUBLICA?.replace(/\/$/, '') || `${url.origin}/fotos`;
      return json({ url: `${base}/${chave}` }, 201, h);
    }

    if (url.pathname.startsWith('/fotos/') && req.method === 'GET') {
      const obj = await env.FOTOS.get(decodeURIComponent(url.pathname.slice('/fotos/'.length)));
      if (!obj) return new Response('Não encontrada', { status: 404, headers: h });
      return new Response(obj.body, {
        headers: { ...h, 'Content-Type': obj.httpMetadata?.contentType ?? 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: obj.httpEtag },
      });
    }

    if (url.pathname === '/asaas/webhook') return json({ erro: 'Disponível na Fase 3.' }, 501, h);
    return json({ erro: 'Rota não encontrada.' }, 404, h);
  },

  async scheduled(_ev: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(enviarLembretes(env));
  },
};

/** Lembretes de 24 h e 2 h. Roda a cada hora (cron "5 * * * *"). */
export async function enviarLembretes(env: Env, agora = Date.now()) {
  if (!env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_PRIVATE_KEY) return;
  const tokenSA = await tokenGoogle(env.GOOGLE_SA_EMAIL, env.GOOGLE_SA_PRIVATE_KEY);
  const db = new Firestore(env.FIREBASE_PROJECT_ID, tokenSA);
  for (const j of janelasLembrete(agora)) {
    const ags = await db.query({
      from: [{ collectionId: 'agendamentos' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: [{ stringValue: 'reservado' }, { stringValue: 'confirmado' }, { stringValue: 'pago' }] } } } },
        { fieldFilter: { field: { fieldPath: 'inicio' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(j.de) } } },
        { fieldFilter: { field: { fieldPath: 'inicio' }, op: 'LESS_THAN', value: { integerValue: String(j.ate) } } },
      ] } },
      limit: 200,
    });
    const mensagens: { token: string; title: string; body: string; agendamentoId: string }[] = [];
    const marcar: string[] = [];
    for (const { id, dados } of ags) {
      const lembretes = (dados.lembretes ?? {}) as Record<string, number>;
      if (lembretes[j.chave]) continue; // já avisado
      const uid = dados.clienteUid as string | null;
      if (!uid) continue; // encaixe de balcão
      const user = await db.get(`users/${uid}`);
      const push = user?.pushToken as string | undefined;
      if (push) {
        const m = mensagemLembrete(dados as { servicoNome: string; inicio: number; barbeariaNome?: string }, j.quando);
        mensagens.push({ token: push, ...m, agendamentoId: id });
      }
      marcar.push(id);
    }
    // FCM v1 manda uma mensagem por chamada; o bloco `notification` faz o Android mostrar
    // o aviso sozinho com o app fechado, no canal "lembretes" criado pelo app.
    // ponytail: token inválido (app desinstalado) só falha calado; limpar o pushToken se o volume crescer.
    for (const m of mensagens) {
      await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSA}` },
        body: JSON.stringify(mensagemFcm(m)),
      });
    }
    for (const id of marcar) await db.marcarNumero(`agendamentos/${id}`, `lembretes.${j.chave}`, agora);
  }
}
