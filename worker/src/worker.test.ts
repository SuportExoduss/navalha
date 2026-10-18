/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveFoto, janelasLembrete, mensagemLembrete } from './util';
import { validarClaims, decodificarParte, type Claims } from './auth';
import { lerValor } from './firestore';

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
