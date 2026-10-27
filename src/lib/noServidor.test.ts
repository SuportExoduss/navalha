import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM_CONEXAO, noServidor } from './noServidor';

test('noServidor: espera o aceite; sem resposta, para com o aviso de conexão', async () => {
  assert.equal(await noServidor(Promise.resolve(7), 50), 7);
  await assert.rejects(noServidor(new Promise(() => undefined), 10), { message: SEM_CONEXAO });
  await assert.rejects(noServidor(Promise.reject(new Error('negado')), 50), { message: 'negado' });
});
