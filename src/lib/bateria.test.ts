import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passosBateria } from './bateria';

test('bateria: cada marca recebe o passo do lugar certo', () => {
  assert.match(passosBateria('Xiaomi')[0], /Início automático/);
  assert.match(passosBateria('POCO')[0], /Início automático/);
  assert.match(passosBateria('samsung')[0], /Bateria/);
  assert.match(passosBateria('motorola')[0], /Sem restrições/);
  assert.match(passosBateria(null)[0], /Sem restrições/); // marca desconhecida: o passo genérico
  for (const m of ['Xiaomi', 'samsung', 'motorola', 'OPPO', 'HONOR']) assert.match(passosBateria(m).at(-1)!, /Notificações/);
});
