// Identidade visual do Navalha: grafite quase preto + um único âmbar latão.
// O âmbar é reservado para ações e seleções; o resto fica em tons neutros.
export const colors = {
  bg: '#0E0F11',
  surface: '#17181B',
  surfaceRaised: '#1F2024',
  border: '#2A2B30',
  text: '#F4F2EE',
  textMuted: '#A3A19C', // contraste ≥ 4,5:1 sobre surface
  accent: '#C8A24A',
  accentText: '#141210', // texto sobre o âmbar
  danger: '#E5675B',
  success: '#5FBF7F',
} as const;

export const radius = { card: 16, chip: 999, input: 12 } as const;

export const space = (n: number) => n * 4;

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
  // Números tabulares em preços e horários para alinhar colunas.
  number: { fontVariant: ['tabular-nums' as const] },
};

// Toque mínimo recomendado (44 px).
export const minTouch = 44;
