import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkWhatsapp, mensagemLembreteCliente, saudacao } from './lembreteWhatsapp';
import { paraMillis } from './agenda';

test('saudação pela hora de Brasília', () => {
  assert.equal(saudacao(paraMillis('2030-01-10', 4 * 60 + 59)), 'Boa noite');
  assert.equal(saudacao(paraMillis('2030-01-10', 5 * 60)), 'Bom dia');
  assert.equal(saudacao(paraMillis('2030-01-10', 12 * 60)), 'Boa tarde');
  assert.equal(saudacao(paraMillis('2030-01-10', 18 * 60)), 'Boa noite');
});

test('lembrete: primeiro nome, dia e horário do corte e o link', () => {
  const agora = paraMillis('2030-01-10', 13 * 60);
  const a = { clienteNome: 'Ana Souza', inicio: paraMillis('2030-01-10', 15 * 60) };
  assert.equal(mensagemLembreteCliente(a, agora, 'https://x'),
    'Boa tarde, Ana! Não esqueça do seu corte com a nossa equipe hoje às 15:00. Acompanhe no Navalha: https://x');
  assert.match(mensagemLembreteCliente({ ...a, inicio: paraMillis('2030-01-11', 9 * 60) }, agora), /amanhã às 09:00/);
  assert.match(mensagemLembreteCliente({ ...a, inicio: paraMillis('2030-01-14', 9 * 60) }, agora), /no dia 14\/01 às 09:00/);
});

test('WhatsApp: número com 55 uma vez só e texto codificado', () => {
  assert.equal(linkWhatsapp('(15) 99999-0000', 'Oi, tudo?'), 'https://wa.me/5515999990000?text=Oi%2C%20tudo%3F');
  assert.equal(linkWhatsapp('+55 15 99999-0000', 'x'), 'https://wa.me/5515999990000?text=x');
});
