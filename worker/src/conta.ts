// Exclusão de conta (LGPD art. 18, VI) e prazos de guarda (arts. 15–16). Fica no Worker porque parte destes dados
// (nota do cliente, avaliações, avisos que outras pessoas receberam, fotos no R2) as regras não deixam o app apagar.
import { idAviso } from '../../src/lib/notificacoes';
import { APAGAR, type Firestore } from './firestore';
import { idAvaliacao } from './avaliacoes';

/** O mesmo texto que as regras aceitam quando o próprio cliente anonimiza o histórico (apps antigos). */
export const NOME_REMOVIDO = 'Cliente removido';
const BARBEIRO_REMOVIDO = 'Barbeiro removido';
/** Campos que ligavam uma avaliação à pessoa (só as antigas os têm): saem todos. */
const SEM_AUTOR = Object.fromEntries(['clienteNome', 'clienteUid', 'autorUid', 'clienteFotoUrl', 'clienteBannerUrl', 'comentario', 'inicio']
  .map(c => [c, APAGAR]));

type Fotos = Pick<R2Bucket, 'list' | 'delete'>;
type Gravacao = { caminho: string; campos: Record<string, unknown> };

const DIA = 86_400_000;
/** Prazos de guarda (dias). Mudou aqui, mude também a política de privacidade. Convites: apagados ao vencer (7 dias). */
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
  const [ags, avs, avisos, clubes] = await Promise.all([
    db.query(iguais('agendamentos', 'clienteUid', uid)),
    db.query(iguais('avaliacoes', 'clienteUid', uid)),
    db.query(iguais('notificacoes', 'paraUid', uid)),
    db.query(iguais('clubeMembros', 'clienteUid', uid)),
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
    // Horário fixo do clube ainda por vir: cancela e libera os blocos (ninguém mais vem nesses horários).
    const fixoFuturo = dados.fixo === true && (dados.status === 'reservado' || dados.status === 'confirmado') && Number(dados.inicio) > agora;
    gravar.push({ caminho: `agendamentos/${id}`, campos: { clienteNome: NOME_REMOVIDO, clienteTelefone: APAGAR, fotos: [], atualizadoEm: agora,
      ...(fixoFuturo ? { status: 'cancelado' } : {}) } });
    if (fixoFuturo) apagar.push(...((dados.slots as string[] | undefined) ?? []).map(k => `ocupacao/${k}`));
    cortes.push(...((dados.fotos as string[] | undefined) ?? []).map(chaveDaFoto).filter((c): c is string => !!c));
    // Os avisos que a casa recebeu levam o nome do cliente no texto: o id é fixo, então nem precisa ler.
    const dono = docs.get(`barbearias/${dados.barbeariaId as string}`)?.donoUid as string | undefined;
    for (const tipo of ['agendado', 'cancelado', 'avaliar'] as const) {
      for (const para of [dados.barbeiroId as string, dono]) if (para && para !== uid) apagar.push(`notificacoes/${idAviso(id, tipo, para)}`);
    }
  }
  // A avaliação da casa: as estrelas continuam na média dela, sem nada que leve à pessoa (as de antes de 25/out ainda
  // tinham nome, comentário, dia ou uid). As antigas entre cliente e barbeiro não contam em nota nenhuma: saem.
  const daCasa = new Set([...avs.filter(a => a.dados.direcao === 'cliente_para_barbearia').map(a => `avaliacoes/${a.id}`),
    ...publicas.filter(c => docs.has(c))]);
  for (const caminho of daCasa) gravar.push({ caminho, campos: SEM_AUTOR });
  // Clube: a assinatura sai (sem nome nem horário fixo); os pagamentos ficam com a casa, sem nada que leve à pessoa.
  // ponytail: os avisos de pedido/vencido que a casa recebeu levam o nome no texto e saem no prazo de 90 dias dos avisos.
  for (const c of clubes) {
    gravar.push({ caminho: `clubeMembros/${c.id}`, campos: { clienteNome: NOME_REMOVIDO, status: 'saiu', horarioFixo: APAGAR,
      lembretes: APAGAR, reservadoAte: APAGAR, reservadoPara: APAGAR, atualizadoEm: agora } });
  }
  apagar.push(...avs.filter(a => a.dados.direcao !== 'cliente_para_barbearia').map(a => `avaliacoes/${a.id}`));
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
  const filtros: [string, string, number][] = [
    ...Object.entries(PRAZOS).map(([colecao, dias]): [string, string, number] => [colecao, 'em', agora - dias * DIA]),
    // Convite vencido (7 dias, usado ou não) não serve para nada e guarda quem convidou e quem entrou.
    ['convites', 'expiraEm', agora],
  ];
  for (const [colecao, campo, antesDe] of filtros) {
    const velhos = await db.query({
      from: [{ collectionId: colecao }],
      where: { fieldFilter: { field: { fieldPath: campo }, op: 'LESS_THAN', value: { integerValue: String(antesDe) } } },
      limit: 500,
    });
    await db.apagar(velhos.map(v => `${colecao}/${v.id}`));
  }
}

/**
 * Cron (1 vez por dia, às 3h de Brasília): o que sobrou das avaliações de antes de 25/out e não tem mais uso nem leitor.
 * Nota do cliente (`notasCliente` e `users.notaCliente`) e avaliações entre cliente e barbeiro saem; as da casa ficam só
 * com as estrelas. Depois da primeira limpeza as consultas voltam vazias.
 * ponytail: 4 consultas por dia mesmo sem nada a limpar; tirar quando o registro de status confirmar tudo zerado.
 */
export async function limparLegado(db: Firestore) {
  const campo = (c: string, op: string, valor: object) => ({ fieldFilter: { field: { fieldPath: c }, op, value: valor } });
  const consulta = (colecao: string, where?: object) => db.query({ from: [{ collectionId: colecao }], ...(where ? { where } : {}), limit: 500 });
  const [notas, entreClienteEBarbeiro, daCasa, perfis] = await Promise.all([
    consulta('notasCliente'),
    consulta('avaliacoes', campo('direcao', 'IN', { arrayValue: { values: [{ stringValue: 'cliente_para_barbeiro' }, { stringValue: 'barbeiro_para_cliente' }] } })),
    consulta('avaliacoes', campo('direcao', 'EQUAL', { stringValue: 'cliente_para_barbearia' })),
    consulta('users', campo('notaCliente.total', 'GREATER_THAN_OR_EQUAL', { integerValue: '0' })),
  ]);
  await db.apagar([...notas.map(n => `notasCliente/${n.id}`), ...entreClienteEBarbeiro.map(a => `avaliacoes/${a.id}`)]);
  await db.escrever([
    ...daCasa.map(a => ({ caminho: `avaliacoes/${a.id}`, campos: { ...SEM_AUTOR, direcao: APAGAR, visivel: APAGAR } })),
    ...perfis.map(p => ({ caminho: `users/${p.id}`, campos: { notaCliente: APAGAR } })),
  ]);
}

/**
 * Cron: o WhatsApp do cliente fica no agendamento só para a barbearia avisar de atraso ou lembrar do corte. Passadas
 * 24 h do fim do horário (atendido, cancelado ou falta), sai. A janela de 2 h pega cada horário uma vez, com folga
 * se uma execução do cron falhar.
 */
export async function tirarTelefonesVencidos(db: Firestore, agora = Date.now()) {
  const H = 3_600_000;
  const ags = await db.query({
    from: [{ collectionId: 'agendamentos' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'fim' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(agora - 26 * H) } } },
      { fieldFilter: { field: { fieldPath: 'fim' }, op: 'LESS_THAN', value: { integerValue: String(agora - 24 * H) } } },
    ] } },
    limit: 500,
  });
  const comTelefone = ags.filter(a => a.dados.clienteTelefone);
  if (comTelefone.length) await db.escrever(comTelefone.map(a => ({ caminho: `agendamentos/${a.id}`, campos: { clienteTelefone: APAGAR } })));
}

/**
 * POST /barbearia/excluir — antes de o app apagar a casa: tira o que as regras não deixam o app apagar (as avaliações
 * públicas da casa) e as fotos da casa e do cardápio no R2. Os cortes ficam no histórico dos clientes.
 */
export async function excluirDadosBarbearia(db: Firestore, fotos: Fotos, uid: string, barbeariaId: string) {
  const casa = (await db.varios([`barbearias/${barbeariaId}`])).get(`barbearias/${barbeariaId}`);
  if (!casa) return { status: 200, corpo: { ok: true } }; // já saiu: nada a limpar (pedido repetido)
  if (casa.donoUid !== uid) return { status: 403, corpo: { erro: 'Só o dono exclui a barbearia.' } };
  const [servicos, avaliacoes] = await Promise.all([
    db.query({ from: [{ collectionId: 'servicos' }] }, `barbearias/${barbeariaId}`),
    db.query(iguais('avaliacoes', 'barbeariaId', barbeariaId)),
  ]);
  // Convites da casa (quem convidou e quem entrou) também saem.
  const convites = await db.query(iguais('convites', 'barbeariaId', barbeariaId));
  const caminhos = [...avaliacoes.map(a => `avaliacoes/${a.id}`), ...convites.map(c => `convites/${c.id}`)];
  for (let i = 0; i < caminhos.length; i += 500) await db.apagar(caminhos.slice(i, i + 500));
  // ponytail: até 1000 fotos por pasta (a casa tem no máximo 12 e cada serviço 6).
  const pastas = await Promise.all([`barbearia/${barbeariaId}/`, ...servicos.map(s => `servico/${s.id}/`)].map(prefix => fotos.list({ prefix })));
  const chaves = pastas.flatMap(p => p.objects.map(o => o.key));
  for (let i = 0; i < chaves.length; i += 1000) await fotos.delete(chaves.slice(i, i + 1000));
  return { status: 200, corpo: { ok: true } };
}

/**
 * GET /conta/dados — acesso e portabilidade (LGPD, art. 18, II e V): tudo o que o Navalha guarda sobre a pessoa, num
 * JSON legível. Quem pede é o próprio dono dos dados (login conferido); nunca traz dados de outra pessoa além do que
 * já aparece para ela no app (nome da barbearia e do barbeiro nos horários).
 * ponytail: até 500 itens por coleção; quem passar disso recebe o resto por e-mail, se pedir.
 */
export async function exportarDados(db: Firestore, uid: string, agora = Date.now()) {
  const doUsuario = (colecao: string, campo: string) => db.query({ ...iguais(colecao, campo, uid), limit: 500 });
  const [agendamentos, notificacoes, eventos, erros, clubes] = await Promise.all([
    doUsuario('agendamentos', 'clienteUid'), doUsuario('notificacoes', 'paraUid'), doUsuario('eventos', 'uid'), doUsuario('erros', 'uid'),
    doUsuario('clubeMembros', 'clienteUid'),
  ]);
  const pagamentos = await Promise.all(clubes.map(c => db.query({ from: [{ collectionId: 'pagamentos' }], limit: 500 }, `clubeMembros/${c.id}`)));
  const perfil = (await db.varios([`users/${uid}`])).get(`users/${uid}`);
  const ondeAtende = (perfil?.barbearias as string[] | undefined) ?? [];
  const casasAvaliadas = Object.keys((perfil?.avaliouBarbearias as Record<string, unknown> | undefined) ?? {});
  const ids = await Promise.all(casasAvaliadas.map(async b => `avaliacoes/${await idAvaliacao(b, uid)}`));
  const outros = await db.varios([`testes/${uid}`, ...ids, ...ondeAtende.flatMap(b => [`barbearias/${b}/barbeiros/${uid}`, `barbearias/${b}/equipePrivado/${uid}`])]);
  const lista = (l: { id: string; dados: Record<string, unknown> }[]) => l.map(x => ({ id: x.id, ...x.dados }));
  return {
    status: 200,
    corpo: {
      geradoEm: new Date(agora).toISOString(),
      sobre: 'Dados que o Navalha guarda sobre você (LGPD, art. 18). Datas em milissegundos desde 1970 (UTC).',
      perfil: perfil ?? null,
      agendamentos: lista(agendamentos),
      clubes: clubes.map((c, i) => ({ id: c.id, ...c.dados, pagamentos: lista(pagamentos[i]) })),
      avaliacoesDeBarbearias: ids.filter(c => outros.has(c)).map(c => outros.get(c)),
      notificacoes: lista(notificacoes),
      usoDoApp: lista(eventos),
      errosTecnicos: lista(erros),
      testeGratis: outros.get(`testes/${uid}`) ?? null,
      equipes: ondeAtende.map(b => ({ barbeariaId: b, cartao: outros.get(`barbearias/${b}/barbeiros/${uid}`) ?? null,
        privado: outros.get(`barbearias/${b}/equipePrivado/${uid}`) ?? null })),
    },
  };
}
