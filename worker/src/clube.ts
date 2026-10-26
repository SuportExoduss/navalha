// Clube de assinatura (docs/clube.md), cron próprio de hora em hora:
//  - pedido novo → aviso para o dono e os barbeiros ativos da casa;
//  - 3 dias antes e no dia do vencimento → lembrete ao cliente (só de dia);
//  - 1 dia depois do vencimento sem pagamento → status "vencido" e aviso ao cliente e ao dono.
// O que avisar e os textos ficam em src/lib/clube.ts (testados). Cada aviso grava a marca em `lembretes` junto
// com a notificação, então rodar de novo não repete.
import { avisoDevido, textoAvisoClube, type AvisoClube } from '../../src/lib/clube';
import type { MembroClube } from '../../src/types/models';
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
