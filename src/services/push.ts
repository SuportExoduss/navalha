// Web/PWA: o Expo Push não entrega na web. Os lembretes chegam pelo app Android
// (e pelo iOS na Fase 3); no navegador o cliente vê os horários em "Agendamentos".
export type ResultadoPush = 'ativo' | 'negado' | 'indisponivel';

export async function registrarPush(_uid: string, _tokenAtual?: string): Promise<ResultadoPush> {
  return 'indisponivel';
}
