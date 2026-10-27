# Mapa de dados pessoais — Navalha (LGPD)

Levantado do código em 23/out/2026 e revisado em 25/out/2026 (`src/types/models.ts`, `firestore.rules`, `worker/src/`, telas). Mudou a coleta no
código, atualize aqui, no `ropa.md` e na política (`src/app/privacidade.tsx`).

Titulares: **clientes**, **barbeiros**, **donos** de barbearia. Sem dados sensíveis (art. 11) e sem perfilamento.
Idade mínima: 18 anos. A tela `/idade` pede a data de nascimento no 1º acesso; menor tem conta e dados apagados.
Só fica `users.maiorDeIdadeEm` (quando declarou), nunca a data. As regras barram reserva sem a declaração.

## Onde cada dado fica

| Onde | Dados pessoais | Titular | Quem lê | Quem grava | Guarda | Na exclusão de conta |
|---|---|---|---|---|---|---|
| Firebase Auth | uid, e-mail, nome, foto do Google | todos | só o sistema | Google login | enquanto a conta existir | apagado |
| `users/{uid}` | nome, apelido, e-mail, foto, capa, WhatsApp, papéis, barbearias, favoritos, token de push, estrelas dadas a cada casa, quando se declarou maior de idade | todos | o próprio | o próprio (avaliações: Worker) | enquanto a conta existir | apagado |
| `agendamentos/{id}` | cliente (uid, nome, WhatsApp), barbeiro (uid, nome), serviço, preço, data/hora, situação, motivo de cancelamento | cliente, barbeiro | o cliente, o barbeiro do horário (só enquanto ativo na casa) e o dono | cliente ou casa | enquanto a conta existir; **WhatsApp sai 24 h depois do horário** (cron) | nome vira "Cliente removido"; WhatsApp sai (o uid fica, sem conta ligada); futuros cancelados |
| `clubeMembros/{bid}_{uid}` | cliente (uid, nome), plano, situação, ciclo e vencimento, horário fixo, marcas de lembrete | cliente | o cliente e a equipe ativa da casa | cliente (pedido, sair, horário fixo), equipe (aceitar, pagamento, encerrar), Worker (vencido, reservas) | enquanto a conta existir | nome vira "Cliente removido", status "saiu", horário fixo e marcas saem; reservas futuras do horário fixo canceladas |
| `clubeMembros/{id}/pagamentos/{pid}` | data, valor, quem da equipe marcou (uid), novo vencimento | cliente | o cliente e a equipe ativa | equipe | enquanto a casa existir | mantidos com a casa, sem nome (o membro foi anonimizado) |
| `ocupacao/{barbeiro_data_HHMM}` | uid do barbeiro e id do agendamento | barbeiro | todos logados (ver horário livre) | junto com o agendamento | até o cancelamento | — |
| `avaliacoes/{hash}` | só as estrelas e a casa (sem nome, uid, comentário ou dia) | cliente | **ninguém** (só o Worker); a casa mostra a média e a quantidade | Worker | enquanto a barbearia existir | continua contando na média, sem nada que leve à pessoa |
| `barbearias/{id}` | nome, endereço, localização, WhatsApp e Instagram da casa, dono (uid) | dono | **público** | dono | enquanto existir | dono precisa excluir a casa antes |
| `barbearias/{id}/barbeiros/{uid}` | nome, foto, capa, expediente | barbeiro | **público** | dono ou o barbeiro | enquanto estiver na equipe | sai da equipe |
| `barbearias/{id}/equipePrivado/{uid}` | telefone do barbeiro | barbeiro | o dono e o próprio | o barbeiro | enquanto estiver na equipe | apagado |
| `barbearias/{id}/motivosFolga` | motivo da folga | barbeiro | o dono e o próprio | barbeiro ou dono | enquanto existir | — |
| `convites/{código}` | uid de quem convidou/usou | dono, barbeiro | quem tem o código | dono | **apagado ao vencer** (7 dias, cron) e ao excluir a casa | — |
| `assinaturas/{bid}` | token de compra do Google Play, plano, vencimento | dono | o dono | Worker | prazo legal de registros de compra | mantido (obrigação legal) |
| `testes/{uid}` | só a data em que usou o teste grátis | dono | o próprio | o próprio | indefinida (evita repetir o teste) | mantido, sem outros dados |
| `notificacoes/{id}` | destinatário (uid), texto do aviso (nome, horário) | todos | o destinatário | Worker | **90 dias** (cron) | apagado |
| `eventos/{id}` | uid, ação (agendou, cancelou…), barbearia, tempos | todos | ninguém pelo app | app | **12 meses** (cron) | fica sem ligação com a pessoa |
| `erros/{id}` | uid, tela, mensagem e pilha do erro, sistema, versão | todos | ninguém pelo app | app | **12 meses** (cron) | fica sem ligação com a pessoa |
| R2 `navalha-fotos` | fotos de perfil, capa, casa e cardápio (a foto do corte saiu em 25/out) | todos | quem tem o link (difícil de adivinhar) | Worker (upload com login) | enquanto o dono da foto existir | perfil, capa (e fotos de corte antigas) apagados |
| Aparelho | sessão de login, tema, cópia temporária de páginas públicas | todos | o próprio aparelho | app | até sair ou limpar | sai com o logout |
| FCM (Google) | token do aparelho | todos | Google | app | até trocar o token | token apagado do perfil |
| Google Play | dados de pagamento da assinatura | dono | Google | Google | regras do Google | fora do nosso alcance |

## Fluxos que levam dado a outra pessoa
- **Cliente → barbearia**: ao marcar, o nome/apelido, o WhatsApp (se preenchido; só nesse horário, até 24 h depois) e o horário.
- **Barbearia → cliente**: avisos de marcado/cancelado (push e sino).
- **Barbeiro → WhatsApp do cliente**: "Lembrar no WhatsApp" abre o WhatsApp **do barbeiro** com mensagem pronta; o
  Navalha não envia nada nem usa a API do WhatsApp.
- **Cliente → média da casa**: as estrelas entram na média e na quantidade mostradas na página; nada da pessoa é público.
- **Cliente → ele mesmo**: Perfil › "Baixar meus dados" (`GET /conta/dados` no Worker) entrega tudo num JSON.
- **Localização**: usada no aparelho para buscar casas por perto; não é gravada. A da barbearia é pública.

## Operadores (art. 39) e onde processam
| Operador | Serviço | Região | Termos de dados |
|---|---|---|---|
| Google (Firebase) | Auth, Firestore, FCM, Hosting | Firestore em `southamerica-east1` (São Paulo); Auth, FCM e Hosting globais | Firebase Data Processing and Security Terms (vêm com os termos do Firebase; conferido em 23/out) |
| Cloudflare | Worker (servidor) e R2 (fotos) | rede global | Cloudflare DPA (incluído no contrato self-serve) |
| Google Play | cobrança das assinaturas | global | termos do Google Play |
