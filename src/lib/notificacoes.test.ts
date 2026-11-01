import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumoMes, ehDiaDoResumo, idAviso, mesAnterior, nomeDoMes, quandoChegou, resumosDoMes, textoAviso, textoResumoMes } from './notificacoes';
import { paraMillis } from './agenda';

const agora = paraMillis('2026-11-03', 9 * 60);
const ag = { clienteNome: 'Ana', servicoNome: 'Degradê', barbeiroNome: 'Lucas', inicio: paraMillis('2026-11-04', 10 * 60) };

test('aviso de marcado e cancelado: o barbeiro vê o cliente; o dono vê também o barbeiro', () => {
  assert.deepEqual(textoAviso('agendado', ag, agora, 'barbeiro'), { titulo: 'Novo horário marcado', corpo: 'Ana: Degradê, amanhã às 10:00.' });
  assert.equal(textoAviso('agendado', ag, agora, 'dono').corpo, 'Ana: Degradê com Lucas, amanhã às 10:00.');
  assert.equal(textoAviso('agendado', { ...ag, origem: 'balcao' }, agora, 'barbeiro').titulo, 'Encaixe marcado');
  const c = textoAviso('cancelado', { ...ag, cancelamento: { por: 'cliente', motivo: 'Dia errado', em: agora } }, agora, 'barbeiro');
  assert.equal(c.corpo, 'Ana cancelou Degradê de amanhã às 10:00. Motivo: Dia errado.');
  // A casa cancelou: o cliente sabe qual barbearia e o motivo; o barbeiro sabe que foi a casa.
  const casa = { ...ag, barbeariaNome: 'Navalha de Ouro', cancelamento: { por: 'casa' as const, motivo: 'Barbeiro doente', em: agora } };
  assert.deepEqual(textoAviso('cancelado', casa, agora, 'cliente'),
    { titulo: 'Seu horário foi cancelado', corpo: 'Navalha de Ouro cancelou Degradê de amanhã às 10:00. Motivo: Barbeiro doente.' });
  assert.equal(textoAviso('cancelado', casa, agora, 'barbeiro').corpo, 'A casa cancelou Degradê de Ana, amanhã às 10:00. Motivo: Barbeiro doente.');
  assert.equal(idAviso('a1', 'agendado', 'lucas'), 'a1_agendado_lucas');
});

test('painel: hora curta de quando a notificação chegou', () => {
  assert.equal(quandoChegou(paraMillis('2026-11-03', 8 * 60 + 5), agora), '08:05');
  assert.equal(quandoChegou(paraMillis('2026-11-02', 14 * 60 + 30), agora), 'ontem 14:30');
  assert.equal(quandoChegou(paraMillis('2026-10-28', 9 * 60), agora), '28/10 09:00');
});

test('resumo do mês: dia 1 em Brasília e o mês anterior certo (inclusive na virada do ano)', () => {
  assert.equal(ehDiaDoResumo(paraMillis('2026-12-01', 0)), true);
  assert.equal(ehDiaDoResumo(paraMillis('2026-11-30', 23 * 60 + 59)), false);
  assert.equal(ehDiaDoResumo(paraMillis('2026-12-03', 23 * 60)), true); // casas que ficaram para trás
  assert.equal(ehDiaDoResumo(paraMillis('2026-12-04', 0)), false);
  assert.deepEqual(mesAnterior(paraMillis('2026-12-01', 9 * 60)), { chave: '2026-11', de: '2026-11-01', ate: '2026-11-30' });
  assert.deepEqual(mesAnterior(paraMillis('2027-01-01', 9 * 60)), { chave: '2026-12', de: '2026-12-01', ate: '2026-12-31' });
  assert.deepEqual(mesAnterior(paraMillis('2027-03-01', 9 * 60)).ate, '2027-02-28');
});

test('resumo do mês: números e texto', () => {
  const a = (status: string, preco: number, servico: string, barbeiro: string, origem = 'app') =>
    ({ status, precoCentavos: preco, servicoNome: servico, barbeiroNome: barbeiro, origem }) as never;
  const r = calcularResumoMes([
    a('concluido', 4500, 'Degradê', 'Lucas'), a('concluido', 4500, 'Degradê', 'Lucas'), a('concluido', 3000, 'Barba', 'Rafa', 'balcao'),
    a('faltou', 4500, 'Degradê', 'Lucas'), a('cancelado', 6000, 'Navalhado', 'Rafa'),
  ]);
  assert.equal(r.agendamentos, 4); assert.equal(r.concluidos, 3); assert.equal(r.faltas, 1); assert.equal(r.cancelados, 1);
  assert.equal(r.faturadoCentavos, 12000); assert.equal(r.pelaApp, 3);
  assert.deepEqual(r.maisPedido, { nome: 'Degradê', vezes: 3 });
  assert.deepEqual(r.porBarbeiro.map(b => [b.nome, b.concluidos]), [['Lucas', 2], ['Rafa', 1]]);
  const t = textoResumoMes('2026-11', r);
  assert.equal(t.titulo, 'Resumo de novembro de 2026');
  assert.match(t.corpo, /Faturado: R\$ 120,00 em 3 atendimentos/);
  assert.equal(textoResumoMes('2026-11', calcularResumoMes([])).corpo, 'Nenhum agendamento em novembro de 2026.');
  // O do barbeiro: título próprio e sem a lista de barbeiros.
  const seu = textoResumoMes('2026-11', r, true);
  assert.equal(seu.titulo, 'Seu resumo de novembro de 2026');
  assert.doesNotMatch(seu.corpo, /Lucas:/);
  assert.equal(nomeDoMes('2027-01'), 'janeiro de 2027');
});

test('resumos do mês: um da casa e um por barbeiro, inclusive quem não atendeu', () => {
  const a = (status: string, preco: number, barbeiroId: string, barbeiroNome: string) =>
    ({ status, precoCentavos: preco, servicoNome: 'Corte', barbeiroId, barbeiroNome, origem: 'app' }) as never;
  const l = resumosDoMes('c1', '2026-10', 5, [a('concluido', 4500, 'u1', 'Lucas'), a('concluido', 3000, 'u2', 'Rafa'), a('faltou', 4500, 'u1', 'Lucas')],
    [{ uid: 'u1', nome: 'Lucas' }, { uid: 'u3', nome: 'Novo' }]);
  assert.deepEqual(l.map(r => [r.id, r.faturadoCentavos, r.agendamentos]),
    [['c1_2026-10_casa', 7500, 3], ['c1_2026-10_u1', 4500, 2], ['c1_2026-10_u3', 0, 0], ['c1_2026-10_u2', 3000, 1]]);
  assert.deepEqual([l[0].barbeiroId, l[1].nome, l[3].nome, l[1].em, l[1].mes], ['casa', 'Lucas', 'Rafa', 5, '2026-10']);
});
