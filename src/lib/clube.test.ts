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
