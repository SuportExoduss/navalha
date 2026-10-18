// Lógica pura da agenda: gera horários livres e as chaves de ocupação
// usadas na trava contra horário duplo. Sem dependência de Firebase,
// para poder ser testada isoladamente (src/lib/agenda.test.ts).
import type { Expediente, HHMM, ISODate, Millis } from '../types/models';

/** Brasília não tem horário de verão desde 2019: UTC−3 fixo. */
export const OFFSET_BRASILIA_MIN = -180;
const MIN = 60_000;

export function hhmmParaMin(h: HHMM): number {
  const [hh, mm] = h.split(':').map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 24 || mm < 0 || mm > 59) {
    throw new Error(`Hora inválida: ${h}`);
  }
  return hh * 60 + mm;
}

export function minParaHHMM(m: number): HHMM {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Converte data local + minuto do dia em instante UTC. */
export function paraMillis(data: ISODate, minutoDoDia: number, offsetMin = OFFSET_BRASILIA_MIN): Millis {
  const [y, mo, d] = data.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 0, minutoDoDia) - offsetMin * MIN;
}

/** Dia da semana (0 = domingo) da data local. */
export function diaDaSemana(data: ISODate): number {
  const [y, mo, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export interface Intervalo { inicio: Millis; fim: Millis }

export interface EntradaHorarios {
  data: ISODate;
  /** Expediente do barbeiro (já limitado ao horário da casa). */
  expediente: Expediente;
  duracaoMin: number;
  passoMin: number;
  /** Agendamentos ativos + bloqueios do barbeiro que tocam este dia. */
  ocupados: Intervalo[];
  agora: Millis;
  antecedenciaMin: number;
  offsetMin?: number;
}

const sobrepoe = (a: Intervalo, b: Intervalo) => a.inicio < b.fim && b.inicio < a.fim;

/**
 * Inícios possíveis em que o corte inteiro cabe antes do próximo compromisso,
 * fora das pausas, dentro do expediente e respeitando a antecedência mínima.
 */
export function gerarHorarios(e: EntradaHorarios): Millis[] {
  const dia = e.expediente[diaDaSemana(e.data)];
  if (!dia || e.duracaoMin <= 0 || e.passoMin <= 0) return [];
  const off = e.offsetMin ?? OFFSET_BRASILIA_MIN;
  const abre = hhmmParaMin(dia.abre);
  const fecha = hhmmParaMin(dia.fecha);
  const pausas: Intervalo[] = (dia.pausas ?? []).map(p => ({
    inicio: paraMillis(e.data, hhmmParaMin(p.inicio), off),
    fim: paraMillis(e.data, hhmmParaMin(p.fim), off),
  }));
  const bloqueios = [...e.ocupados, ...pausas];
  const limite = e.agora + e.antecedenciaMin * MIN;

  // Grade ancorada à meia-noite: alinha os inícios com as chaves de ocupação.
  const primeiro = Math.ceil(abre / e.passoMin) * e.passoMin;
  const livres: Millis[] = [];
  for (let m = primeiro; m + e.duracaoMin <= fecha; m += e.passoMin) {
    const cand = { inicio: paraMillis(e.data, m, off), fim: paraMillis(e.data, m + e.duracaoMin, off) };
    if (cand.inicio < limite) continue;
    if (bloqueios.some(b => sobrepoe(cand, b))) continue;
    livres.push(cand.inicio);
  }
  return livres;
}

/**
 * Chaves dos blocos de `passoMin` que um atendimento ocupa.
 * Dois atendimentos sobrepostos do mesmo barbeiro sempre compartilham ao menos
 * uma chave — por isso criar esses documentos numa transação impede horário duplo.
 */
export function chavesOcupacao(
  barbeiroId: string, inicio: Millis, duracaoMin: number, passoMin: number,
  offsetMin = OFFSET_BRASILIA_MIN,
): string[] {
  const local = new Date(inicio + offsetMin * MIN);
  const data = local.toISOString().slice(0, 10);
  const minutoInicio = local.getUTCHours() * 60 + local.getUTCMinutes();
  const base = Math.floor(minutoInicio / passoMin) * passoMin;
  const fim = minutoInicio + duracaoMin;
  const chaves: string[] = [];
  for (let m = base; m < fim; m += passoMin) {
    chaves.push(`${barbeiroId}_${data}_${minParaHHMM(m).replace(':', '')}`);
  }
  return chaves;
}

/** "Qualquer barbeiro": primeiro horário livre entre todos. */
export function primeiroHorarioDaCasa(
  porBarbeiro: Record<string, Millis[]>,
): { barbeiroId: string; inicio: Millis } | null {
  let melhor: { barbeiroId: string; inicio: Millis } | null = null;
  for (const [barbeiroId, horarios] of Object.entries(porBarbeiro)) {
    const h = horarios[0];
    if (h !== undefined && (!melhor || h < melhor.inicio)) melhor = { barbeiroId, inicio: h };
  }
  return melhor;
}

/** Agrupa para a tela: Manhã (< 12h), Tarde (< 18h), Noite. */
export function agruparPorPeriodo(horarios: Millis[], offsetMin = OFFSET_BRASILIA_MIN) {
  const grupos = { manha: [] as Millis[], tarde: [] as Millis[], noite: [] as Millis[] };
  for (const h of horarios) {
    const hora = new Date(h + offsetMin * MIN).getUTCHours();
    (hora < 12 ? grupos.manha : hora < 18 ? grupos.tarde : grupos.noite).push(h);
  }
  return grupos;
}

/** Data local (YYYY-MM-DD) de um instante. */
export function dataLocal(ms: Millis, offsetMin = OFFSET_BRASILIA_MIN): ISODate {
  return new Date(ms + offsetMin * MIN).toISOString().slice(0, 10);
}

export function formatarHora(ms: Millis, offsetMin = OFFSET_BRASILIA_MIN): HHMM {
  const d = new Date(ms + offsetMin * MIN);
  return minParaHHMM(d.getUTCHours() * 60 + d.getUTCMinutes());
}

export function formatarPreco(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

// ---------- Sprint 3: expediente, folgas e calendário ----------

export const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

type DiaExpediente = NonNullable<Expediente[number]>;

/** Recorta um intervalo de minutos pelas pausas e devolve os trechos que sobram. */
function trechosLivres(dia: DiaExpediente): [number, number][] {
  let trechos: [number, number][] = [[hhmmParaMin(dia.abre), hhmmParaMin(dia.fecha)]];
  for (const p of dia.pausas ?? []) {
    const pi = hhmmParaMin(p.inicio), pf = hhmmParaMin(p.fim);
    trechos = trechos.flatMap(([a, b]) => {
      if (pf <= a || pi >= b) return [[a, b] as [number, number]];
      const r: [number, number][] = [];
      if (pi > a) r.push([a, pi]);
      if (pf < b) r.push([pf, b]);
      return r;
    });
  }
  return trechos;
}

/** Converte trechos de trabalho de volta em abre/fecha + pausas (os buracos entre trechos). */
function deTrechos(trechos: [number, number][]): DiaExpediente | undefined {
  const t = trechos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  if (!t.length) return undefined;
  const pausas = t.slice(1).map(([a], i) => ({ inicio: minParaHHMM(t[i][1]), fim: minParaHHMM(a) }));
  return { abre: minParaHHMM(t[0][0]), fecha: minParaHHMM(t[t.length - 1][1]), ...(pausas.length ? { pausas } : {}) };
}

/**
 * Expediente que vale para o barbeiro: o dele, recortado pelo horário da casa.
 * Dia fechado na casa ou no barbeiro = fechado; as pausas de ambos valem.
 */
export function expedienteEfetivo(casa: Expediente, barbeiro: Expediente): Expediente {
  const r: Expediente = {};
  for (let d = 0; d < 7; d++) {
    const c = casa[d], b = barbeiro[d];
    if (!c || !b) continue;
    const tc = trechosLivres(c), tb = trechosLivres(b);
    const inter: [number, number][] = [];
    for (const [a1, b1] of tc) for (const [a2, b2] of tb) {
      const ini = Math.max(a1, a2), fim = Math.min(b1, b2);
      if (fim > ini) inter.push([ini, fim]);
    }
    const dia = deTrechos(inter);
    if (dia) r[d] = dia;
  }
  return r;
}

/** Mensagem de erro do expediente digitado, ou null se estiver válido. */
export function validarExpediente(e: Expediente): string | null {
  for (let d = 0; d < 7; d++) {
    const dia = e[d];
    if (!dia) continue;
    let abre: number, fecha: number;
    try { abre = hhmmParaMin(dia.abre); fecha = hhmmParaMin(dia.fecha); } catch { return `${NOMES_DIAS[d]}: hora inválida.`; }
    if (fecha <= abre) return `${NOMES_DIAS[d]}: o fechamento precisa ser depois da abertura.`;
    if (fecha > 24 * 60) return `${NOMES_DIAS[d]}: fechamento até 24:00.`;
    for (const p of dia.pausas ?? []) {
      let pi: number, pf: number;
      try { pi = hhmmParaMin(p.inicio); pf = hhmmParaMin(p.fim); } catch { return `${NOMES_DIAS[d]}: pausa com hora inválida.`; }
      if (pf <= pi || pi < abre || pf > fecha) return `${NOMES_DIAS[d]}: a pausa precisa ficar dentro do expediente.`;
    }
  }
  return null;
}

/** Soma dias a uma data local (YYYY-MM-DD). */
export function somarDias(data: ISODate, n: number): ISODate {
  const [y, mo, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** Próximos `n` dias a partir de hoje (fuso da barbearia). */
export function proximosDias(agora: Millis, n: number, offsetMin = OFFSET_BRASILIA_MIN): ISODate[] {
  const hoje = dataLocal(agora, offsetMin);
  return Array.from({ length: n }, (_, i) => somarDias(hoje, i));
}

/** Folga de dias inteiros (de `de` até `ate`, inclusive) como intervalo. */
export function intervaloFolga(de: ISODate, ate: ISODate, offsetMin = OFFSET_BRASILIA_MIN): Intervalo {
  return { inicio: paraMillis(de, 0, offsetMin), fim: paraMillis(somarDias(ate, 1), 0, offsetMin) };
}

/** Rótulo curto do dia para os chips: "Hoje", "Amanhã" ou "Sex 06/11". */
export function rotuloDia(data: ISODate, hoje: ISODate): string {
  if (data === hoje) return 'Hoje';
  if (data === somarDias(hoje, 1)) return 'Amanhã';
  const [, mo, d] = data.split('-');
  return `${NOMES_DIAS[diaDaSemana(data)].slice(0, 3)} ${d}/${mo}`;
}

/** Hora digitada ("9", "930", "09:30") normalizada para HH:MM, ou null. */
export function normalizarHora(texto: string): HHMM | null {
  const dig = texto.replace(/\D/g, '');
  if (!dig || dig.length > 4) return null;
  const hh = dig.length <= 2 ? Number(dig) : Number(dig.slice(0, dig.length - 2));
  const mm = dig.length <= 2 ? 0 : Number(dig.slice(-2));
  if (hh > 24 || mm > 59 || (hh === 24 && mm > 0)) return null;
  return minParaHHMM(hh * 60 + mm);
}

/** O cliente ainda cancela sem custo? (política da casa, em horas antes do início). */
export function cancelamentoGratis(inicio: Millis, agora: Millis, horas: number): boolean {
  return inicio - agora >= horas * 3_600_000;
}

/** Data digitada "06/11" ou "06/11/2026" → YYYY-MM-DD; sem ano, a próxima ocorrência a partir de hoje. */
export function normalizarData(texto: string, hoje: ISODate): ISODate | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(hoje.slice(0, 4));
  const montar = (ano: number) => {
    const dt = new Date(Date.UTC(ano, mo - 1, d));
    return dt.getUTCDate() === d && dt.getUTCMonth() === mo - 1 ? dt.toISOString().slice(0, 10) : null;
  };
  let r = montar(y);
  if (r && !m[3] && r < hoje) r = montar(++y);
  return r;
}

/** "Sex 06/11" sem o "Hoje/Amanhã", para listas. */
export function formatarData(data: ISODate): string {
  const [, mo, d] = data.split('-');
  return `${NOMES_DIAS[diaDaSemana(data)].slice(0, 3)} ${d}/${mo}`;
}
