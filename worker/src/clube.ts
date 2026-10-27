// Clube de assinatura (docs/clube.md), cron próprio de hora em hora:
//  - pedido novo → aviso para o dono e os barbeiros ativos da casa;
//  - 3 dias antes e no dia do vencimento → lembrete ao cliente (só de dia);
//  - 1 dia depois do vencimento sem pagamento → status "vencido" e aviso ao cliente e ao dono.
// O que avisar e os textos ficam em src/lib/clube.ts (testados). Cada aviso grava a marca em `lembretes` junto
// com a notificação, então rodar de novo não repete.
import {
  avisoDevido, chaveHorarioFixo, horarioFixoPendente, motivoSemClube, planoHorarioFixo, textoAvisoClube, usosNoCiclo, type AvisoClube,
} from '../../src/lib/clube';
import { chavesOcupacao, dataLocal, expedienteEfetivo, formatarData, gerarHorarios, paraMillis } from '../../src/lib/agenda';
import type { Agendamento, Expediente, MembroClube, PlanoClube } from '../../src/types/models';
import { enviarPush } from './avisos';
import { APAGAR, type Firestore } from './firestore';

const DIA = 86_400_000;
// ponytail: até 20 membros por execução (limite de 50 chamadas do Worker grátis: consultas, gravação e um push por
// aviso). O que sobrar vai na hora seguinte; acima de ~400 avisos por dia, Workers pago ou fila.
const POR_EXECUCAO = 20;

type Membro = MembroClube & { lembretes?: Partial<Record<AvisoClube, number>> };

export async function rotinaClube(db: Firestore, tokenSA: string, projectId: string, agora = Date.now()) {
  const igual = (campo: string, valor: string) => ({ fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } } });
  const [pedidos, perto] = await Promise.all([
    db.query({ from: [{ collectionId: 'clubeMembros' }], where: igual('status', 'solicitado'), limit: 100 }),
    // Ativos que vencem em até 3 dias ou já venceram (índice status + venceEm).
    db.query({
      from: [{ collectionId: 'clubeMembros' }], limit: 200,
      where: { compositeFilter: { op: 'AND', filters: [igual('status', 'ativo'),
        { fieldFilter: { field: { fieldPath: 'venceEm' }, op: 'LESS_THAN_OR_EQUAL', value: { integerValue: String(agora + 3 * DIA) } } }] } },
    }),
  ]);
  const fila = [...pedidos, ...perto]
    .map(({ id, dados }) => ({ id, m: dados as unknown as Membro, tipo: avisoDevido(dados as unknown as Membro, agora) }))
    .filter((x): x is { id: string; m: Membro; tipo: AvisoClube } => x.tipo !== null)
    .slice(0, POR_EXECUCAO);
  if (!fila.length) return { avisos: 0 };

  // Quem é a casa: o dono de cada uma (uma leitura só) e, para pedidos, os barbeiros ativos (que também aceitam).
  const casas = await db.varios([...new Set(fila.map(f => `barbearias/${f.m.barbeariaId}`))]);
  const equipe = new Map<string, string[]>();
  for (const bid of new Set(fila.filter(f => f.tipo === 'pedido').map(f => f.m.barbeariaId))) {
    const bs = await db.query({ from: [{ collectionId: 'barbeiros' }], where: { fieldFilter: { field: { fieldPath: 'ativo' }, op: 'EQUAL', value: { booleanValue: true } } } }, `barbearias/${bid}`);
    equipe.set(bid, bs.map(b => b.id));
  }

  const notifs: { id: string; paraUid: string; barbeariaId: string; titulo: string; corpo: string; link: string }[] = [];
  const marcas: { caminho: string; campos: Record<string, unknown> }[] = [];
  for (const { id, m, tipo } of fila) {
    const dono = casas.get(`barbearias/${m.barbeariaId}`)?.donoUid as string | undefined;
    const casa = tipo === 'pedido' ? [...new Set([dono, ...(equipe.get(m.barbeariaId) ?? [])])] : tipo === 'vencido' ? [dono] : [];
    const para = [...casa.filter((u): u is string => !!u).map(u => ({ u, papel: 'casa' as const })),
      ...(tipo === 'pedido' ? [] : [{ u: m.clienteUid, papel: 'cliente' as const }])];
    // Id fixo por ciclo (ou pedido): o mesmo aviso nunca duplica no sino.
    const ciclo = tipo === 'pedido' ? m.atualizadoEm : m.venceEm;
    for (const { u, papel } of para) {
      notifs.push({ id: `clube_${id}_${tipo}_${ciclo}_${u}`, paraUid: u, barbeariaId: m.barbeariaId, ...textoAvisoClube(tipo, m, papel, agora),
        link: `https://navalha.web.app/${papel === 'cliente' ? 'meu-clube' : 'clube'}` });
    }
    marcas.push({ caminho: `clubeMembros/${id}`, campos: {
      [`lembretes.${tipo}`]: agora,
      // Vencido: a casa ainda pode marcar o pagamento (as regras aceitam de "vencido" para "ativo").
      ...(tipo === 'vencido' ? { status: 'vencido', atualizadoEm: agora } : {}),
    } });
  }
  await db.escrever([
    ...notifs.map(({ link: _, ...n }) => ({ caminho: `notificacoes/${n.id}`, criar: true, campos: { ...n, tipo: 'clube', em: agora, lida: false } })),
    ...marcas,
  ]);
  const perfis = await db.varios([...new Set(notifs.map(n => `users/${n.paraUid}`))]);
  for (const n of notifs) {
    const token = perfis.get(`users/${n.paraUid}`)?.pushToken as string | undefined;
    if (token) await enviarPush(projectId, tokenSA, { token, title: n.titulo, body: n.corpo, agendamentoId: n.id, link: n.link });
  }
  return { avisos: notifs.length };
}

/**
 * POST /clube/agendar — o cliente marca um horário pelo clube (sem preço). Só o Worker cria agendamento com origem
 * "clube" (as regras barram o app): aqui ele confere o membro, o plano, o limite do ciclo e a casa, e grava o
 * agendamento e os blocos de ocupação num commit só, que falha inteiro se algum bloco já foi pego.
 * ponytail: contar os usos e gravar não é uma transação; duas reservas no mesmo segundo podem passar o limite em 1.
 * Transação REST (beginTransaction + runQuery) se isso aparecer.
 */
export async function agendarPeloClube(
  db: Firestore, uid: string, barbeariaId: string, servicoId: string, inicio: number, agora = Date.now(),
) {
  const erro = (status: number, msg: string) => ({ status, corpo: { erro: msg } });
  const membroId = `${barbeariaId}_${uid}`;
  const docs = await db.varios([`users/${uid}`, `clubeMembros/${membroId}`, `barbearias/${barbeariaId}`, `barbearias/${barbeariaId}/servicos/${servicoId}`]);
  const perfil = docs.get(`users/${uid}`);
  const m = docs.get(`clubeMembros/${membroId}`) as unknown as MembroClube | undefined;
  const casa = docs.get(`barbearias/${barbeariaId}`);
  const s = docs.get(`barbearias/${barbeariaId}/servicos/${servicoId}`);
  if (typeof perfil?.maiorDeIdadeEm !== 'number') return erro(403, 'Confirme sua idade no app antes de reservar.');
  if (!casa || casa.emDia !== true) return erro(409, 'Esta barbearia não está recebendo horários agora.');
  if (!s || s.ativo === false) return erro(409, 'Este corte saiu do cardápio.');
  const passoMin = Number(casa.passoMin), duracaoMin = Number(s.duracaoMin), barbeiroId = String(s.barbeiroId);
  if (!Number.isInteger(inicio) || inicio <= agora || inicio % (passoMin * 60_000) !== 0
    || inicio > agora + (Number(casa.janelaDias) + 1) * DIA) return erro(400, 'Horário inválido.');

  const extra = await db.varios([...(m ? [`barbearias/${barbeariaId}/clubePlanos/${m.planoId}`] : []), `barbearias/${barbeariaId}/barbeiros/${barbeiroId}`]);
  const barbeiro = extra.get(`barbearias/${barbeariaId}/barbeiros/${barbeiroId}`);
  if (!barbeiro || barbeiro.ativo === false) return erro(409, 'Este barbeiro não atende mais aqui.');
  const plano = m ? extra.get(`barbearias/${barbeariaId}/clubePlanos/${m.planoId}`) as unknown as PlanoClube | undefined : undefined;
  const ags = m ? await db.query({ from: [{ collectionId: 'agendamentos' }],
    where: { fieldFilter: { field: { fieldPath: 'clubeMembroId' }, op: 'EQUAL', value: { stringValue: membroId } } } }) : [];
  const motivo = motivoSemClube(m, plano, servicoId, inicio, m ? usosNoCiclo(ags.map(a => a.dados as unknown as Agendamento), m) : 0);
  if (motivo) return erro(403, motivo);

  const id = await gravarReserva(db, { barbeariaId, casa, s, servicoId, barbeiro, barbeiroId, perfil, uid, membroId, inicio }, agora);
  return id ? { status: 200, corpo: { ok: true, agendamentoId: id } } : { status: 409, corpo: { erro: 'Esse horário acabou de ser ocupado. Escolha outro.', ocupado: true } };
}

type Doc = Record<string, unknown>;

/** Agendamento do clube (preço 0) + blocos de ocupação num commit só. Bloco já pego: nada gravado, devolve null. */
async function gravarReserva(db: Firestore, r: {
  barbeariaId: string; casa: Doc; s: Doc; servicoId: string; barbeiro: Doc; barbeiroId: string; perfil: Doc; uid: string;
  membroId: string; inicio: number; fixo?: boolean;
}, agora: number): Promise<string | null> {
  const { barbeariaId, barbeiroId, inicio } = r;
  const duracaoMin = Number(r.s.duracaoMin);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const slots = chavesOcupacao(barbeiroId, inicio, duracaoMin, Number(r.casa.passoMin));
  const telefone = typeof r.perfil.telefone === 'string' ? r.perfil.telefone : '';
  const ag = {
    id, barbeariaId, barbeiroId, barbeariaNome: r.casa.nome, barbeiroNome: r.barbeiro.apelido || r.barbeiro.nome,
    clienteUid: r.uid, clienteNome: r.perfil.apelido || r.perfil.nome || 'Cliente', ...(telefone ? { clienteTelefone: telefone } : {}),
    servicoId: r.servicoId, servicoNome: r.s.nome, precoCentavos: 0, duracaoMin,
    data: dataLocal(inicio), inicio, fim: inicio + duracaoMin * 60_000, slots,
    status: 'reservado', origem: 'clube', clubeMembroId: r.membroId, ...(r.fixo ? { fixo: true } : {}),
    lembretes: {}, criadoEm: agora, atualizadoEm: agora,
  };
  const ok = await db.criarTodos([
    { caminho: `agendamentos/${id}`, campos: ag },
    ...slots.map(k => ({ caminho: `ocupacao/${k}`, campos: { barbeariaId, barbeiroId, agendamentoId: id, inicio } })),
  ]);
  return ok ? id : null;
}

/**
 * Põe o horário fixo em dia (src/lib/clube.ts › planoHorarioFixo): cancela as reservas futuras que não valem mais
 * (liberando os blocos no mesmo commit) e reserva as datas do ciclo pago, cada uma com a trava. Data em folga, fora
 * do expediente, já ocupada ou além do limite de cortes não é reservada e volta em `naoCouberam`.
 */
export async function sincronizarHorarioFixo(db: Firestore, membroId: string, agora = Date.now()) {
  const m = (await db.varios([`clubeMembros/${membroId}`])).get(`clubeMembros/${membroId}`) as unknown as MembroClube | undefined;
  const res = { reservados: [] as string[], naoCouberam: [] as string[], cancelados: 0 };
  if (!m) return res;
  const ags = (await db.query({ from: [{ collectionId: 'agendamentos' }],
    where: { fieldFilter: { field: { fieldPath: 'clubeMembroId' }, op: 'EQUAL', value: { stringValue: membroId } } } }))
    .map(a => a.dados as unknown as Agendamento);
  const futuras = ags.filter(a => a.fixo && (a.status === 'reservado' || a.status === 'confirmado') && a.inicio > agora);
  const plano = planoHorarioFixo(m, futuras.map(a => a.id), agora);
  const cancelar = futuras.filter(a => plano.cancelar.includes(a.id));
  // Primeiro libera: o horário novo pode cair em cima do antigo.
  await db.escrever(cancelar.map(a => ({ caminho: `agendamentos/${a.id}`, campos: { status: 'cancelado', atualizadoEm: agora } })),
    cancelar.flatMap(a => a.slots.map(k => `ocupacao/${k}`)));
  res.cancelados = cancelar.length;

  const h = m.horarioFixo;
  if (h && plano.datas.length) {
    const bid = m.barbeariaId;
    const [docs, folgas] = await Promise.all([
      db.varios([`users/${m.clienteUid}`, `barbearias/${bid}`, `barbearias/${bid}/servicos/${h.servicoId}`,
        `barbearias/${bid}/barbeiros/${h.barbeiroId}`, `barbearias/${bid}/clubePlanos/${m.planoId}`]),
      db.query({ from: [{ collectionId: 'bloqueios' }],
        where: { fieldFilter: { field: { fieldPath: 'barbeiroId' }, op: 'EQUAL', value: { stringValue: h.barbeiroId } } } }, `barbearias/${bid}`),
    ]);
    const perfil = docs.get(`users/${m.clienteUid}`), casa = docs.get(`barbearias/${bid}`);
    const s = docs.get(`barbearias/${bid}/servicos/${h.servicoId}`), barbeiro = docs.get(`barbearias/${bid}/barbeiros/${h.barbeiroId}`);
    const pc = docs.get(`barbearias/${bid}/clubePlanos/${m.planoId}`) as unknown as PlanoClube | undefined;
    const pode = !!perfil && casa?.emDia === true && !!s && s.ativo !== false && s.barbeiroId === h.barbeiroId && !!barbeiro && barbeiro.ativo !== false;
    const ocupados = folgas.map(f => ({ inicio: Number(f.dados.inicio), fim: Number(f.dados.fim) })).filter(f => f.fim > agora);
    let usos = usosNoCiclo(ags.filter(a => !plano.cancelar.includes(a.id)), m);
    for (const data of plano.datas) {
      const inicio = paraMillis(data, h.minutos);
      const cabe = pode && !motivoSemClube(m, pc, h.servicoId, inicio, usos) && gerarHorarios({
        data, expediente: expedienteEfetivo(casa!.expediente as Expediente, barbeiro!.expediente as Expediente),
        duracaoMin: Number(s!.duracaoMin), passoMin: Number(casa!.passoMin), ocupados, agora, antecedenciaMin: 0,
      }).includes(inicio);
      const id = cabe ? await gravarReserva(db, { barbeariaId: bid, casa: casa!, s: s!, servicoId: h.servicoId, barbeiro: barbeiro!,
        barbeiroId: h.barbeiroId, perfil: perfil!, uid: m.clienteUid, membroId, inicio, fixo: true }, agora) : null;
      if (id) { res.reservados.push(data); usos++; } else res.naoCouberam.push(data);
    }
  }
  await db.escrever([{ caminho: `clubeMembros/${membroId}`, campos: plano.ate && h
    ? { reservadoAte: plano.ate, reservadoPara: chaveHorarioFixo(h) } : { reservadoAte: APAGAR, reservadoPara: APAGAR } }]);
  return res;
}

/** POST /clube/horario-fixo — depois de escolher, trocar ou tirar o horário fixo (cliente) ou de encerrar (casa). */
export async function horarioFixoAgora(db: Firestore, uid: string, barbeariaId: string, clienteUid: string, agora = Date.now()) {
  if (uid !== clienteUid) {
    const docs = await db.varios([`barbearias/${barbeariaId}`, `barbearias/${barbeariaId}/barbeiros/${uid}`]);
    const b = docs.get(`barbearias/${barbeariaId}/barbeiros/${uid}`);
    if (docs.get(`barbearias/${barbeariaId}`)?.donoUid !== uid && (!b || b.ativo === false)) return { status: 403, corpo: { erro: 'Sem permissão.' } };
  }
  return { status: 200, corpo: { ok: true, ...(await sincronizarHorarioFixo(db, `${barbeariaId}_${clienteUid}`, agora)) } };
}

// ponytail: 2 membros por execução (cada um gasta ~10 das 50 chamadas do Worker grátis, junto com os avisos).
// Dá 48 por dia; acima disso, Workers pago ou fila.
const FIXOS_POR_EXECUCAO = 2;

/** Cron: horário fixo novo ou ciclo renovado → reserva as datas; o que não coube vira aviso ao cliente. */
export async function preencherHorariosFixos(db: Firestore, tokenSA: string, projectId: string, agora = Date.now()) {
  const ativos = await db.query({ from: [{ collectionId: 'clubeMembros' }], limit: 300,
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'ativo' } } } });
  const fila = ativos.filter(a => horarioFixoPendente(a.dados as unknown as MembroClube)).slice(0, FIXOS_POR_EXECUCAO);
  for (const { id, dados } of fila) {
    const m = dados as unknown as MembroClube;
    const r = await sincronizarHorarioFixo(db, id, agora);
    if (!r.naoCouberam.length) continue;
    const hoje = dataLocal(agora);
    const n = { id: `clube_${id}_fixo_${r.naoCouberam[0]}`, paraUid: m.clienteUid, barbeariaId: m.barbeariaId, titulo: 'Horário fixo',
      corpo: `Seu horário fixo na ${m.barbeariaNome} não coube em ${r.naoCouberam.map(d => formatarData(d, hoje)).join(', ')}. Marque outro dia pelo app.` };
    await db.escrever([{ caminho: `notificacoes/${n.id}`, criar: true, campos: { ...n, tipo: 'clube', em: agora, lida: false } }]);
    const token = (await db.varios([`users/${m.clienteUid}`])).get(`users/${m.clienteUid}`)?.pushToken as string | undefined;
    if (token) await enviarPush(projectId, tokenSA, { token, title: n.titulo, body: n.corpo, agendamentoId: n.id, link: 'https://navalha.web.app/meu-clube' });
  }
  return { membros: fila.length };
}
