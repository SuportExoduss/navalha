import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idade, lerDataBR, mascaraData } from './idade';

// 25/10/2026, 10:00 em Brasília.
const agora = Date.UTC(2026, 9, 25, 13, 0);

test('máscara da data enquanto digita', () => {
  assert.equal(mascaraData('2510'), '25/10');
  assert.equal(mascaraData('25101990'), '25/10/1990');
  assert.equal(mascaraData('25/10/19901'), '25/10/1990');
});

test('data de nascimento: só datas que existem e já passaram', () => {
  assert.equal(lerDataBR('25/10/1990', agora), '1990-10-25');
  assert.equal(lerDataBR('31/02/2000', agora), null);
  assert.equal(lerDataBR('01/01/1899', agora), null);
  assert.equal(lerDataBR('26/10/2026', agora), null); // amanhã
  assert.equal(lerDataBR('1990-10-25', agora), null);
});

test('18 anos completos no dia do aniversário, não antes', () => {
  assert.equal(idade('2008-10-25', agora), 18);
  assert.equal(idade('2008-10-26', agora), 17);
  assert.equal(idade('2008-11-01', agora), 17);
  assert.equal(idade('1990-01-01', agora), 36);
  // Meia-noite e meia em Brasília do dia 25 ainda é dia 25 (UTC já seria 25 3h30): o fuso conta.
  assert.equal(idade('2008-10-25', Date.UTC(2026, 9, 25, 3, 30)), 18);
  assert.equal(idade('2008-10-25', Date.UTC(2026, 9, 25, 2, 30)), 17); // 23:30 do dia 24 em Brasília
});
