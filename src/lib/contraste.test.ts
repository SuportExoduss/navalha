/// <reference types="node" />
// Os dois temas precisam ser legíveis: texto ≥ 4,5:1 e o âmbar das ações ≥ 4,5:1 com o texto dele (WCAG AA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletas } from '../theme';

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [nome, p] of Object.entries(paletas)) {
  test(`tema ${nome}: contraste mínimo`, () => {
    for (const fundo of [p.bg, p.surface, p.surfaceRaised]) {
      assert.ok(contraste(p.text, fundo) >= 7, `texto sobre ${fundo}`);
      assert.ok(contraste(p.textMuted, fundo) >= 4.5, `texto secundário sobre ${fundo}`);
    }
    assert.ok(contraste(p.accentText, p.accent) >= 4.5, 'texto do botão sobre o âmbar');
    assert.ok(contraste(p.accent, p.surface) >= 3, 'âmbar (chip/ícone) sobre o cartão');
    assert.ok(contraste(p.danger, p.surface) >= 4.5, 'erro sobre o cartão');
  });
}
