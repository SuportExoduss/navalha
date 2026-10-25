// Avaliação da barbearia: uma por cliente por casa (avaliar de novo edita a mesma). A nota só muda aqui (as regras
// barram o app), então ninguém infla a própria nota: o Worker confere o corte concluído e quem avalia antes de somar.
import { aplicarAvaliacao, media, notaRanking, podeAvaliarCasa } from '../../src/lib/avaliacoes';
import { APAGAR, type Firestore } from './firestore';

type Resumo = { notaApp?: number; totalAvaliacoesApp?: number; somaEstrelasApp?: number };

/**
 * Id da avaliação: resumo (SHA-256) de casa + cliente. O documento não leva o uid do cliente (ninguém precisa saber
 * quem avaliou); só o Worker sabe montar o id (para editar e para apagar na exclusão de conta).
 */
export async function idAvaliacao(barbeariaId: string, clienteUid: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${barbeariaId}:${clienteUid}`)));
  return [...bytes.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /avaliacoes — o cliente avalia a barbearia (1 a 5 estrelas) a partir de um corte concluído. Comentário de app
 * antigo é ignorado.
 * Já avaliou essa casa: edita (troca a nota sem contar duas vezes).
 * ponytail: placar lido e regravado sem transação; duas avaliações da mesma casa no mesmo segundo podem perder uma.
 * Recalcular pelo total das avaliações se o volume crescer.
 */
export async function avaliar(db: Firestore, uid: string, agendamentoId: string, estrelas: number, agora = Date.now()) {
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return { status: 400, corpo: { erro: 'Escolha de 1 a 5 estrelas.' } };
  const ag = (await db.varios([`agendamentos/${agendamentoId}`])).get(`agendamentos/${agendamentoId}`);
  if (!ag) return { status: 404, corpo: { erro: 'Agendamento não encontrado.' } };
  if (ag.clienteUid !== uid) return { status: 403, corpo: { erro: 'Sem permissão.' } };
  if (!podeAvaliarCasa(ag as Parameters<typeof podeAvaliarCasa>[0])) return { status: 409, corpo: { erro: 'Dá para avaliar depois de um corte concluído.' } };
  const bid = ag.barbeariaId as string;
  const id = await idAvaliacao(bid, uid);
  const docs = await db.varios([`barbearias/${bid}`, `avaliacoes/${id}`, `users/${uid}`]);
  const casa = docs.get(`barbearias/${bid}`);
  if (!casa) return { status: 404, corpo: { erro: 'A barbearia saiu do ar.' } };
  const existente = docs.get(`avaliacoes/${id}`);
  const antiga = existente ? Number(existente.estrelas) : null;

  const r = (casa.resumo ?? {}) as Resumo;
  const total = r.totalAvaliacoesApp ?? 0;
  const placar = aplicarAvaliacao({ soma: r.somaEstrelasApp ?? Math.round((r.notaApp ?? 0) * total), total }, antiga, estrelas);
  await db.escrever([
    // Só as estrelas (LGPD, necessidade): a avaliação serve só para a média e a quantidade da casa, ninguém a lê.
    // Nada de nome, comentário ou dia do corte; os campos de avaliações antigas saem quando a pessoa edita.
    { caminho: `avaliacoes/${id}`, criar: true, campos: {
      id, barbeariaId: bid, estrelas, criadoEm: Number(existente?.criadoEm ?? agora), atualizadoEm: agora,
      clienteNome: APAGAR, comentario: APAGAR, inicio: APAGAR, direcao: APAGAR, visivel: APAGAR,
    } },
    { caminho: `barbearias/${bid}`, campos: {
      'resumo.notaApp': media(placar), 'resumo.totalAvaliacoesApp': placar.total, 'resumo.somaEstrelasApp': placar.soma,
      'resumo.notaRanking': notaRanking(placar),
    } },
    // O app do cliente lê o próprio perfil: mostra "Editar" e não pede de novo. Conta excluída: não recria o perfil.
    ...(docs.has(`users/${uid}`) ? [{ caminho: `users/${uid}`, campos: { [`avaliouBarbearias.${bid}`]: { estrelas, em: agora } } }] : []),
  ]);
  return { status: 200, corpo: { ok: true, editada: antiga !== null } };
}
