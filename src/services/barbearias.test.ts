/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarCodigo, linksDeRota, precoParaCentavos, resumoDoCardapio } from './barbearias';

test('preço digitado vira centavos', () => {
  assert.equal(precoParaCentavos('45'), 4500);
  assert.equal(precoParaCentavos('45,90'), 4590);
  assert.equal(precoParaCentavos('R$ 1.200,00'), 120000);
  assert.equal(precoParaCentavos(''), null);
  assert.equal(precoParaCentavos('abc'), null);
  assert.equal(precoParaCentavos('99999'), null);
});

test('código de convite tem 6 caracteres sem 0, O, 1 ou I', () => {
  for (let i = 0; i < 200; i++) assert.match(gerarCodigo(), /^[A-HJ-NP-Z2-9]{6}$/);
});

test('resumo do cardápio ignora serviços pausados', () => {
  const r = resumoDoCardapio([
    { precoCentavos: 4000, fotos: ['a'], ativo: true, categoria: 'cabelo' },
    { precoCentavos: 7000, fotos: ['b', 'c'], ativo: true, categoria: 'combo' },
    { precoCentavos: 1000, fotos: ['z'], ativo: false, categoria: 'barba' },
  ]);
  assert.deepEqual(r, { precoMin: 4000, precoMax: 7000, fotosDestaque: ['a', 'b', 'c'], categorias: ['cabelo', 'combo'] });
  assert.deepEqual(resumoDoCardapio([]), { fotosDestaque: [], categorias: [] });
});

test('Ver no mapa: Google Maps, Waze e Uber com o destino da casa', () => {
  const [maps, waze, uber] = linksDeRota(-23.6, -47.2, 'Navalha & Cia');
  assert.match(maps.url, /destination=-23\.6,-47\.2/);
  assert.match(waze.url, /ll=-23\.6,-47\.2/);
  assert.match(uber.url, /dropoff\[latitude\]=-23\.6&dropoff\[longitude\]=-47\.2&dropoff\[nickname\]=Navalha%20%26%20Cia$/);
  assert.deepEqual([maps.esquema, waze.esquema, uber.esquema], [undefined, 'waze://', 'uber://']);
});
