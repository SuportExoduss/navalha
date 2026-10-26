// Clube de assinatura (docs/clube.md), cron próprio de hora em hora:
//  - pedido novo → aviso para o dono e os barbeiros ativos da casa;
//  - 3 dias antes e no dia do vencimento → lembrete ao cliente (só de dia);
//  - 1 dia depois do vencimento sem pagamento → status "vencido" e aviso ao cliente e ao dono.
// O que avisar e os textos ficam em src/lib/clube.ts (testados). Cada aviso grava a marca em `lembretes` junto
// com a notificação, então rodar de novo não repete.
import { avisoDevido, motivoSemClube, textoAvisoClube, usosNoCiclo, type AvisoClube } from '../../src/lib/clube';
import { chavesOcupacao, dataLocal } from '../../src/lib/agenda';
import type { Agendamento, MembroClube, PlanoClube } from '../../src/types/models';
import { enviarPush } from './avisos';
import type { Firestore } from './firestore';

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

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const slots = chavesOcupacao(barbeiroId, inicio, duracaoMin, passoMin);
  const telefone = typeof perfil.telefone === 'string' ? perfil.telefone : '';
  const ag = {
    id, barbeariaId, barbeiroId, barbeariaNome: casa.nome, barbeiroNome: barbeiro.apelido || barbeiro.nome,
    clienteUid: uid, clienteNome: perfil.apelido || perfil.nome || 'Cliente', ...(telefone ? { clienteTelefone: telefone } : {}),
    servicoId, servicoNome: s.nome, precoCentavos: 0, duracaoMin,
    data: dataLocal(inicio), inicio, fim: inicio + duracaoMin * 60_000, slots,
    status: 'reservado', origem: 'clube', clubeMembroId: membroId, lembretes: {}, criadoEm: agora, atualizadoEm: agora,
  };
  const ok = await db.criarTodos([
    { caminho: `agendamentos/${id}`, campos: ag },
    ...slots.map(k => ({ caminho: `ocupacao/${k}`, campos: { barbeariaId, barbeiroId, agendamentoId: id, inicio } })),
  ]);
  return ok ? { status: 200, corpo: { ok: true, agendamentoId: id } } : { status: 409, corpo: { erro: 'Esse horário acabou de ser ocupado. Escolha outro.', ocupado: true } };
}
