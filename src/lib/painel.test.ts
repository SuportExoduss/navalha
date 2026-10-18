/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPainel } from './painel';
import { paraMillis } from './agenda';
import type { Agendamento } from '../types/models';

const ag = (data: string, status: Agendamento['status'], preco = 4500, servicoNome = 'Degradê', origem: Agendamento['origem'] = 'app') =>
  ({ data, status, precoCentavos: preco, servicoNome, origem }) as Agendamento;

test('painel do dono: hoje, semana, faltas e corte mais pedido', () => {
  const agora = paraMillis('2026-12-20', 10 * 60);
  const p = calcularPainel([
    ag('2026-12-20', 'confirmado'), ag('2026-12-20', 'reservado', 3000, 'Barba'), ag('2026-12-20', 'cancelado'),
    ag('2026-12-18', 'concluido'), ag('2026-12-18', 'concluido', 6000, 'Combo', 'balcao'), ag('2026-12-15', 'faltou'),
    ag('2026-12-10', 'concluido'), // fora da semana
  ], agora);
  assert.deepEqual(p.hoje, { clientes: 2, previstoCentavos: 7500 });
  assert.equal(p.semana.agendamentos, 5);
  assert.equal(p.semana.faturadoCentavos, 10500);
  assert.equal(p.semana.taxaFaltaPercent, 33);
  assert.equal(p.semana.cancelados, 1);
  assert.equal(p.semana.pelaApp, 4);
  assert.deepEqual(p.maisPedido, { nome: 'Degradê', vezes: 3 });
});

test('painel vazio não divide por zero', () => {
  const p = calcularPainel([], paraMillis('2026-12-20', 600));
  assert.equal(p.semana.taxaFaltaPercent, 0);
  assert.equal(p.maisPedido, null);
});
