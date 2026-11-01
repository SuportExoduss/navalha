// Exportar um ou vários meses (Resumos anteriores): planilha CSV e PDF (HTML que vira PDF). Lógica pura, sem React.
import { formatarHora, formatarPreco } from './agenda';
import { calcularResumoMes, nomeDoMes } from './notificacoes';
import type { Agendamento, ISODate, StatusAgendamento } from '../types/models';

type Linha = Pick<Agendamento, 'data' | 'inicio' | 'barbeiroNome' | 'clienteNome' | 'servicoNome' | 'precoCentavos' | 'status' | 'origem' | 'cancelamento'>;

export const STATUS: Record<StatusAgendamento, string> = {
  reservado: 'Reservado', confirmado: 'Confirmado', pago: 'Pago', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado',
};
export const ORIGEM: Record<Agendamento['origem'], string> = { app: 'App', balcao: 'Balcão', clube: 'Clube' };

/** Datas do mês 'AAAA-MM' para a consulta (o "31" serve em qualquer mês: a comparação é de texto). */
export function intervaloDoMes(mes: string): { de: ISODate; ate: ISODate } {
  return { de: `${mes}-01`, ate: `${mes}-31` };
}

/** "Cliente: não vou conseguir ir" (vazio se não foi cancelado ou não deixou motivo). */
export const textoDoCancelamento = (c: Agendamento['cancelamento']) =>
  c ? `${c.por === 'cliente' ? 'Cliente' : 'Barbearia'}: ${c.motivo}` : '';

const ordenar = (ags: Linha[]) => [...ags].sort((a, b) => a.inicio - b.inicio);
const dataBR = (d: ISODate) => d.split('-').reverse().join('/');
const valor = (c: number) => (c / 100).toFixed(2).replace('.', ',');

function colunas(a: Linha) {
  return [dataBR(a.data), formatarHora(a.inicio), a.barbeiroNome || 'Barbeiro', a.clienteNome, a.servicoNome,
    valor(a.precoCentavos), STATUS[a.status], ORIGEM[a.origem], textoDoCancelamento(a.cancelamento)];
}
const CABECALHO = ['Data', 'Hora', 'Barbeiro', 'Cliente', 'Serviço', 'Valor (R$)', 'Status', 'Origem', 'Cancelamento'];

/** Uma linha por atendimento, separada por ";" e com BOM: o Excel brasileiro abre com colunas e acentos certos. */
export function csvDoMes(ags: Linha[]): string {
  const campo = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const linhas = [CABECALHO, ...ordenar(ags).map(colunas)].map(l => l.map(campo).join(';'));
  return '﻿' + linhas.join('\r\n') + '\r\n';
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** HTML do PDF de um mês. `quem`: nome da casa ou do barbeiro. */
export const htmlDoMes = (mes: string, quem: string, ags: Linha[]) => htmlDosMeses([mes], quem, ags);

/** HTML do PDF: para cada mês (do mais antigo ao mais novo, um por página), os números e a lista de atendimentos. */
export function htmlDosMeses(meses: string[], quem: string, ags: Linha[]): string {
  const ordem = [...meses].sort();
  const titulo = ordem.length === 1 ? `Resumo de ${nomeDoMes(ordem[0])}` : `Resumos de ${nomeDoMes(ordem[0])} a ${nomeDoMes(ordem[ordem.length - 1])}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(`${titulo} - ${quem}`)}</title>
<style>body{font-family:sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0}h2{font-size:14px;color:#555;margin:4px 0 16px}
p{margin:4px 0;font-size:13px}table{border-collapse:collapse;width:100%;margin-top:16px;font-size:11px}
th,td{border-bottom:1px solid #ddd;padding:4px;text-align:left}th{background:#eee}td:nth-child(6){text-align:right}
section+section{page-break-before:always;margin-top:32px}</style></head><body>
${ordem.map(m => secaoDoMes(m, quem, ags.filter(a => a.data.startsWith(m)))).join('')}
</body></html>`;
}

function secaoDoMes(mes: string, quem: string, ags: Linha[]): string {
  const r = calcularResumoMes(ags);
  const n = (v: number, palavra: string) => `${v} ${v === 1 ? palavra : palavra + 's'}`;
  const numeros = [
    `Faturado: <b>${formatarPreco(r.faturadoCentavos)}</b>`,
    `${n(r.agendamentos, 'agendamento')} (${r.pelaApp} pelo app), ${n(r.concluidos, 'concluído')}, ${n(r.faltas, 'falta')} e ${n(r.cancelados, 'cancelado')}`,
    ...(r.maisPedido ? [`Mais pedido: ${esc(r.maisPedido.nome)} (${r.maisPedido.vezes}×)`] : []),
    ...r.porBarbeiro.map(b => `${esc(b.nome)}: ${formatarPreco(b.faturadoCentavos)} em ${n(b.concluidos, 'atendimento')}`),
  ];
  const linhas = ordenar(ags).map(a => `<tr>${colunas(a).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<section><h1>Resumo de ${esc(nomeDoMes(mes))}</h1><h2>${esc(quem)}</h2>${numeros.map(t => `<p>${t}</p>`).join('')}
${ags.length ? `<table><thead><tr>${CABECALHO.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table>`
    : '<p>Nenhum agendamento no mês.</p>'}</section>`;
}

/** Nome do arquivo sem acento nem espaço: "resumo-2026-10-joao-silva"; vários meses: "resumo-2026-09-a-2026-10-…". */
export function nomeDoArquivo(meses: string | string[], quem: string): string {
  const o = (typeof meses === 'string' ? [meses] : meses).slice().sort();
  const mes = o.length > 1 ? `${o[0]}-a-${o[o.length - 1]}` : o[0];
  const slug = quem.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `resumo-${mes}${slug ? `-${slug}` : ''}`;
}
