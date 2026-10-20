/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveFoto, janelasLembrete, mensagemFcm, mensagemLembrete, tipoDaImagem } from './util';
import { validarClaims, decodificarParte, type Claims } from './auth';
import { Firestore, lerValor } from './firestore';
import { camposDaCasa, lerCompra } from './assinatura';

test('chave da foto aceita só tipos e ids seguros', () => {
  assert.equal(chaveFoto('corte', 'uid123', 'ag_1', 'abc-1'), 'corte/ag_1/uid123-abc-1.webp');
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

test('avisos: só o cliente avisa; barbeiro e dono recebem uma vez; aviso velho é ignorado', async () => {
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
  } finally { globalThis.fetch = original; }
});
