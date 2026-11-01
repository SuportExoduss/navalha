// Notificações: aviso na hora (marcado/cancelado) e resumo do mês no dia 1.
// Sem Cloud Functions: o app avisa o Worker logo depois de reservar/cancelar; o Worker confere o agendamento
// no Firestore (nunca confia no que o app manda), grava a notificação com id fixo (sem duplicar) e manda o push.
import {
  ehDiaDoResumo, idAviso, mesAnterior, resumosDoMes, textoAviso, textoPedidoAvaliacao, textoResumoMes,
} from '../../src/lib/notificacoes';
import type { Firestore } from './firestore';
import { mensagemFcm } from './util';

const RECENTE_MS = 15 * 60_000;

export async function enviarPush(projectId: string, tokenSA: string, m: { token: string; title: string; body: string; agendamentoId: string; link: string; rota?: string }) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSA}` },
    body: JSON.stringify(mensagemFcm(m)),
  });
  if (!r.ok) console.error('FCM falhou', m.agendamentoId, r.status, await r.text());
}

/** POST /avisos/agendamento — alguém acabou de marcar ou cancelar: avisa os outros lados (cliente, barbeiro, dono). */
export async function avisarAgendamento(db: Firestore, tokenSA: string, projectId: string, uid: string, agendamentoId: string, agora = Date.now()) {
  const ag = (await db.varios([`agendamentos/${agendamentoId}`])).get(`agendamentos/${agendamentoId}`);
  if (!ag) return { status: 404, corpo: { erro: 'Agendamento não encontrado.' } };
  const casa = (await db.varios([`barbearias/${ag.barbeariaId as string}`])).get(`barbearias/${ag.barbeariaId as string}`);
  const donoUid = casa?.donoUid as string | undefined;
  const clienteUid = (ag.clienteUid as string | null) ?? undefined; // balcão: sem cliente no app
  // Só quem faz parte do agendamento avisa, e só logo depois (um aviso velho reenviado não vira notificação).
  if (![clienteUid, ag.barbeiroId, donoUid].includes(uid)) return { status: 403, corpo: { erro: 'Sem permissão.' } };
  // Finalizado pela casa: se o dono ligou "pedir avaliação", só o cliente recebe o pedido, e só se ainda não avaliou a casa.
  let pedir = ag.status === 'concluido' && casa?.pedirAvaliacao === true && !!clienteUid && uid !== clienteUid;
  if (pedir) {
    const avaliou = (await db.varios([`users/${clienteUid}`])).get(`users/${clienteUid}`)?.avaliouBarbearias as Record<string, unknown> | undefined;
    pedir = !avaliou?.[ag.barbeariaId as string];
  }
  const tipo = ag.status === 'cancelado' ? 'cancelado' : ['reservado', 'confirmado'].includes(ag.status as string) ? 'agendado' : pedir ? 'avaliar' : null;
  const quando = Number(tipo === 'agendado' ? ag.criadoEm : ag.atualizadoEm);
  if (!tipo || !(agora - quando < RECENTE_MS)) return { status: 409, corpo: { erro: 'Nada a avisar.' } };

  const para = tipo === 'avaliar' ? [clienteUid!]
    : [...new Set([clienteUid, ag.barbeiroId as string, donoUid].filter((x): x is string => !!x && x !== uid))];
  const papel = (p: string) => (p === clienteUid ? 'cliente' : p === ag.barbeiroId ? 'barbeiro' : 'dono');
  const ids = para.map(p => idAviso(agendamentoId, tipo, p));
  const ja = await db.varios(ids.map(id => `notificacoes/${id}`));
  const novos = para.filter((_, i) => !ja.has(`notificacoes/${ids[i]}`));
  if (!novos.length) return { status: 200, corpo: { enviados: 0 } };

  const dados = ag as Parameters<typeof textoAviso>[1];
  const notifs = novos.map(p => {
    const t = tipo === 'avaliar' ? textoPedidoAvaliacao(dados) : textoAviso(tipo, dados, agora, papel(p));
    // Barbeiro e horário: o painel mostra "Lembrar no WhatsApp" só ao barbeiro do horário, sem ler o agendamento.
    return { id: idAviso(agendamentoId, tipo, p), paraUid: p, barbeariaId: ag.barbeariaId as string, tipo, ...t, agendamentoId,
      barbeiroId: ag.barbeiroId as string, inicio: ag.inicio as number, em: agora, lida: false };
  });
  await db.escrever([
    ...notifs.map(n => ({ caminho: `notificacoes/${n.id}`, criar: true, campos: n as Record<string, unknown> })),
    // O app do cliente mostra o pedido em destaque nos Agendamentos (sem ler a configuração da casa).
    ...(tipo === 'avaliar' ? [{ caminho: `agendamentos/${agendamentoId}`, campos: { pedidoAvaliacao: true } }] : []),
  ]);
  const perfis = await db.varios(novos.map(p => `users/${p}`));
  for (const n of notifs) {
    const token = perfis.get(`users/${n.paraUid}`)?.pushToken as string | undefined;
    const link = `https://navalha.web.app/${papel(n.paraUid) === 'cliente' ? 'agendamentos' : 'agenda'}`;
    if (token) await enviarPush(projectId, tokenSA, { token, title: n.titulo, body: n.corpo, agendamentoId, link });
  }
  return { status: 200, corpo: { enviados: notifs.length } };
}

/**
 * Cron, nos dias 1 a 3 (Brasília): salva os resumos do mês anterior de cada casa (o geral e um por barbeiro, em
 * `resumos`) e avisa o dono e cada barbeiro. Ids fixos, então cada execução faz só as casas que faltam.
 * ponytail: 3 casas por execução (limite de 50 chamadas do Worker grátis, dividido com lembretes e vencimentos);
 * acima de ~200 casas, Workers pago ou fila.
 */
export async function resumoDoMes(db: Firestore, tokenSA: string, projectId: string, agora = Date.now()) {
  if (!ehDiaDoResumo(agora)) return;
  const mes = mesAnterior(agora);
  const casas = await db.query({ from: [{ collectionId: 'barbearias' }], limit: 300 });
  const feitos = await db.varios(casas.map(c => `resumos/${c.id}_${mes.chave}_casa`));
  const pendentes = casas.filter(c => !feitos.has(`resumos/${c.id}_${mes.chave}_casa`) && c.dados.donoUid).slice(0, 3);
  const rota = `/resumos?mes=${mes.chave}`;
  for (const c of pendentes) {
    const dono = c.dados.donoUid as string;
    const [ags, equipe] = await Promise.all([
      db.query({
        from: [{ collectionId: 'agendamentos' }],
        where: { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'barbeariaId' }, op: 'EQUAL', value: { stringValue: c.id } } },
          { fieldFilter: { field: { fieldPath: 'data' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: mes.de } } },
          { fieldFilter: { field: { fieldPath: 'data' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: mes.ate } } },
        ] } },
      }),
      db.query({ from: [{ collectionId: 'barbeiros' }] }, `barbearias/${c.id}`),
    ]);
    const resumos = resumosDoMes(c.id, mes.chave, agora, ags.map(a => a.dados) as never,
      equipe.map(b => ({ uid: b.id, nome: (b.dados.apelido as string) || (b.dados.nome as string) || 'Barbeiro' })));
    // O dono recebe o geral; cada barbeiro (menos o dono) recebe o dele.
    const avisos = resumos.flatMap(r => r.barbeiroId === 'casa'
      ? [{ id: `resumo_${mes.chave}_${c.id}`, paraUid: dono, ...textoResumoMes(mes.chave, r) }]
      : r.barbeiroId === dono ? [] : [{ id: `resumo_${mes.chave}_${c.id}_${r.barbeiroId}`, paraUid: r.barbeiroId, ...textoResumoMes(mes.chave, r, true) }]);
    // Notificação que já existe (ex.: a do formato antigo) não é regravada, para não voltar a "não lida".
    const lidos = await db.varios([...avisos.map(n => `notificacoes/${n.id}`), ...avisos.map(n => `users/${n.paraUid}`)]);
    const novos = avisos.filter(n => !lidos.has(`notificacoes/${n.id}`));
    await db.escrever([
      ...resumos.map(({ id, ...campos }) => ({ caminho: `resumos/${id}`, criar: true, campos })),
      ...novos.map(n => ({ caminho: `notificacoes/${n.id}`, criar: true,
        campos: { ...n, barbeariaId: c.id, tipo: 'resumo_mes', em: agora, lida: false } })),
    ]);
    for (const n of novos) {
      const token = lidos.get(`users/${n.paraUid}`)?.pushToken as string | undefined;
      if (token) await enviarPush(projectId, tokenSA, { token, title: n.titulo, body: n.corpo.split('\n')[0], agendamentoId: n.id, link: `https://navalha.web.app${rota}`, rota });
    }
  }
}
