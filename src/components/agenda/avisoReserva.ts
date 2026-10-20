// Recado da reserva confirmada para a página da casa: a tela de horário confirma, volta (dismissTo) até a casa
// e a casa mostra o aviso uma vez. Em memória: some ao ler.
let pendente: string | null = null;

export function avisarReserva(texto: string) { pendente = texto; }

export function pegarAvisoReserva(): string | null {
  const t = pendente;
  pendente = null;
  return t;
}
