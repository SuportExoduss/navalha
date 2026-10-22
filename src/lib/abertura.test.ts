import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIMO_LOGADO_MS, esperaRestante } from './abertura';

test('logado espera completar 1,35 s; sem login sai assim que carregar', () => {
  assert.equal(esperaRestante(0, 400, true), MINIMO_LOGADO_MS - 400);
  assert.equal(esperaRestante(0, 2000, true), 0); // internet lenta: a tela demorou mais que o mínimo
  assert.equal(esperaRestante(0, 400, false), 0);
});
