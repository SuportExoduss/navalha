/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkAvaliacaoGoogle, notaRanking, placeIdValido, podeAvaliarAlvo, somarAvaliacao } from './avaliacoes';

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
  const pode = podeAvaliarAlvo;
  assert.equal(pode({ status: 'concluido', fim: agora - 86_400_000 }, 'barbeiro', agora), true);
  assert.equal(pode({ status: 'concluido', fim: agora, avaliacao: { estrelas: 5 } }, 'barbeiro', agora), false); // antiga conta
  assert.equal(pode({ status: 'concluido', fim: agora, avaliacoes: { barbeiro: {} } }, 'barbearia', agora), true); // outra direção
  assert.equal(pode({ status: 'faltou', fim: agora }, 'barbeiro', agora), false);
  assert.equal(pode({ status: 'concluido', fim: agora - 31 * 86_400_000 }, 'barbeiro', agora), false);
});

test('avaliar no cancelamento: só quem foi cancelado avalia quem cancelou', () => {
  const agora = 1_800_000_000_000;
  const casaCancelou = { status: 'cancelado', fim: agora + 86_400_000, clienteUid: 'ana', cancelamento: { por: 'casa' as const } };
  const clienteCancelou = { ...casaCancelou, cancelamento: { por: 'cliente' as const } };
  assert.equal(podeAvaliarAlvo(casaCancelou, 'barbeiro', agora), true);
  assert.equal(podeAvaliarAlvo(casaCancelou, 'cliente', agora), false);
  assert.equal(podeAvaliarAlvo(casaCancelou, 'barbearia', agora), false); // a casa só depois do atendimento
  assert.equal(podeAvaliarAlvo(clienteCancelou, 'cliente', agora), true);
  assert.equal(podeAvaliarAlvo(clienteCancelou, 'barbeiro', agora), false);
  // Falta: o barbeiro avalia o cliente; encaixe de balcão (sem conta) não tem quem avaliar.
  assert.equal(podeAvaliarAlvo({ status: 'faltou', fim: agora, clienteUid: 'ana' }, 'cliente', agora), true);
  assert.equal(podeAvaliarAlvo({ status: 'concluido', fim: agora, clienteUid: null }, 'cliente', agora), false);
});

test('link do Google abre a janela de avaliação da casa', () => {
  assert.equal(linkAvaliacaoGoogle('ChIJabc123_-x'), 'https://search.google.com/local/writereview?placeid=ChIJabc123_-x');
});

test('Place ID: só caracteres seguros', () => {
  assert.equal(placeIdValido('ChIJN1t_tDeuEmsRUsoyG83frY4'), true);
  assert.equal(placeIdValido('../admin?x=1'), false);
});
