// Avaliações do cliente e nota do Google. As notas só mudam aqui (as regras barram o app), então ninguém
// infla a própria nota: o Worker confere o agendamento concluído antes de somar.
import { MAX_COMENTARIO, notaRanking, placeIdValido, podeAvaliar, somarAvaliacao } from '../../src/lib/avaliacoes';
import type { Firestore } from './firestore';

type Resumo = { notaApp?: number; totalAvaliacoesApp?: number; notaGoogle?: number; totalAvaliacoesGoogle?: number };

/**
 * POST /avaliacoes — o cliente avalia um atendimento concluído (1 a 5 estrelas, comentário opcional).
 * ponytail: média recalculada a partir do valor lido (sem transação); duas avaliações da mesma casa no mesmo
 * segundo podem perder uma na média. Recalcular pelo total das avaliações se o volume crescer.
 */
export async function avaliar(db: Firestore, uid: string, agendamentoId: string, estrelas: number, comentario: string, agora = Date.now()) {
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return { status: 400, corpo: { erro: 'Escolha de 1 a 5 estrelas.' } };
  const ag = (await db.varios([`agendamentos/${agendamentoId}`])).get(`agendamentos/${agendamentoId}`);
  if (!ag) return { status: 404, corpo: { erro: 'Agendamento não encontrado.' } };
  if (ag.clienteUid !== uid) return { status: 403, corpo: { erro: 'Sem permissão.' } };
  if (!podeAvaliar(ag as { status: string; fim: number; avaliacao?: unknown }, agora)) {
    return { status: 409, corpo: { erro: ag.avaliacao ? 'Você já avaliou este atendimento.' : 'Este atendimento não pode mais ser avaliado.' } };
  }

  const bid = ag.barbeariaId as string, barbeiroId = ag.barbeiroId as string;
  const docs = await db.varios([`barbearias/${bid}`, `barbearias/${bid}/barbeiros/${barbeiroId}`]);
  const casa = docs.get(`barbearias/${bid}`);
  if (!casa) return { status: 404, corpo: { erro: 'A barbearia saiu do ar.' } };
  const barbeiro = docs.get(`barbearias/${bid}/barbeiros/${barbeiroId}`);

  const resumo = (casa.resumo ?? {}) as Resumo;
  const app = somarAvaliacao({ media: resumo.notaApp ?? 0, total: resumo.totalAvaliacoesApp ?? 0 }, estrelas);
  const texto = comentario.trim().slice(0, MAX_COMENTARIO);
  await db.escrever([
    { caminho: `avaliacoes/${agendamentoId}`, criar: true, campos: {
      id: agendamentoId, agendamentoId, barbeariaId: bid, barbeiroId, clienteUid: uid,
      // Só o primeiro nome aparece na página da casa.
      clienteNome: String(ag.clienteNome ?? 'Cliente').split(' ')[0], barbeiroNome: (ag.barbeiroNome as string | undefined) ?? '',
      direcao: 'cliente_para_barbeiro', estrelas, chips: [], ...(texto ? { comentario: texto } : {}), visivel: true, criadoEm: agora,
    } },
    { caminho: `agendamentos/${agendamentoId}`, campos: { avaliacao: { estrelas, em: agora } } },
    { caminho: `barbearias/${bid}`, campos: {
      'resumo.notaApp': app.media, 'resumo.totalAvaliacoesApp': app.total,
      'resumo.notaRanking': notaRanking({ ...resumo, notaApp: app.media, totalAvaliacoesApp: app.total }),
    } },
    // Barbeiro que saiu da casa: a avaliação conta só para a casa.
    ...(barbeiro ? [{ caminho: `barbearias/${bid}/barbeiros/${barbeiroId}`, campos: { nota: somarAvaliacao(barbeiro.nota as { media: number; total: number } | undefined, estrelas) } }] : []),
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
