// Avisa o Worker que o cliente acabou de marcar ou cancelar: ele confere no Firestore e notifica o barbeiro e o dono
// (push + painel de notificações). Nunca atrapalha a reserva: se falhar, a reserva já está feita e segue normal.
import { auth } from './firebase';

export function avisarCasa(agendamentoId: string) {
  (async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avisos/agendamento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ agendamentoId }),
    });
  })().catch(() => undefined);
}
