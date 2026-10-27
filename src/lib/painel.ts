// Resumo da casa para o dono, calculado dos agendamentos já lidos (uma escuta cobre os três filtros).
// Hoje = só hoje; Semana = segunda a domingo desta semana; Mês = do dia 1 até hoje.
import { diaDaSemana, somarDias } from './agenda';
import type { Agendamento, ISODate } from '../types/models';

export type Periodo = 'dia' | 'semana' | 'mes';

export interface Resumo {
  agendamentos: number; concluidos: number; faltas: number; cancelados: number; pelaApp: number;
  /** Concluídos (já atendidos). */
  faturadoCentavos: number;
  /** Ainda de pé (reservado/confirmado): o que falta receber no período. */
  aReceberCentavos: number;
  taxaFaltaPercent: number;
  maisPedido: { nome: string; vezes: number } | null;
}

const DE_PE = new Set(['reservado', 'confirmado', 'pago']);

export function intervaloDoPeriodo(periodo: Periodo, hoje: ISODate): { de: ISODate; ate: ISODate } {
  if (periodo === 'dia') return { de: hoje, ate: hoje };
  if (periodo === 'mes') return { de: `${hoje.slice(0, 8)}01`, ate: hoje };
  const segunda = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  return { de: segunda, ate: somarDias(segunda, 6) };
}

/** O que a escuta do painel lê: do começo mais cedo (segunda ou dia 1) ao fim mais tarde (domingo). */
export function intervaloDoPainel(hoje: ISODate): { de: ISODate; ate: ISODate } {
  const s = intervaloDoPeriodo('semana', hoje);
  const m = intervaloDoPeriodo('mes', hoje);
  return { de: s.de < m.de ? s.de : m.de, ate: s.ate };
}

export function resumir(ags: Agendamento[], periodo: Periodo, hoje: ISODate): Resumo {
  const { de, ate } = intervaloDoPeriodo(periodo, hoje);
  const doPeriodo = ags.filter(a => a.data >= de && a.data <= ate);
  const valendo = doPeriodo.filter(a => a.status !== 'cancelado');
  const concluidos = doPeriodo.filter(a => a.status === 'concluido');
  const faltas = doPeriodo.filter(a => a.status === 'faltou').length;
  const contagem = new Map<string, number>();
  for (const a of valendo) contagem.set(a.servicoNome, (contagem.get(a.servicoNome) ?? 0) + 1);
  const [top] = [...contagem.entries()].sort((x, y) => y[1] - x[1]);
  return {
    agendamentos: valendo.length,
    concluidos: concluidos.length,
    faltas,
    cancelados: doPeriodo.length - valendo.length,
    pelaApp: valendo.filter(a => a.origem === 'app').length,
    faturadoCentavos: concluidos.reduce((s, a) => s + a.precoCentavos, 0),
    aReceberCentavos: doPeriodo.filter(a => DE_PE.has(a.status)).reduce((s, a) => s + a.precoCentavos, 0),
    taxaFaltaPercent: concluidos.length + faltas ? Math.round((faltas / (concluidos.length + faltas)) * 100) : 0,
    maisPedido: top ? { nome: top[0], vezes: top[1] } : null,
  };
}
