import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANOS, cabeMaisUm, emDiaPeloPlay, excedentesPara, modoDeTroca, planoPorId, planoPorProduto } from './planos';

test('planos: preços e limites decididos pelo dono', () => {
  assert.deepEqual(PLANOS.map(p => [p.precoCentavos, p.barbeiros]), [[2500, 1], [7000, 3], [10000, 6], [15000, 10]]);
  assert.equal(planoPorProduto('navalha_equipe')?.id, 'equipe');
  assert.equal(planoPorProduto('outro_app'), undefined);
});

test('planos: limite de barbeiros e quem precisa sair ao baixar de plano', () => {
  const solo = planoPorId('solo')!, equipe = planoPorId('equipe')!;
  assert.equal(excedentesPara(solo, 3), 2);
  assert.equal(excedentesPara(equipe, 3), 0);
  assert.equal(cabeMaisUm(2, 3), true);
  assert.equal(cabeMaisUm(3, 3), false);
});

test('planos: em dia pelo estado do Google Play', () => {
  const agora = 1_000;
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_ACTIVE', 2_000, agora), true);
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 2_000, agora), true);
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_CANCELED', 2_000, agora), true); // vale até o fim do mês pago
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_ACTIVE', 500, agora), false);
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_ON_HOLD', 2_000, agora), false);
  assert.equal(emDiaPeloPlay('SUBSCRIPTION_STATE_EXPIRED', 2_000, agora), false);
});

test('planos: subir cobra a diferença já, descer vale na renovação', () => {
  assert.equal(modoDeTroca(planoPorId('solo')!, planoPorId('equipe')!), 'charge-prorated-price');
  assert.equal(modoDeTroca(planoPorId('casa')!, planoPorId('equipe')!), 'deferred');
});
