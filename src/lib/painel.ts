// Resumo da casa para o dono, calculado dos agendamentos já lidos (uma escuta cobre os três filtros).
// Calendário = um dia escolhido; Hoje = só hoje; Semana = segunda a domingo desta semana; Mês = o mês inteiro (o que
// ainda vem entra no "A receber").
import { diaDaSemana, somarDias } from './agenda';
import type { Agendamento, ISODate } from '../types/models';

export type Periodo = 'calendario' | 'dia' | 'semana' | 'mes';

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

export function intervaloDoPeriodo(periodo: Periodo, hoje: ISODate, escolhido: ISODate = hoje): { de: ISODate; ate: ISODate } {
  if (periodo === 'calendario') return { de: escolhido, ate: escolhido };
  if (periodo === 'dia') return { de: hoje, ate: hoje };
  if (periodo === 'mes') return { de: `${hoje.slice(0, 8)}01`, ate: fimDoMes(hoje) };
  const segunda = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  return { de: segunda, ate: somarDias(segunda, 6) };
}

/** Último dia do mês de `dia` (o dia 0 do mês seguinte). */
export function fimDoMes(dia: ISODate): ISODate {
  return new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), 0)).toISOString().slice(0, 10);
}

/** O que a escuta do painel lê: do começo mais cedo (segunda ou dia 1) ao fim mais tarde (domingo ou fim do mês). */
export function intervaloDoPainel(hoje: ISODate): { de: ISODate; ate: ISODate } {
  const s = intervaloDoPeriodo('semana', hoje);
  const m = intervaloDoPeriodo('mes', hoje);
  return { de: s.de < m.de ? s.de : m.de, ate: s.ate > m.ate ? s.ate : m.ate };
}

export function resumir(ags: Agendamento[], periodo: Periodo, hoje: ISODate, escolhido: ISODate = hoje): Resumo {
  const { de, ate } = intervaloDoPeriodo(periodo, hoje, escolhido);
  return resumirLista(ags.filter(a => a.data >= de && a.data <= ate));
}

/** Os números de uma lista já recortada (o relatório do mês usa direto). */
export function resumirLista(doPeriodo: Agendamento[]): Resumo {
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

/** O que cada número do resumo soma, para a lista que abre ao tocar nele (por horário). */
export type Detalhe = 'agendamentos' | 'faturado' | 'receber' | 'faltas';
const DO_DETALHE: Record<Detalhe, (s: Agendamento['status']) => boolean> = {
  agendamentos: s => s !== 'cancelado',
  faturado: s => s === 'concluido',
  receber: s => DE_PE.has(s),
  faltas: s => s === 'faltou' || s === 'cancelado',
};
export function doDetalhe<T extends Pick<Agendamento, 'status' | 'inicio'>>(ags: T[], d: Detalhe): T[] {
  return ags.filter(a => DO_DETALHE[d](a.status)).sort((a, b) => a.inicio - b.inicio);
}

/** Serviços do período (sem os cancelados), do mais pedido ao menos. */
export function porServico(ags: Pick<Agendamento, 'status' | 'servicoNome' | 'precoCentavos'>[]) {
  const m = new Map<string, { nome: string; vezes: number; centavos: number }>();
  for (const a of ags) {
    if (a.status === 'cancelado') continue;
    const s = m.get(a.servicoNome) ?? { nome: a.servicoNome, vezes: 0, centavos: 0 };
    s.vezes++; s.centavos += a.precoCentavos;
    m.set(a.servicoNome, s);
  }
  return [...m.values()].sort((x, y) => y.vezes - x.vezes || y.centavos - x.centavos);
}

/** Calendário do mês de `dia`: semanas de domingo a sábado, com null nas casas fora do mês. */
export function semanasDoMes(dia: ISODate): (ISODate | null)[][] {
  const primeiro = `${dia.slice(0, 8)}01`;
  const dias: (ISODate | null)[] = Array(diaDaSemana(primeiro)).fill(null);
  for (let d = primeiro; d.slice(0, 7) === primeiro.slice(0, 7); d = somarDias(d, 1)) dias.push(d);
  while (dias.length % 7) dias.push(null);
  return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
}
