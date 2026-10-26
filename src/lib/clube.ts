// Clube de assinatura: datas do ciclo. Lógica pura (testada em clube.test.ts); as regras do Firestore
// aceitam vencimento de 28 a 31 dias depois do início do ciclo, que é o que estas funções produzem.
import { dataLocal, formatarData, paraMillis } from './agenda';
import type { Agendamento, MembroClube, Millis, PlanoClube } from '../types/models';

const DIA = 86_400_000;

/** Mesmo dia e hora no mês seguinte (Brasília). Dia 31 em mês curto vira o último dia dele. */
export function somarMes(ms: Millis): Millis {
  const [a, m, d] = dataLocal(ms).split('-').map(Number);
  const minutos = Math.round((ms - paraMillis(dataLocal(ms), 0)) / 60_000);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(d, ultimo);
  return paraMillis(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, minutos);
}

/**
 * "Recebi o pagamento": novo ciclo. Em dia (ou no dia de tolerância), conta do vencimento antigo e ninguém perde dias;
 * já vencido, conta de hoje.
 */
export function novoCiclo(venceEm: Millis | undefined, agora: Millis): { cicloInicio: Millis; venceEm: Millis } {
  const inicio = venceEm !== undefined && agora <= venceEm + DIA ? venceEm : agora;
  return { cicloInicio: inicio, venceEm: somarMes(inicio) };
}

/** Membro como a casa vê na lista. Até o Worker marcar "vencido" (1 dia depois), ativo com prazo passado já aparece vencido. */
export type Situacao = 'pedido' | 'vencido' | 'vence_logo' | 'em_dia';

export function situacao(m: Pick<MembroClube, 'status' | 'venceEm'>, agora: Millis): Situacao | null {
  if (m.status === 'solicitado') return 'pedido';
  if (m.status === 'vencido') return 'vencido';
  if (m.status !== 'ativo' || m.venceEm === undefined) return null;
  if (m.venceEm < agora) return 'vencido';
  return m.venceEm - agora <= 7 * DIA ? 'vence_logo' : 'em_dia';
}

/** Separa os membros nas listas da tela da casa, cada uma pela data que importa. */
export function separarMembros<T extends Pick<MembroClube, 'status' | 'venceEm' | 'criadoEm'>>(membros: T[], agora: Millis) {
  const grupos: Record<Situacao, T[]> = { pedido: [], vencido: [], vence_logo: [], em_dia: [] };
  for (const m of membros) {
    const s = situacao(m, agora);
    if (s) grupos[s].push(m);
  }
  grupos.pedido.sort((a, b) => a.criadoEm - b.criadoEm);
  for (const k of ['vencido', 'vence_logo', 'em_dia'] as const) grupos[k].sort((a, b) => (a.venceEm ?? 0) - (b.venceEm ?? 0));
  return grupos;
}

// ---------- Avisos do clube (o cron do Worker decide e manda; textos testados aqui) ----------

export type AvisoClube = 'pedido' | 'd3' | 'd0' | 'vencido';
type MembroParaAviso = Pick<MembroClube, 'status' | 'venceEm' | 'lembretes' | 'atualizadoEm'> & { lembretes?: Partial<Record<AvisoClube, Millis>> };

/** Lembrete ao cliente só de dia (9h às 20h59 em Brasília): o cron roda de hora em hora e ninguém recebe às 3 da manhã. */
const deDia = (agora: Millis) => { const h = new Date(agora - 3 * 3_600_000).getUTCHours(); return h >= 9 && h <= 20; };

/**
 * O que avisar sobre este membro agora (no máximo um por vez; o Worker marca em `lembretes` o que já foi).
 * Pedido: avisa a casa uma vez por pedido (pedir de novo depois de sair avisa de novo).
 * Vencido: 1 dia depois do vencimento sem pagamento (decisão do dono); a casa ainda pode marcar o pagamento.
 */
export function avisoDevido(m: MembroParaAviso, agora: Millis): AvisoClube | null {
  const l = m.lembretes ?? {};
  if (m.status === 'solicitado') return (l.pedido ?? 0) >= m.atualizadoEm ? null : 'pedido';
  if (m.status !== 'ativo' || m.venceEm === undefined) return null;
  if (agora > m.venceEm + DIA) return 'vencido';
  if (!deDia(agora)) return null;
  if (!l.d0 && dataLocal(agora) === dataLocal(m.venceEm)) return 'd0';
  if (!l.d3 && !l.d0 && m.venceEm > agora && m.venceEm - agora <= 3 * DIA) return 'd3';
  return null;
}

/** Título e texto do aviso (sino e push). A casa recebe pedido e vencido; o cliente, lembretes e vencido. */
export function textoAvisoClube(
  tipo: AvisoClube, m: Pick<MembroClube, 'planoNome' | 'barbeariaNome' | 'clienteNome' | 'venceEm'>, para: 'cliente' | 'casa', agora: Millis,
) {
  const vence = m.venceEm !== undefined ? formatarData(dataLocal(m.venceEm), dataLocal(agora)) : '';
  if (tipo === 'pedido') return { titulo: 'Pedido no clube', corpo: `${m.clienteNome} quer assinar o ${m.planoNome}. Aceite quando receber o 1º pagamento.` };
  if (tipo === 'd3') return { titulo: 'Seu clube vence em breve', corpo: `${m.planoNome} na ${m.barbeariaNome} vence ${vence}. Pague na barbearia para continuar.` };
  if (tipo === 'd0') return { titulo: 'Seu clube vence hoje', corpo: `${m.planoNome} na ${m.barbeariaNome}: pague hoje na barbearia. Depois de amanhã o horário fixo fica livre para outros.` };
  return para === 'cliente'
    ? { titulo: 'Seu clube venceu', corpo: `${m.planoNome} na ${m.barbeariaNome} venceu ${vence}. O horário fixo foi liberado; pague na barbearia para voltar.` }
    : { titulo: 'Assinatura vencida', corpo: `${m.clienteNome} não renovou o ${m.planoNome} (venceu ${vence}). Se ele pagar, toque em "Recebi o pagamento".` };
}

// ---------- Usar o clube ao agendar (a reserva é do Worker: POST /clube/agendar) ----------

/** Fim do ciclo pago para reservar: vencimento + 1 dia de tolerância (decisão do dono). */
export const fimDoCiclo = (m: Pick<MembroClube, 'venceEm'>) => (m.venceEm ?? 0) + DIA;

/**
 * Usos do ciclo: horários do clube que caem nele e não foram cancelados (falta conta como uso; cancelar devolve).
 */
export function usosNoCiclo(ags: Pick<Agendamento, 'inicio' | 'status'>[], m: Pick<MembroClube, 'cicloInicio' | 'venceEm'>): number {
  const de = m.cicloInicio ?? 0, ate = fimDoCiclo(m);
  return ags.filter(a => a.status !== 'cancelado' && a.inicio >= de && a.inicio < ate).length;
}

/** Pode marcar este horário pelo clube? null = pode; senão, o motivo (mostrado ao cliente). */
export function motivoSemClube(
  m: Pick<MembroClube, 'status' | 'venceEm' | 'cicloInicio' | 'cortesPorMes'> | null | undefined,
  plano: Pick<PlanoClube, 'servicoIds'> | null | undefined, servicoId: string, inicio: Millis, usos: number,
): string | null {
  if (!m || m.status !== 'ativo' || m.venceEm === undefined) return 'Você não tem clube ativo nesta barbearia.';
  if (!plano) return 'O plano do seu clube não existe mais. Fale com a barbearia.';
  if (!plano.servicoIds.includes(servicoId)) return 'Este corte não faz parte do seu plano.';
  if (inicio >= fimDoCiclo(m)) return 'Este dia passa do vencimento do clube. Pague na barbearia para usar no mês seguinte.';
  if (m.cortesPorMes && usos >= m.cortesPorMes) return `Você já usou os ${m.cortesPorMes} do clube neste mês.`;
  return null;
}
