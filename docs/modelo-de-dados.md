# Modelo de dados — Navalha (Firestore)

Fechado na Fase 0. Já inclui as coleções das Fases 3 a 5, vazias no MVP, para nenhuma fase exigir migração.
Tipos completos em `src/types/models.ts`; permissões em `firestore.rules`.

| Coleção | Quem grava | Fase | Para quê |
| --- | --- | --- | --- |
| `users/{uid}` | o próprio usuário | 1 | Nome, apelido, foto, papéis (cliente/barbeiro/dono), modo ativo, favoritos, token de push |
| `barbearias/{id}` | dono | 1 | Perfil, endereço + geohash, expediente, política, **resumo** (nota, preço, próximo horário), Place ID do Google, pagamento, assinatura |
| `barbearias/{id}/barbeiros/{uid}` | dono ou o barbeiro (via convite) | 1 | Barbeiros da casa, expediente próprio, nota |
| `convites/{código}` | dono | 1 | Código de 6 letras (sem 0/O/1/I), válido 7 dias, uso único; aponta para a barbearia |
| `barbearias/{id}/servicos/{id}` | barbeiro (o próprio) ou dono | 1 | Cardápio: nome, preço em centavos, duração, até 6 fotos |
| `barbearias/{id}/bloqueios/{id}` | barbeiro ou dono | 1 | Folgas, férias, pausas pontuais |
| `agendamentos/{id}` | cliente (app) ou casa (balcão) | 1 | Status: reservado, confirmado, pago, concluído, faltou, cancelado. O barbeiro lê e mexe só nos próprios; o dono, em todos da casa |

> `cancelamento: { por: 'cliente' | 'casa', motivo, em }` — gravado junto com o status `cancelado`; a regra só aceita o motivo assinado por quem cancela (até 200 caracteres). O outro lado vê o motivo na agenda ou no histórico.
| `ocupacao/{barbeiro_data_HHMM}` | junto com o agendamento | 1 | **Trava contra horário duplo** (abaixo) |
| `eventos/{id}` | app | 1 | Métricas do piloto: agendou, cancelou, faltou, tempo até agendar |
| `notificacoes/{id}` | Worker | 1 | Sino na Agenda (casa) e em Agendamentos (cliente): marcado e cancelado avisam os outros lados (cliente, barbeiro, dono), nunca quem fez (id `agendamento_tipo_uid`, nunca duplica) e resumo do mês no dia 1 (`resumo_AAAA-MM_casa`). O destinatário só lê e marca como lida |
| `pagamentos/{id}` | Worker (webhook Asaas) | 3 | Pix, cartão, split, assinatura |
| `avaliacoes/{id}` | cliente/barbeiro cria oculta; Worker revela | 3 | Avaliação mútua dupla-cega |
| `clubes/{id}`, `assinaturasClube/{id}` | dono / Worker | 4 | Clube de assinatura do cliente |

## Trava contra horário duplo

Cada atendimento ocupa blocos de `passoMin` (padrão 15 min) numa grade ancorada à meia-noite.
Um corte de 45 min às 09:00 cria `lucas_2026-11-05_0900`, `…_0915` e `…_0930`.
O agendamento e esses documentos são gravados **na mesma transação**: se algum bloco já existe, nada é gravado e o segundo cliente vê "Esse horário acabou de ser ocupado".
Dois atendimentos sobrepostos do mesmo barbeiro sempre compartilham ao menos um bloco — isso é verificado em `src/lib/agenda.test.ts`.
As regras exigem que o agendamento e os blocos nasçam juntos (`getAfter`), que as chaves sejam do próprio barbeiro do agendamento, e só liberam os blocos quando o agendamento vira `cancelado`.
O encaixe de balcão usa a mesma trava (`origem: 'balcao'`, `clienteUid: null`, já `confirmado`).

## Horários livres (Sprint 3)

Expediente do barbeiro ∩ expediente da casa (`expedienteEfetivo`), menos os blocos de `ocupacao` do dia e as folgas em `bloqueios` que tocam o dia.
O agendamento guarda `barbeariaNome` e `barbeiroNome` para a lista do cliente não gastar leituras extras.

## Economia de leituras (cota grátis: 50 mil/dia)

- A lista "Perto de você" lê só `barbearias` com o campo `resumo` desnormalizado: 1 leitura por card.
- A agenda escuta só o dia aberto na tela (`ocupacao` filtrada por barbeiro e dia).
- Cache de 5 min das leituras públicas (`src/services/cache.ts`, padrão do controle de O.S. do MyHub): lista perto
  (chave por ~1 km, compartilhada por Início e Explorar), página da casa + agendar (`dadosDaCasa`) e painel do dono.
  Gravação do próprio aparelho limpa a chave; "Tentar de novo" ignora o cache. Tempo real só onde precisa ser exato:
  horários livres, agenda do dia, perfil.
- Perfil: 1 leitura por abertura (a escuta já traz o documento). Lista do cliente: 20 mais recentes.
- Worker (lembretes): perfis em 1 `batchGet` e marcações em 1 `commit` por janela (limite de 50 chamadas por execução no plano grátis).

## Fotos

Ficam no Cloudflare R2 (`tipo/refId/uid-uuid.webp`), enviadas pelo Worker após conferir o token do Firebase. O Firestore guarda só a URL.
