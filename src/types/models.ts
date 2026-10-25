// Modelo de dados completo do Navalha (Firestore).
// Já inclui as coleções das Fases 3 a 5 (pagamentos, avaliações, assinaturas),
// para que nenhuma fase futura exija migração. Ver docs/modelo-de-dados.md.
import type { PlanoId } from '../lib/planos';

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
  /** A avaliação que o cliente deu a cada barbearia (só o Worker grava): o app mostra "Editar" e não pede de novo. */
  avaliouBarbearias?: Record<string, { estrelas: number; em: Millis }>;
  provedores: ('google' | 'apple')[];
  /** Quando a pessoa informou ter 18 anos ou mais (a data de nascimento não é guardada). Sem isto, o app pede antes de liberar. */
  maiorDeIdadeEm?: Millis;
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
  /** O app pede ao cliente para avaliar quando o barbeiro finaliza o corte (o dono liga em Configurações). */
  pedirAvaliacao?: boolean;
  /** Resumo desnormalizado: a lista "Perto de você" custa 1 leitura por card. */
  resumo: {
    /** Média simples das avaliações do app (0,0 a 5,0) e quantas são; a soma evita arredondar a cada edição. */
    notaApp: number;
    totalAvaliacoesApp: number;
    somaEstrelasApp?: number;
    /** Só para ordenar "Mais bem avaliadas" (pesa a quantidade). */
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
  /** Quem cancelou e por quê: a barbearia vê o motivo do cliente e o cliente vê o da barbearia. */
  cancelamento?: { por: 'cliente' | 'casa'; motivo: string; em: Millis };
  /** WhatsApp do cliente no momento da reserva (do perfil dele): o barbeiro do horário pode mandar um lembrete. */
  clienteTelefone?: string;
  /** Seguir cortes: quando o barbeiro iniciou o corte (o app abre a tela do corte atual). */
  iniciadoEm?: Millis;
  /** A casa pede avaliação e o barbeiro finalizou: o cliente vê o pedido em destaque (só o Worker grava). */
  pedidoAvaliacao?: boolean;
  criadoEm: Millis;
  atualizadoEm: Millis;
}

/** pagamentos/{pagamentoId} — Fase 3 (Asaas) */
export interface Pagamento {
  id: string;
  agendamentoId?: string;
  barbeariaId: string;
  clienteUid?: string;
  tipo: 'corte' | 'sinal' | 'assinatura_barbearia';
  metodo: 'pix' | 'cartao' | 'boleto' | 'balcao';
  valorCentavos: number;
  status: 'pendente' | 'pago' | 'estornado' | 'falhou';
  asaasId?: string;
  split?: { recebedor: string; valorCentavos: number }[];
  criadoEm: Millis;
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
