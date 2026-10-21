/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notaRanking, placeIdValido, podeAvaliar, somarAvaliacao } from './avaliacoes';

test('média: soma uma avaliação de cada vez', () => {
  assert.deepEqual(somarAvaliacao(undefined, 5), { media: 5, total: 1 });
  assert.deepEqual(somarAvaliacao({ media: 5, total: 1 }, 4), { media: 4.5, total: 2 });
  assert.deepEqual(somarAvaliacao({ media: 4.5, total: 2 }, 3), { media: 4, total: 3 });
});

test('ranking: poucas avaliações não passam na frente de muitas', () => {
  assert.equal(notaRanking({}), 0);
  const nova = notaRanking({ notaApp: 5, totalAvaliacoesApp: 2 });
  const consagrada = notaRanking({ notaApp: 4.9, totalAvaliacoesApp: 20, notaGoogle: 4.8, totalAvaliacoesGoogle: 300 });
  assert.ok(consagrada > nova, `${consagrada} > ${nova}`);
  assert.equal(notaRanking({ notaGoogle: 4.5, totalAvaliacoesGoogle: 10 }), 4.25);
});

test('avaliar: só concluído, uma vez, até 30 dias', () => {
  const agora = 1_800_000_000_000;
  assert.equal(podeAvaliar({ status: 'concluido', fim: agora - 86_400_000 }, agora), true);
  assert.equal(podeAvaliar({ status: 'concluido', fim: agora, avaliacao: { estrelas: 5 } }, agora), false);
  assert.equal(podeAvaliar({ status: 'faltou', fim: agora }, agora), false);
  assert.equal(podeAvaliar({ status: 'concluido', fim: agora - 31 * 86_400_000 }, agora), false);
});

test('Place ID: só caracteres seguros', () => {
  assert.equal(placeIdValido('ChIJN1t_tDeuEmsRUsoyG83frY4'), true);
  assert.equal(placeIdValido('../admin?x=1'), false);
});
