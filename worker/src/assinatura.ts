// Assinatura da barbearia pelo Google Play Billing. O app compra; o Worker confere no Google
// (Android Publisher API, subscriptionsv2) e só então grava plano, vencimento e "em dia" — campos
// que as regras do Firestore não deixam o dono mexer.
import {
  DIAS_TESTE, LIMITE_TESTE, bloqueiaEm, conferirCupom, cupomValido, emDiaPeloPlay, excedentesPara, normalizarCupom, planoPorProduto,
  renovaSozinha, type Cupom, type Plano,
} from '../../src/lib/planos';
import { dataLocal, formatarData } from '../../src/lib/agenda';
import { enviarPush } from './avisos';
import type { Firestore } from './firestore';

export const PACOTE = 'com.trevotec.navalha';

export interface CompraPlay {
  subscriptionState?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
}

/** O que a compra significa para a casa. Puro, para testar sem rede. */
export function lerCompra(c: CompraPlay, barbeariaId: string, agora: number):
  { ok: true; plano: Plano; venceEm: number; emDia: boolean; estado: string } | { ok: false; erro: string } {
  // A compra precisa ter sido feita para ESTA barbearia (o app manda o id dela como conta ofuscada):
  // sem isso, um token de outra casa poderia ser reaproveitado.
  if (c.externalAccountIdentifiers?.obfuscatedExternalAccountId !== barbeariaId) return { ok: false, erro: 'Compra de outra barbearia.' };
  const item = c.lineItems?.[0];
  const plano = planoPorProduto(item?.productId);
  if (!plano) return { ok: false, erro: 'Produto desconhecido.' };
  const venceEm = Date.parse(item?.expiryTime ?? '');
  if (!Number.isFinite(venceEm)) return { ok: false, erro: 'Compra sem vencimento.' };
  const estado = c.subscriptionState ?? '';
  return { ok: true, plano, venceEm, emDia: emDiaPeloPlay(estado, venceEm, agora), estado };
}

/** Campos da casa depois de conferir a compra. Em atraso/vencida: sai da busca, mantém o plano para o dono ver. */
export function camposDaCasa(r: { plano: Plano; venceEm: number; emDia: boolean; estado: string }) {
  const atrasada = r.estado === 'SUBSCRIPTION_STATE_ON_HOLD' || r.estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  return {
    'assinatura.status': r.emDia ? 'ativa' : atrasada ? 'inadimplente' : 'vencida',
    'assinatura.plano': r.plano.id,
    'assinatura.venceEm': r.venceEm,
    'assinatura.limiteBarbeiros': r.plano.barbeiros,
    'assinatura.renovaSozinha': renovaSozinha(r.estado),
    emDia: r.emDia,
  };
}

export async function consultarPlay(tokenSA: string, purchaseToken: string): Promise<CompraPlay | null> {
  const r = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACOTE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${tokenSA}` } },
  );
  if (r.status === 404 || r.status === 410) return null;
  if (!r.ok) throw new Error(`Play ${r.status}: ${await r.text()}`);
  return (await r.json()) as CompraPlay;
}

/** POST /assinatura/verificar — chamado pelo app logo depois da compra (e no "restaurar"). */
export async function verificarCompra(db: Firestore, tokenSA: string, uid: string, barbeariaId: string, purchaseToken: string, agora = Date.now()) {
  const casa = (await db.varios([`barbearias/${barbeariaId}`])).get(`barbearias/${barbeariaId}`);
  if (!casa || casa.donoUid !== uid) return { status: 403, corpo: { erro: 'Só o dono da barbearia assina o plano.' } };
  const compra = await consultarPlay(tokenSA, purchaseToken);
  if (!compra) return { status: 404, corpo: { erro: 'Compra não encontrada no Google Play.' } };
  const r = lerCompra(compra, barbeariaId, agora);
  if (!r.ok) return { status: 400, corpo: { erro: r.erro } };
  // Troca para plano menor (vale na renovação): a compra nova ainda não está ativa; não derruba a atual.
  if (!r.emDia && casa.emDia === true && (casa.assinatura as { status?: string })?.status === 'ativa') {
    return { status: 202, corpo: { pendente: true } };
  }
  await db.escrever([
    { caminho: `barbearias/${barbeariaId}`, campos: camposDaCasa(r) },
    { caminho: `assinaturas/${barbeariaId}`, criar: true, campos: { purchaseToken, produto: r.plano.produto, estado: r.estado, atualizadoEm: agora } },
  ]);
  return { status: 200, corpo: { emDia: r.emDia, plano: r.plano.id, venceEm: r.venceEm } };
}

/**
 * Cron: casas "em dia" cujo prazo passou. Com compra: pergunta ao Google (a renovação automática estende o prazo).
 * Sem renovação (ou fim do teste): mais 5 dias de uso para regularizar; depois, bloqueada (`emDia: false`: some da
 * busca, as regras barram agendamentos e o app trava a agenda). Durante os 5 dias a casa volta aqui a cada hora.
 * ponytail: até 15 por execução (limite de chamadas do plano grátis); acima disso, RTDN do Play ou Workers pago.
 */
export async function conferirVencimentos(db: Firestore, tokenSA: string, agora = Date.now(), projectId?: string) {
  const vencidas = await db.query({
    from: [{ collectionId: 'barbearias' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'emDia' }, op: 'EQUAL', value: { booleanValue: true } } },
      { fieldFilter: { field: { fieldPath: 'assinatura.venceEm' }, op: 'LESS_THAN', value: { integerValue: String(agora) } } },
    ] } },
    limit: 15,
  });
  if (!vencidas.length) return;
  const compras = await db.varios(vencidas.map(v => `assinaturas/${v.id}`));
  const escritas: { caminho: string; campos: Record<string, unknown> }[] = [];
  const avisos: { id: string; casa: Record<string, unknown>; ate: number }[] = [];
  for (const { id, dados } of vencidas) {
    // Cortesia (cupom) não passa pelo Google: um token antigo do Play não pode decidir o fim do cupom.
    const cortesia = (dados.assinatura as { status?: string } | undefined)?.status === 'cortesia';
    const token = cortesia ? undefined : compras.get(`assinaturas/${id}`)?.purchaseToken as string | undefined;
    const compra = token ? await consultarPlay(tokenSA, token).catch(() => null) : null;
    const r = compra ? lerCompra(compra, id, agora) : null;
    const venceEm = r?.ok ? r.venceEm : Number((vencidas.find(v => v.id === id)?.dados.assinatura as { venceEm?: number } | undefined)?.venceEm ?? 0);
    const liberada = agora < bloqueiaEm(venceEm); // dentro dos 5 dias de regularização
    const campos = r?.ok ? { ...camposDaCasa(r), emDia: r.emDia || liberada } : { 'assinatura.status': 'vencida', emDia: liberada };
    escritas.push({ caminho: `barbearias/${id}`, campos });
    if (!(r?.ok && r.emDia) && liberada) avisos.push({ id, casa: dados, ate: bloqueiaEm(venceEm) });
  }
  await db.escrever(escritas);
  await avisarPlanoVencido(db, tokenSA, projectId, avisos, agora);
}

/**
 * Venceu e entrou nos 5 dias: aviso no sino e push para o dono, uma vez por vencimento (id fixo: o cron passa
 * pela casa a cada hora durante os 5 dias e não repete).
 */
async function avisarPlanoVencido(db: Firestore, tokenSA: string, projectId: string | undefined,
  avisos: { id: string; casa: Record<string, unknown>; ate: number }[], agora: number) {
  const lista = avisos.filter(a => a.casa.donoUid).map(a => ({ ...a, nid: `plano_${a.id}_${a.ate}`, dono: a.casa.donoUid as string }));
  if (!lista.length) return;
  const ja = await db.varios(lista.map(a => `notificacoes/${a.nid}`));
  const novos = lista.filter(a => !ja.has(`notificacoes/${a.nid}`));
  if (!novos.length) return;
  const notifs = novos.map(a => ({
    id: a.nid, paraUid: a.dono, barbeariaId: a.id, tipo: 'plano', em: agora, lida: false,
    titulo: 'Plano vencido',
    corpo: `O plano da ${String(a.casa.nome ?? 'sua barbearia')} venceu. Assine até ${formatarData(dataLocal(a.ate))} para a barbearia não ficar bloqueada.`,
  }));
  await db.escrever(notifs.map(n => ({ caminho: `notificacoes/${n.id}`, criar: true, campos: n })));
  if (!projectId) return;
  const perfis = await db.varios(novos.map(a => `users/${a.dono}`));
  for (const n of notifs) {
    const token = perfis.get(`users/${n.paraUid}`)?.pushToken as string | undefined;
    if (token) await enviarPush(projectId, tokenSA, { token, title: n.titulo, body: n.corpo, agendamentoId: n.id, link: 'https://navalha.web.app/plano' });
  }
}

/**
 * POST /cupom/resgatar — cupom do Navalha (cortesia): libera o plano do cupom pelos dias dele, sem Google Play e sem
 * cobrança. Só o dono; um uso por barbearia; respeita limite, validade e o limite de barbeiros do plano.
 * ponytail: o contador de usos é lido e somado sem transação; dois resgates no mesmo instante podem passar 1 do limite.
 */
export async function resgatarCupom(db: Firestore, uid: string, barbeariaId: string, codigoBruto: string, agora = Date.now()) {
  const codigo = normalizarCupom(codigoBruto);
  if (!cupomValido(codigo)) return { status: 400, corpo: { erro: 'Código inválido.' } };
  const docs = await db.varios([`barbearias/${barbeariaId}`, `cupons/${codigo}`, `cupons/${codigo}/usos/${barbeariaId}`]);
  const casa = docs.get(`barbearias/${barbeariaId}`);
  if (!casa || casa.donoUid !== uid) return { status: 403, corpo: { erro: 'Só o dono da barbearia usa cupom.' } };
  const a = (casa.assinatura ?? {}) as { status?: string; renovaSozinha?: boolean };
  // Plano pago renovando pela Play: o cupom não para a cobrança; o dono cancela na Play Store antes.
  if (casa.emDia === true && a.status === 'ativa' && a.renovaSozinha !== false) {
    return { status: 409, corpo: { erro: 'Você tem um plano pago ativo no Google Play. Cancele a renovação na Play Store e use o cupom depois.' } };
  }
  const c = conferirCupom(docs.get(`cupons/${codigo}`) as Cupom | undefined, docs.has(`cupons/${codigo}/usos/${barbeariaId}`), agora);
  if (!c.ok) return { status: 404, corpo: { erro: c.erro } };
  const excedentes = excedentesPara(c.plano, Number(casa.barbeirosAtivos ?? 1));
  if (excedentes > 0) return { status: 409, corpo: { erro: `O cupom é do plano ${c.plano.nome} (até ${c.plano.barbeiros}). Desligue ${excedentes} na equipe e tente de novo.` } };
  const venceEm = agora + c.dias * 86_400_000;
  await db.escrever([
    { caminho: `barbearias/${barbeariaId}`, campos: {
      'assinatura.status': 'cortesia', 'assinatura.plano': c.plano.id, 'assinatura.venceEm': venceEm,
      'assinatura.limiteBarbeiros': c.plano.barbeiros, 'assinatura.renovaSozinha': false, 'assinatura.cupom': codigo, emDia: true,
    } },
    { caminho: `cupons/${codigo}`, campos: { usos: Number(docs.get(`cupons/${codigo}`)?.usos ?? 0) + 1 } },
    { caminho: `cupons/${codigo}/usos/${barbeariaId}`, criar: true, campos: { uid, em: agora, venceEm } },
  ]);
  return { status: 200, corpo: { plano: c.plano.id, nome: c.plano.nome, venceEm } };
}

/**
 * Migração única das casas criadas antes dos planos: contador de barbeiros ativos, 60 dias de teste
 * a partir de agora (primeiros usuários) e a marca de teste usado do dono. Idempotente.
 */
export async function migrarAssinaturas(db: Firestore, agora = Date.now()) {
  const casas = await db.query({ from: [{ collectionId: 'barbearias' }], limit: 300 });
  let migradas = 0;
  for (const { id, dados } of casas) {
    if (typeof dados.emDia === 'boolean' && typeof dados.barbeirosAtivos === 'number') continue;
    const ativos = await db.query({
      from: [{ collectionId: 'barbeiros' }],
      where: { fieldFilter: { field: { fieldPath: 'ativo' }, op: 'EQUAL', value: { booleanValue: true } } },
    }, `barbearias/${id}`);
    await db.escrever([
      { caminho: `barbearias/${id}`, campos: {
        assinatura: { status: 'teste', venceEm: agora + DIAS_TESTE * 86_400_000, limiteBarbeiros: LIMITE_TESTE },
        emDia: true, barbeirosAtivos: ativos.length,
      } },
      { caminho: `testes/${dados.donoUid as string}`, criar: true, campos: { em: agora } },
    ]);
    migradas++;
  }
  return { casas: casas.length, migradas };
}
