/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarHorarios, chavesOcupacao, paraMillis, formatarHora, agruparPorPeriodo,
  primeiroHorarioDaCasa, formatarPreco, expedienteEfetivo, validarExpediente, proximosDias,
  intervaloFolga, rotuloDia, normalizarHora, cancelamentoGratis, somarDias, normalizarData, formatarData,
} from './agenda';
import type { Expediente } from '../types/models';

// 2026-11-05 é quinta-feira (dia 4).
const DATA = '2026-11-05';
const exp: Expediente = { 4: { abre: '09:00', fecha: '12:00', pausas: [{ inicio: '10:30', fim: '10:45' }] } };
const ontem = paraMillis('2026-11-04', 0);
const horas = (l: number[]) => l.map(h => formatarHora(h));

test('gera inícios a cada 15 min onde o corte inteiro cabe, fora da pausa', () => {
  const h = gerarHorarios({ data: DATA, expediente: exp, duracaoMin: 45, passoMin: 15, ocupados: [], agora: ontem, antecedenciaMin: 30 });
  assert.deepEqual(horas(h), ['09:00', '09:15', '09:30', '09:45', '10:45', '11:00', '11:15']);
});

test('remove horários que se sobrepõem a um agendamento existente', () => {
  const ocupado = { inicio: paraMillis(DATA, 9 * 60 + 30), fim: paraMillis(DATA, 10 * 60) };
  const h = gerarHorarios({ data: DATA, expediente: exp, duracaoMin: 30, passoMin: 15, ocupados: [ocupado], agora: ontem, antecedenciaMin: 0 });
  assert.deepEqual(horas(h), ['09:00', '10:00', '10:45', '11:00', '11:15', '11:30']);
});

test('respeita antecedência mínima', () => {
  const agora = paraMillis(DATA, 9 * 60 + 50);
  const h = gerarHorarios({ data: DATA, expediente: exp, duracaoMin: 30, passoMin: 15, ocupados: [], agora, antecedenciaMin: 30 });
  assert.equal(horas(h)[0], '10:45');
});

test('dia fechado não gera horários', () => {
  assert.deepEqual(gerarHorarios({ data: '2026-11-08', expediente: exp, duracaoMin: 30, passoMin: 15, ocupados: [], agora: ontem, antecedenciaMin: 0 }), []);
});

test('atendimentos sobrepostos sempre compartilham uma chave de ocupação', () => {
  const a = chavesOcupacao('b1', paraMillis(DATA, 9 * 60), 45, 15);
  assert.deepEqual(a, ['b1_2026-11-05_0900', 'b1_2026-11-05_0915', 'b1_2026-11-05_0930']);
  for (let inicio = 8 * 60; inicio < 10 * 60; inicio += 15) {
    for (const dur of [15, 20, 30, 45, 60]) {
      const b = chavesOcupacao('b1', paraMillis(DATA, inicio), dur, 15);
      const sobrepoe = inicio < 9 * 60 + 45 && 9 * 60 < inicio + dur;
      assert.equal(a.some(k => b.includes(k)), sobrepoe, `início ${inicio} dur ${dur}`);
    }
  }
});

test('barbeiros diferentes nunca colidem', () => {
  const a = chavesOcupacao('b1', paraMillis(DATA, 600), 30, 15);
  const b = chavesOcupacao('b2', paraMillis(DATA, 600), 30, 15);
  assert.equal(a.some(k => b.includes(k)), false);
});

test('qualquer barbeiro escolhe o primeiro horário livre da casa', () => {
  const r = primeiroHorarioDaCasa({ lucas: [paraMillis(DATA, 660)], rafael: [paraMillis(DATA, 600)], bruno: [] });
  assert.equal(r?.barbeiroId, 'rafael');
});

test('agrupa manhã, tarde e noite; formata preço', () => {
  const g = agruparPorPeriodo([paraMillis(DATA, 9 * 60), paraMillis(DATA, 14 * 60), paraMillis(DATA, 19 * 60)]);
  assert.deepEqual([g.manha.length, g.tarde.length, g.noite.length], [1, 1, 1]);
  assert.equal(formatarPreco(4500), 'R$ 45,00');
});

// ---------- Sprint 3 ----------

test('expediente do barbeiro é recortado pelo horário da casa, somando as pausas', () => {
  const casa: Expediente = { 4: { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] }, 5: { abre: '09:00', fecha: '19:00' } };
  const barbeiro: Expediente = { 4: { abre: '08:00', fecha: '17:00', pausas: [{ inicio: '15:00', fim: '15:30' }] }, 6: { abre: '09:00', fecha: '12:00' } };
  const e = expedienteEfetivo(casa, barbeiro);
  assert.deepEqual(e[4], { abre: '09:00', fecha: '17:00', pausas: [{ inicio: '12:00', fim: '13:00' }, { inicio: '15:00', fim: '15:30' }] });
  assert.equal(e[5], undefined); // barbeiro folga na sexta
  assert.equal(e[6], undefined); // casa fechada no sábado
});

test('horários respeitam o expediente efetivo', () => {
  const casa: Expediente = { 4: { abre: '09:00', fecha: '12:00' } };
  const barbeiro: Expediente = { 4: { abre: '10:00', fecha: '18:00' } };
  const h = gerarHorarios({ data: DATA, expediente: expedienteEfetivo(casa, barbeiro), duracaoMin: 60, passoMin: 30, ocupados: [], agora: ontem, antecedenciaMin: 0 });
  assert.deepEqual(horas(h), ['10:00', '10:30', '11:00']);
});

test('valida expediente digitado', () => {
  assert.equal(validarExpediente({ 2: { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] } }), null);
  assert.match(validarExpediente({ 2: { abre: '19:00', fecha: '09:00' } }) ?? '', /Terça/);
  assert.match(validarExpediente({ 3: { abre: '09:00', fecha: '12:00', pausas: [{ inicio: '13:00', fim: '14:00' }] } }) ?? '', /pausa/);
});

test('folga de dia inteiro bloqueia todos os horários do dia e só dele', () => {
  const folga = intervaloFolga(DATA, DATA);
  const base = { expediente: exp, duracaoMin: 30, passoMin: 15, ocupados: [folga], agora: ontem, antecedenciaMin: 0 };
  assert.deepEqual(gerarHorarios({ ...base, data: DATA }), []);
  const quintaSeguinte = somarDias(DATA, 7);
  assert.ok(gerarHorarios({ ...base, data: quintaSeguinte }).length > 0);
});

test('calendário: próximos dias, rótulos e virada de mês', () => {
  const agora = paraMillis('2026-11-29', 23 * 60 + 30);
  assert.deepEqual(proximosDias(agora, 3), ['2026-11-29', '2026-11-30', '2026-12-01']);
  assert.equal(rotuloDia('2026-11-29', '2026-11-29'), 'Hoje');
  assert.equal(rotuloDia('2026-11-30', '2026-11-29'), 'Amanhã');
  assert.equal(rotuloDia('2026-12-04', '2026-11-29'), 'Sex 04/12');
});

test('hora digitada vira HH:MM', () => {
  assert.equal(normalizarHora('9'), '09:00');
  assert.equal(normalizarHora('930'), '09:30');
  assert.equal(normalizarHora('18:45'), '18:45');
  assert.equal(normalizarHora('25'), null);
  assert.equal(normalizarHora('12:75'), null);
});

test('cancelamento grátis respeita a antecedência da casa', () => {
  const inicio = paraMillis(DATA, 10 * 60);
  assert.equal(cancelamentoGratis(inicio, inicio - 3 * 3_600_000, 2), true);
  assert.equal(cancelamentoGratis(inicio, inicio - 3_600_000, 2), false);
});

test('data digitada vira YYYY-MM-DD, pulando para o próximo ano se já passou', () => {
  assert.equal(normalizarData('06/11', '2026-10-17'), '2026-11-06');
  assert.equal(normalizarData('05/01', '2026-10-17'), '2027-01-05');
  assert.equal(normalizarData('31/02', '2026-10-17'), null);
  assert.equal(normalizarData('10/12/2026', '2026-10-17'), '2026-12-10');
  assert.equal(formatarData('2026-11-06'), 'Sex 06/11');
  assert.equal(formatarData('2026-11-06', '2026-01-01'), 'Sex 06/11');
  assert.equal(formatarData('2027-10-25', '2026-10-25'), 'Seg 25/10/2027');
});
