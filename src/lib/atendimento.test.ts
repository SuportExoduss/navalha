import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corteAberto, minutosDecorridos, podeIniciar } from './atendimento';
import { paraMillis } from './agenda';

const agora = paraMillis('2030-01-10', 10 * 60);
const ag = (id: string, extra: object = {}) => ({ id, barbeiroId: 'lucas', status: 'confirmado', inicio: agora, ...extra });

test('seguir cortes: só inicia outro depois de finalizar o aberto (por barbeiro)', () => {
  const a = ag('a'), b = ag('b'), c = ag('c', { barbeiroId: 'rafael' });
  assert.equal(podeIniciar(a, [a, b, c], agora), true);
  const aAberto = { ...a, iniciadoEm: agora };
  const lista = [aAberto, b, c];
  assert.equal(corteAberto(lista, 'lucas')?.id, 'a');
  assert.equal(podeIniciar(b, lista, agora), false); // Lucas tem um corte aberto
  assert.equal(podeIniciar(c, lista, agora), true); // outro barbeiro segue livre
  const aFinalizado = { ...aAberto, status: 'concluido' };
  assert.equal(podeIniciar(b, [aFinalizado, b, c], agora), true);
});

test('seguir cortes: não inicia o que já começou, foi cancelado ou não é de hoje', () => {
  assert.equal(podeIniciar(ag('a', { iniciadoEm: agora }), [], agora), false);
  assert.equal(podeIniciar(ag('a', { status: 'cancelado' }), [], agora), false);
  assert.equal(podeIniciar(ag('a', { inicio: agora + 86_400_000 }), [], agora), false);
  assert.equal(minutosDecorridos(agora, agora + 12.5 * 60_000), 12);
});
