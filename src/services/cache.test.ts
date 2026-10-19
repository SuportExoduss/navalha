import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esquecer, lembrar } from './cache';

test('cache: 2ª leitura em 5 min não vai ao servidor; forçar, expirar e esquecer vão', async () => {
  let leituras = 0;
  const ler = async () => ++leituras;
  assert.equal(await lembrar('casa:a', ler, { agora: 0 }), 1);
  assert.equal(await lembrar('casa:a', ler, { agora: 60_000 }), 1);
  assert.equal(await lembrar('casa:a', ler, { agora: 60_000, forcar: true }), 2);
  assert.equal(await lembrar('casa:a', ler, { agora: 60_000 + 5 * 60_000 }), 3);
  esquecer('casa:');
  assert.equal(await lembrar('casa:a', ler, { agora: 400_000 }), 4);
});

test('cache: leitura que falhou não fica guardada', async () => {
  await assert.rejects(lembrar('x', async () => { throw new Error('rede'); }, { agora: 0 }));
  assert.equal(await lembrar('x', async () => 'ok', { agora: 1 }), 'ok');
});
