// Notificações: aviso na hora (marcado/cancelado) e resumo do mês no dia 1.
// Sem Cloud Functions: o app avisa o Worker logo depois de reservar/cancelar; o Worker confere o agendamento
// no Firestore (nunca confia no que o app manda), grava a notificação com id fixo (sem duplicar) e manda o push.
import {
  calcularResumoMes, ehDiaDoResumo, idAviso, mesAnterior, textoAviso, textoPedidoAvaliacao, textoResumoMes,
} from '../../src/lib/notificacoes';
import type { Firestore } from './firestore';
import { mensagemFcm } from './util';

const RECENTE_MS = 15 * 60_000;

async function enviarPush(projectId: string, tokenSA: string, m: { token: string; title: string; body: string; agendamentoId: string; link: string }) {
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
  // Finalizado pela casa: se o dono ligou "pedir avaliação", só o cliente recebe o pedido.
  const pedir = ag.status === 'concluido' && casa?.pedirAvaliacao === true && !!clienteUid && uid !== clienteUid;
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
    return { id: idAviso(agendamentoId, tipo, p), paraUid: p, barbeariaId: ag.barbeariaId as string, tipo, ...t, agendamentoId, em: agora, lida: false };
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
 * Cron, no dia 1 (Brasília): resumo do mês anterior para o dono de cada casa. Id fixo por casa e mês, então cada
 * execução do dia faz só as que faltam. ponytail: 5 casas por execução (limite de 50 chamadas do Worker grátis,
 * dividido com lembretes e vencimentos) = até 120 casas no dia 1; acima disso, Workers pago ou fila.
 */
export async function resumoDoMes(db: Firestore, tokenSA: string, projectId: string, agora = Date.now()) {
  if (!ehDiaDoResumo(agora)) return;
  const mes = mesAnterior(agora);
  const casas = await db.query({ from: [{ collectionId: 'barbearias' }], limit: 300 });
  const idDe = (bid: string) => `resumo_${mes.chave}_${bid}`;
  const feitos = await db.varios(casas.map(c => `notificacoes/${idDe(c.id)}`));
  const pendentes = casas.filter(c => !feitos.has(`notificacoes/${idDe(c.id)}`) && c.dados.donoUid).slice(0, 5);
  if (!pendentes.length) return;
  const perfis = await db.varios(pendentes.map(c => `users/${c.dados.donoUid as string}`));
  for (const c of pendentes) {
    const ags = await db.query({
      from: [{ collectionId: 'agendamentos' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'barbeariaId' }, op: 'EQUAL', value: { stringValue: c.id } } },
        { fieldFilter: { field: { fieldPath: 'data' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: mes.de } } },
        { fieldFilter: { field: { fieldPath: 'data' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: mes.ate } } },
      ] } },
    });
    const t = textoResumoMes(mes.chave, calcularResumoMes(ags.map(a => a.dados) as never));
    const dono = c.dados.donoUid as string;
    const n = { id: idDe(c.id), paraUid: dono, barbeariaId: c.id, tipo: 'resumo_mes', ...t, em: agora, lida: false };
    await db.escrever([{ caminho: `notificacoes/${n.id}`, criar: true, campos: n }]);
    const token = perfis.get(`users/${dono}`)?.pushToken as string | undefined;
    if (token) {
      await enviarPush(projectId, tokenSA, { token, title: t.titulo, body: t.corpo.split('\n')[0], agendamentoId: n.id, link: 'https://navalha.web.app/agenda' });
    }
  }
}
