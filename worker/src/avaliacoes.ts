// Avaliações (cliente ↔ barbeiro, cliente → barbearia) e nota do Google. As notas só mudam aqui (as regras barram
// o app), então ninguém infla a própria nota: o Worker confere o atendimento e quem avalia antes de somar.
import {
  DIRECAO_DO_ALVO, MAX_COMENTARIO, jaAvaliado, notaRanking, placeIdValido, podeAvaliarAlvo, somarAvaliacao, type AlvoAvaliacao,
} from '../../src/lib/avaliacoes';
import type { Firestore } from './firestore';

type Resumo = { notaApp?: number; totalAvaliacoesApp?: number; notaGoogle?: number; totalAvaliacoesGoogle?: number };

/**
 * POST /avaliacoes — uma das três avaliações de um atendimento (1 a 5 estrelas, comentário opcional):
 * - `barbeiro` e `barbearia`: quem avalia é o cliente; `cliente`: o barbeiro do atendimento ou o dono da casa.
 * Quando cada uma vale está em podeAvaliarAlvo (concluído; cancelamento só para quem foi cancelado).
 * Notas: barbearia → resumo da casa (ranking); barbeiro → equipePrivado (só a casa vê); cliente → perfil do cliente
 * e notasCliente (a casa lê no agendamento).
 * ponytail: média recalculada a partir do valor lido (sem transação); duas avaliações do mesmo alvo no mesmo
 * segundo podem perder uma na média. Recalcular pelo total das avaliações se o volume crescer.
 */
export async function avaliar(
  db: Firestore, uid: string, agendamentoId: string, alvo: AlvoAvaliacao, estrelas: number, comentario: string, agora = Date.now(),
) {
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return { status: 400, corpo: { erro: 'Escolha de 1 a 5 estrelas.' } };
  const ag = (await db.varios([`agendamentos/${agendamentoId}`])).get(`agendamentos/${agendamentoId}`);
  if (!ag) return { status: 404, corpo: { erro: 'Agendamento não encontrado.' } };
  const bid = ag.barbeariaId as string, barbeiroId = ag.barbeiroId as string, clienteUid = ag.clienteUid as string | null;
  const casa = (await db.varios([`barbearias/${bid}`])).get(`barbearias/${bid}`);
  if (!casa) return { status: 404, corpo: { erro: 'A barbearia saiu do ar.' } };

  const autorOk = alvo === 'cliente' ? uid === barbeiroId || uid === casa.donoUid : uid === clienteUid;
  if (!autorOk) return { status: 403, corpo: { erro: 'Sem permissão.' } };
  if (!podeAvaliarAlvo(ag as Parameters<typeof podeAvaliarAlvo>[0], alvo, agora)) {
    return { status: 409, corpo: { erro: jaAvaliado(ag as Parameters<typeof jaAvaliado>[0], alvo) ? 'Você já fez esta avaliação.' : 'Este atendimento não pode mais ser avaliado.' } };
  }

  const caminhos = { privado: `barbearias/${bid}/equipePrivado/${barbeiroId}`, cliente: `users/${clienteUid}` };
  const outros = await db.varios([caminhos.privado, ...(clienteUid ? [caminhos.cliente] : [])]);
  const perfilCliente = outros.get(caminhos.cliente);
  const texto = comentario.trim().slice(0, MAX_COMENTARIO);
  const nomeCliente = String(ag.clienteNome ?? 'Cliente');

  const notas: { caminho: string; campos: Record<string, unknown>; criar?: boolean }[] = [];
  if (alvo === 'barbearia') {
    const resumo = (casa.resumo ?? {}) as Resumo;
    const app = somarAvaliacao({ media: resumo.notaApp ?? 0, total: resumo.totalAvaliacoesApp ?? 0 }, estrelas);
    notas.push({ caminho: `barbearias/${bid}`, campos: {
      'resumo.notaApp': app.media, 'resumo.totalAvaliacoesApp': app.total,
      'resumo.notaRanking': notaRanking({ ...resumo, notaApp: app.media, totalAvaliacoesApp: app.total }),
    } });
  } else if (alvo === 'barbeiro') {
    const atual = outros.get(caminhos.privado)?.nota as { media: number; total: number } | undefined;
    notas.push({ caminho: caminhos.privado, criar: true, campos: { nota: somarAvaliacao(atual, estrelas) } });
  } else if (clienteUid) {
    const atual = perfilCliente?.notaCliente as { media: number; total: number } | undefined;
    const nota = somarAvaliacao(atual, estrelas);
    // Conta excluída: não recria o perfil, só a nota que a casa lê.
    if (perfilCliente) notas.push({ caminho: caminhos.cliente, campos: { 'notaCliente.media': nota.media, 'notaCliente.total': nota.total } });
    notas.push({ caminho: `notasCliente/${clienteUid}`, criar: true, campos: { media: nota.media, total: nota.total } });
  }

  // A da barbearia é pública (qualquer um lê o documento, não só a tela): só o primeiro nome, sem foto, capa nem uid
  // do cliente (LGPD, necessidade). As outras ficam entre a casa e o cliente, com o nome todo e a foto.
  const publica = alvo === 'barbearia';
  const quemAvaliou = publica ? { clienteNome: nomeCliente.split(' ')[0] } : {
    clienteUid, autorUid: uid, clienteNome: nomeCliente,
    ...(perfilCliente?.fotoUrl ? { clienteFotoUrl: perfilCliente.fotoUrl } : {}),
    ...(perfilCliente?.bannerUrl ? { clienteBannerUrl: perfilCliente.bannerUrl } : {}),
  };
  await db.escrever([
    { caminho: `avaliacoes/${agendamentoId}_${alvo}`, criar: true, campos: {
      id: `${agendamentoId}_${alvo}`, agendamentoId, barbeariaId: bid, barbeiroId, alvo, direcao: DIRECAO_DO_ALVO[alvo], ...quemAvaliou,
      barbeiroNome: (ag.barbeiroNome as string | undefined) ?? '', servicoNome: (ag.servicoNome as string | undefined) ?? '',
      inicio: ag.inicio as number, origem: ag.status === 'cancelado' ? 'cancelamento' : 'atendimento',
      estrelas, chips: [], ...(texto ? { comentario: texto } : {}), visivel: true, criadoEm: agora,
    } },
    { caminho: `agendamentos/${agendamentoId}`, campos: { [`avaliacoes.${alvo}`]: { estrelas, em: agora } } },
    ...notas,
  ]);
  return { status: 200, corpo: { ok: true } };
}

const DIA = 86_400_000;
/** Casas por execução do cron: cada uma é 1 chamada ao Google (limite de 50 chamadas por execução no Worker grátis). */
const CASAS_POR_VEZ = 5;

/**
 * Cron de hora em hora: nota do Google (Places API, campos rating e userRatingCount) das casas com o código do Google,
 * no máximo 1 vez por dia cada. Sem a chave GOOGLE_PLACES_KEY, não faz nada.
 * ponytail: 5 casas/hora = 120/dia; a franquia grátis do Google é de 1.000 consultas/mês (≈ 33 casas). Acima disso,
 * espaçar para 1 vez a cada 2–3 dias.
 */
export async function atualizarNotasGoogle(db: Firestore, chave: string | undefined, agora = Date.now()) {
  if (!chave) return;
  const casas = await db.query({
    from: [{ collectionId: 'barbearias' }],
    where: { fieldFilter: { field: { fieldPath: 'googlePlaceId' }, op: 'GREATER_THAN', value: { stringValue: '' } } },
    limit: 300,
  });
  const vez = casas.filter(c => !(Number(c.dados.googleAtualizadoEm ?? 0) > agora - DIA)).slice(0, CASAS_POR_VEZ);
  const gravar: { caminho: string; campos: Record<string, unknown> }[] = [];
  for (const c of vez) {
    const placeId = String(c.dados.googlePlaceId);
    const campos: Record<string, unknown> = { googleAtualizadoEm: agora }; // mesmo se falhar: tenta de novo amanhã, não a cada hora
    if (placeIdValido(placeId)) {
      const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': chave, 'X-Goog-FieldMask': 'rating,userRatingCount' },
      });
      if (r.ok) {
        const g = (await r.json()) as { rating?: number; userRatingCount?: number };
        if (g.rating && g.userRatingCount) {
          const resumo = { ...((c.dados.resumo ?? {}) as Resumo), notaGoogle: g.rating, totalAvaliacoesGoogle: g.userRatingCount };
          Object.assign(campos, {
            'resumo.notaGoogle': g.rating, 'resumo.totalAvaliacoesGoogle': g.userRatingCount, 'resumo.notaRanking': notaRanking(resumo),
          });
        }
      } else console.error('Places falhou', c.id, r.status, await r.text());
    }
    gravar.push({ caminho: `barbearias/${c.id}`, campos });
  }
  await db.escrever(gravar); // uma gravação só para todas
}
