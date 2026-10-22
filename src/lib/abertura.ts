// Tempo da abertura (splash em JS por cima da nativa). Sem login: só o tempo de carregar e a entrada elegante.
// Com login: no mínimo 1,35 s ou até a tela inicial estar pronta, o que vier por último. Tocar pula na hora.

export const MINIMO_LOGADO_MS = 1350;
/** Entrada da primeira vez (sem login): o logo sobe um pouco e some enquanto o login aparece. */
export const ENTRADA_MS = 650;
/** Saída de quem já está logado: só o fade. */
export const SAIDA_MS = 300;

/** Quanto falta esperar antes de começar a sair (0 = pode sair já). */
export function esperaRestante(inicio: number, agora: number, logado: boolean): number {
  return logado ? Math.max(0, MINIMO_LOGADO_MS - (agora - inicio)) : 0;
}
