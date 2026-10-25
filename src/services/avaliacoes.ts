// Avaliação da barbearia: o cliente manda as estrelas ao Worker (que confere o corte concluído e recalcula a nota);
// avaliar de novo edita a mesma. As avaliações não são públicas: a página da casa mostra só a média em estrelas.
import { auth } from './firebase';
import { esquecer } from './cache';

export async function avaliarBarbearia(a: { id: string; barbeariaId: string }, estrelas: number) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Entre na sua conta para avaliar.');
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avaliacoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ agendamentoId: a.id, estrelas }),
  }).catch(() => { throw new Error('Sem conexão. Confira a internet e tente de novo.'); });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erro?: string } | null)?.erro ?? 'Não foi possível enviar. Tente de novo.');
  // A nota da casa mudou: a página e a busca leem de novo.
  esquecer(`casa:${a.barbeariaId}`); esquecer('perto:');
}
