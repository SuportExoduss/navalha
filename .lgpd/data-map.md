# Mapa de dados pessoais — Navalha (LGPD)

Levantado do código em 23/out/2026 (`src/types/models.ts`, `firestore.rules`, `worker/src/`, telas). Mudou a coleta no
código, atualize aqui, no `ropa.md` e na política (`src/app/privacidade.tsx`).

Titulares: **clientes**, **barbeiros**, **donos** de barbearia. Sem dados sensíveis (art. 11) e sem perfilamento.
Idade mínima declarada: 18 anos (sem verificação).

## Onde cada dado fica

| Onde | Dados pessoais | Titular | Quem lê | Quem grava | Guarda | Na exclusão de conta |
|---|---|---|---|---|---|---|
| Firebase Auth | uid, e-mail, nome, foto do Google | todos | só o sistema | Google login | enquanto a conta existir | apagado |
| `users/{uid}` | nome, apelido, e-mail, foto, capa, WhatsApp, papéis, barbearias, favoritos, token de push, avaliações dadas | todos | o próprio | o próprio (avaliações: Worker) | enquanto a conta existir | apagado |
| `agendamentos/{id}` | cliente (uid, nome, WhatsApp), barbeiro (uid, nome), serviço, preço, data/hora, situação, motivo de cancelamento, foto do corte | cliente, barbeiro | o cliente, o barbeiro do horário e o dono | cliente ou casa | enquanto a conta existir | nome vira "Cliente removido"; WhatsApp e fotos saem (o uid fica, sem conta ligada); futuros cancelados |
| `ocupacao/{barbeiro_data_HHMM}` | uid do barbeiro e id do agendamento | barbeiro | todos logados (ver horário livre) | junto com o agendamento | até o cancelamento | — |
| `avaliacoes/{hash}` | primeiro nome, estrelas, comentário, dia do corte (sem uid) | cliente | **público** | Worker | enquanto a barbearia existir | nome vira "Cliente" |
| `barbearias/{id}` | nome, endereço, localização, WhatsApp e Instagram da casa, dono (uid) | dono | **público** | dono | enquanto existir | dono precisa excluir a casa antes |
| `barbearias/{id}/barbeiros/{uid}` | nome, foto, capa, expediente | barbeiro | **público** | dono ou o barbeiro | enquanto estiver na equipe | sai da equipe |
| `barbearias/{id}/equipePrivado/{uid}` | telefone do barbeiro | barbeiro | o dono e o próprio | o barbeiro | enquanto estiver na equipe | apagado |
| `barbearias/{id}/motivosFolga` | motivo da folga | barbeiro | o dono e o próprio | barbeiro ou dono | enquanto existir | — |
| `convites/{código}` | uid de quem convidou/usou | dono, barbeiro | quem tem o código | dono | 7 dias de validade | — |
| `assinaturas/{bid}` | token de compra do Google Play, plano, vencimento | dono | o dono | Worker | prazo legal de registros de compra | mantido (obrigação legal) |
| `testes/{uid}` | só a data em que usou o teste grátis | dono | o próprio | o próprio | indefinida (evita repetir o teste) | mantido, sem outros dados |
| `notificacoes/{id}` | destinatário (uid), texto do aviso (nome, horário) | todos | o destinatário | Worker | **90 dias** (cron) | apagado |
| `eventos/{id}` | uid, ação (agendou, cancelou…), barbearia, tempos | todos | ninguém pelo app | app | **12 meses** (cron) | fica sem ligação com a pessoa |
| `erros/{id}` | uid, tela, mensagem e pilha do erro, sistema, versão | todos | ninguém pelo app | app | **12 meses** (cron) | fica sem ligação com a pessoa |
| R2 `navalha-fotos` | fotos de perfil, capa, casa, cardápio e corte | todos | quem tem o link (difícil de adivinhar) | Worker (upload com login) | enquanto o dono da foto existir | perfil, capa e cortes apagados |
| Aparelho | sessão de login, tema, cópia temporária de páginas públicas | todos | o próprio aparelho | app | até sair ou limpar | sai com o logout |
| FCM (Google) | token do aparelho | todos | Google | app | até trocar o token | token apagado do perfil |
| Google Play | dados de pagamento da assinatura | dono | Google | Google | regras do Google | fora do nosso alcance |

## Fluxos que levam dado a outra pessoa
- **Cliente → barbearia**: ao marcar, o nome/apelido, o WhatsApp (se preenchido) e o horário.
- **Barbearia → cliente**: foto do corte no histórico; avisos de marcado/cancelado (push e sino).
- **Barbeiro → WhatsApp do cliente**: "Lembrar no WhatsApp" abre o WhatsApp **do barbeiro** com mensagem pronta; o
  Navalha não envia nada nem usa a API do WhatsApp.
- **Cliente → público**: avaliação da barbearia (primeiro nome, dia, estrelas, comentário).
- **Localização**: usada no aparelho para buscar casas por perto; não é gravada. A da barbearia é pública.

## Operadores (art. 39) e onde processam
| Operador | Serviço | Região | Termos de dados |
|---|---|---|---|
| Google (Firebase) | Auth, Firestore, FCM, Hosting | Firestore em `southamerica-east1` (São Paulo); Auth, FCM e Hosting globais | Firebase Data Processing and Security Terms (vêm com os termos do Firebase; conferido em 23/out) |
| Cloudflare | Worker (servidor) e R2 (fotos) | rede global | Cloudflare DPA (incluído no contrato self-serve) |
| Google Play | cobrança das assinaturas | global | termos do Google Play |
