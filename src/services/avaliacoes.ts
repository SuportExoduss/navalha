// Avaliações: o cliente avalia pelo Worker (que confere o atendimento e soma as notas); a página da casa
// mostra as últimas, com cache de 5 min como o resto da página.
import { collection, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { auth } from './firebase';
import { esquecer, lembrar } from './cache';
import type { Avaliacao } from '../types/models';

export async function avaliar(a: { id: string; barbeariaId: string }, estrelas: number, comentario: string) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Entre na sua conta para avaliar.');
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avaliacoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ agendamentoId: a.id, estrelas, comentario }),
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? 'Não foi possível enviar. Tente de novo.');
  // A nota da casa mudou: a página e a busca leem de novo.
  esquecer(`avaliacoes:${a.barbeariaId}`); esquecer(`casa:${a.barbeariaId}`); esquecer('perto:');
}

/** As 5 avaliações mais recentes da casa (5 leituras, guardadas 5 min). */
export function ultimasAvaliacoes(db: Firestore, barbeariaId: string): Promise<Avaliacao[]> {
  return lembrar(`avaliacoes:${barbeariaId}`, async () => (await getDocs(query(
    collection(db, 'avaliacoes'),
    where('barbeariaId', '==', barbeariaId), where('visivel', '==', true), where('direcao', '==', 'cliente_para_barbeiro'),
    orderBy('criadoEm', 'desc'), limit(5),
  ))).docs.map(d => d.data() as Avaliacao));
}
