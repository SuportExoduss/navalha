/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvDoMes, htmlDoMes, htmlDosMeses, intervaloDoMes, nomeDoArquivo } from './exportar';
import { hhmmParaMin, paraMillis } from './agenda';
import type { Agendamento } from '../types/models';

const ag = (data: string, hora: string, status: Agendamento['status'], extra: Partial<Agendamento> = {}) =>
  ({ data, inicio: paraMillis(data, hhmmParaMin(hora)), status, barbeiroNome: 'João', clienteNome: 'Ana', servicoNome: 'Degradê',
    precoCentavos: 4500, origem: 'app', ...extra }) as Agendamento;

test('intervalo do mês para a consulta', () => {
  assert.deepEqual(intervaloDoMes('2026-10'), { de: '2026-10-01', ate: '2026-10-31' });
});

test('CSV: BOM, ";", ordem por horário, valor com vírgula e campo com ";" ou aspas entre aspas', () => {
  const csv = csvDoMes([
    ag('2026-10-05', '14:00', 'concluido'),
    ag('2026-10-02', '09:30', 'faltou', { clienteNome: 'Zé "Bigode"; Jr', origem: 'balcao', precoCentavos: 3000 }),
    ag('2026-10-07', '10:00', 'cancelado', { cancelamento: { por: 'cliente', motivo: 'Viagem', em: 0 } }),
  ]);
  assert.ok(csv.startsWith('﻿'));
  const linhas = csv.slice(1).trimEnd().split('\r\n');
  assert.equal(linhas[0], 'Data;Hora;Barbeiro;Cliente;Serviço;Valor (R$);Status;Origem;Cancelamento');
  assert.equal(linhas[1], '02/10/2026;09:30;João;"Zé ""Bigode""; Jr";Degradê;30,00;Faltou;Balcão;');
  assert.equal(linhas[2], '05/10/2026;14:00;João;Ana;Degradê;45,00;Concluído;App;');
  assert.equal(linhas[3], '07/10/2026;10:00;João;Ana;Degradê;45,00;Cancelado;App;Cliente: Viagem');
});

test('CSV vazio tem só o cabeçalho', () => {
  assert.equal(csvDoMes([]).slice(1).trimEnd().split('\r\n').length, 1);
});

test('HTML: números do resumo, linhas e texto escapado', () => {
  const html = htmlDoMes('2026-10', 'Barbearia <Top>', [ag('2026-10-05', '14:00', 'concluido'), ag('2026-10-06', '10:00', 'cancelado')]);
  assert.match(html, /Resumo de outubro/i);
  assert.match(html, /Barbearia &lt;Top&gt;/);
  assert.match(html, /R\$ 45,00/);
  assert.equal((html.match(/<tr><td>/g) ?? []).length, 2);
  assert.match(htmlDoMes('2026-10', 'X', []), /Nenhum agendamento/);
});

test('HTML de vários meses: uma seção por mês, do mais antigo ao mais novo, cada uma só com o dela', () => {
  const html = htmlDosMeses(['2026-10', '2026-09'], 'Casa', [ag('2026-09-03', '10:00', 'concluido', { clienteNome: 'Bia' }), ag('2026-10-05', '14:00', 'concluido')]);
  assert.match(html, /<title>Resumos de setembro de 2026 a outubro de 2026/);
  const secoes = html.split('<section>').slice(1);
  assert.equal(secoes.length, 2);
  assert.match(secoes[0], /setembro/); assert.match(secoes[0], /Bia/); assert.doesNotMatch(secoes[0], /Ana/);
  assert.match(secoes[1], /outubro/); assert.match(secoes[1], /Ana/);
});

test('nome do arquivo sem acento nem espaço', () => {
  assert.equal(nomeDoArquivo(['2026-10', '2026-08', '2026-09'], 'Casa'), 'resumo-2026-08-a-2026-10-casa');
  assert.equal(nomeDoArquivo('2026-10', 'João da Silva'), 'resumo-2026-10-joao-da-silva');
  assert.equal(nomeDoArquivo('2026-10', ''), 'resumo-2026-10');
});
