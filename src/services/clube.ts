// Clube de assinatura, lado da casa (docs/clube.md): planos, pedidos, "Recebi o pagamento" e encerrar.
// O app não cobra: a equipe marca o que recebeu na casa. Vencido, lembretes e reservas ficam com o Worker.
import {
  collection, deleteDoc, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch,
  type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { novoCiclo } from '../lib/clube';
import type { MembroClube, PlanoClube } from '../types/models';

/** Membro com o id do documento (barbeariaId_uid), que as listas e as gravações usam. */
export type Membro = MembroClube & { id: string };

export function ouvirPlanos(db: Firestore, barbeariaId: string, cb: (l: PlanoClube[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'barbearias', barbeariaId, 'clubePlanos'),
    s => cb(s.docs.map(d => d.data() as PlanoClube).sort((a, b) => a.precoCentavos - b.precoCentavos)));
}

export function novoIdPlano(db: Firestore, barbeariaId: string): string {
  return doc(collection(db, 'barbearias', barbeariaId, 'clubePlanos')).id;
}

export async function salvarPlano(db: Firestore, barbeariaId: string, p: PlanoClube) {
  // Firestore não aceita undefined: plano ilimitado vai sem o campo.
  const { cortesPorMes, ...resto } = p;
  await setDoc(doc(db, 'barbearias', barbeariaId, 'clubePlanos', p.id),
    { ...resto, ...(cortesPorMes ? { cortesPorMes } : {}), atualizadoEm: Date.now() });
}

export async function removerPlano(db: Firestore, barbeariaId: string, id: string) {
  await deleteDoc(doc(db, 'barbearias', barbeariaId, 'clubePlanos', id));
}

/** Pedidos e assinantes da casa (quem saiu ou foi recusado fica de fora: menos leituras). */
export function ouvirMembrosDaCasa(db: Firestore, barbeariaId: string, cb: (l: Membro[]) => void, erro?: () => void): Unsubscribe {
  const q = query(collection(db, 'clubeMembros'), where('barbeariaId', '==', barbeariaId), where('status', 'in', ['solicitado', 'ativo', 'vencido']));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ ...(d.data() as MembroClube), id: d.id }))), () => erro?.());
}

/**
 * Pagamento recebido na casa: abre o ciclo seguinte e guarda no histórico, na mesma gravação.
 * Aceitar um pedido é o primeiro pagamento (o ciclo começa agora).
 */
export async function registrarPagamento(db: Firestore, m: Membro, porUid: string, valorCentavos: number, agora = Date.now()) {
  const ciclo = novoCiclo(m.status === 'solicitado' ? undefined : m.venceEm, agora);
  const lote = writeBatch(db);
  lote.update(doc(db, 'clubeMembros', m.id), {
    status: 'ativo', ...ciclo, atualizadoEm: agora,
    // Lembretes do ciclo velho saem; o Worker avisa de novo no próximo vencimento.
    ...(m.status === 'solicitado' ? {} : { lembretes: deleteField() }),
  });
  lote.set(doc(collection(db, 'clubeMembros', m.id, 'pagamentos')), { em: agora, porUid, valorCentavos, venceEmNovo: ciclo.venceEm });
  await lote.commit();
  return ciclo.venceEm;
}

export async function recusar(db: Firestore, m: Membro) {
  await updateDoc(doc(db, 'clubeMembros', m.id), { status: 'recusado', atualizadoEm: Date.now() });
}

/** Encerrar pela casa. ponytail: as reservas futuras do horário fixo o Worker cancela (etapa 6 do docs/clube.md). */
export async function encerrar(db: Firestore, m: Membro) {
  await updateDoc(doc(db, 'clubeMembros', m.id), { status: 'saiu', horarioFixo: deleteField(), atualizadoEm: Date.now() });
}
