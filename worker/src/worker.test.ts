/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveFoto, janelasLembrete, mensagemFcm, mensagemLembrete, tipoDaImagem } from './util';
import { validarClaims, decodificarParte, type Claims } from './auth';
import { Firestore, lerValor } from './firestore';
import { camposDaCasa, conferirVencimentos, lerCompra } from './assinatura';

test('chave da foto aceita só tipos e ids seguros', () => {
  assert.equal(chaveFoto('corte', 'uid123', 'ag_1', 'abc-1'), null); // foto do corte saiu do app
  assert.equal(chaveFoto('servico', 'uid123', 's_1', 'abc-1'), 'servico/s_1/uid123-abc-1.webp');
  assert.equal(chaveFoto('banner', 'uid123', 'uid123', 'abc-1'), 'banner/uid123/uid123-abc-1.webp');
  assert.equal(chaveFoto('virus', 'u', 'r', 'i'), null);
  assert.equal(chaveFoto('perfil', 'u', '../../segredo', 'i'), null);
  assert.equal(chaveFoto('perfil', 'u/x', 'r', 'i'), null);
});

test('claims do token do Firebase', () => {
  const agora = 2_000_000_000;
  const ok: Claims = { sub: 'abc', aud: 'navalha-app', iss: 'https://securetoken.google.com/navalha-app', exp: agora + 60, iat: agora - 10, auth_time: agora - 10 };
  assert.equal(validarClaims(ok, 'navalha-app', agora), null);
  assert.equal(validarClaims({ ...ok, aud: 'outro' }, 'navalha-app', agora), 'aud');
  assert.equal(validarClaims({ ...ok, iss: 'https://evil' }, 'navalha-app', agora), 'iss');
  assert.equal(validarClaims({ ...ok, exp: agora - 1 }, 'navalha-app', agora), 'exp');
  assert.equal(validarClaims({ ...ok, sub: '' }, 'navalha-app', agora), 'sub');
});

test('decodifica base64url do JWT', () => {
  const parte = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
  assert.deepEqual(decodificarParte(parte), { alg: 'RS256', kid: 'k1' });
});

test('converte valores do Firestore REST', () => {
  assert.deepEqual(
    lerValor({ mapValue: { fields: { n: { integerValue: '42' }, s: { stringValue: 'x' }, l: { arrayValue: { values: [{ booleanValue: true }] } } } } }),
    { n: 42, s: 'x', l: [true] },
  );
});

test('lembretes: janelas de 24 h e 2 h e texto no horário de Brasília', () => {
  const agora = Date.UTC(2026, 11, 14, 12, 5); // 09:05 em Brasília
  const [h24, h2] = janelasLembrete(agora);
  assert.equal(h24.de - agora, 23 * 3_600_000);
  assert.equal(h2.ate - agora, 2 * 3_600_000);
  const inicio = Date.UTC(2026, 11, 15, 13, 30); // 10:30 em Brasília
  assert.equal(mensagemLembrete({ servicoNome: 'Degradê', inicio, barbeariaNome: 'Navalha de Ouro' }, 'amanhã').body,
    'Seu Degradê é amanhã, às 10:30 na Navalha de Ouro.');
});

test('mensagem do FCM vai no canal de lembretes com o id do agendamento', () => {
  const m = mensagemFcm({ token: 'tk', title: 'T', body: 'B', agendamentoId: 'ag1' }).message;
  assert.equal(m.token, 'tk');
  assert.deepEqual(m.notification, { title: 'T', body: 'B' });
  assert.equal(m.android.notification.channel_id, 'lembretes');
  assert.equal(m.data.agendamentoId, 'ag1');
  assert.equal(m.webpush.fcm_options.link, 'https://navalha.web.app/agendamentos');
});
test('tipo da foto vem dos bytes, não do cabeçalho', () => {
  const bytes = (...x: (number | string)[]) => new Uint8Array(x.flatMap(v => typeof v === 'string' ? [...v].map(c => c.charCodeAt(0)) : [v]));
  assert.equal(tipoDaImagem(bytes('RIFF', 0, 0, 0, 0, 'WEBP')), 'image/webp');
  assert.equal(tipoDaImagem(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(tipoDaImagem(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(tipoDaImagem(bytes('<svg onload=alert(1)>')), null);
  assert.equal(tipoDaImagem(bytes('RIFF', 0, 0, 0, 0, 'WAVE')), null);
  assert.equal(tipoDaImagem(new Uint8Array()), null);
});

test('lembretes: perfis numa leitura só e marcações numa gravação só (limite de chamadas do plano grátis)', async () => {
  const chamadas: { url: string; corpo: any }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, corpo: JSON.parse(String(init?.body ?? '{}')) });
    const raiz = 'projects/p/databases/(default)/documents/';
    const resp = url.endsWith(':batchGet')
      ? [{ found: { name: raiz + 'users/ana', fields: { pushToken: { stringValue: 't1' } } } }, { missing: raiz + 'users/beto' }]
      : {};
    return new Response(JSON.stringify(resp), { status: 200 });
  }) as typeof fetch;
  try {
    const db = new Firestore('p', 'tk');
    const perfis = await db.varios(['users/ana', 'users/beto']);
    assert.equal(perfis.get('users/ana')?.pushToken, 't1');
    assert.equal(perfis.has('users/beto'), false);
    await db.marcarVarios(['agendamentos/a1', 'agendamentos/a2'], 'lembretes.h2', 5);
    assert.equal(chamadas.length, 2);
    assert.deepEqual(chamadas[1].corpo.writes.map((w: any) => w.updateMask.fieldPaths), [['lembretes.h2'], ['lembretes.h2']]);
    assert.equal(chamadas[1].corpo.writes[0].update.fields.lembretes.mapValue.fields.h2.integerValue, '5');
    await db.marcarVarios([], 'lembretes.h2', 5);
    assert.equal(chamadas.length, 2); // nada a marcar = nenhuma chamada
  } finally { globalThis.fetch = original; }
});

test('assinatura: compra do Google Play só vale para a barbearia que comprou e vira campos da casa', () => {
  const agora = Date.parse('2027-01-10T12:00:00Z');
  const compra = {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    lineItems: [{ productId: 'navalha_equipe', expiryTime: '2027-02-10T12:00:00Z' }],
    externalAccountIdentifiers: { obfuscatedExternalAccountId: 'b1' },
  };
  const r = lerCompra(compra, 'b1', agora);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(camposDaCasa(r), {
    'assinatura.status': 'ativa', 'assinatura.plano': 'equipe', 'assinatura.venceEm': Date.parse('2027-02-10T12:00:00Z'),
    'assinatura.limiteBarbeiros': 3, 'assinatura.renovaSozinha': true, emDia: true,
  });
  assert.equal(camposDaCasa(lerCompra({ ...compra, subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }, 'b1', agora) as never)['assinatura.renovaSozinha'], false);
  assert.equal(lerCompra(compra, 'outra', agora).ok, false); // token reaproveitado em outra casa
  assert.equal(lerCompra({ ...compra, lineItems: [{ productId: 'outro_app', expiryTime: '2027-02-10T12:00:00Z' }] }, 'b1', agora).ok, false);
  const atrasada = lerCompra({ ...compra, subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' }, 'b1', agora);
  assert.ok(atrasada.ok && camposDaCasa(atrasada)['assinatura.status'] === 'inadimplente' && camposDaCasa(atrasada).emDia === false);
});

test('Firestore REST: campos com ponto viram mapa e se juntam numa gravação', async () => {
  const chamadas: any[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => { chamadas.push(JSON.parse(String(init?.body))); return new Response('{}'); }) as typeof fetch;
  try {
    await new Firestore('p', 't').escrever([{ caminho: 'barbearias/b1', campos: { 'assinatura.status': 'ativa', 'assinatura.venceEm': 5, emDia: true } }]);
    const w = chamadas[0].writes[0];
    assert.deepEqual(w.updateMask.fieldPaths, ['assinatura.status', 'assinatura.venceEm', 'emDia']);
    assert.deepEqual(w.update.fields.assinatura.mapValue.fields, { status: { stringValue: 'ativa' }, venceEm: { integerValue: '5' } });
    assert.deepEqual(w.currentDocument, { exists: true });
  } finally { globalThis.fetch = original; }
});

test('avisos: só quem é do agendamento avisa; os outros lados recebem uma vez; aviso velho é ignorado', async () => {
  const { avisarAgendamento } = await import('./avisos');
  const agora = 1_800_000_000_000;
  const docs = new Map<string, Record<string, unknown>>([
    ['agendamentos/a1', { clienteUid: 'ana', clienteNome: 'Ana', status: 'reservado', criadoEm: agora - 60_000, barbeariaId: 'b1',
      barbeiroId: 'lucas', barbeiroNome: 'Lucas', servicoNome: 'Degradê', inicio: agora + 86_400_000 }],
    ['barbearias/b1', { donoUid: 'dono' }],
    ['users/lucas', { pushToken: 'tk-lucas' }],
  ]);
  const db = {
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    // Como o Firestore: junta os campos ao documento que já existe.
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => { for (const w of l) docs.set(w.caminho, { ...docs.get(w.caminho), ...w.campos }); },
  } as never;
  const pushes: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => { pushes.push(JSON.parse(String(init?.body)).message.token); return new Response('{}'); }) as typeof fetch;
  try {
    assert.equal((await avisarAgendamento(db, 't', 'p', 'intruso', 'a1', agora)).status, 403);
    const r = await avisarAgendamento(db, 't', 'p', 'ana', 'a1', agora);
    assert.deepEqual(r.corpo, { enviados: 2 });
    assert.equal((docs.get('notificacoes/a1_agendado_dono') as { corpo: string }).corpo.includes('com Lucas'), true);
    const n = docs.get('notificacoes/a1_agendado_lucas') as { barbeiroId: string; inicio: number };
    assert.deepEqual([n.barbeiroId, n.inicio], ['lucas', agora + 86_400_000]); // o painel do barbeiro mostra "Lembrar no WhatsApp"
    assert.deepEqual(pushes, ['tk-lucas']); // o dono não tem token: fica só no painel
    assert.deepEqual((await avisarAgendamento(db, 't', 'p', 'ana', 'a1', agora)).corpo, { enviados: 0 }); // não repete
    assert.equal((await avisarAgendamento(db, 't', 'p', 'ana', 'a1', agora + 60 * 60_000)).status, 409); // velho demais

    // A casa cancela: o cliente e o barbeiro ficam sabendo; quem cancelou (o dono) não recebe.
    docs.set('agendamentos/a2', { ...docs.get('agendamentos/a1'), barbeariaNome: 'Navalha de Ouro', status: 'cancelado', atualizadoEm: agora - 1000,
      cancelamento: { por: 'casa', motivo: 'Chuva', em: agora } });
    docs.set('users/ana', { pushToken: 'tk-ana' });
    pushes.length = 0;
    assert.deepEqual((await avisarAgendamento(db, 't', 'p', 'dono', 'a2', agora)).corpo, { enviados: 2 });
    assert.equal((docs.get('notificacoes/a2_cancelado_ana') as { titulo: string }).titulo, 'Seu horário foi cancelado');
    assert.equal(docs.has('notificacoes/a2_cancelado_dono'), false);
    assert.deepEqual(pushes.sort(), ['tk-ana', 'tk-lucas']);

    // Finalizado: com "pedir avaliação" ligado, só o cliente recebe o pedido; desligado, ninguém recebe nada.
    docs.set('agendamentos/a3', { ...docs.get('agendamentos/a1'), barbeariaNome: 'Navalha de Ouro', status: 'concluido', atualizadoEm: agora - 1000 });
    assert.equal((await avisarAgendamento(db, 't', 'p', 'lucas', 'a3', agora)).status, 409);
    docs.set('barbearias/b1', { donoUid: 'dono', pedirAvaliacao: true });
    pushes.length = 0;
    assert.deepEqual((await avisarAgendamento(db, 't', 'p', 'lucas', 'a3', agora)).corpo, { enviados: 1 });
    const pedido = docs.get('notificacoes/a3_avaliar_ana') as { titulo: string; corpo: string };
    assert.equal(pedido.titulo, 'Como foi o corte?');
    assert.equal(pedido.corpo, 'Avalie seu atendimento com Lucas na Navalha de Ouro. Leva 10 segundos.');
    assert.deepEqual(pushes, ['tk-ana']);
    assert.equal((docs.get('agendamentos/a3') as { pedidoAvaliacao?: boolean }).pedidoAvaliacao, true);
    assert.equal((await avisarAgendamento(db, 't', 'p', 'ana', 'a3', agora)).status, 409); // o cliente não pede para si
  } finally { globalThis.fetch = original; }
});

test('avaliar: uma avaliação por cliente por casa; de novo, edita; a nota e o ranking só do app', async () => {
  const { avaliar, idAvaliacao } = await import('./avaliacoes');
  const { APAGAR } = await import('./firestore');
  const agora = 1_800_000_000_000;
  const docs = new Map<string, Record<string, unknown>>([
    ['agendamentos/a1', { clienteUid: 'ana', clienteNome: 'Ana Souza', status: 'concluido', inicio: agora - 6_300_000, barbeariaId: 'b1' }],
    ['agendamentos/a2', { clienteUid: 'ana', status: 'reservado', barbeariaId: 'b1' }],
    ['agendamentos/a3', { clienteUid: 'ana', clienteNome: 'Ana Souza', status: 'concluido', inicio: agora, barbeariaId: 'b1' }],
    ['barbearias/b1', { donoUid: 'dono', resumo: { notaApp: 4, totalAvaliacoesApp: 1, somaEstrelasApp: 4 } }],
    ['users/ana', { uid: 'ana' }],
  ]);
  const db = {
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => {
      for (const w of l) {
        const d = { ...(docs.get(w.caminho) ?? {}) } as Record<string, unknown>;
        for (const [k, v] of Object.entries(w.campos)) {
          const [a, b] = k.split('.');
          if (v === APAGAR) delete d[k]; else if (b) d[a] = { ...(d[a] as object), [b]: v }; else d[a] = v;
        }
        docs.set(w.caminho, d);
      }
    },
  } as never;
  assert.equal((await avaliar(db, 'beto', 'a1', 5, agora)).status, 403);
  assert.equal((await avaliar(db, 'ana', 'a2', 5, agora)).status, 409); // ainda não concluído
  assert.equal((await avaliar(db, 'ana', 'a1', 9, agora)).status, 400);
  assert.deepEqual((await avaliar(db, 'ana', 'a1', 5, agora)).corpo, { ok: true, editada: false });
  const id = await idAvaliacao('b1', 'ana');
  assert.match(id, /^[0-9a-f]{24}$/);
  const av = docs.get(`avaliacoes/${id}`) as Record<string, unknown>;
  // Só as estrelas (LGPD, necessidade): nada de nome, comentário, dia do corte, uid ou foto.
  assert.deepEqual(Object.keys(av).sort(), ['atualizadoEm', 'barbeariaId', 'criadoEm', 'estrelas', 'id']);
  assert.equal('comentario' in (docs.get('users/ana')!.avaliouBarbearias as Record<string, object>).b1, false);
  let r = docs.get('barbearias/b1')!.resumo as Record<string, number>;
  assert.deepEqual([r.notaApp, r.totalAvaliacoesApp, r.somaEstrelasApp], [4.5, 2, 9]);
  assert.ok(r.notaRanking > 4 && r.notaRanking < 4.5); // o ranking pesa a quantidade
  assert.equal((docs.get('users/ana')!.avaliouBarbearias as Record<string, { estrelas: number }>).b1.estrelas, 5);

  // De novo (mesmo de outro corte): edita, não soma outra. Uma antiga (de antes de 25/out) perde nome e comentário.
  docs.set(`avaliacoes/${id}`, { ...av, clienteNome: 'Ana', comentario: 'Ótimo', inicio: 1, direcao: 'cliente_para_barbearia', visivel: true });
  assert.deepEqual((await avaliar(db, 'ana', 'a3', 3, agora + 1000)).corpo, { ok: true, editada: true });
  r = docs.get('barbearias/b1')!.resumo as Record<string, number>;
  assert.deepEqual([r.notaApp, r.totalAvaliacoesApp, r.somaEstrelasApp], [3.5, 2, 7]);
  const editada = docs.get(`avaliacoes/${id}`) as Record<string, unknown>;
  assert.deepEqual([editada.estrelas, editada.criadoEm, editada.atualizadoEm], [3, agora, agora + 1000]);
  assert.deepEqual(Object.keys(editada).sort(), ['atualizadoEm', 'barbeariaId', 'criadoEm', 'estrelas', 'id']);
});

test('Firestore REST: APAGAR tira o campo (fica na máscara sem valor) e apagar manda deletes', async () => {
  const { APAGAR } = await import('./firestore');
  const chamadas: any[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => { chamadas.push(JSON.parse(String(init?.body))); return new Response('{}'); }) as typeof fetch;
  try {
    const db = new Firestore('p', 't');
    await db.escrever([{ caminho: 'agendamentos/a1', campos: { clienteNome: 'X', clienteTelefone: APAGAR } }]);
    assert.deepEqual(chamadas[0].writes[0].updateMask.fieldPaths, ['clienteNome', 'clienteTelefone']);
    assert.deepEqual(Object.keys(chamadas[0].writes[0].update.fields), ['clienteNome']);
    await db.apagar(['users/u1']);
    assert.equal(chamadas[1].writes[0].delete, 'projects/p/databases/(default)/documents/users/u1');
  } finally { globalThis.fetch = original; }
});

test('excluir conta: anonimiza histórico e tira o autor da avaliação, apaga avisos, perfil e fotos; barbeiro sai da equipe; dono não exclui', async () => {
  const { excluirConta, chaveDaFoto } = await import('./conta');
  const { idAvaliacao } = await import('./avaliacoes');
  const { APAGAR } = await import('./firestore');
  const agora = 1_800_000_000_000;
  const foto = 'https://navalha-worker.navalha-worker.workers.dev/fotos/corte/a1/lucas-x1.webp';
  const publica = `avaliacoes/${await idAvaliacao('b1', 'ana')}`;
  const docs = new Map<string, Record<string, unknown>>([
    ['users/ana', { uid: 'ana', barbearias: ['b2'] }], // atende na b2
    ['barbearias/b1', { donoUid: 'dono' }],
    ['barbearias/b2', { donoUid: 'outro', barbeirosAtivos: 3 }],
    ['barbearias/b2/barbeiros/ana', { nome: 'Ana', fotoUrl: 'f', ativo: true }],
    [publica, { clienteNome: 'Ana' }], // pública: sem uid, achada pelo id (casa + cliente)
  ]);
  const consultas: Record<string, { id: string; dados: Record<string, unknown> }[]> = {
    agendamentos: [{ id: 'a1', dados: { barbeariaId: 'b1', barbeiroId: 'lucas', fotos: [foto, 'https://evil/x.webp'] } }],
    // Antigas (de antes de 23/out), achadas pelo uid: a do barbeiro sai; a da casa fica, sem autor.
    avaliacoes: [{ id: 'a1_barbeiro', dados: { direcao: 'cliente_para_barbeiro' } }, { id: 'a0', dados: { direcao: 'cliente_para_barbearia' } }],
    notificacoes: [{ id: 'n-da-ana', dados: {} }],
  };
  const gravados: { caminho: string; campos: Record<string, unknown> }[] = [];
  const apagados: string[] = [];
  const db = {
    query: async (q: { from: { collectionId: string }[]; where: { fieldFilter: { value: { stringValue: string } } } }) => {
      assert.equal(q.where.fieldFilter.value.stringValue, 'ana'); // nunca consulta dados de outra pessoa
      return consultas[q.from[0].collectionId];
    },
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    escrever: async (l: typeof gravados) => { gravados.push(...l); },
    apagar: async (l: string[]) => { apagados.push(...l); },
  } as never;
  const fotosApagadas: string[] = [];
  const bucket = {
    list: async ({ prefix }: { prefix: string }) => ({ objects: prefix === 'perfil/ana/' ? [{ key: 'perfil/ana/ana-1.webp' }] : [] }),
    delete: async (k: string[]) => { fotosApagadas.push(...k); },
  } as never;

  assert.equal(chaveDaFoto('https://x/fotos/../segredo/a.webp'), null);
  assert.deepEqual((await excluirConta(db, bucket, 'ana', agora)).status, 200);
  const g = (c: string) => gravados.find(w => w.caminho === c)?.campos;
  assert.deepEqual(g('agendamentos/a1'), { clienteNome: 'Cliente removido', clienteTelefone: APAGAR, fotos: [], atualizadoEm: agora });
  const semAutor = Object.fromEntries(['clienteNome', 'clienteUid', 'autorUid', 'clienteFotoUrl', 'clienteBannerUrl', 'comentario', 'inicio'].map(c => [c, APAGAR]));
  assert.deepEqual(g(publica), semAutor);
  assert.deepEqual(g('avaliacoes/a0'), semAutor);
  assert.equal(g('avaliacoes/a1_barbeiro'), undefined);
  assert.ok(apagados.includes('avaliacoes/a1_barbeiro'));
  assert.deepEqual(g('barbearias/b2/barbeiros/ana'), { nome: 'Barbeiro removido', apelido: APAGAR, fotoUrl: APAGAR, bannerUrl: APAGAR, ativo: false });
  assert.deepEqual(g('barbearias/b2'), { barbeirosAtivos: 2, mudouBarbeiro: 'ana' });
  for (const c of ['users/ana', 'notificacoes/n-da-ana', 'notificacoes/a1_agendado_lucas', 'notificacoes/a1_cancelado_dono',
    'notificacoes/a1_avaliar_lucas', 'barbearias/b2/equipePrivado/ana']) assert.ok(apagados.includes(c), c);
  assert.deepEqual(fotosApagadas.sort(), ['corte/a1/lucas-x1.webp', 'perfil/ana/ana-1.webp']); // a de fora do R2 é ignorada

  // Dona de barbearia: não exclui a conta (nem mexe em nada) até excluir a casa.
  docs.set('users/ana', { uid: 'ana', barbearias: ['b3'] });
  docs.set('barbearias/b3', { donoUid: 'ana' });
  gravados.length = 0; apagados.length = 0;
  assert.equal((await excluirConta(db, bucket, 'ana', agora)).status, 409);
  assert.deepEqual([gravados.length, apagados.length], [0, 0]);
});

test('prazos de guarda: métricas e erros 12 meses, avisos 90 dias, convites ao vencer', async () => {
  const { limparAntigos } = await import('./conta');
  const agora = 1_800_000_000_000, DIA = 86_400_000;
  const limites: Record<string, number> = {};
  const apagados: string[] = [];
  const db = {
    query: async (q: { from: { collectionId: string }[]; where: { fieldFilter: { field: { fieldPath: string }; op: string; value: { integerValue: string } } } }) => {
      const c = q.from[0].collectionId;
      assert.deepEqual([q.where.fieldFilter.field.fieldPath, q.where.fieldFilter.op], [c === 'convites' ? 'expiraEm' : 'em', 'LESS_THAN']);
      limites[c] = Number(q.where.fieldFilter.value.integerValue);
      return [{ id: `${c}-velho`, dados: {} }];
    },
    apagar: async (l: string[]) => { apagados.push(...l); },
  } as never;
  await limparAntigos(db, agora);
  assert.deepEqual(limites, { eventos: agora - 365 * DIA, erros: agora - 365 * DIA, notificacoes: agora - 90 * DIA, convites: agora });
  assert.deepEqual(apagados, ['eventos/eventos-velho', 'erros/erros-velho', 'notificacoes/notificacoes-velho', 'convites/convites-velho']);
});

test('excluir barbearia: só o dono; apaga as avaliações, os convites e as fotos da casa e do cardápio', async () => {
  const { excluirDadosBarbearia } = await import('./conta');
  const docs = new Map<string, Record<string, unknown>>([['barbearias/b1', { donoUid: 'dono' }]]);
  const apagados: string[] = [], fotosApagadas: string[] = [], pastas: string[] = [];
  const db = {
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    query: async (q: { from: { collectionId: string }[] }, pai = '') => q.from[0].collectionId === 'servicos'
      ? (assert.equal(pai, 'barbearias/b1'), [{ id: 's1', dados: {} }])
      : q.from[0].collectionId === 'convites' ? [{ id: 'ABCDEF', dados: {} }] : [{ id: 'h1', dados: {} }, { id: 'h2', dados: {} }],
    apagar: async (l: string[]) => { apagados.push(...l); },
  } as never;
  const bucket = {
    list: async ({ prefix }: { prefix: string }) => { pastas.push(prefix); return { objects: [{ key: `${prefix}x.webp` }] }; },
    delete: async (k: string[]) => { fotosApagadas.push(...k); },
  } as never;
  assert.equal((await excluirDadosBarbearia(db, bucket, 'intruso', 'b1')).status, 403);
  assert.deepEqual([apagados.length, fotosApagadas.length], [0, 0]);
  assert.equal((await excluirDadosBarbearia(db, bucket, 'dono', 'b1')).status, 200);
  assert.deepEqual(apagados, ['avaliacoes/h1', 'avaliacoes/h2', 'convites/ABCDEF']);
  assert.deepEqual(pastas, ['barbearia/b1/', 'servico/s1/']);
  assert.deepEqual(fotosApagadas, ['barbearia/b1/x.webp', 'servico/s1/x.webp']);
  assert.equal((await excluirDadosBarbearia(db, bucket, 'dono', 'sumiu')).status, 200); // já excluída: nada a fazer
});

test('WhatsApp do cliente sai do agendamento 24 h depois do fim do horário', async () => {
  const { tirarTelefonesVencidos } = await import('./conta');
  const { APAGAR } = await import('./firestore');
  const agora = 1_800_000_000_000, H = 3_600_000;
  let janela: number[] = [];
  const gravados: { caminho: string; campos: Record<string, unknown> }[] = [];
  const db = {
    query: async (q: { where: { compositeFilter: { filters: { fieldFilter: { field: { fieldPath: string }; value: { integerValue: string } } }[] } } }) => {
      janela = q.where.compositeFilter.filters.map(f => (assert.equal(f.fieldFilter.field.fieldPath, 'fim'), Number(f.fieldFilter.value.integerValue)));
      return [{ id: 'a1', dados: { clienteTelefone: '15999990000' } }, { id: 'a2', dados: {} }];
    },
    escrever: async (l: typeof gravados) => { gravados.push(...l); },
  } as never;
  await tirarTelefonesVencidos(db, agora);
  assert.deepEqual(janela, [agora - 26 * H, agora - 24 * H]); // terminou entre 26 h e 24 h atrás
  assert.deepEqual(gravados, [{ caminho: 'agendamentos/a1', campos: { clienteTelefone: APAGAR } }]); // sem telefone, nem grava
});

test('legado das avaliações antigas: nota do cliente e avaliações entre cliente e barbeiro saem; a da casa fica só com as estrelas', async () => {
  const { limparLegado } = await import('./conta');
  const { APAGAR } = await import('./firestore');
  const apagados: string[] = [];
  const gravados: { caminho: string; campos: Record<string, unknown> }[] = [];
  const db = {
    query: async (q: { from: { collectionId: string }[]; where?: { fieldFilter: { field: { fieldPath: string } } } }) => {
      const c = q.from[0].collectionId, f = q.where?.fieldFilter.field.fieldPath;
      if (c === 'notasCliente') return [{ id: 'ana', dados: {} }];
      if (c === 'users') return (assert.equal(f, 'notaCliente.total'), [{ id: 'ana', dados: {} }]);
      return JSON.stringify(q.where).includes('barbeiro_para_cliente') ? [{ id: 'v1_cliente', dados: {} }] : [{ id: 'v1_barbearia', dados: {} }];
    },
    apagar: async (l: string[]) => { apagados.push(...l); },
    escrever: async (l: typeof gravados) => { gravados.push(...l); },
  } as never;
  await limparLegado(db);
  assert.deepEqual(apagados, ['notasCliente/ana', 'avaliacoes/v1_cliente']);
  const casa = gravados.find(g => g.caminho === 'avaliacoes/v1_barbearia')!.campos;
  for (const c of ['clienteNome', 'clienteUid', 'comentario', 'inicio', 'direcao']) assert.equal(casa[c], APAGAR, c);
  assert.deepEqual(gravados.find(g => g.caminho === 'users/ana')!.campos, { notaCliente: APAGAR });
});

test('baixar meus dados: tudo da própria pessoa, nada consultado por outro uid', async () => {
  const { exportarDados } = await import('./conta');
  const { idAvaliacao } = await import('./avaliacoes');
  const av = `avaliacoes/${await idAvaliacao('b1', 'ana')}`;
  const docs = new Map<string, Record<string, unknown>>([
    ['users/ana', { uid: 'ana', nome: 'Ana', barbearias: ['b2'], avaliouBarbearias: { b1: { estrelas: 5, em: 1 } } }],
    [av, { estrelas: 5 }], ['testes/ana', { em: 1 }],
    ['barbearias/b2/barbeiros/ana', { nome: 'Ana' }], ['barbearias/b2/equipePrivado/ana', { telefone: '15999990000' }],
  ]);
  const db = {
    query: async (q: { from: { collectionId: string }[]; where: { fieldFilter: { value: { stringValue: string } } } }) => {
      assert.equal(q.where.fieldFilter.value.stringValue, 'ana');
      return [{ id: `${q.from[0].collectionId}-1`, dados: { x: 1 } }];
    },
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
  } as never;
  const { corpo } = await exportarDados(db, 'ana', 0);
  assert.equal((corpo.perfil as { nome: string }).nome, 'Ana');
  assert.deepEqual(corpo.agendamentos, [{ id: 'agendamentos-1', x: 1 }]);
  assert.deepEqual([corpo.notificacoes.length, corpo.usoDoApp.length, corpo.errosTecnicos.length], [1, 1, 1]);
  assert.deepEqual(corpo.avaliacoesDeBarbearias, [{ estrelas: 5 }]);
  assert.deepEqual(corpo.testeGratis, { em: 1 });
  assert.deepEqual(corpo.equipes, [{ barbeariaId: 'b2', cartao: { nome: 'Ana' }, privado: { telefone: '15999990000' } }]);
});

test('vencimento: renovou segue; teste ou plano vencido tem 5 dias para regularizar; depois bloqueia', async () => {
  const D = 86_400_000, agora = Date.parse('2027-03-01T12:00:00Z');
  const casas = [
    { id: 'teste3', dados: { emDia: true, assinatura: { status: 'teste', venceEm: agora - 3 * D } } },     // dentro dos 5 dias
    { id: 'teste6', dados: { emDia: true, assinatura: { status: 'teste', venceEm: agora - 6 * D } } },     // passou dos 5 dias
    { id: 'renovou', dados: { emDia: true, assinatura: { status: 'ativa', venceEm: agora - 3600_000 } } },
    { id: 'cancelou', dados: { emDia: true, assinatura: { status: 'ativa', venceEm: agora - 6 * D } } },
  ];
  const compras: Record<string, { estado: string; vence: number }> = {
    renovou: { estado: 'SUBSCRIPTION_STATE_ACTIVE', vence: agora + 30 * D },
    cancelou: { estado: 'SUBSCRIPTION_STATE_EXPIRED', vence: agora - 6 * D },
  };
  const gravado: Record<string, Record<string, unknown>> = {};
  const db = {
    query: async () => casas,
    varios: async (cs: string[]) => new Map(cs.filter(c => compras[c.split('/')[1]]).map(c => [c, { purchaseToken: c.split('/')[1] }])),
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => { for (const w of l) gravado[w.caminho.split('/')[1]] = w.campos; },
  } as never;
  const original = globalThis.fetch;
  globalThis.fetch = (async (u: string) => {
    const id = decodeURIComponent(u.split('/tokens/')[1]);
    const c = compras[id];
    return new Response(JSON.stringify({ subscriptionState: c.estado, externalAccountIdentifiers: { obfuscatedExternalAccountId: id },
      lineItems: [{ productId: 'navalha_solo', expiryTime: new Date(c.vence).toISOString() }] }));
  }) as typeof fetch;
  try { await conferirVencimentos(db, 't', agora); } finally { globalThis.fetch = original; }
  assert.deepEqual(gravado.teste3, { 'assinatura.status': 'vencida', emDia: true });
  assert.deepEqual(gravado.teste6, { 'assinatura.status': 'vencida', emDia: false });
  assert.equal(gravado.renovou.emDia, true);
  assert.equal(gravado.renovou['assinatura.venceEm'], agora + 30 * D);
  assert.equal(gravado.cancelou.emDia, false);
  assert.equal(gravado.cancelou['assinatura.renovaSozinha'], false);
});

test('cupom: só o dono, um uso por casa, respeita limite e não passa por cima de plano pago', async () => {
  const { resgatarCupom } = await import('./assinatura');
  const agora = 1_800_000_000_000, D = 86_400_000;
  const docs = new Map<string, Record<string, unknown>>([
    ['barbearias/b1', { donoUid: 'dono', emDia: true, barbeirosAtivos: 2, assinatura: { status: 'teste', venceEm: agora + D } }],
    ['barbearias/b2', { donoUid: 'dono2', emDia: true, barbeirosAtivos: 1, assinatura: { status: 'ativa', renovaSozinha: true } }],
    ['cupons/PARCEIRO-1ANO', { plano: 'casa_cheia', dias: 365, limite: 2, usos: 0 }],
    ['cupons/SOLO-7', { plano: 'solo', dias: 7, limite: 5, usos: 0 }],
  ]);
  const db = {
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => { for (const w of l) docs.set(w.caminho, { ...(docs.get(w.caminho) ?? {}), ...w.campos }); },
  } as never;
  assert.equal((await resgatarCupom(db, 'intruso', 'b1', 'PARCEIRO-1ANO', agora)).status, 403);
  assert.equal((await resgatarCupom(db, 'dono', 'b1', 'NAOEXISTE', agora)).status, 404);
  assert.equal((await resgatarCupom(db, 'dono', 'b1', 'SOLO-7', agora)).status, 409); // 2 barbeiros ativos, Solo permite 1
  assert.equal((await resgatarCupom(db, 'dono2', 'b2', 'PARCEIRO-1ANO', agora)).status, 409); // plano pago renovando
  const r = await resgatarCupom(db, 'dono', 'b1', ' parceiro-1ano ', agora);
  assert.deepEqual(r.corpo, { plano: 'casa_cheia', nome: 'Casa cheia', venceEm: agora + 365 * D });
  const casa = docs.get('barbearias/b1')!;
  assert.deepEqual([casa['assinatura.status'], casa['assinatura.limiteBarbeiros'], casa.emDia], ['cortesia', 10, true]);
  assert.equal(docs.get('cupons/PARCEIRO-1ANO')!.usos, 1);
  assert.equal((await resgatarCupom(db, 'dono', 'b1', 'PARCEIRO-1ANO', agora)).status, 404); // mesma casa, de novo
});

test('plano vencido: aviso no sino ao entrar nos 5 dias, uma vez só; cortesia não consulta o Google', async () => {
  const { conferirVencimentos } = await import('./assinatura');
  const D = 86_400_000, agora = Date.parse('2027-03-01T12:00:00Z');
  const casas = [
    { id: 'c1', dados: { nome: 'Navalha de Ouro', donoUid: 'dono', emDia: true, assinatura: { status: 'cortesia', venceEm: agora - D } } },
  ];
  const docs = new Map<string, Record<string, unknown>>([['assinaturas/c1', { purchaseToken: 'antigo' }]]);
  const db = {
    query: async () => casas,
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => { for (const w of l) docs.set(w.caminho, w.campos); },
  } as never;
  const original = globalThis.fetch;
  let chamouGoogle = false;
  globalThis.fetch = (async () => { chamouGoogle = true; return new Response('{}'); }) as typeof fetch;
  try {
    await conferirVencimentos(db, 't', agora);
    await conferirVencimentos(db, 't', agora + 3600_000); // próxima hora: não repete
  } finally { globalThis.fetch = original; }
  assert.equal(chamouGoogle, false);
  assert.deepEqual(docs.get('barbearias/c1'), { 'assinatura.status': 'vencida', emDia: true });
  const avisos = [...docs.keys()].filter(k => k.startsWith('notificacoes/'));
  assert.equal(avisos.length, 1);
  const n = docs.get(avisos[0])!;
  assert.equal(n.titulo, 'Plano vencido');
  assert.match(String(n.corpo), /Navalha de Ouro venceu\. Assine até .* para a barbearia não ficar bloqueada\./);
});
