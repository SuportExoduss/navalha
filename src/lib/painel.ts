// Números do painel do dono, calculados dos agendamentos já lidos (sem leituras extras).
import { dataLocal, somarDias } from './agenda';
import type { Agendamento, Millis } from '../types/models';

export interface Painel {
  hoje: { clientes: number; previstoCentavos: number };
  semana: {
    agendamentos: number; concluidos: number; faltas: number; cancelados: number;
    faturadoCentavos: number; taxaFaltaPercent: number; pelaApp: number;
  };
  maisPedido: { nome: string; vezes: number } | null;
}

const ATIVO = new Set(['reservado', 'confirmado', 'pago']);

/** "Semana" = últimos 7 dias, incluindo hoje. */
export function calcularPainel(ags: Agendamento[], agora: Millis): Painel {
  const hoje = dataLocal(agora);
  const desde = somarDias(hoje, -6);
  const doDia = ags.filter(a => a.data === hoje && (ATIVO.has(a.status) || a.status === 'concluido'));
  const semana = ags.filter(a => a.data >= desde && a.data <= hoje);
  const concluidos = semana.filter(a => a.status === 'concluido');
  const faltas = semana.filter(a => a.status === 'faltou').length;
  const contagem = new Map<string, number>();
  for (const a of semana) if (a.status !== 'cancelado') contagem.set(a.servicoNome, (contagem.get(a.servicoNome) ?? 0) + 1);
  const [top] = [...contagem.entries()].sort((x, y) => y[1] - x[1]);
  return {
    hoje: { clientes: doDia.length, previstoCentavos: doDia.reduce((s, a) => s + a.precoCentavos, 0) },
    semana: {
      agendamentos: semana.filter(a => a.status !== 'cancelado').length,
      concluidos: concluidos.length,
      faltas,
      cancelados: semana.filter(a => a.status === 'cancelado').length,
      faturadoCentavos: concluidos.reduce((s, a) => s + a.precoCentavos, 0),
      taxaFaltaPercent: concluidos.length + faltas ? Math.round((faltas / (concluidos.length + faltas)) * 100) : 0,
      pelaApp: semana.filter(a => a.origem === 'app' && a.status !== 'cancelado').length,
    },
    maisPedido: top ? { nome: top[0], vezes: top[1] } : null,
  };
}
