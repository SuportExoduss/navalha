// Avaliações: quem avalia manda para o Worker (que confere o atendimento e soma as notas). Leituras por tela:
// página da casa (públicas da barbearia), aba Avaliações da casa (dono: todas; barbeiro: as dele) e Perfil do cliente.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { auth } from './firebase';
import { esquecer, lembrar } from './cache';
import type { AlvoAvaliacao } from '../lib/avaliacoes';
import type { Avaliacao } from '../types/models';

export async function avaliar(a: { id: string; barbeariaId: string }, alvo: AlvoAvaliacao, estrelas: number, comentario: string) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Entre na sua conta para avaliar.');
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avaliacoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ agendamentoId: a.id, alvo, estrelas, comentario }),
  }).catch(() => { throw new Error('Sem conexão. Confira a internet e tente de novo.'); });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? 'Não foi possível enviar. Tente de novo.');
  // A nota da casa mudou: a página e a busca leem de novo.
  if (alvo === 'barbearia') { esquecer(`avaliacoes:${a.barbeariaId}`); esquecer(`casa:${a.barbeariaId}`); esquecer('perto:'); }
}

/** As 5 avaliações mais recentes da barbearia, na página da casa (5 leituras, guardadas 5 min). */
export function ultimasAvaliacoes(db: Firestore, barbeariaId: string): Promise<Avaliacao[]> {
  return lembrar(`avaliacoes:${barbeariaId}`, async () => (await getDocs(query(
    collection(db, 'avaliacoes'),
    where('barbeariaId', '==', barbeariaId), where('visivel', '==', true), where('direcao', '==', 'cliente_para_barbearia'),
    orderBy('criadoEm', 'desc'), limit(5),
  ))).docs.map(d => d.data() as Avaliacao));
}

// Listas internas: as 50 mais recentes (cada uma é 1 leitura). ponytail: paginar se uma casa passar disso.
const LIMITE = 50;

/** Dono: todas as avaliações da casa (da barbearia, dos barbeiros e as que a casa deu aos clientes). */
export async function avaliacoesDaCasa(db: Firestore, barbeariaId: string): Promise<Avaliacao[]> {
  const s = await getDocs(query(collection(db, 'avaliacoes'), where('barbeariaId', '==', barbeariaId), orderBy('criadoEm', 'desc'), limit(LIMITE)));
  return s.docs.map(d => d.data() as Avaliacao);
}

/** Barbeiro: as que os clientes deram a ele. */
export async function avaliacoesDoBarbeiro(db: Firestore, uid: string): Promise<Avaliacao[]> {
  const s = await getDocs(query(collection(db, 'avaliacoes'), where('barbeiroId', '==', uid), orderBy('criadoEm', 'desc'), limit(LIMITE)));
  return s.docs.map(d => d.data() as Avaliacao).filter(a => a.direcao === 'cliente_para_barbeiro');
}

/** Cliente: as que os barbeiros deram a ele (Perfil › Minhas avaliações). */
export async function avaliacoesRecebidasPeloCliente(db: Firestore, uid: string): Promise<Avaliacao[]> {
  const s = await getDocs(query(collection(db, 'avaliacoes'), where('clienteUid', '==', uid), orderBy('criadoEm', 'desc'), limit(LIMITE)));
  return s.docs.map(d => d.data() as Avaliacao).filter(a => a.direcao === 'barbeiro_para_cliente');
}

/** Média do cliente, para a casa ver no agendamento (1 leitura por cliente, guardada 5 min). */
export function notaDoCliente(db: Firestore, clienteUid: string): Promise<{ media: number; total: number } | null> {
  return lembrar(`notaCliente:${clienteUid}`, async () => {
    const s = await getDoc(doc(db, 'notasCliente', clienteUid));
    return s.exists() ? (s.data() as { media: number; total: number }) : null;
  });
}
