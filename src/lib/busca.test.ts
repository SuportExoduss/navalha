/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTROS_PADRAO, abertaAgora, atendeAindaHoje, contarFiltros, filtrarBarbearias } from './busca';
import { paraMillis } from './agenda';
import type { Barbearia } from '../types/models';

// 2026-11-05 é quinta-feira (dia 4).
const exp = { 4: { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] } };
const casa = (id: string, extra: Partial<Barbearia['resumo']> & { km: number; nome?: string }) => ({
  id, nome: extra.nome ?? id, endereco: 'Rua A', cidade: 'Sorocaba', expediente: exp, antecedenciaMin: 30,
  resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [], ...extra }, distanciaKm: extra.km,
}) as unknown as Barbearia & { distanciaKm: number };

const lista = [
  casa('barata', { km: 0.8, precoMin: 2500, precoMax: 3500, categorias: ['cabelo'] }),
  casa('media', { km: 2.5, precoMin: 4000, precoMax: 6000, categorias: ['cabelo', 'barba'], nome: 'Barbearia São João' }),
  casa('cara', { km: 7, precoMin: 8000, precoMax: 12000, categorias: ['combo'] }),
  casa('vazia', { km: 4 }),
];
const ids = (l: { id: string }[]) => l.map(b => b.id);
const quinta10h = paraMillis('2026-11-05', 10 * 60);

test('raio e texto (sem acento)', () => {
  assert.deepEqual(ids(filtrarBarbearias(lista, { ...FILTROS_PADRAO, raioKm: 3 }, quinta10h)), ['barata', 'media']);
  // Sem filtro de distância, a mais longe também aparece.
  assert.ok(filtrarBarbearias([{ ...lista[0], id: 'longe', distanciaKm: 250 }], FILTROS_PADRAO, quinta10h).length === 1);
  assert.deepEqual(ids(filtrarBarbearias(lista, { ...FILTROS_PADRAO, texto: 'sao joao' }, quinta10h)), ['media']);
});

test('categoria e faixa de preço', () => {
  assert.deepEqual(ids(filtrarBarbearias(lista, { ...FILTROS_PADRAO, categoria: 'barba' }, quinta10h)), ['media']);
  assert.deepEqual(ids(filtrarBarbearias(lista, { ...FILTROS_PADRAO, preco: 'ate40' }, quinta10h)), ['barata', 'media']);
  assert.deepEqual(ids(filtrarBarbearias(lista, { ...FILTROS_PADRAO, preco: '70mais' }, quinta10h)), ['cara']);
});

test('aberto agora respeita expediente e pausa', () => {
  const b = { expediente: exp };
  assert.equal(abertaAgora(b, quinta10h), true);
  assert.equal(abertaAgora(b, paraMillis('2026-11-05', 12 * 60 + 30)), false); // almoço
  assert.equal(abertaAgora(b, paraMillis('2026-11-05', 19 * 60)), false);
  assert.equal(abertaAgora(b, paraMillis('2026-11-06', 10 * 60)), false); // sexta fechada
});

test('ainda hoje considera a antecedência', () => {
  const b = { expediente: exp, antecedenciaMin: 30 };
  assert.equal(atendeAindaHoje(b, paraMillis('2026-11-05', 18 * 60)), true);
  assert.equal(atendeAindaHoje(b, paraMillis('2026-11-05', 18 * 60 + 40)), false);
  assert.equal(contarFiltros({ ...FILTROS_PADRAO, raioKm: 3, abertoAgora: true }), 2);
});
