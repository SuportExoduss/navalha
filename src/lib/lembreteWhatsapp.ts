// "Lembrar no WhatsApp": o barbeiro do horário manda ao cliente uma mensagem pronta, do próprio WhatsApp dele
// (sem API paga: abre o wa.me com o texto). Saudação pela hora de Brasília, dia e horário do corte e o link.
import { OFFSET_BRASILIA_MIN, dataLocal, formatarHora, rotuloDia } from './agenda';
import type { Millis } from '../types/models';

/** Abre "Agendamentos" na web; com o app instalado (App Links), abre o app direto. */
export const LINK_AGENDAMENTOS = 'https://navalha.web.app/agendamentos';

/** Bom dia (5h–11h), boa tarde (12h–17h), boa noite (18h–4h), na hora de Brasília. */
export function saudacao(agora: Millis) {
  const hora = new Date(agora + OFFSET_BRASILIA_MIN * 60_000).getUTCHours();
  return hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "Boa tarde, Ana! Não esqueça do seu corte com a nossa equipe hoje às 15:00. Acompanhe no Navalha: <link>" */
export function mensagemLembreteCliente(a: { clienteNome: string; inicio: Millis }, agora: Millis, link = LINK_AGENDAMENTOS) {
  const dia = dataLocal(a.inicio), hoje = dataLocal(agora);
  const rotulo = rotuloDia(dia, hoje);
  // "Hoje"/"Amanhã" entram como estão; outro dia vira "no dia 24/10".
  const quando = rotulo === 'Hoje' || rotulo === 'Amanhã' ? rotulo.toLowerCase() : `no dia ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const nome = a.clienteNome.trim().split(' ')[0];
  return `${saudacao(agora)}, ${nome}! Não esqueça do seu corte com a nossa equipe ${quando} às ${formatarHora(a.inicio)}. Acompanhe no Navalha: ${link}`;
}

/** Link do WhatsApp com o número no formato internacional (55 + DDD + número) e o texto pronto. */
export function linkWhatsapp(telefone: string, texto: string) {
  const d = telefone.replace(/\D/g, '');
  const numero = d.length >= 12 && d.startsWith('55') ? d : `55${d}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
