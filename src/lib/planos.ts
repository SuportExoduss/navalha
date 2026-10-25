// Planos da barbearia (assinatura mensal pelo Google Play Billing). Uma única fonte para o app,
// o Worker (que confere a compra) e os testes. Preços em centavos; o valor cobrado de verdade é o
// cadastrado na Play Console — estes servem para a tela e para conferir o produto comprado.
import type { AssinaturaCasa, Millis } from '../types/models';

export type PlanoId = 'solo' | 'equipe' | 'time' | 'casa_cheia';

export interface Plano {
  id: PlanoId;
  /** ID do produto de assinatura na Play Console (base plan mensal "mensal"). */
  produto: string;
  nome: string;
  precoCentavos: number;
  /** Barbeiros ativos na casa, contando o dono. */
  barbeiros: number;
}

export const PLANOS: Plano[] = [
  { id: 'solo', produto: 'navalha_solo', nome: 'Solo', precoCentavos: 2500, barbeiros: 1 },
  { id: 'equipe', produto: 'navalha_equipe', nome: 'Equipe', precoCentavos: 7000, barbeiros: 3 },
  { id: 'time', produto: 'navalha_time', nome: 'Time', precoCentavos: 10000, barbeiros: 6 },
  { id: 'casa_cheia', produto: 'navalha_casa_cheia', nome: 'Casa cheia', precoCentavos: 15000, barbeiros: 10 },
];

/** Primeiros usuários: 60 dias liberados, com o limite do maior plano, para conhecer tudo. */
export const DIAS_TESTE = 60;
export const LIMITE_TESTE = 10;
/** Venceu (teste ou mês pago sem renovar): mais 5 dias de uso para regularizar; depois a barbearia fica bloqueada. */
export const DIAS_REGULARIZAR = 5;
/** A partir de quantos dias antes do fim o dono vê o aviso de vencimento próximo. */
export const DIAS_AVISO = 7;

const DIA = 86_400_000;
/** Até quando a casa continua liberada depois do vencimento. */
export const bloqueiaEm = (venceEm: Millis) => venceEm + DIAS_REGULARIZAR * DIA;
const diasAte = (quando: Millis, agora: Millis) => Math.max(1, Math.ceil((quando - agora) / DIA));

export type SituacaoAssinatura =
  | { tipo: 'ok' }
  | { tipo: 'rascunho' } // casa sem teste nem plano: o dono monta e assina antes de receber clientes
  | { tipo: 'vence_logo'; ate: Millis; dias: number }
  | { tipo: 'regularizar'; ate: Millis; dias: number } // venceu, mas ainda dentro dos 5 dias
  | { tipo: 'bloqueada' };

/**
 * O que o app mostra ao dono sobre a assinatura. `emDia` vem do servidor (o cron decide o bloqueio de hora em hora);
 * aqui só se traduz para avisos. Plano pago com renovação automática não avisa: o Google Play cobra sozinho.
 */
export function situacaoAssinatura(b: { emDia: boolean; assinatura: Pick<AssinaturaCasa, 'status' | 'venceEm' | 'renovaSozinha'> }, agora: Millis): SituacaoAssinatura {
  const { status, venceEm, renovaSozinha } = b.assinatura;
  if (status === 'rascunho') return { tipo: 'rascunho' };
  if (!b.emDia) return { tipo: 'bloqueada' };
  if (!venceEm) return { tipo: 'ok' };
  const renovando = status === 'ativa' && renovaSozinha !== false;
  if (status === 'inadimplente' || status === 'vencida' || (venceEm <= agora && !renovando)) {
    const ate = bloqueiaEm(venceEm);
    return { tipo: 'regularizar', ate, dias: diasAte(ate, agora) };
  }
  if (!renovando && venceEm - agora <= DIAS_AVISO * DIA) return { tipo: 'vence_logo', ate: venceEm, dias: diasAte(venceEm, agora) };
  return { tipo: 'ok' };
}

export const planoPorId = (id: string | undefined) => PLANOS.find(p => p.id === id);
export const planoPorProduto = (produto: string | undefined) => PLANOS.find(p => p.produto === produto);

/** Quantos barbeiros ativos precisam ser desligados antes de ir para este plano (0 = pode trocar já). */
export function excedentesPara(plano: Plano, barbeirosAtivos: number): number {
  return Math.max(0, barbeirosAtivos - plano.barbeiros);
}

/** Cabe mais um barbeiro ativo agora? */
export const cabeMaisUm = (barbeirosAtivos: number, limite: number) => barbeirosAtivos < limite;

/** Renovação automática ligada? Cancelada (o dono desligou na Play Store) ou expirada: não renova mais. */
export const renovaSozinha = (estado: string) => estado !== 'SUBSCRIPTION_STATE_CANCELED' && estado !== 'SUBSCRIPTION_STATE_EXPIRED';

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
