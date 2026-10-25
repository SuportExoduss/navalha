// Identidade visual do Navalha: grafite + um único âmbar latão, em dois temas.
// Escuro: grafite quase preto, como a parede de uma barbearia à noite. Claro: papel quente com tinta grafite.
// O âmbar é reservado para ações e seleções nos dois; no claro ele escurece para manter o contraste.

export type NomePaleta = 'escuro' | 'claro';
export type PreferenciaTema = 'sistema' | NomePaleta;

export interface Paleta {
  bg: string; surface: string; surfaceRaised: string; border: string;
  text: string; textMuted: string; accent: string; accentText: string;
  danger: string; success: string;
  /** Amarelo de aviso (plano perto de vencer); só ícone e borda, nunca texto corrido. */
  alerta: string;
}

export const paletas: Record<NomePaleta, Paleta> = {
  escuro: {
    bg: '#0E0F11',
    surface: '#17181B',
    surfaceRaised: '#1F2024',
    border: '#2A2B30',
    text: '#F4F2EE',
    textMuted: '#A3A19C',
    accent: '#C8A24A',
    accentText: '#141210', // texto sobre o âmbar
    danger: '#E5675B',
    success: '#5FBF7F',
    alerta: '#F2C94C',
  },
  claro: {
    bg: '#F6F3EC',          // papel quente, não branco puro
    surface: '#FFFDF8',
    surfaceRaised: '#EFEBE2',
    border: '#DED8CB',
    text: '#17181B',        // a mesma tinta grafite do tema escuro
    textMuted: '#5F5A50',
    accent: '#8A6714',      // latão escurecido: contraste ≥ 4,5:1 sobre o papel
    accentText: '#FFFDF8',
    danger: '#B3372B',
    success: '#2E7A4C',
    alerta: '#9A6A00',
  },
};

/**
 * Cores do tema ativo. O objeto é o mesmo o tempo todo e os valores são trocados por `aplicarPaleta`;
 * as telas leem `colors.x` ao desenhar e o app é redesenhado inteiro quando o tema muda (TemaProvider).
 */
export const colors: Paleta = { ...paletas.escuro };
export let paletaAtiva: NomePaleta = 'escuro';

export function aplicarPaleta(nome: NomePaleta) {
  Object.assign(colors, paletas[nome]);
  paletaAtiva = nome;
}

// Sobre fotos o véu é sempre escuro e o texto sempre claro, nos dois temas (a foto não muda com o tema).
// `destaque`: o âmbar do tema escuro, fixo, porque o véu é escuro nos dois temas (só para texto grande: ≥ 3:1).
export const sobreFoto = { veu: 'rgba(14,15,17,0.8)', texto: '#F4F2EE', destaque: '#C8A24A' } as const;

export const radius = { card: 16, chip: 999, input: 12 } as const;

export const space = (n: number) => n * 4;

// Getters: a cor do texto acompanha o tema ativo no momento em que o estilo é usado.
export const type = {
  // Títulos em Barlow Condensed (letreiro de barbearia); o corpo fica na fonte do sistema, mais legível.
  title: { fontSize: 32, fontFamily: 'BarlowCondensed_700Bold', letterSpacing: 0.2, get color() { return colors.text; } },
  heading: { fontSize: 20, fontFamily: 'BarlowCondensed_600SemiBold', letterSpacing: 0.2, get color() { return colors.text; } },
  body: { fontSize: 15, fontWeight: '400' as const, get color() { return colors.text; } },
  caption: { fontSize: 13, fontWeight: '400' as const, get color() { return colors.textMuted; } },
  // Números tabulares em preços e horários para alinhar colunas.
  number: { fontVariant: ['tabular-nums' as const] },
};

// Toque mínimo recomendado (44 px).
export const minTouch = 44;
