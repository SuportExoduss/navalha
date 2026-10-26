import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoCiclo, somarMes } from './clube';
import { paraMillis } from './agenda';

const DIA = 86_400_000;

test('somarMes: mesmo dia do mês seguinte; dia 31 vira o último dia do mês curto; virada do ano', () => {
  assert.equal(somarMes(paraMillis('2026-10-26', 600)), paraMillis('2026-11-26', 600));
  assert.equal(somarMes(paraMillis('2027-01-31', 0)), paraMillis('2027-02-28', 0));
  assert.equal(somarMes(paraMillis('2026-12-15', 0)), paraMillis('2027-01-15', 0));
  // Toda saída fica entre 28 e 31 dias: é o que as regras aceitam.
  for (const d of ['2027-01-31', '2027-02-28', '2026-03-31', '2026-07-15']) {
    const ms = paraMillis(d, 0);
    const dias = (somarMes(ms) - ms) / DIA;
    assert.ok(dias >= 28 && dias <= 31, `${d}: ${dias}`);
  }
});

test('novoCiclo: em dia conta do vencimento; vencido há mais de 1 dia conta de hoje', () => {
  const vence = paraMillis('2026-11-10', 600);
  assert.deepEqual(novoCiclo(vence, vence - 3 * DIA), { cicloInicio: vence, venceEm: paraMillis('2026-12-10', 600) });
  assert.deepEqual(novoCiclo(vence, vence + DIA), { cicloInicio: vence, venceEm: paraMillis('2026-12-10', 600) });
  const hoje = vence + 5 * DIA;
  assert.equal(novoCiclo(vence, hoje).cicloInicio, hoje);
  assert.equal(novoCiclo(undefined, hoje).cicloInicio, hoje); // aceite: o primeiro ciclo começa hoje
});

test('separarMembros: pedidos, vencidos (inclusive antes do Worker marcar), vencem em 7 dias e em dia', async () => {
  const { separarMembros } = await import('./clube');
  const agora = paraMillis('2026-11-10', 600);
  const m = (status: string, venceEm?: number, criadoEm = 1) => ({ status, venceEm, criadoEm }) as never;
  const g = separarMembros([
    m('solicitado', undefined, 5), m('solicitado', undefined, 2),
    m('vencido', agora - 3 * DIA), m('ativo', agora - 60_000),
    m('ativo', agora + 2 * DIA), m('ativo', agora + 20 * DIA),
    m('saiu', agora + 20 * DIA), m('recusado'),
  ], agora);
  assert.deepEqual(g.pedido.map((x: { criadoEm: number }) => x.criadoEm), [2, 5]);
  assert.equal(g.vencido.length, 2);
  assert.equal(g.vence_logo.length, 1);
  assert.equal(g.em_dia.length, 1);
});

test('avisoDevido: pedido uma vez; 3 dias antes e no dia só de dia; vencido 1 dia depois', async () => {
  const { avisoDevido, textoAvisoClube } = await import('./clube');
  const vence = paraMillis('2026-11-26', 15 * 60);
  const as = (agora: number, extra: Record<string, unknown> = {}) => avisoDevido({ status: 'ativo', venceEm: vence, atualizadoEm: 1, ...extra } as never, agora);
  assert.equal(avisoDevido({ status: 'solicitado', atualizadoEm: 100 } as never, 200), 'pedido');
  assert.equal(avisoDevido({ status: 'solicitado', atualizadoEm: 100, lembretes: { pedido: 150 } } as never, 200), null);
  assert.equal(avisoDevido({ status: 'solicitado', atualizadoEm: 300, lembretes: { pedido: 150 } } as never, 400), 'pedido'); // pediu de novo
  assert.equal(as(paraMillis('2026-11-20', 10 * 60)), null); // 6 dias antes
  assert.equal(as(paraMillis('2026-11-23', 16 * 60)), 'd3');
  assert.equal(as(paraMillis('2026-11-23', 23 * 60)), null); // de noite espera a manhã
  assert.equal(as(paraMillis('2026-11-24', 10 * 60), { lembretes: { d3: 1 } }), null);
  assert.equal(as(paraMillis('2026-11-26', 9 * 60), { lembretes: { d3: 1 } }), 'd0');
  assert.equal(as(paraMillis('2026-11-27', 10 * 60), { lembretes: { d3: 1, d0: 1 } }), null); // dia de tolerância
  assert.equal(as(paraMillis('2026-11-27', 15 * 60 + 1), { lembretes: { d3: 1, d0: 1 } }), 'vencido');
  assert.equal(as(paraMillis('2026-11-28', 3 * 60)), 'vencido'); // vencido não espera o dia
  assert.equal(avisoDevido({ status: 'saiu', venceEm: vence, atualizadoEm: 1 } as never, vence + 5 * DIA), null);
  const m = { planoNome: '4 cortes', barbeariaNome: 'Navalha de Ouro', clienteNome: 'Ana', venceEm: vence };
  assert.equal(textoAvisoClube('d3', m, 'cliente', paraMillis('2026-11-23', 600)).corpo, '4 cortes na Navalha de Ouro vence Qui 26/11. Pague na barbearia para continuar.');
  assert.match(textoAvisoClube('pedido', m, 'casa', 0).corpo, /^Ana quer assinar o 4 cortes/);
  assert.match(textoAvisoClube('vencido', m, 'casa', vence + 2 * DIA).corpo, /Recebi o pagamento/);
});

test('usar o clube: conta usos do ciclo (falta conta, cancelado não) e barra fora do plano, do ciclo ou do limite', async () => {
  const { motivoSemClube, usosNoCiclo } = await import('./clube');
  const inicio = paraMillis('2026-11-01', 600), vence = paraMillis('2026-12-01', 600);
  const m = { status: 'ativo' as const, cicloInicio: inicio, venceEm: vence, cortesPorMes: 2 };
  const ags = [
    { inicio: inicio + DIA, status: 'concluido' as const }, { inicio: inicio + 2 * DIA, status: 'cancelado' as const },
    { inicio: inicio + 3 * DIA, status: 'faltou' as const }, { inicio: inicio - DIA, status: 'concluido' as const }, // ciclo anterior
    { inicio: vence + 3_600_000, status: 'reservado' as const }, // dia de tolerância ainda é deste ciclo
  ];
  assert.equal(usosNoCiclo(ags, m), 3);
  const plano = { servicoIds: ['s1'] };
  assert.equal(motivoSemClube(m, plano, 's1', inicio + 5 * DIA, 1), null);
  assert.match(motivoSemClube(m, plano, 's1', inicio + 5 * DIA, 2)!, /já usou os 2/);
  assert.equal(motivoSemClube({ ...m, cortesPorMes: undefined }, plano, 's1', inicio + 5 * DIA, 99), null); // ilimitado
  assert.match(motivoSemClube(m, plano, 's2', inicio + 5 * DIA, 0)!, /não faz parte/);
  assert.match(motivoSemClube(m, plano, 's1', vence + 2 * DIA, 0)!, /passa do vencimento/);
  assert.match(motivoSemClube({ ...m, status: 'vencido' }, plano, 's1', inicio, 0)!, /não tem clube ativo/);
  assert.match(motivoSemClube(m, null, 's1', inicio, 0)!, /não existe mais/);
});
