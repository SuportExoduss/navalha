// Avaliação da barbearia e ranking: lógica pura, usada pelo Worker (que grava as notas) e pelo app (que ordena a busca).
// Cada cliente tem uma avaliação por barbearia (avaliar de novo edita a mesma). A nota mostrada é a média simples;
// o ranking usa uma média bayesiana para uma casa com 1 avaliação 5★ não passar na frente de outra com 80 de 4,8★.

/** Nota "neutra" e quantas avaliações ela vale: puxa para o meio só a ordem das casas com poucas avaliações. */
const PRIOR_NOTA = 4;
const PRIOR_PESO = 10;

const duasCasas = (n: number) => Math.round(n * 100) / 100;

/** Soma das estrelas e quantidade: guardar a soma (inteira) evita o erro de arredondar a média a cada edição. */
export type Placar = { soma: number; total: number };

/**
 * Placar novo depois de uma avaliação: `antiga` é a estrela que o cliente já tinha dado à casa (edição) ou null.
 * Editar troca a nota sem mudar a quantidade.
 */
export function aplicarAvaliacao(p: Placar, antiga: number | null, nova: number): Placar {
  return antiga === null ? { soma: p.soma + nova, total: p.total + 1 } : { soma: p.soma - antiga + nova, total: p.total };
}

/** Média de 0,0 a 5,0 (0 = sem avaliações; o card mostra "Novo"). */
export const media = (p: Placar) => (p.total ? duasCasas(p.soma / p.total) : 0);

/** Nota usada só para ordenar "Mais bem avaliadas". */
export function notaRanking(p: Placar) {
  return p.total ? duasCasas((PRIOR_NOTA * PRIOR_PESO + p.soma) / (PRIOR_PESO + p.total)) : 0;
}

/** Pode avaliar a casa a partir deste atendimento? Só cliente com conta e corte concluído. */
export function podeAvaliarCasa(a: { status: string; clienteUid?: string | null }) {
  return a.status === 'concluido' && !!a.clienteUid;
}
