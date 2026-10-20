// Avisa o Worker que alguém (cliente ou casa) acabou de marcar ou cancelar: ele confere no Firestore e notifica
// os outros lados — cliente, barbeiro e dono (push + painel de notificações). Nunca atrapalha a reserva: se falhar, a reserva já está feita e segue normal.
import { auth } from './firebase';

export function avisarAgendamento(agendamentoId: string) {
  (async () => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/avisos/agendamento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ agendamentoId }),
    });
  })().catch(() => undefined);
}
