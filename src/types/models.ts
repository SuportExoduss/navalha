// Modelo de dados completo do Navalha (Firestore).
// Já inclui as coleções das Fases 3 a 5 (pagamentos, avaliações, assinaturas),
// para que nenhuma fase futura exija migração. Ver docs/modelo-de-dados.md.
import type { PlanoId } from '../lib/planos';
import type { AlvoAvaliacao } from '../lib/avaliacoes';

export type Role = 'cliente' | 'barbeiro' | 'dono';

/** Hora no formato "HH:MM", sempre no fuso da barbearia. */
export type HHMM = string;
/** Data no formato "YYYY-MM-DD". */
export type ISODate = string;
/** Firestore Timestamp serializado em milissegundos (simplifica testes). */
export type Millis = number;

/** users/{uid} */
export interface UserProfile {
  uid: string;
  nome: string;
  apelido?: string;
  email: string;
  fotoUrl?: string;
  /** Capa do perfil (faixa no topo, atrás da foto e do nome). */
  bannerUrl?: string;
  telefone?: string;
  /** Papéis que a conta já ativou; troca de modo sem trocar de conta. */
  papeis: Role[];
  papelAtivo: Role;
  /** Barbearias onde a pessoa é dono ou barbeiro. */
  barbearias: string[];
  favoritos: { barbearias: string[]; barbeiros: string[] };
  privacidade: { fotosNoPortfolio: boolean };
  /** Token do FCM (Firebase Cloud Messaging) para lembretes. */
  pushToken?: string;
  /** Média das avaliações recebidas como cliente (Fase 3). */
  notaCliente?: { media: number; total: number; faltas90d: number };
  provedores: ('google' | 'apple')[];
  criadoEm: Millis;
}

export type Comodidade =
  | 'estacionamento' | 'ar' | 'wifi' | 'bebidas' | 'acessivel' | 'pix';

export interface Expediente {
  /** 0 = domingo … 6 = sábado. Dia ausente = fechado. */
  [diaSemana: number]: { abre: HHMM; fecha: HHMM; pausas?: { inicio: HHMM; fim: HHMM }[] } | undefined;
}

/** rascunho = sem teste nem plano; teste = 60 dias grátis; vencida = teste ou plano acabou. */
export type StatusAssinatura = 'rascunho' | 'teste' | 'ativa' | 'inadimplente' | 'cancelada' | 'vencida';

/** Assinatura da casa. Só o Worker grava (depois de conferir a compra no Google Play); o dono só lê. */
export interface AssinaturaCasa {
  status: StatusAssinatura;
  plano?: PlanoId;
  /** Fim do teste ou do mês pago. */
  venceEm?: Millis;
  /** Barbeiros ativos permitidos (dono incluso). */
  limiteBarbeiros: number;
  fundador?: boolean;
}

/** barbearias/{barbeariaId} */
export interface Barbearia {
  id: string;
  donoUid: string;
  nome: string;
  logoUrl?: string;
  capaUrl?: string;
  fotos: string[];
  endereco: string;
  cidade: string;
  geo: { lat: number; lng: number; geohash: string };
  telefone?: string;
  instagram?: string;
  expediente: Expediente;
  comodidades: Comodidade[];
  politica: { cancelamentoGratisHoras: number; toleranciaMin: number };
  passoMin: 10 | 15 | 20 | 30;
  antecedenciaMin: number;
  janelaDias: number;
  /** Place ID do Google: o Worker busca a nota do Google 1 vez por dia. */
  googlePlaceId?: string;
  /** O app pede ao cliente para avaliar quando o barbeiro finaliza o corte (o dono liga em Configurações). */
  pedirAvaliacao?: boolean;
  /** Última consulta da nota do Google (só o Worker grava). */
  googleAtualizadoEm?: Millis;
  /** Resumo desnormalizado: a lista "Perto de você" custa 1 leitura por card. */
  resumo: {
    notaApp: number;
    totalAvaliacoesApp: number;
    notaGoogle?: number;
    totalAvaliacoesGoogle?: number;
    notaRanking?: number;
    precoMin?: number;
    precoMax?: number;
    /** Categorias do cardápio ativo, para o filtro da busca. */
    categorias?: Servico['categoria'][];
    proximoHorario?: { barbeiroId: string; inicio: Millis };
    fotosDestaque: string[];
  };
  pagamento: { pagarNoApp: boolean; sinalPercent: number; subcontaAsaasId?: string };
  assinatura: AssinaturaCasa;
  /** Teste ou mensalidade em dia: só assim a casa aparece na busca. Gravado só pelo servidor. */
  emDia: boolean;
  /** Contador de barbeiros ativos (as regras usam para barrar além do limite do plano). */
  barbeirosAtivos: number;
  /** Último barbeiro adicionado, ligado ou desligado: as regras conferem o contador por ele. */
  mudouBarbeiro?: string;
  /** Só barbearias publicadas aparecem na busca. */
  publicada: boolean;
  criadoEm: Millis;
}

/** barbearias/{id}/barbeiros/{uid} */
export interface Barbeiro {
  uid: string;
  barbeariaId: string;
  nome: string;
  apelido?: string;
  fotoUrl?: string;
  /** Capa do barbeiro: aparece ao fundo na escolha do barbeiro. */
  bannerUrl?: string;
  especialidades: string[];
  /** Expediente próprio dentro do horário da casa. */
  expediente: Expediente;
  ativo: boolean;
  nota: { media: number; total: number };
  // Comissão não fica aqui: este documento é público (leitura aberta). Na Fase 4 vai para um doc só do dono.
}

/** barbearias/{id}/convites/{codigo} */
export interface Convite {
  codigo: string;
  barbeariaId: string;
  criadoPor: string;
  email?: string;
  usadoPor?: string;
  expiraEm: Millis;
}

/** barbearias/{id}/servicos/{servicoId} — cardápio por barbeiro */
export interface Servico {
  id: string;
  barbeariaId: string;
  barbeiroId: string;
  nome: string;
  categoria: 'cabelo' | 'barba' | 'combo' | 'outro';
  precoCentavos: number;
  duracaoMin: number;
  fotos: string[];
  ativo: boolean;
  /** Item herdado do catálogo padrão da casa. */
  catalogoId?: string;
}

/** barbearias/{id}/bloqueios/{bloqueioId} — folgas, férias, pausas pontuais */
export interface Bloqueio {
  id: string;
  barbeiroId: string;
  inicio: Millis;
  fim: Millis;
  motivo?: string;
}

export type StatusAgendamento =
  | 'reservado' | 'confirmado' | 'pago' | 'concluido' | 'faltou' | 'cancelado';

/** agendamentos/{agendamentoId} */
export interface Agendamento {
  id: string;
  barbeariaId: string;
  barbeiroId: string;
  /** Nomes copiados na reserva para a lista do cliente não precisar de leituras extras. */
  barbeariaNome?: string;
  barbeiroNome?: string;
  clienteUid: string | null; // null = encaixe manual de balcão
  clienteNome: string;
  servicoId: string;
  servicoNome: string;
  precoCentavos: number;
  duracaoMin: number;
  data: ISODate;
  inicio: Millis;
  fim: Millis;
  /** IDs dos documentos de ocupação (slots) que este agendamento trava. */
  slots: string[];
  status: StatusAgendamento;
  origem: 'app' | 'balcao';
  lembretes: { h24?: Millis; h2?: Millis };
  pagamentoId?: string;
  fotos: string[];
  fotosAprovadas?: boolean;
  /** Quem cancelou e por quê: a barbearia vê o motivo do cliente e o cliente vê o da barbearia. */
  cancelamento?: { por: 'cliente' | 'casa'; motivo: string; em: Millis };
  /** Avaliação do cliente (gravada só pelo Worker): o card mostra as estrelas no lugar do botão Avaliar. */
  avaliacao?: { estrelas: number; em: Millis };
  /** Avaliações deste atendimento por direção (gravadas só pelo Worker). */
  avaliacoes?: Partial<Record<AlvoAvaliacao, { estrelas: number; em: Millis }>>;
  /** A casa pede avaliação e o barbeiro finalizou: o cliente vê o pedido em destaque (só o Worker grava). */
  pedidoAvaliacao?: boolean;
  criadoEm: Millis;
  atualizadoEm: Millis;
}

/**
 * ocupacao/{barbeiroId_YYYY-MM-DD_HHMM}
 * Um documento por bloco de `passoMin` ocupado. Criado em transação:
 * se já existe, a reserva falha — é a trava contra horário duplo.
 */
export interface Ocupacao {
  barbeariaId: string;
  barbeiroId: string;
  agendamentoId: string;
  inicio: Millis;
}

/** pagamentos/{pagamentoId} — Fase 3 (Asaas) */
export interface Pagamento {
  id: string;
  agendamentoId?: string;
  barbeariaId: string;
  clienteUid?: string;
  tipo: 'corte' | 'sinal' | 'assinatura_barbearia' | 'clube_cliente';
  metodo: 'pix' | 'cartao' | 'boleto' | 'balcao';
  valorCentavos: number;
  status: 'pendente' | 'pago' | 'estornado' | 'falhou';
  asaasId?: string;
  split?: { recebedor: string; valorCentavos: number }[];
  criadoEm: Millis;
}

/**
 * avaliacoes/{agendamentoId}_{alvo} — gravada só pelo Worker (POST /avaliacoes). A da barbearia é pública
 * (página da casa); a do barbeiro, só a casa e o cliente veem; a do cliente, o cliente e a casa.
 * (As de antes de 22/out têm id = agendamentoId e direção cliente_para_barbeiro.)
 */
export interface Avaliacao {
  id: string;
  /** Na da barbearia (pública), só o primeiro nome; nas outras, o nome todo. */
  clienteNome?: string;
  /** Foto e capa do cliente no momento da avaliação, para a lista mostrar quem avaliou. */
  clienteFotoUrl?: string;
  clienteBannerUrl?: string;
  barbeiroNome?: string;
  agendamentoId: string;
  barbeariaId: string;
  barbeiroId: string;
  clienteUid: string;
  alvo?: AlvoAvaliacao;
  direcao: 'cliente_para_barbeiro' | 'cliente_para_barbearia' | 'barbeiro_para_cliente';
  /** Dia e horário do corte e o serviço (para listar "Degradê · ter 21/10, 15:00"). */
  inicio?: Millis;
  servicoNome?: string;
  /** Avaliação feita num cancelamento (e não depois do atendimento). */
  origem?: 'atendimento' | 'cancelamento';
  autorUid?: string;
  estrelas: 1 | 2 | 3 | 4 | 5;
  chips: string[];
  comentario?: string;
  /** Revelada quando o outro lado avalia ou após 7 dias. */
  visivel: boolean;
  resposta?: string;
  criadoEm: Millis;
}

/** clubes/{clubeId} e assinaturasClube/{id} — Fase 4 */
export interface PlanoClube {
  id: string;
  barbeariaId: string;
  nome: string;
  valorCentavos: number;
  creditos: { servicoCategoria: Servico['categoria']; quantidade: number | 'ilimitado' }[];
  ativo: boolean;
}

/** eventos/{eventoId} — métricas do piloto desde o dia 1 */
export interface EventoUso {
  tipo: 'abriu_app' | 'viu_barbearia' | 'iniciou_agendamento' | 'agendou' | 'cancelou' | 'faltou' | 'concluiu';
  uid?: string;
  barbeariaId?: string;
  /** Para "tempo até agendar". */
  duracaoMs?: number;
  em: Millis;
}
