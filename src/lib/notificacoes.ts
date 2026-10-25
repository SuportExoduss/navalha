// Notificações (cliente, barbeiro e dono): textos e resumo do mês. Lógica pura, usada pelo Worker (que grava
// e manda o push) e testada aqui. Fuso fixo de Brasília (UTC−3).
import { formatarHora, formatarPreco, rotuloDia, dataLocal } from './agenda';
import type { Agendamento, Millis } from '../types/models';

export type TipoNotificacao = 'agendado' | 'cancelado' | 'resumo_mes' | 'avaliar' | 'plano';

/** notificacoes/{id}: gravada só pelo Worker; o destinatário só lê e marca como lida. */
export interface Notificacao {
  id: string;
  paraUid: string;
  barbeariaId: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  agendamentoId?: string;
  /** Do agendamento (avisos de 22/out em diante): o painel mostra "Lembrar no WhatsApp" ao barbeiro do horário. */
  barbeiroId?: string;
  inicio?: Millis;
  em: Millis;
  lida: boolean;
}

type AgParaAviso = Pick<Agendamento, 'clienteNome' | 'servicoNome' | 'barbeiroNome' | 'inicio' | 'cancelamento'>
  & Partial<Pick<Agendamento, 'barbeariaNome' | 'origem'>>;
export type Destinatario = 'cliente' | 'barbeiro' | 'dono';

/** Texto do aviso de marcado/cancelado. O dono vê de qual barbeiro é; o cliente vê qual barbearia. */
export function textoAviso(tipo: 'agendado' | 'cancelado', a: AgParaAviso, agora: Millis, para: Destinatario) {
  const quando = `${rotuloDia(dataLocal(a.inicio), dataLocal(agora)).toLowerCase()} às ${formatarHora(a.inicio)}`;
  const motivo = a.cancelamento?.motivo ? ` Motivo: ${a.cancelamento.motivo}.` : '';
  if (para === 'cliente') {
    const casa = a.barbeariaNome ?? 'A barbearia';
    return tipo === 'agendado'
      ? { titulo: 'Horário marcado', corpo: `${a.servicoNome} na ${casa}, ${quando}.` }
      : { titulo: 'Seu horário foi cancelado', corpo: `${casa} cancelou ${a.servicoNome} de ${quando}.${motivo}` };
  }
  const com = para === 'dono' && a.barbeiroNome ? ` com ${a.barbeiroNome}` : '';
  if (tipo === 'agendado') {
    return { titulo: a.origem === 'balcao' ? 'Encaixe marcado' : 'Novo horário marcado', corpo: `${a.clienteNome}: ${a.servicoNome}${com}, ${quando}.` };
  }
  if (a.cancelamento?.por === 'casa') {
    return { titulo: 'Horário cancelado', corpo: `A casa cancelou ${a.servicoNome} de ${a.clienteNome}${com}, ${quando}.${motivo}` };
  }
  return { titulo: 'Horário cancelado', corpo: `${a.clienteNome} cancelou ${a.servicoNome}${com} de ${quando}.${motivo}` };
}

/** Pedido de avaliação ao cliente quando o barbeiro finaliza (só se a casa ligou "pedir avaliação"). */
export function textoPedidoAvaliacao(a: Pick<Agendamento, 'barbeiroNome'> & Partial<Pick<Agendamento, 'barbeariaNome'>>) {
  const frase = ['Avalie seu atendimento', a.barbeiroNome && `com ${a.barbeiroNome}`, a.barbeariaNome && `na ${a.barbeariaNome}`].filter(Boolean).join(' ');
  return { titulo: 'Como foi o corte?', corpo: `${frase}. Leva 10 segundos.` };
}

/** Id fixo: o mesmo aviso nunca é gravado (nem enviado) duas vezes, mesmo se o app chamar de novo. */
export const idAviso = (agendamentoId: string, tipo: TipoNotificacao, paraUid: string) => `${agendamentoId}_${tipo}_${paraUid}`;

/** Quando chegou, curto: "14:30" (hoje), "ontem 14:30" ou "03/11 14:30". */
export function quandoChegou(em: Millis, agora: Millis): string {
  const dia = dataLocal(em), hoje = dataLocal(agora);
  if (dia === hoje) return formatarHora(em);
  if (rotuloDia(dia, hoje) === 'Amanhã') return formatarHora(em); // relógio adiantado: trata como hoje
  const ontem = dataLocal(agora - 86_400_000);
  if (dia === ontem) return `ontem ${formatarHora(em)}`;
  const [, mm, dd] = dia.split('-');
  return `${dd}/${mm} ${formatarHora(em)}`;
}

// ---------- Resumo do mês (dia 1) ----------

const H = 3_600_000;
const brasilia = (agora: Millis) => new Date(agora - 3 * H);

/** Dia 1 no horário de Brasília: o cron do Worker manda o resumo do mês anterior. */
export const ehDiaDoResumo = (agora: Millis) => brasilia(agora).getUTCDate() === 1;

/** Mês anterior ao de `agora` (Brasília) como 'YYYY-MM', e o primeiro e o último dia em ISODate. */
export function mesAnterior(agora: Millis) {
  const d = brasilia(agora);
  const ano = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const mes = d.getUTCMonth() === 0 ? 12 : d.getUTCMonth(); // 1–12
  const mm = String(mes).padStart(2, '0');
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { chave: `${ano}-${mm}`, de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface ResumoMes {
  agendamentos: number; concluidos: number; faltas: number; cancelados: number;
  faturadoCentavos: number; pelaApp: number; maisPedido: { nome: string; vezes: number } | null;
  porBarbeiro: { nome: string; concluidos: number; faturadoCentavos: number }[];
}

export function calcularResumoMes(ags: Pick<Agendamento, 'status' | 'precoCentavos' | 'servicoNome' | 'origem' | 'barbeiroNome'>[]): ResumoMes {
  const validos = ags.filter(a => a.status !== 'cancelado');
  const concluidos = ags.filter(a => a.status === 'concluido');
  const contagem = new Map<string, number>();
  for (const a of validos) contagem.set(a.servicoNome, (contagem.get(a.servicoNome) ?? 0) + 1);
  const [top] = [...contagem.entries()].sort((x, y) => y[1] - x[1]);
  const porBarbeiro = new Map<string, { nome: string; concluidos: number; faturadoCentavos: number }>();
  for (const a of concluidos) {
    const nome = a.barbeiroNome || 'Barbeiro';
    const b = porBarbeiro.get(nome) ?? { nome, concluidos: 0, faturadoCentavos: 0 };
    b.concluidos++; b.faturadoCentavos += a.precoCentavos;
    porBarbeiro.set(nome, b);
  }
  return {
    agendamentos: validos.length,
    concluidos: concluidos.length,
    faltas: ags.filter(a => a.status === 'faltou').length,
    cancelados: ags.filter(a => a.status === 'cancelado').length,
    faturadoCentavos: concluidos.reduce((s, a) => s + a.precoCentavos, 0),
    pelaApp: validos.filter(a => a.origem === 'app').length,
    maisPedido: top ? { nome: top[0], vezes: top[1] } : null,
    porBarbeiro: [...porBarbeiro.values()].sort((x, y) => y.faturadoCentavos - x.faturadoCentavos),
  };
}

/** Texto do resumo (push mostra o começo; o painel de notificações mostra tudo). */
export function textoResumoMes(chaveMes: string, r: ResumoMes) {
  const [ano, mm] = chaveMes.split('-');
  const nomeMes = `${MESES[Number(mm) - 1]} de ${ano}`;
  if (!r.agendamentos && !r.cancelados) {
    return { titulo: `Resumo de ${nomeMes}`, corpo: `Nenhum agendamento em ${nomeMes}.` };
  }
  const linhas = [
    `Faturado: ${formatarPreco(r.faturadoCentavos)} em ${r.concluidos} ${r.concluidos === 1 ? 'atendimento' : 'atendimentos'}.`,
    `${r.agendamentos} ${r.agendamentos === 1 ? 'agendamento' : 'agendamentos'} (${r.pelaApp} pelo app), ${r.faltas} ${r.faltas === 1 ? 'falta' : 'faltas'} e ${r.cancelados} ${r.cancelados === 1 ? 'cancelamento' : 'cancelamentos'}.`,
    ...(r.maisPedido ? [`Mais pedido: ${r.maisPedido.nome} (${r.maisPedido.vezes}×).`] : []),
    ...r.porBarbeiro.map(b => `${b.nome}: ${b.concluidos} ${b.concluidos === 1 ? 'atendimento' : 'atendimentos'}, ${formatarPreco(b.faturadoCentavos)}.`),
  ];
  return { titulo: `Resumo de ${nomeMes}`, corpo: linhas.join('\n') };
}
