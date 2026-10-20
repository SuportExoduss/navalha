// Assinatura da barbearia pelo Google Play Billing (expo-iap, sem conta Expo).
// O app compra; o Worker confere no Google e grava plano e vencimento (as regras não deixam o app gravar).
// A compra leva o id da barbearia como "conta ofuscada": o Worker recusa token usado em outra casa.
import {
  fetchProducts, finishTransaction, getAvailablePurchases, initConnection, isUserCancelledError,
  purchaseErrorListener, purchaseUpdatedListener, requestPurchase,
  type ProductSubscription, type Purchase,
} from 'expo-iap';
import { PLANOS, modoDeTroca, planoPorProduto, type Plano } from '../lib/planos';
import { auth } from './firebase';

export interface OfertaPlano { plano: Plano; preco: string; offerToken: string }
export interface CompraAtual { produto: string; token: string }
export type ResultadoAssinatura = 'ok' | 'pendente' | 'cancelado';

export const assinaturaDisponivel = true;

let conexao: Promise<unknown> | null = null;
const conectar = () => (conexao ??= initConnection().catch(e => { conexao = null; throw e; }));

/** Preços reais vindos da Play Store (na moeda e com os impostos do aparelho). Vazio = produtos ainda não publicados. */
export async function carregarPlanos(): Promise<OfertaPlano[]> {
  await conectar();
  const produtos = (await fetchProducts({ skus: PLANOS.map(p => p.produto), type: 'subs' })) as ProductSubscription[];
  return PLANOS.flatMap(plano => {
    const p = produtos.find(x => x.id === plano.produto);
    const oferta = p?.subscriptionOffers?.find(o => o.basePlanIdAndroid === 'mensal') ?? p?.subscriptionOffers?.[0];
    return oferta?.offerTokenAndroid ? [{ plano, preco: oferta.displayPrice, offerToken: oferta.offerTokenAndroid }] : [];
  });
}

/** Assinatura que esta conta Google já tem no aparelho (para trocar de plano). */
export async function compraAtual(): Promise<CompraAtual | null> {
  await conectar();
  const p = (await getAvailablePurchases()).find(x => planoPorProduto(x.productId) && x.purchaseToken);
  return p ? { produto: p.productId, token: p.purchaseToken! } : null;
}

async function confirmarNoServidor(barbeariaId: string, purchaseToken: string): Promise<'ok' | 'pendente'> {
  const idToken = await auth.currentUser?.getIdToken();
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/assinatura/verificar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ barbeariaId, purchaseToken }),
  });
  if (r.status === 202) return 'pendente';
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? 'Não foi possível confirmar a assinatura.');
  return 'ok';
}

/** Confere no servidor e só então conclui a compra (o Google estorna se não concluir em 3 dias). */
async function concluir(compra: Purchase, barbeariaId: string) {
  const r = await confirmarNoServidor(barbeariaId, compra.purchaseToken!);
  await finishTransaction({ purchase: compra, isConsumable: false });
  return r;
}

/** Abre a tela de pagamento do Google Play. `atual` = troca de plano (sobe já; desce na renovação). */
export function assinar(o: OfertaPlano, barbeariaId: string, atual?: CompraAtual | null): Promise<ResultadoAssinatura> {
  return new Promise((resolve, reject) => {
    const limpar = () => { ok.remove(); erro.remove(); };
    const ok = purchaseUpdatedListener(compra => {
      if (compra.productId !== o.plano.produto) return;
      limpar();
      concluir(compra, barbeariaId).then(resolve, reject);
    });
    const erro = purchaseErrorListener(e => {
      limpar();
      if (isUserCancelledError(e)) resolve('cancelado');
      else reject(new Error('O Google Play não concluiu o pagamento. Tente de novo.'));
    });
    const anterior = atual ? planoPorProduto(atual.produto) : undefined;
    conectar().then(() => requestPurchase({
      type: 'subs',
      request: { google: {
        skus: [o.plano.produto],
        subscriptionOffers: [{ sku: o.plano.produto, offerToken: o.offerToken }],
        obfuscatedAccountId: barbeariaId,
        ...(atual && anterior ? {
          purchaseToken: atual.token,
          subscriptionProductReplacementParams: { oldProductId: atual.produto, replacementMode: modoDeTroca(anterior, o.plano) },
        } : {}),
      } },
    })).catch(e => { limpar(); reject(e); });
  });
}

/** "Já paguei": reenvia ao servidor a assinatura que o Google Play mostra neste aparelho. */
export async function restaurar(barbeariaId: string): Promise<boolean> {
  await conectar();
  const compra = (await getAvailablePurchases()).find(x => planoPorProduto(x.productId) && x.purchaseToken);
  if (!compra) return false;
  await concluir(compra, barbeariaId);
  return true;
}
