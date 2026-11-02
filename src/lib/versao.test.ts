import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precisaAtualizar } from './versao';

test('versão atrás da mínima precisa atualizar; igual ou à frente, não', () => {
  assert.equal(precisaAtualizar('0.4.8', '0.4.9'), true);
  assert.equal(precisaAtualizar('0.4.9', '0.4.10'), true); // número, não texto
  assert.equal(precisaAtualizar('0.4.9', '0.5'), true);
  assert.equal(precisaAtualizar('0.4.9', '0.4.9'), false);
  assert.equal(precisaAtualizar('0.4.10', '0.4.9'), false);
  assert.equal(precisaAtualizar('1.0', '0.9.9'), false);
});

test('na dúvida não bloqueia', () => {
  assert.equal(precisaAtualizar(undefined, '0.4.9'), false);
  assert.equal(precisaAtualizar('0.4.8', undefined), false);
  assert.equal(precisaAtualizar('0.4.8', ''), false);
  assert.equal(precisaAtualizar('0.4.8', 'abc'), false);
  assert.equal(precisaAtualizar('?', '0.4.9'), false);
});
