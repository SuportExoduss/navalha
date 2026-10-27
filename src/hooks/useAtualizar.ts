// Puxar para atualizar: a Tela chama atualizarTudo e cada leitura feita uma vez (casa, lista perto, painel, clube)
// relê do servidor. O que já é escuta em tempo real (agenda, agendamentos, perfil) não precisa. Formulários não
// remontam: o que a pessoa digitou fica.
import { useSyncExternalStore } from 'react';
import { esquecer } from '../services/cache';

let versao = 0;
const ouvintes = new Set<() => void>();

export function atualizarTudo() {
  esquecer('');
  versao++;
  ouvintes.forEach(f => f());
}

/** Muda a cada puxada: ponha nas dependências do efeito que lê do servidor. */
export const useVersao = () => useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => versao);
