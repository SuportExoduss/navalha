// Filtros da busca "Perto de você". Usa só o documento da barbearia (com o resumo
// desnormalizado), então filtrar não gasta nenhuma leitura extra.
import { OFFSET_BRASILIA_MIN, dataLocal, diaDaSemana, hhmmParaMin } from './agenda';
import type { Barbearia, Millis, Servico } from '../types/models';

export type FaixaPreco = 'ate40' | '40a70' | '70mais';
export const RAIOS = [1, 3, 5, 10] as const;

export interface Filtros {
  raioKm: (typeof RAIOS)[number];
  texto: string;
  categoria: Servico['categoria'] | null;
  preco: FaixaPreco | null;
  abertoAgora: boolean;
  /** Ainda dá para cortar hoje: a casa fecha depois de agora + antecedência. */
  aindaHoje: boolean;
}

export const FILTROS_PADRAO: Filtros = { raioKm: 10, texto: '', categoria: null, preco: null, abertoAgora: false, aindaHoje: false };

const FAIXAS: Record<FaixaPreco, [number, number]> = { ate40: [0, 4000], '40a70': [4000, 7000], '70mais': [7000, Infinity] };

function minutoLocal(agora: Millis) {
  const d = new Date(agora + OFFSET_BRASILIA_MIN * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function abertaAgora(b: Pick<Barbearia, 'expediente'>, agora: Millis): boolean {
  const dia = b.expediente[diaDaSemana(dataLocal(agora))];
  if (!dia) return false;
  const m = minutoLocal(agora);
  if (m < hhmmParaMin(dia.abre) || m >= hhmmParaMin(dia.fecha)) return false;
  return !(dia.pausas ?? []).some(p => m >= hhmmParaMin(p.inicio) && m < hhmmParaMin(p.fim));
}

export function atendeAindaHoje(b: Pick<Barbearia, 'expediente' | 'antecedenciaMin'>, agora: Millis): boolean {
  const dia = b.expediente[diaDaSemana(dataLocal(agora))];
  return !!dia && minutoLocal(agora) + b.antecedenciaMin < hhmmParaMin(dia.fecha);
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarBarbearias<T extends Barbearia & { distanciaKm: number }>(lista: T[], f: Filtros, agora: Millis): T[] {
  const texto = semAcento(f.texto.trim());
  return lista.filter(b => {
    if (b.distanciaKm > f.raioKm) return false;
    if (texto && !semAcento(`${b.nome} ${b.endereco} ${b.cidade}`).includes(texto)) return false;
    if (f.categoria && !(b.resumo.categorias ?? []).includes(f.categoria)) return false;
    if (f.preco) {
      const [de, ate] = FAIXAS[f.preco];
      const min = b.resumo.precoMin, max = b.resumo.precoMax ?? min;
      if (min === undefined || max === undefined || max < de || min > ate) return false;
    }
    if (f.abertoAgora && !abertaAgora(b, agora)) return false;
    if (f.aindaHoje && !atendeAindaHoje(b, agora)) return false;
    return true;
  });
}

export function contarFiltros(f: Filtros): number {
  return [f.raioKm !== 10, !!f.categoria, !!f.preco, f.abertoAgora, f.aindaHoje].filter(Boolean).length;
}
