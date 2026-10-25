// Cupom do Navalha: o dono manda o código ao Worker, que confere e libera o plano do cupom (cortesia, sem Google Play).
import { auth } from './firebase';

export async function usarCupom(barbeariaId: string, codigo: string): Promise<{ nome: string; venceEm: number }> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Entre na sua conta para usar o cupom.');
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/cupom/resgatar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ barbeariaId, codigo }),
  }).catch(() => { throw new Error('Sem conexão. Confira a internet e tente de novo.'); });
  const j = (await r.json().catch(() => ({}))) as { erro?: string; nome?: string; venceEm?: number };
  if (!r.ok) throw new Error(j.erro ?? 'Não foi possível usar o cupom. Tente de novo.');
  return { nome: j.nome ?? '', venceEm: j.venceEm ?? 0 };
}
