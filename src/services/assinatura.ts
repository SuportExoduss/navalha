// Versão web: o Google Play Billing só existe no app Android. A web mostra o plano e manda para o app.
import type { Plano } from '../lib/planos';

export interface OfertaPlano { plano: Plano; preco: string; offerToken: string }
export interface CompraAtual { produto: string; token: string }
export type ResultadoAssinatura = 'ok' | 'pendente' | 'cancelado';

export const assinaturaDisponivel = false;
const SO_NO_APP = 'A assinatura é feita pelo app Android (Google Play).';

export async function carregarPlanos(): Promise<OfertaPlano[]> { return []; }
export async function compraAtual(): Promise<CompraAtual | null> { return null; }
export async function assinar(_o: OfertaPlano, _b: string, _a?: CompraAtual | null): Promise<ResultadoAssinatura> { throw new Error(SO_NO_APP); }
export async function restaurar(_b: string): Promise<boolean> { throw new Error(SO_NO_APP); }
