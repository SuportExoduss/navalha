import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarAvaliacao, media, notaRanking, podeAvaliarCasa } from './avaliacoes';

test('avaliação única: avaliar soma, editar troca a nota sem contar duas vezes', () => {
  let p = { soma: 0, total: 0 };
  p = aplicarAvaliacao(p, null, 5);
  p = aplicarAvaliacao(p, null, 3);
  assert.deepEqual(p, { soma: 8, total: 2 });
  assert.equal(media(p), 4);
  p = aplicarAvaliacao(p, 3, 5); // o segundo cliente mudou de 3 para 5
  assert.deepEqual(p, { soma: 10, total: 2 });
  assert.equal(media(p), 5);
  assert.equal(media({ soma: 0, total: 0 }), 0);
});

test('ranking: poucas avaliações não passam na frente de muitas', () => {
  const umaCinco = notaRanking({ soma: 5, total: 1 });
  const oitentaQuaseCinco = notaRanking({ soma: 4.8 * 80, total: 80 });
  assert.ok(oitentaQuaseCinco > umaCinco);
  assert.equal(notaRanking({ soma: 0, total: 0 }), 0);
});

test('só avalia a casa quem teve corte concluído e tem conta', () => {
  assert.equal(podeAvaliarCasa({ status: 'concluido', clienteUid: 'ana' }), true);
  assert.equal(podeAvaliarCasa({ status: 'faltou', clienteUid: 'ana' }), false);
  assert.equal(podeAvaliarCasa({ status: 'concluido', clienteUid: null }), false); // encaixe de balcão
});
