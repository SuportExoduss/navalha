/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveFoto, janelasLembrete, mensagemFcm, mensagemLembrete, tipoDaImagem } from './util';
import { validarClaims, decodificarParte, type Claims } from './auth';
import { Firestore, lerValor } from './firestore';

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
