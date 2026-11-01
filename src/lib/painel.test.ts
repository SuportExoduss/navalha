/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doDetalhe, fimDoMes, intervaloDoPainel, intervaloDoPeriodo, porServico, resumir, semanasDoMes } from './painel';
import type { Agendamento } from '../types/models';

const ag = (data: string, status: Agendamento['status'], preco = 4500, servicoNome = 'Degradê', origem: Agendamento['origem'] = 'app') =>
  ({ data, status, precoCentavos: preco, servicoNome, origem }) as Agendamento;

test('períodos: hoje; semana de segunda a domingo; mês inteiro', () => {
  // 2026-12-02 é quarta.
  assert.deepEqual(intervaloDoPeriodo('dia', '2026-12-02'), { de: '2026-12-02', ate: '2026-12-02' });
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-02'), { de: '2026-11-30', ate: '2026-12-06' });
  assert.deepEqual(intervaloDoPeriodo('mes', '2026-12-02'), { de: '2026-12-01', ate: '2026-12-31' });
  assert.equal(fimDoMes('2028-02-10'), '2028-02-29');
  assert.equal(fimDoMes('2026-11-30'), '2026-11-30');
  // Domingo fecha a semana que começou na segunda anterior; segunda abre a nova.
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-06'), { de: '2026-11-30', ate: '2026-12-06' });
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-12-07'), { de: '2026-12-07', ate: '2026-12-13' });
  // A escuta cobre a semana que começou ou termina fora do mês e o mês inteiro.
  assert.deepEqual(intervaloDoPainel('2026-12-02'), { de: '2026-11-30', ate: '2026-12-31' });
  assert.deepEqual(intervaloDoPainel('2026-12-30'), { de: '2026-12-01', ate: '2027-01-03' });
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
  assert.equal(mes.agendamentos, 7); // o mês inteiro, com o sábado 19 que ainda vem
  assert.equal(mes.faturadoCentavos, 15000);
  assert.equal(mes.aReceberCentavos, 12000);
});

test('resumo vazio não divide por zero', () => {
  const r = resumir([], 'mes', '2026-12-20');
  assert.equal(r.taxaFaltaPercent, 0);
  assert.equal(r.maisPedido, null);
});

test('calendário: um dia escolhido, inclusive fora da semana e do mês', () => {
  const l = [ag('2026-10-05', 'concluido'), ag('2026-10-05', 'reservado'), ag('2026-10-06', 'concluido')];
  assert.deepEqual(intervaloDoPeriodo('calendario', '2026-12-02', '2026-10-05'), { de: '2026-10-05', ate: '2026-10-05' });
  const r = resumir(l, 'calendario', '2026-12-02', '2026-10-05');
  assert.equal(r.agendamentos, 2);
  assert.equal(r.faturadoCentavos, 4500);
  // Sem dia escolhido, "calendário" é hoje.
  assert.equal(resumir(l, 'calendario', '2026-10-06').agendamentos, 1);
});

test('semanasDoMes: começa no domingo, preenche com null e cobre o mês todo', () => {
  // Novembro/2026 começa num domingo e tem 30 dias.
  const nov = semanasDoMes('2026-11-17');
  assert.equal(nov[0][0], '2026-11-01');
  assert.equal(nov.flat().filter(Boolean).length, 30);
  assert.ok(nov.every(s => s.length === 7));
  // Outubro/2026 começa numa quinta: 4 vazios antes do dia 1.
  const out = semanasDoMes('2026-10-01');
  assert.deepEqual(out[0].slice(0, 5), [null, null, null, null, '2026-10-01']);
  assert.equal(out.at(-1)!.filter(Boolean).at(-1), '2026-10-31');
  // Fevereiro bissexto.
  assert.equal(semanasDoMes('2028-02-10').flat().filter(Boolean).length, 29);
});

test('detalhe: cada número abre só o que ele soma, por horário', () => {
  const l = (['concluido', 'reservado', 'cancelado', 'faltou', 'confirmado', 'pago'] as const)
    .map((status, i) => ({ status, inicio: 100 - i }) as Agendamento);
  const st = (d: Parameters<typeof doDetalhe>[1]) => doDetalhe(l, d).map(a => a.status);
  assert.deepEqual(st('agendamentos'), ['pago', 'confirmado', 'faltou', 'reservado', 'concluido']);
  assert.deepEqual(st('faturado'), ['concluido']);
  assert.deepEqual(st('receber'), ['pago', 'confirmado', 'reservado']);
  assert.deepEqual(st('faltas'), ['faltou', 'cancelado']);
});

test('serviços do período: sem cancelados, do mais pedido ao menos', () => {
  const r = porServico([ag('2026-12-01', 'concluido', 3000, 'Barba'), ag('2026-12-01', 'reservado'), ag('2026-12-02', 'faltou'),
    ag('2026-12-02', 'cancelado', 3000, 'Barba'), ag('2026-12-03', 'cancelado', 3000, 'Barba')]);
  assert.deepEqual(r, [{ nome: 'Degradê', vezes: 2, centavos: 9000 }, { nome: 'Barba', vezes: 1, centavos: 3000 }]);
});
