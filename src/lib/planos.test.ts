import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANOS, bloqueiaEm, cabeMaisUm, emDiaPeloPlay, excedentesPara, modoDeTroca, planoPorId, planoPorProduto, renovaSozinha, situacaoAssinatura, seloAssinatura, tituloDoPlano, conferirCupom, normalizarCupom, cupomValido } from './planos';

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
  assert.equal(modoDeTroca(planoPorId('time')!, planoPorId('equipe')!), 'deferred');
});

test('assinatura: aviso 7 dias antes, 5 dias para regularizar, depois bloqueada', () => {
  const D = 86_400_000, agora = 100 * D;
  const casa = (status: 'teste' | 'ativa' | 'vencida' | 'inadimplente' | 'rascunho', venceEm: number, emDia = true, renova?: boolean) =>
    ({ emDia, assinatura: { status, venceEm, ...(renova === undefined ? {} : { renovaSozinha: renova }) } });
  // Teste grátis: longe do fim, nada; a 3 dias, avisa.
  assert.deepEqual(situacaoAssinatura(casa('teste', agora + 20 * D), agora), { tipo: 'ok' });
  assert.deepEqual(situacaoAssinatura(casa('teste', agora + 3 * D), agora), { tipo: 'vence_logo', ate: agora + 3 * D, dias: 3 });
  // Plano pago renovando sozinho: nunca avisa, nem no dia (o cron confere a renovação).
  assert.deepEqual(situacaoAssinatura(casa('ativa', agora + 2 * D, true, true), agora), { tipo: 'ok' });
  assert.deepEqual(situacaoAssinatura(casa('ativa', agora - 60_000, true, true), agora), { tipo: 'ok' });
  // Renovação desligada na Play Store: avisa como o teste.
  assert.equal(situacaoAssinatura(casa('ativa', agora + 2 * D, true, false), agora).tipo, 'vence_logo');
  // Venceu: 5 dias de regularização contados do vencimento.
  assert.deepEqual(situacaoAssinatura(casa('vencida', agora - 1 * D), agora), { tipo: 'regularizar', ate: bloqueiaEm(agora - D), dias: 4 });
  assert.equal(situacaoAssinatura(casa('inadimplente', agora + D), agora).tipo, 'regularizar');
  // O servidor bloqueou; rascunho é outra coisa (casa sem teste, montando antes de assinar).
  assert.deepEqual(situacaoAssinatura(casa('vencida', agora - 6 * D, false), agora), { tipo: 'bloqueada' });
  assert.deepEqual(situacaoAssinatura(casa('rascunho', 0, false), agora), { tipo: 'rascunho' });
  assert.equal(bloqueiaEm(agora), agora + 5 * D);
  assert.equal(renovaSozinha('SUBSCRIPTION_STATE_ACTIVE'), true);
  assert.equal(renovaSozinha('SUBSCRIPTION_STATE_CANCELED'), false);
});

test('selo do plano: verde em dia, amarelo perto de vencer, vermelho vencido/bloqueado/sem plano', () => {
  assert.equal(seloAssinatura({ tipo: 'ok' }), 'ok');
  assert.equal(seloAssinatura({ tipo: 'vence_logo', ate: 0, dias: 3 }), 'alerta');
  for (const t of ['regularizar', 'bloqueada', 'rascunho'] as const) assert.equal(seloAssinatura({ tipo: t, ate: 0, dias: 1 } as never), 'vencido');
  assert.equal(tituloDoPlano({ emDia: true, assinatura: { status: 'cortesia', plano: 'casa_cheia' } }), 'Cupom · Casa cheia');
  assert.equal(tituloDoPlano({ emDia: false, assinatura: { status: 'vencida', plano: 'solo' } }), 'Barbearia bloqueada');
  assert.equal(tituloDoPlano({ emDia: true, assinatura: { status: 'vencida' } }), 'Teste grátis encerrado');
  // Cortesia avisa 7 dias antes, como o teste (não renova sozinha).
  const D = 86_400_000;
  assert.equal(situacaoAssinatura({ emDia: true, assinatura: { status: 'cortesia', venceEm: 10 * D } }, 5 * D).tipo, 'vence_logo');
});

test('cupom: válido, expirado, esgotado, já usado pela casa', () => {
  const agora = 1_000_000;
  const c = { plano: 'casa_cheia' as const, dias: 365, limite: 1, usos: 0 };
  const r = conferirCupom(c, false, agora);
  assert.ok(r.ok && r.plano.id === 'casa_cheia' && r.dias === 365);
  assert.equal(conferirCupom(undefined, false, agora).ok, false);
  assert.equal(conferirCupom({ ...c, usos: 1 }, false, agora).ok, false);
  assert.equal(conferirCupom(c, true, agora).ok, false);
  assert.equal(conferirCupom({ ...c, validoAte: agora - 1 }, false, agora).ok, false);
  assert.equal(conferirCupom({ ...c, ativo: false }, false, agora).ok, false);
  assert.equal(normalizarCupom(' parceiro-1 ano '), 'PARCEIRO-1ANO');
  assert.equal(cupomValido('PARCEIRO-1ANO'), true);
  assert.equal(cupomValido('../x'), false);
});
