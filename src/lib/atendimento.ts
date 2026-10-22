// Seguir cortes: o barbeiro inicia o corte, o app abre a tela do corte atual e só deixa iniciar outro depois de
// finalizar este. Lógica pura (o app decide os botões; a regra do Firestore já deixa a casa gravar o início).
import { dataLocal } from './agenda';

type AgCorte = { id: string; barbeiroId: string; status: string; inicio: number; iniciadoEm?: number };

/** Corte iniciado e ainda não finalizado. */
export const emAtendimento = (a: AgCorte) => !!a.iniciadoEm && a.status === 'confirmado';

/** O corte aberto do barbeiro na lista do dia (no máximo um). */
export function corteAberto<T extends AgCorte>(lista: T[], barbeiroId: string): T | undefined {
  return lista.find(a => a.barbeiroId === barbeiroId && emAtendimento(a));
}

/**
 * Pode iniciar? Horário de hoje, ainda de pé e sem início, e o barbeiro sem outro corte aberto.
 * ponytail: o bloqueio olha a agenda do dia; um corte de ontem esquecido aberto não trava o de hoje.
 */
export function podeIniciar(a: AgCorte, lista: AgCorte[], agora: number) {
  return ['reservado', 'confirmado'].includes(a.status) && !a.iniciadoEm
    && dataLocal(a.inicio) === dataLocal(agora) && !corteAberto(lista, a.barbeiroId);
}

/** Minutos desde o início do corte (para o "12 min de 45"). */
export const minutosDecorridos = (iniciadoEm: number, agora: number) => Math.max(0, Math.floor((agora - iniciadoEm) / 60_000));
