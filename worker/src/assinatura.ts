// Assinatura da barbearia pelo Google Play Billing. O app compra; o Worker confere no Google
// (Android Publisher API, subscriptionsv2) e só então grava plano, vencimento e "em dia" — campos
// que as regras do Firestore não deixam o dono mexer.
import { DIAS_TESTE, LIMITE_TESTE, emDiaPeloPlay, planoPorProduto, type Plano } from '../../src/lib/planos';
import type { Firestore } from './firestore';

export const PACOTE = 'com.trevotec.navalha';

export interface CompraPlay {
  subscriptionState?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
}

/** O que a compra significa para a casa. Puro, para testar sem rede. */
export function lerCompra(c: CompraPlay, barbeariaId: string, agora: number):
  { ok: true; plano: Plano; venceEm: number; emDia: boolean; estado: string } | { ok: false; erro: string } {
  // A compra precisa ter sido feita para ESTA barbearia (o app manda o id dela como conta ofuscada):
  // sem isso, um token de outra casa poderia ser reaproveitado.
  if (c.externalAccountIdentifiers?.obfuscatedExternalAccountId !== barbeariaId) return { ok: false, erro: 'Compra de outra barbearia.' };
  const item = c.lineItems?.[0];
  const plano = planoPorProduto(item?.productId);
  if (!plano) return { ok: false, erro: 'Produto desconhecido.' };
  const venceEm = Date.parse(item?.expiryTime ?? '');
  if (!Number.isFinite(venceEm)) return { ok: false, erro: 'Compra sem vencimento.' };
  const estado = c.subscriptionState ?? '';
  return { ok: true, plano, venceEm, emDia: emDiaPeloPlay(estado, venceEm, agora), estado };
}

/** Campos da casa depois de conferir a compra. Em atraso/vencida: sai da busca, mantém o plano para o dono ver. */
export function camposDaCasa(r: { plano: Plano; venceEm: number; emDia: boolean; estado: string }) {
  const atrasada = r.estado === 'SUBSCRIPTION_STATE_ON_HOLD' || r.estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  return {
    'assinatura.status': r.emDia ? 'ativa' : atrasada ? 'inadimplente' : 'vencida',
    'assinatura.plano': r.plano.id,
    'assinatura.venceEm': r.venceEm,
    'assinatura.limiteBarbeiros': r.plano.barbeiros,
    emDia: r.emDia,
  };
}

export async function consultarPlay(tokenSA: string, purchaseToken: string): Promise<CompraPlay | null> {
  const r = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACOTE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${tokenSA}` } },
  );
  if (r.status === 404 || r.status === 410) return null;
  if (!r.ok) throw new Error(`Play ${r.status}: ${await r.text()}`);
  return (await r.json()) as CompraPlay;
}

/** POST /assinatura/verificar — chamado pelo app logo depois da compra (e no "restaurar"). */
export async function verificarCompra(db: Firestore, tokenSA: string, uid: string, barbeariaId: string, purchaseToken: string, agora = Date.now()) {
  const casa = (await db.varios([`barbearias/${barbeariaId}`])).get(`barbearias/${barbeariaId}`);
  if (!casa || casa.donoUid !== uid) return { status: 403, corpo: { erro: 'Só o dono da barbearia assina o plano.' } };
  const compra = await consultarPlay(tokenSA, purchaseToken);
  if (!compra) return { status: 404, corpo: { erro: 'Compra não encontrada no Google Play.' } };
  const r = lerCompra(compra, barbeariaId, agora);
  if (!r.ok) return { status: 400, corpo: { erro: r.erro } };
  // Troca para plano menor (vale na renovação): a compra nova ainda não está ativa; não derruba a atual.
  if (!r.emDia && casa.emDia === true && (casa.assinatura as { status?: string })?.status === 'ativa') {
    return { status: 202, corpo: { pendente: true } };
  }
  await db.escrever([
    { caminho: `barbearias/${barbeariaId}`, campos: camposDaCasa(r) },
    { caminho: `assinaturas/${barbeariaId}`, criar: true, campos: { purchaseToken, produto: r.plano.produto, estado: r.estado, atualizadoEm: agora } },
  ]);
  return { status: 200, corpo: { emDia: r.emDia, plano: r.plano.id, venceEm: r.venceEm } };
}

/**
 * Cron: casas "em dia" cujo prazo passou. Com compra: pergunta ao Google (a renovação estende o prazo).
 * Sem compra (fim do teste): sai da busca. ponytail: até 15 por execução (limite de chamadas do plano grátis).
 */
export async function conferirVencimentos(db: Firestore, tokenSA: string, agora = Date.now()) {
  const vencidas = await db.query({
    from: [{ collectionId: 'barbearias' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'emDia' }, op: 'EQUAL', value: { booleanValue: true } } },
      { fieldFilter: { field: { fieldPath: 'assinatura.venceEm' }, op: 'LESS_THAN', value: { integerValue: String(agora) } } },
    ] } },
    limit: 15,
  });
  if (!vencidas.length) return;
  const compras = await db.varios(vencidas.map(v => `assinaturas/${v.id}`));
  const escritas: { caminho: string; campos: Record<string, unknown> }[] = [];
  for (const { id } of vencidas) {
    const token = compras.get(`assinaturas/${id}`)?.purchaseToken as string | undefined;
    const compra = token ? await consultarPlay(tokenSA, token).catch(() => null) : null;
    const r = compra ? lerCompra(compra, id, agora) : null;
    escritas.push({ caminho: `barbearias/${id}`, campos: r?.ok ? camposDaCasa(r) : { 'assinatura.status': 'vencida', emDia: false } });
  }
  await db.escrever(escritas);
}

/**
 * Migração única das casas criadas antes dos planos: contador de barbeiros ativos, 60 dias de teste
 * a partir de agora (primeiros usuários) e a marca de teste usado do dono. Idempotente.
 */
export async function migrarAssinaturas(db: Firestore, agora = Date.now()) {
  const casas = await db.query({ from: [{ collectionId: 'barbearias' }], limit: 300 });
  let migradas = 0;
  for (const { id, dados } of casas) {
    if (typeof dados.emDia === 'boolean' && typeof dados.barbeirosAtivos === 'number') continue;
    const ativos = await db.query({
      from: [{ collectionId: 'barbeiros' }],
      where: { fieldFilter: { field: { fieldPath: 'ativo' }, op: 'EQUAL', value: { booleanValue: true } } },
    }, `barbearias/${id}`);
    await db.escrever([
      { caminho: `barbearias/${id}`, campos: {
        assinatura: { status: 'teste', venceEm: agora + DIAS_TESTE * 86_400_000, limiteBarbeiros: LIMITE_TESTE },
        emDia: true, barbeirosAtivos: ativos.length,
      } },
      { caminho: `testes/${dados.donoUid as string}`, criar: true, campos: { em: agora } },
    ]);
    migradas++;
  }
  return { casas: casas.length, migradas };
}
