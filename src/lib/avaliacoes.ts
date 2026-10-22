// Avaliações e ranking: lógica pura, usada pelo Worker (que grava as notas) e pelo app (que ordena a busca).
// A nota do ranking junta a do app e a do Google numa média bayesiana: casa com 2 avaliações 5★ não passa
// na frente de casa com 300 avaliações 4,8★.

/** Prazo para avaliar um atendimento concluído. */
export const DIAS_PARA_AVALIAR = 30;
export const MAX_COMENTARIO = 300;

/** Nota "neutra" e quantas avaliações ela vale: puxa para o meio as casas com poucas avaliações. */
const PRIOR_NOTA = 4;
const PRIOR_PESO = 10;

const duasCasas = (n: number) => Math.round(n * 100) / 100;

/** Média nova somando uma avaliação. */
export function somarAvaliacao(atual: { media: number; total: number } | undefined, estrelas: number) {
  const media = atual?.media ?? 0, total = atual?.total ?? 0;
  return { media: duasCasas((media * total + estrelas) / (total + 1)), total: total + 1 };
}

/** Nota do ranking (0 = sem avaliações, o card mostra "Novo"). */
export function notaRanking(r: { notaApp?: number; totalAvaliacoesApp?: number; notaGoogle?: number; totalAvaliacoesGoogle?: number }) {
  const nApp = r.totalAvaliacoesApp ?? 0, nGoogle = r.totalAvaliacoesGoogle ?? 0;
  if (!nApp && !nGoogle) return 0;
  const soma = (r.notaApp ?? 0) * nApp + (r.notaGoogle ?? 0) * nGoogle;
  return duasCasas((PRIOR_NOTA * PRIOR_PESO + soma) / (PRIOR_PESO + nApp + nGoogle));
}

/**
 * Três avaliações, todas opcionais: o cliente avalia o barbeiro (nota interna da casa) e a barbearia (pública,
 * conta no ranking); o barbeiro avalia o cliente (o cliente vê em Perfil). Cada uma, uma vez por atendimento.
 */
export type AlvoAvaliacao = 'barbeiro' | 'barbearia' | 'cliente';
export const DIRECAO_DO_ALVO = {
  barbeiro: 'cliente_para_barbeiro', barbearia: 'cliente_para_barbearia', cliente: 'barbeiro_para_cliente',
} as const;

type AgParaAvaliar = {
  status: string; fim: number; clienteUid?: string | null; cancelamento?: { por: 'cliente' | 'casa' };
  /** Avaliação antiga (antes de 22/out): era a do cliente para o barbeiro. */
  avaliacao?: unknown;
  avaliacoes?: Partial<Record<AlvoAvaliacao, unknown>>;
};

export function jaAvaliado(a: AgParaAvaliar, alvo: AlvoAvaliacao) {
  return !!a.avaliacoes?.[alvo] || (alvo === 'barbeiro' && !!a.avaliacao);
}

/**
 * Ainda dá para avaliar? Até 30 dias depois, uma vez por direção. Atendimento concluído vale para as três;
 * cancelamento, só para quem foi cancelado avaliar quem cancelou; falta, para o barbeiro avaliar o cliente.
 */
export function podeAvaliarAlvo(a: AgParaAvaliar, alvo: AlvoAvaliacao, agora: number) {
  if (jaAvaliado(a, alvo) || agora - a.fim >= DIAS_PARA_AVALIAR * 86_400_000) return false;
  if (alvo === 'barbearia') return a.status === 'concluido';
  if (alvo === 'barbeiro') return a.status === 'concluido' || (a.status === 'cancelado' && a.cancelamento?.por === 'casa');
  return !!a.clienteUid && (a.status === 'concluido' || a.status === 'faltou' || (a.status === 'cancelado' && a.cancelamento?.por === 'cliente'));
}

/**
 * Janela de avaliação da casa no Google. O Google não aceita estrelas nem texto pré-preenchidos (e não há API
 * para publicar pelo cliente): o app copia o comentário e abre esta página; a pessoa escolhe as estrelas e cola.
 */
export function linkAvaliacaoGoogle(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/** Place ID do Google: só letras, números, _ e - (nada que mude o endereço da chamada ao Google). */
export const placeIdValido = (id: string) => /^[A-Za-z0-9_-]{10,300}$/.test(id);
