// Avaliação da barbearia: o cliente manda ao Worker (que confere o corte concluído e recalcula a nota); avaliar de
// novo edita a mesma. A página da casa lê as avaliações (públicas) na aba Avaliações.
import { collection, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { auth } from './firebase';
import { esquecer, lembrar } from './cache';
import type { Avaliacao } from '../types/models';

export async function avaliarBarbearia(a: { id: string; barbeariaId: string }, estrelas: number, comentario: string) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Entre na sua conta para avaliar.');
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avaliacoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ agendamentoId: a.id, estrelas, comentario }),
  }).catch(() => { throw new Error('Sem conexão. Confira a internet e tente de novo.'); });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? 'Não foi possível enviar. Tente de novo.');
  // A nota da casa mudou: a página e a busca leem de novo.
  esquecer(`avaliacoes:${a.barbeariaId}`); esquecer(`casa:${a.barbeariaId}`); esquecer('perto:');
}

// ponytail: as 50 mais recentes (1 leitura cada, guardadas 5 min); paginar se uma casa passar disso.
const LIMITE = 50;

/** Avaliações da casa, das mais recentes (aba Avaliações da página da casa). */
export function avaliacoesDaBarbearia(db: Firestore, barbeariaId: string): Promise<Avaliacao[]> {
  return lembrar(`avaliacoes:${barbeariaId}`, async () => (await getDocs(query(
    collection(db, 'avaliacoes'),
    where('barbeariaId', '==', barbeariaId), where('visivel', '==', true), where('direcao', '==', 'cliente_para_barbearia'),
    orderBy('criadoEm', 'desc'), limit(LIMITE),
  ))).docs.map(d => d.data() as Avaliacao));
}
