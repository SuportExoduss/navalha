// Exclusão de conta (LGPD art. 18, VI) e prazos de guarda (arts. 15–16). Fica no Worker porque parte destes dados
// (nota do cliente, avaliações, avisos que outras pessoas receberam, fotos no R2) as regras não deixam o app apagar.
import { idAviso } from '../../src/lib/notificacoes';
import { APAGAR, type Firestore } from './firestore';
import { idAvaliacao } from './avaliacoes';

/** O mesmo texto que as regras aceitam quando o próprio cliente anonimiza o histórico (apps antigos). */
export const NOME_REMOVIDO = 'Cliente removido';
const BARBEIRO_REMOVIDO = 'Barbeiro removido';

type Fotos = Pick<R2Bucket, 'list' | 'delete'>;
type Gravacao = { caminho: string; campos: Record<string, unknown> };

const DIA = 86_400_000;
/** Prazos de guarda (dias). Mudou aqui, mude também a política de privacidade. */
export const PRAZOS = { eventos: 365, erros: 365, notificacoes: 90 } as const;

const iguais = (colecao: string, campo: string, valor: string) => ({
  from: [{ collectionId: colecao }],
  where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } } },
});

/** Só fotos de corte gravadas pelo nosso Worker: "…/corte/<agendamento>/<arquivo>.webp" vira a chave do R2. */
export function chaveDaFoto(url: string): string | null {
  const chave = url.split('/').slice(-3).join('/');
  return /^corte\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.webp$/.test(chave) ? chave : null;
}

/**
 * POST /conta/excluir — apaga ou anonimiza tudo da pessoa, menos o login (o app apaga depois, com login recente).
 * Os horários futuros o app já cancelou antes (a transação libera os blocos de ocupação).
 * Dono de barbearia não exclui a conta: primeiro exclui a casa (Configurações › Excluir barbearia), senão a casa e os
 * horários dos clientes ficariam sem responsável.
 */
export async function excluirConta(db: Firestore, fotos: Fotos, uid: string, agora = Date.now()) {
  const [ags, avs, avisos] = await Promise.all([
    db.query(iguais('agendamentos', 'clienteUid', uid)),
    db.query(iguais('avaliacoes', 'clienteUid', uid)),
    db.query(iguais('notificacoes', 'paraUid', uid)),
  ]);
  const perfil = (await db.varios([`users/${uid}`])).get(`users/${uid}`);
  const ondeAtende = (perfil?.barbearias as string[] | undefined) ?? [];
  const casas = [...new Set([...ags.map(a => a.dados.barbeariaId as string), ...ondeAtende])];
  // A avaliação pública da barbearia não guarda o uid do cliente: o id é o resumo de casa + cliente.
  const publicas = await Promise.all(casas.map(async b => `avaliacoes/${await idAvaliacao(b, uid)}`));
  const docs = await db.varios([...casas.map(b => `barbearias/${b}`), ...ondeAtende.map(b => `barbearias/${b}/barbeiros/${uid}`), ...publicas]);
  if (ondeAtende.some(b => docs.get(`barbearias/${b}`)?.donoUid === uid)) {
    return { status: 409, corpo: { erro: 'Você é dono de uma barbearia. Exclua a barbearia em Configurações antes de excluir a conta.' } };
  }

  const gravar: Gravacao[] = [];
  const apagar = [`users/${uid}`, ...avisos.map(n => `notificacoes/${n.id}`)];
  const cortes: string[] = [];

  for (const { id, dados } of ags) {
    gravar.push({ caminho: `agendamentos/${id}`, campos: { clienteNome: NOME_REMOVIDO, clienteTelefone: APAGAR, fotos: [], atualizadoEm: agora } });
    cortes.push(...((dados.fotos as string[] | undefined) ?? []).map(chaveDaFoto).filter((c): c is string => !!c));
    // Os avisos que a casa recebeu levam o nome do cliente no texto: o id é fixo, então nem precisa ler.
    const dono = docs.get(`barbearias/${dados.barbeariaId as string}`)?.donoUid as string | undefined;
    for (const tipo of ['agendado', 'cancelado', 'avaliar'] as const) {
      for (const para of [dados.barbeiroId as string, dono]) if (para && para !== uid) apagar.push(`notificacoes/${idAviso(id, tipo, para)}`);
    }
  }
  // As estrelas e o comentário continuam na nota da casa, assinados só como "Cliente". As antigas (com uid) também.
  const avaliacoes = new Set([...avs.map(a => `avaliacoes/${a.id}`), ...publicas.filter(c => docs.has(c))]);
  for (const caminho of avaliacoes) {
    gravar.push({ caminho, campos: { clienteNome: 'Cliente', clienteFotoUrl: APAGAR, clienteBannerUrl: APAGAR } });
  }
  // Barbeiro (não dono) de alguma casa: o cartão público perde nome e fotos e sai da equipe ativa; o telefone some.
  for (const b of ondeAtende) {
    const casa = docs.get(`barbearias/${b}`), cartao = docs.get(`barbearias/${b}/barbeiros/${uid}`);
    if (!casa || !cartao || casa.donoUid === uid) continue;
    gravar.push({ caminho: `barbearias/${b}/barbeiros/${uid}`, campos: { nome: BARBEIRO_REMOVIDO, apelido: APAGAR, fotoUrl: APAGAR, bannerUrl: APAGAR, ativo: false } });
    // O contador do plano anda junto com o barbeiro que saiu (mesma regra do app: mudouBarbeiro).
    if (cartao.ativo === true) gravar.push({ caminho: `barbearias/${b}`, campos: { barbeirosAtivos: Math.max(0, Number(casa.barbeirosAtivos ?? 1) - 1), mudouBarbeiro: uid } });
    apagar.push(`barbearias/${b}/equipePrivado/${uid}`);
  }

  for (let i = 0; i < gravar.length; i += 500) await db.escrever(gravar.slice(i, i + 500));
  const unicos = [...new Set(apagar)];
  for (let i = 0; i < unicos.length; i += 500) await db.apagar(unicos.slice(i, i + 500));

  // Foto e capa do perfil (a pasta é o uid) e as fotos dos cortes da pessoa.
  const pastas = await Promise.all([`perfil/${uid}/`, `banner/${uid}/`].map(prefix => fotos.list({ prefix })));
  const chaves = [...pastas.flatMap(p => p.objects.map(o => o.key)), ...cortes];
  for (let i = 0; i < chaves.length; i += 1000) await fotos.delete(chaves.slice(i, i + 1000));

  return { status: 200, corpo: { ok: true } };
}

/**
 * Cron: apaga o que passou do prazo de guarda (métricas e erros 12 meses, avisos 90 dias).
 * ponytail: 500 por coleção a cada hora (12 mil/dia); se acumular mais que isso, aumentar o limite ou rodar mais vezes.
 */
export async function limparAntigos(db: Firestore, agora = Date.now()) {
  for (const [colecao, dias] of Object.entries(PRAZOS)) {
    const velhos = await db.query({
      from: [{ collectionId: colecao }],
      where: { fieldFilter: { field: { fieldPath: 'em' }, op: 'LESS_THAN', value: { integerValue: String(agora - dias * DIA) } } },
      limit: 500,
    });
    await db.apagar(velhos.map(v => `${colecao}/${v.id}`));
  }
}
