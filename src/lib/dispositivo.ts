// Detecção do aparelho na versão web, só para ajustar a interface (nunca para segurança:
// o navegador pode mentir o User-Agent).

export const LINK_PLAY_STORE = 'https://play.google.com/store/apps/details?id=br.com.navalha.app';

/** Android no navegador, e não o site já aberto como app pela Tela de Início. */
export function ehAndroidNoNavegador(userAgent: string, abertoComoApp: boolean): boolean {
  return /Android/i.test(userAgent) && !abertoComoApp;
}

const SETE_DIAS_MS = 7 * 86_400_000;

/** Quem fechou o aviso não vê de novo por 7 dias. */
export function mostrarAvisoApp(fechadoEm: number | null, agora: number): boolean {
  return fechadoEm === null || agora - fechadoEm > SETE_DIAS_MS;
}
