// Painel de notificações da casa: escuta só as 30 mais recentes do próprio usuário (cota) e marca como lidas.
import { collection, doc, limit, onSnapshot, orderBy, query, where, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { Notificacao } from '../lib/notificacoes';

export function ouvirNotificacoes(db: Firestore, uid: string, cb: (l: Notificacao[]) => void, erro?: (e: Error) => void): Unsubscribe {
  const q = query(collection(db, 'notificacoes'), where('paraUid', '==', uid), orderBy('em', 'desc'), limit(30));
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Notificacao)), erro);
}

export async function marcarLidas(db: Firestore, ids: string[]) {
  if (!ids.length) return;
  const lote = writeBatch(db);
  ids.forEach(id => lote.update(doc(db, 'notificacoes', id), { lida: true }));
  await lote.commit();
}
