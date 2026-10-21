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

/** Ainda dá para avaliar? Só atendimento concluído, uma vez, até 30 dias depois. */
export function podeAvaliar(a: { status: string; fim: number; avaliacao?: unknown }, agora: number) {
  return a.status === 'concluido' && !a.avaliacao && agora - a.fim < DIAS_PARA_AVALIAR * 86_400_000;
}

/** Place ID do Google: só letras, números, _ e - (nada que mude o endereço da chamada ao Google). */
export const placeIdValido = (id: string) => /^[A-Za-z0-9_-]{10,300}$/.test(id);
