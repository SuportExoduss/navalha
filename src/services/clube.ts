// Clube de assinatura, lado da casa (docs/clube.md): planos, pedidos, "Recebi o pagamento" e encerrar.
// O app não cobra: a equipe marca o que recebeu na casa. Vencido, lembretes e reservas ficam com o Worker.
import {
  collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch,
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

// ---------- Lado do cliente ----------

/** Planos abertos da casa, para a página dela (leitura só ao abrir a página). */
export async function planosAbertos(db: Firestore, barbeariaId: string): Promise<PlanoClube[]> {
  const s = await getDocs(query(collection(db, 'barbearias', barbeariaId, 'clubePlanos'), where('ativo', '==', true)));
  return s.docs.map(d => d.data() as PlanoClube).sort((a, b) => a.precoCentavos - b.precoCentavos);
}

/** Os clubes da pessoa (em todas as casas): poucos documentos, um por casa. */
export function ouvirMeusClubes(db: Firestore, uid: string, cb: (l: Membro[]) => void, erro?: () => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'clubeMembros'), where('clienteUid', '==', uid)),
    s => cb(s.docs.map(d => ({ ...(d.data() as MembroClube), id: d.id })).sort((a, b) => b.atualizadoEm - a.atualizadoEm)), () => erro?.());
}

/**
 * "Quero assinar": nasce o pedido, ou volta a pedir depois de recusado ou de ter saído (pode trocar de plano).
 * Nome e limite vêm do plano: as regras conferem com o plano ativo.
 */
export async function solicitar(
  db: Firestore, casa: { id: string; nome: string }, plano: PlanoClube, cliente: { uid: string; nome: string }, anterior?: Membro,
) {
  const agora = Date.now();
  const id = `${casa.id}_${cliente.uid}`;
  const pedido = { status: 'solicitado' as const, planoId: plano.id, planoNome: plano.nome, clienteNome: cliente.nome.slice(0, 80), atualizadoEm: agora };
  if (anterior) {
    await updateDoc(doc(db, 'clubeMembros', id), { ...pedido, cortesPorMes: plano.cortesPorMes ?? deleteField() });
    return;
  }
  await setDoc(doc(db, 'clubeMembros', id), {
    ...pedido, ...(plano.cortesPorMes ? { cortesPorMes: plano.cortesPorMes } : {}),
    barbeariaId: casa.id, barbeariaNome: casa.nome, clienteUid: cliente.uid, criadoEm: agora,
  });
}

/** O cliente sai do clube (ou desiste do pedido). O horário fixo sai junto. */
export async function sair(db: Firestore, m: Membro) {
  await updateDoc(doc(db, 'clubeMembros', m.id), { status: 'saiu', horarioFixo: deleteField(), atualizadoEm: Date.now() });
}
