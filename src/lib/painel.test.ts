/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intervaloDoPainel, intervaloDoPeriodo, resumir } from './painel';
import type { Agendamento } from '../types/models';

const ag = (data: string, status: Agendamento['status'], preco = 4500, servicoNome = 'Degradê', origem: Agendamento['origem'] = 'app') =>
  ({ data, status, precoCentavos: preco, servicoNome, origem }) as Agendamento;

test('períodos: hoje; semana de segunda a domingo; mês do dia 1 até hoje', () => {
  // 2026-12-02 é quarta.
  assert.deepEqual(intervaloDoPeriodo('dia', '2026-12-02'), { de: '2026-12-02', ate: '2026-12-02' });
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-02'), { de: '2026-11-30', ate: '2026-12-06' });
  assert.deepEqual(intervaloDoPeriodo('mes', '2026-12-02'), { de: '2026-12-01', ate: '2026-12-02' });
  // Domingo fecha a semana que começou na segunda anterior; segunda abre a nova.
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-06'), { de: '2026-11-30', ate: '2026-12-06' });
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-07'), { de: '2026-12-07', ate: '2026-12-13' });
  // A escuta cobre a semana que começou no mês anterior e o mês inteiro até domingo.
  assert.deepEqual(intervaloDoPainel('2026-12-02'), { de: '2026-11-30', ate: '2026-12-06' });
  assert.deepEqual(intervaloDoPainel('2026-12-20'), { de: '2026-12-01', ate: '2026-12-20' });
});

test('resumo: conta só o período, separa faturado do que falta receber', () => {
  const hoje = '2026-12-16'; // quarta; semana 14 a 20
  const l = [
    ag('2026-12-16', 'confirmado'), ag('2026-12-16', 'reservado', 3000, 'Barba'), ag('2026-12-16', 'cancelado'),
    ag('2026-12-14', 'concluido'), ag('2026-12-14', 'concluido', 6000, 'Combo', 'balcao'), ag('2026-12-15', 'faltou'),
    ag('2026-12-19', 'reservado'), // sábado, ainda nesta semana
    ag('2026-12-02', 'concluido'), // só no mês
  ];
  const dia = resumir(l, 'dia', hoje);
  assert.equal(dia.agendamentos, 2);
  assert.equal(dia.aReceberCentavos, 7500);
  assert.equal(dia.cancelados, 1);
  const semana = resumir(l, 'semana', hoje);
  assert.equal(semana.agendamentos, 6);
  assert.equal(semana.faturadoCentavos, 10500);
  assert.equal(semana.aReceberCentavos, 12000);
  assert.equal(semana.taxaFaltaPercent, 33);
  assert.equal(semana.pelaApp, 5);
  assert.deepEqual(semana.maisPedido, { nome: 'Degradê', vezes: 4 });
  const mes = resumir(l, 'mes', hoje);
  assert.equal(mes.agendamentos, 6); // dia 2 + até hoje (o sábado 19 ainda não chegou)
  assert.equal(mes.faturadoCentavos, 15000);
});

test('resumo vazio não divide por zero', () => {
  const r = resumir([], 'mes', '2026-12-20');
  assert.equal(r.taxaFaltaPercent, 0);
  assert.equal(r.maisPedido, null);
});
