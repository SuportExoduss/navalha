// Reserva com trava contra horário duplo: cria, numa única transação,
// o agendamento e um documento de ocupação por bloco de horário.
// Se qualquer bloco já existir, a transação aborta e nada é gravado.
import {
  addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, setDoc,
  where, updateDoc, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import {
  chavesOcupacao, dataLocal, expedienteEfetivo, gerarHorarios, paraMillis, somarDias, type Intervalo,
} from '../lib/agenda';
import type {
  Agendamento, Barbearia, Barbeiro, Bloqueio, EventoUso, ISODate, Millis, Servico, StatusAgendamento,
} from '../types/models';

export class HorarioOcupadoError extends Error {
  constructor() { super('Esse horário acabou de ser ocupado. Escolha outro.'); }
}

export interface NovaReserva {
  barbeariaId: string;
  barbeiroId: string;
  barbeariaNome?: string;
  barbeiroNome?: string;
  servico: Pick<Servico, 'id' | 'nome' | 'precoCentavos' | 'duracaoMin'>;
  cliente: { uid: string | null; nome: string };
  inicio: number;
  passoMin: number;
  origem: 'app' | 'balcao';
}

export async function reservar(db: Firestore, r: NovaReserva): Promise<string> {
  const ref = doc(collection(db, 'agendamentos'));
  const chaves = chavesOcupacao(r.barbeiroId, r.inicio, r.servico.duracaoMin, r.passoMin);
  const fim = r.inicio + r.servico.duracaoMin * 60_000;
  const agora = Date.now();

  await runTransaction(db, async tx => {
    const refs = chaves.map(k => doc(db, 'ocupacao', k));
    const lidos = await Promise.all(refs.map(o => tx.get(o)));
    if (lidos.some(s => s.exists())) throw new HorarioOcupadoError();

    const ag: Agendamento = {
      id: ref.id,
      barbeariaId: r.barbeariaId,
      barbeiroId: r.barbeiroId,
      ...(r.barbeariaNome ? { barbeariaNome: r.barbeariaNome } : {}),
      ...(r.barbeiroNome ? { barbeiroNome: r.barbeiroNome } : {}),
      clienteUid: r.cliente.uid,
      clienteNome: r.cliente.nome,
      servicoId: r.servico.id,
      servicoNome: r.servico.nome,
      precoCentavos: r.servico.precoCentavos,
      duracaoMin: r.servico.duracaoMin,
      data: dataLocal(r.inicio),
      inicio: r.inicio,
      fim,
      slots: chaves,
      status: r.origem === 'balcao' ? 'confirmado' : 'reservado',
      origem: r.origem,
      lembretes: {},
      fotos: [],
      criadoEm: agora,
      atualizadoEm: agora,
    };
    tx.set(ref, ag);
    refs.forEach(o => tx.set(o, { barbeariaId: r.barbeariaId, barbeiroId: r.barbeiroId, agendamentoId: ref.id, inicio: r.inicio }));
  });
  return ref.id;
}

/** Cancela e libera os blocos de horário na mesma transação. O motivo fica registrado para o outro lado ver. */
export async function cancelar(
  db: Firestore, ag: Pick<Agendamento, 'id' | 'slots'>, motivo?: { por: 'cliente' | 'casa'; motivo: string },
) {
  const agora = Date.now();
  const texto = motivo?.motivo.trim().slice(0, 200);
  await runTransaction(db, async tx => {
    tx.update(doc(db, 'agendamentos', ag.id), {
      status: 'cancelado', atualizadoEm: agora,
      ...(motivo && texto ? { cancelamento: { por: motivo.por, motivo: texto, em: agora } } : {}),
    });
    ag.slots.forEach(k => tx.delete(doc(db, 'ocupacao', k)));
  });
}

export async function concluir(db: Firestore, id: string, fotos: string[]) {
  await updateDoc(doc(db, 'agendamentos', id), { status: 'concluido', fotos, atualizadoEm: Date.now() });
}

function consultaOcupacao(db: Firestore, barbeiroId: string, data: ISODate) {
  return query(
    collection(db, 'ocupacao'),
    where('barbeiroId', '==', barbeiroId),
    where('inicio', '>=', paraMillis(data, 0) - 4 * 3_600_000),
    where('inicio', '<', paraMillis(data, 24 * 60)),
  );
}

/** Cada documento de ocupação = um bloco de `passoMin` minutos; o horário vem do próprio ID. */
function blocosDe(ids: string[], passoMin: number): Intervalo[] {
  return ids.map(id => {
    const [, dataBloco, hhmm] = id.split('_');
    const inicio = paraMillis(dataBloco, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2)));
    return { inicio, fim: inicio + passoMin * 60_000 };
  });
}

/** Intervalos ocupados de um barbeiro num dia (escuta só o dia aberto na tela). */
export async function ocupadosDoDia(
  db: Firestore, barbeiroId: string, data: ISODate, passoMin: number,
): Promise<Intervalo[]> {
  const snap = await getDocs(consultaOcupacao(db, barbeiroId, data));
  return blocosDe(snap.docs.map(d => d.id), passoMin);
}

// ---------- Sprint 3: horários livres, agenda do dia e folgas ----------

/** Folgas e pausas pontuais do barbeiro que tocam o dia. */
export async function bloqueiosDoDia(db: Firestore, barbeariaId: string, barbeiroId: string, data: ISODate): Promise<Intervalo[]> {
  const ini = paraMillis(data, 0);
  const fim = paraMillis(somarDias(data, 1), 0);
  const q = query(
    collection(db, 'barbearias', barbeariaId, 'bloqueios'),
    where('barbeiroId', '==', barbeiroId),
    where('fim', '>', ini),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Bloqueio).filter(b => b.inicio < fim).map(b => ({ inicio: b.inicio, fim: b.fim }));
}

/** Horários livres de um barbeiro num dia para um corte: expediente da casa ∩ do barbeiro, menos ocupação e folgas. */
export async function horariosLivres(
  db: Firestore,
  p: { barbearia: Barbearia; barbeiro: Barbeiro; duracaoMin: number; data: ISODate; agora?: Millis; antecedenciaMin?: number },
): Promise<Millis[]> {
  const [ocupados, folgas] = await Promise.all([
    ocupadosDoDia(db, p.barbeiro.uid, p.data, p.barbearia.passoMin),
    bloqueiosDoDia(db, p.barbearia.id, p.barbeiro.uid, p.data),
  ]);
  return gerarHorarios({
    data: p.data,
    expediente: expedienteEfetivo(p.barbearia.expediente, p.barbeiro.expediente),
    duracaoMin: p.duracaoMin,
    passoMin: p.barbearia.passoMin,
    ocupados: [...ocupados, ...folgas],
    agora: p.agora ?? Date.now(),
    antecedenciaMin: p.antecedenciaMin ?? p.barbearia.antecedenciaMin,
  });
}

/**
 * Horários livres em tempo real: quando alguém reserva (ou cancela), a grade de quem está
 * escolhendo muda na hora, sem esperar o "acabou de ser ocupado" no confirmar.
 * Escuta só a ocupação do dia aberto; folgas mudam pouco e são lidas uma vez.
 */
export function ouvirHorariosLivres(
  db: Firestore,
  p: { barbearia: Barbearia; barbeiro: Barbeiro; duracaoMin: number; data: ISODate; agora?: () => Millis; antecedenciaMin?: number },
  cb: (horarios: Millis[]) => void,
  erro: (e: Error) => void,
): Unsubscribe {
  let parar: Unsubscribe | null = null;
  let ativo = true;
  bloqueiosDoDia(db, p.barbearia.id, p.barbeiro.uid, p.data).then(folgas => {
    if (!ativo) return;
    parar = onSnapshot(consultaOcupacao(db, p.barbeiro.uid, p.data), s => cb(gerarHorarios({
      data: p.data,
      expediente: expedienteEfetivo(p.barbearia.expediente, p.barbeiro.expediente),
      duracaoMin: p.duracaoMin,
      passoMin: p.barbearia.passoMin,
      ocupados: [...blocosDe(s.docs.map(d => d.id), p.barbearia.passoMin), ...folgas],
      agora: p.agora?.() ?? Date.now(),
      antecedenciaMin: p.antecedenciaMin ?? p.barbearia.antecedenciaMin,
    })), erro);
  }).catch(erro);
  return () => { ativo = false; parar?.(); };
}

/** Agenda da casa num dia, em tempo real (escuta só o dia aberto na tela). */
export function ouvirAgendaDoDia(
  db: Firestore, barbeariaId: string, data: ISODate, cb: (l: Agendamento[]) => void, erro?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'agendamentos'),
    where('barbeariaId', '==', barbeariaId),
    where('data', '==', data),
    orderBy('inicio'),
  );
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Agendamento)), erro);
}

/** Agendamentos do cliente, mais recentes primeiro. */
export function ouvirMeusAgendamentos(
  db: Firestore, uid: string, cb: (l: Agendamento[]) => void, erro?: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'agendamentos'), where('clienteUid', '==', uid), orderBy('inicio', 'desc'), limit(50));
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Agendamento)), erro);
}

/** A casa confirma, marca falta ou conclui. Cancelar usa `cancelar`, que libera os horários. */
export async function definirStatus(db: Firestore, id: string, status: Extract<StatusAgendamento, 'confirmado' | 'concluido' | 'faltou'>) {
  await updateDoc(doc(db, 'agendamentos', id), { status, atualizadoEm: Date.now() });
}

export function ouvirFolgas(
  db: Firestore, barbeariaId: string, barbeiroId: string, cb: (l: Bloqueio[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'barbearias', barbeariaId, 'bloqueios'),
    where('barbeiroId', '==', barbeiroId),
    where('fim', '>', Date.now()),
    orderBy('fim'),
  );
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Bloqueio).sort((a, b) => a.inicio - b.inicio)));
}

export async function criarFolga(db: Firestore, barbeariaId: string, b: Omit<Bloqueio, 'id'>) {
  const ref = doc(collection(db, 'barbearias', barbeariaId, 'bloqueios'));
  await setDoc(ref, { ...b, id: ref.id });
  return ref.id;
}

export async function removerFolga(db: Firestore, barbeariaId: string, id: string) {
  await deleteDoc(doc(db, 'barbearias', barbeariaId, 'bloqueios', id));
}

/** Métricas do piloto: nunca deixam a ação principal falhar. */
export function registrarEvento(db: Firestore, e: EventoUso) {
  addDoc(collection(db, 'eventos'), e).catch(() => undefined);
}

/** Agendamentos da casa dos últimos 7 dias até hoje (painel do dono): uma consulta só. */
export async function agendamentosDaSemana(db: Firestore, barbeariaId: string, hoje: ISODate): Promise<Agendamento[]> {
  const q = query(
    collection(db, 'agendamentos'),
    where('barbeariaId', '==', barbeariaId),
    where('data', '>=', somarDias(hoje, -6)),
    where('data', '<=', hoje),
  );
  return (await getDocs(q)).docs.map(d => d.data() as Agendamento);
}
