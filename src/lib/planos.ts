// Planos da barbearia (assinatura mensal pelo Google Play Billing). Uma única fonte para o app,
// o Worker (que confere a compra) e os testes. Preços em centavos; o valor cobrado de verdade é o
// cadastrado na Play Console — estes servem para a tela e para conferir o produto comprado.
import type { Millis } from '../types/models';

export type PlanoId = 'solo' | 'equipe' | 'casa' | 'casa_cheia';

export interface Plano {
  id: PlanoId;
  /** ID do produto de assinatura na Play Console (base plan mensal "mensal"). */
  produto: string;
  nome: string;
  precoCentavos: number;
  /** Barbeiros ativos na casa, contando o dono. */
  barbeiros: number;
}

// ponytail: nomes de "casa" e "casa_cheia" (R$ 100 e R$ 150) ainda não decididos pelo dono; trocar só o `nome`.
export const PLANOS: Plano[] = [
  { id: 'solo', produto: 'navalha_solo', nome: 'Solo', precoCentavos: 2500, barbeiros: 1 },
  { id: 'equipe', produto: 'navalha_equipe', nome: 'Equipe', precoCentavos: 7000, barbeiros: 3 },
  { id: 'casa', produto: 'navalha_casa', nome: 'Casa', precoCentavos: 10000, barbeiros: 6 },
  { id: 'casa_cheia', produto: 'navalha_casa_cheia', nome: 'Casa cheia', precoCentavos: 15000, barbeiros: 10 },
];

/** Primeiros usuários: 60 dias liberados, com o limite do maior plano, para conhecer tudo. */
export const DIAS_TESTE = 60;
export const LIMITE_TESTE = 10;

export const planoPorId = (id: string | undefined) => PLANOS.find(p => p.id === id);
export const planoPorProduto = (produto: string | undefined) => PLANOS.find(p => p.produto === produto);

/** Quantos barbeiros ativos precisam ser desligados antes de ir para este plano (0 = pode trocar já). */
export function excedentesPara(plano: Plano, barbeirosAtivos: number): number {
  return Math.max(0, barbeirosAtivos - plano.barbeiros);
}

/** Cabe mais um barbeiro ativo agora? */
export const cabeMaisUm = (barbeirosAtivos: number, limite: number) => barbeirosAtivos < limite;

/** Estados do Google Play (subscriptionsv2) que mantêm a barbearia no ar. */
const ESTADOS_EM_DIA = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']);

/**
 * Em dia = pago e dentro do prazo. Cancelada continua valendo até o fim do período já pago
 * (o dono cancelou a renovação, não o mês corrente).
 */
export function emDiaPeloPlay(estado: string, venceEm: Millis, agora: Millis): boolean {
  if (venceEm <= agora) return false;
  return ESTADOS_EM_DIA.has(estado) || estado === 'SUBSCRIPTION_STATE_CANCELED';
}

/** Troca para um plano mais caro cobra a diferença já; para um mais barato vale a partir da próxima renovação. */
export function modoDeTroca(atual: Plano, novo: Plano): 'charge-prorated-price' | 'deferred' {
  return novo.precoCentavos > atual.precoCentavos ? 'charge-prorated-price' : 'deferred';
}
