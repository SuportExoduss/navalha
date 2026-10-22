/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveFoto, janelasLembrete, mensagemFcm, mensagemLembrete, tipoDaImagem } from './util';
import { validarClaims, decodificarParte, type Claims } from './auth';
import { Firestore, lerValor } from './firestore';
import { camposDaCasa, lerCompra } from './assinatura';

test('chave da foto aceita só tipos e ids seguros', () => {
  assert.equal(chaveFoto('corte', 'uid123', 'ag_1', 'abc-1'), 'corte/ag_1/uid123-abc-1.webp');
  assert.equal(chaveFoto('banner', 'uid123', 'uid123', 'abc-1'), 'banner/uid123/uid123-abc-1.webp');
  assert.equal(chaveFoto('virus', 'u', 'r', 'i'), null);
  assert.equal(chaveFoto('corte', 'u', '../../segredo', 'i'), null);
  assert.equal(chaveFoto('corte', 'u/x', 'r', 'i'), null);
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
    'assinatura.limiteBarbeiros': 3, emDia: true,
  });
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
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => { for (const w of l) docs.set(w.caminho, w.campos); },
  } as never;
  const pushes: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init?: RequestInit) => { pushes.push(JSON.parse(String(init?.body)).message.token); return new Response('{}'); }) as typeof fetch;
  try {
    assert.equal((await avisarAgendamento(db, 't', 'p', 'intruso', 'a1', agora)).status, 403);
    const r = await avisarAgendamento(db, 't', 'p', 'ana', 'a1', agora);
    assert.deepEqual(r.corpo, { enviados: 2 });
    assert.equal((docs.get('notificacoes/a1_agendado_dono') as { corpo: string }).corpo.includes('com Lucas'), true);
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
  } finally { globalThis.fetch = original; }
});

test('avaliar: só o cliente de um atendimento concluído, uma vez; notas da casa e do barbeiro somam', async () => {
  const { avaliar } = await import('./avaliacoes');
  const agora = 1_800_000_000_000;
  const docs = new Map<string, Record<string, unknown>>([
    ['agendamentos/a1', { clienteUid: 'ana', clienteNome: 'Ana Souza', status: 'concluido', fim: agora - 3_600_000, barbeariaId: 'b1', barbeiroId: 'lucas' }],
    ['agendamentos/a2', { clienteUid: 'ana', status: 'reservado', fim: agora + 3_600_000, barbeariaId: 'b1', barbeiroId: 'lucas' }],
    ['barbearias/b1', { resumo: { notaApp: 4, totalAvaliacoesApp: 1, notaGoogle: 4.8, totalAvaliacoesGoogle: 100 } }],
    ['barbearias/b1/barbeiros/lucas', { nota: { media: 0, total: 0 } }],
  ]);
  const db = {
    varios: async (cs: string[]) => new Map(cs.filter(c => docs.has(c)).map(c => [c, docs.get(c)!])),
    escrever: async (l: { caminho: string; campos: Record<string, unknown> }[]) => {
      for (const w of l) {
        const d = { ...(docs.get(w.caminho) ?? {}) } as Record<string, unknown>;
        for (const [k, v] of Object.entries(w.campos)) {
          const [a, b] = k.split('.');
          if (b) d[a] = { ...(d[a] as object), [b]: v }; else d[a] = v;
        }
        docs.set(w.caminho, d);
      }
    },
  } as never;
  assert.equal((await avaliar(db, 'beto', 'a1', 5, '', agora)).status, 403);
  assert.equal((await avaliar(db, 'ana', 'a2', 5, '', agora)).status, 409); // ainda não concluído
  assert.equal((await avaliar(db, 'ana', 'a1', 9, '', agora)).status, 400);
  assert.equal((await avaliar(db, 'ana', 'a1', 5, '  Ótimo degradê  ', agora)).status, 200);
  const r = docs.get('barbearias/b1')!.resumo as Record<string, number>;
  assert.deepEqual([r.notaApp, r.totalAvaliacoesApp], [4.5, 2]);
  assert.ok(r.notaRanking > 4 && r.notaRanking < 5);
  assert.deepEqual(docs.get('barbearias/b1/barbeiros/lucas')!.nota, { media: 5, total: 1 });
  const av = docs.get('avaliacoes/a1') as Record<string, unknown>;
  assert.deepEqual([av.clienteNome, av.comentario, av.visivel], ['Ana', 'Ótimo degradê', true]);
  assert.equal((await avaliar(db, 'ana', 'a1', 1, '', agora)).status, 409); // não avalia duas vezes
});

test('nota do Google: no máximo 1 vez por dia por casa, gravada numa chamada só', async () => {
  const { atualizarNotasGoogle } = await import('./avaliacoes');
  const agora = 1_800_000_000_000;
  const casas = [
    { id: 'b1', dados: { googlePlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', resumo: { notaApp: 5, totalAvaliacoesApp: 1 } } },
    { id: 'b2', dados: { googlePlaceId: 'ChIJxxxxxxxxxxxxxxxxxxxx', googleAtualizadoEm: agora - 3_600_000 } }, // já foi hoje
    { id: 'b3', dados: { googlePlaceId: '../nao?x=1' } }, // inválido: não chama o Google
  ];
  const gravados: { caminho: string; campos: Record<string, unknown> }[][] = [];
  const db = { query: async () => casas, escrever: async (l: never[]) => { gravados.push(l); } } as never;
  const chamadas: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (u: string) => { chamadas.push(u); return new Response(JSON.stringify({ rating: 4.7, userRatingCount: 120 })); }) as typeof fetch;
  try {
    await atualizarNotasGoogle(db, undefined, agora);
    assert.equal(gravados.length, 0); // sem chave, nada
    await atualizarNotasGoogle(db, 'chave', agora);
    assert.deepEqual(chamadas, ['https://places.googleapis.com/v1/places/ChIJN1t_tDeuEmsRUsoyG83frY4']);
    assert.equal(gravados.length, 1);
    const [b1, b3] = gravados[0];
    assert.deepEqual([b1.caminho, b1.campos['resumo.notaGoogle'], b1.campos['resumo.totalAvaliacoesGoogle']], ['barbearias/b1', 4.7, 120]);
    assert.deepEqual(b3.campos, { googleAtualizadoEm: agora });
  } finally { globalThis.fetch = original; }
});
