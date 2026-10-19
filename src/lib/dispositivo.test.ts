import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehAndroidNoNavegador, mostrarAvisoApp } from './dispositivo';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; 23124RA7EO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

test('aviso do app: só Android no navegador', () => {
  assert.equal(ehAndroidNoNavegador(ANDROID, false), true);
  assert.equal(ehAndroidNoNavegador(ANDROID, true), false); // já aberto como app da Tela de Início
  assert.equal(ehAndroidNoNavegador(IPHONE, false), false);
  assert.equal(ehAndroidNoNavegador(PC, false), false);
});

test('aviso do app: fechado volta só depois de 7 dias', () => {
  const dia = 86_400_000;
  assert.equal(mostrarAvisoApp(null, 0), true);
  assert.equal(mostrarAvisoApp(0, 3 * dia), false);
  assert.equal(mostrarAvisoApp(0, 8 * dia), true);
});
