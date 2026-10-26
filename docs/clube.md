# Clube de assinatura do cliente (desenho, 26/out/2026)

Pedido do dono em 26/out/2026, saindo da Fase 4 (que segue fora do plano no resto). **O app não cobra nada**: o
cliente paga na barbearia (Pix, dinheiro, cartão na maquininha) e o app só organiza: planos, quem é assinante,
vencimento com lembrete e um horário fixo já reservado.

## Decisões do dono
| Pergunta | Decisão |
|---|---|
| Vencido e não pagou | **1 dia após o vencimento** o horário fixo é liberado para outros clientes |
| Limite de cortes | Quem cria o plano escolhe o limite por mês (ou ilimitado); o app bloqueia usar o clube além dele |
| Frequência do horário fixo | Semanal, quinzenal ou mensal (decidido abaixo) |
| Entrada | O cliente **solicita** pelo app; o **barbeiro ou o dono** aceita |
| Planos do Navalha | Clube disponível em **todos** (Solo e os maiores) |

## Como funciona

### 1. Planos
- Criados na aba Barbearia › **Clube** (como o cardápio): nome, preço mensal (informativo, em centavos), serviços
  incluídos (do cardápio) e **cortes por mês** (número ou ilimitado). Pausar um plano esconde da página da casa
  sem afetar quem já assina.
- Quem cria: o dono. Se a casa quiser que cada barbeiro tenha planos próprios, é uma extensão (plano com `barbeiroId`).

### 2. Entrada
1. Na página da casa, o cliente vê os planos e toca **Quero assinar** → status `solicitado`. A casa recebe aviso no sino e push.
2. O barbeiro ou o dono abre a solicitação e toca **Aceitar** (normalmente com o cliente na cadeira, já pagando) ou **Recusar**.
3. Aceitar = **1º pagamento recebido**: status `ativo`, ciclo começa hoje, `venceEm` = mesmo dia do mês seguinte.

### 3. Vencimento e pagamento
- **Recebi o pagamento** (dono ou barbeiro): soma 1 mês ao `venceEm`. Se pagou em dia, conta do vencimento antigo
  (não perde dias); se já estava vencido, conta de hoje.
- Lembretes (cron de hora em hora que já existe): push ao cliente **3 dias antes** e **no dia**.
- **1 dia depois do vencimento** sem pagamento: status `vencido`, o Worker cancela as reservas do horário fixo que
  sobraram (libera os blocos na mesma gravação) e avisa cliente e casa. Pagando depois, volta a `ativo` e o
  horário fixo é reservado de novo, se ainda estiver livre.
- O dono vê na aba Clube: **Solicitações**, **Vencem esta semana**, **Vencidos**.

### 4. Limite de cortes
- Ciclo = de `cicloInicio` até `venceEm`. Usos = agendamentos do clube no ciclo que não foram cancelados.
- Ao agendar na casa, assinante ativo com saldo vê **Usar o clube (2 de 4 usados)**; sem saldo, agenda normal
  (paga na hora). Faltou ao horário conta como uso; cancelou no prazo, não.
- Só serviços incluídos no plano podem usar o clube.

### 5. Horário fixo
- O assinante escolhe **barbeiro, serviço, dia da semana, hora e frequência**:
  - **Semanal**, **quinzenal** ou **mensal (a cada 4 semanas, mesmo dia da semana)**. Mensal por "dia 10 de todo
    mês" não entra: cai em dias diferentes da semana e bate com folgas e expediente. Semana é como a agenda já pensa.
- O Worker reserva os horários **do ciclo pago** (até `venceEm` + 1 dia), um agendamento normal por data, com a
  **mesma trava contra horário duplo** (agendamento + documentos de `ocupacao` numa gravação só, que falha se algum
  bloco já existir). Nada passa por cima de outro cliente.
- Data que cai em folga, fora do expediente, já ocupada ou além do limite de cortes: não reserva e avisa o cliente
  ("Dia 12 seu horário fixo não coube; escolha outro").
- Cancelar uma data é o cancelar de hoje e não mexe no horário fixo. Trocar ou tirar o horário fixo cancela as
  reservas futuras dele e, se for o caso, reserva as novas.
- Na agenda do barbeiro, os horários do clube aparecem com o selo **Clube**.

## Dados (Firestore)
- `barbearias/{bid}/clubePlanos/{pid}`: `nome`, `precoCentavos`, `servicoIds[]`, `cortesPorMes` (omitido = ilimitado),
  `ativo`, `criadoEm`.
- `clubeMembros/{bid}_{uid}` (ID fixo: um por cliente por casa): `barbeariaId`, `barbeariaNome`, `planoId`,
  `planoNome`, `cortesPorMes?`, `clienteUid`, `clienteNome`,
  `status: 'solicitado' | 'ativo' | 'vencido' | 'recusado' | 'saiu'`, `cicloInicio`, `venceEm` (Millis),
  `horarioFixo?: { barbeiroId, servicoId, diaSemana, minutos, frequencia: 'semanal' | 'quinzenal' | 'mensal', ancora: ISODate }`,
  `reservadoAte?: ISODate`, `lembretes: {}`, `criadoEm`, `atualizadoEm`.
- `clubeMembros/{id}/pagamentos/{pid}`: `em`, `porUid`, `valorCentavos`, `venceEmNovo`. Histórico para o dono e o cliente.
- `agendamentos`: `origem` ganha `'clube'`; novo campo `clubeMembroId`. O painel do dono não soma esses como
  faturamento do dia (a receita é a mensalidade, em `pagamentos`).

Nome `assinaturas/{bid}` já é a mensalidade da barbearia no Google Play; por isso tudo aqui é `clube…`.

## Quem grava o quê (regras + `tests/regras.test.ts`, o que pode E o que não pode)
- Planos: leitura pública; gravação só do dono da casa.
- Membro: o cliente **cria** só o próprio, só com status `solicitado`; pode **sair** e **mudar o horário fixo**
  (formato validado). `status`, `venceEm`, `cicloInicio` e `pagamentos` só dono ou barbeiro da casa.
  Ninguém de outra casa lê ou grava.
- Agendamentos do clube (`origem: 'clube'`): **só o Worker** cria, tanto os do horário fixo quanto o "Usar o clube"
  (`POST /clube/agendar`, confere ativo, saldo e serviço do plano). Cliente não marca agendamento próprio como do clube.

## Worker
- `POST /clube/agendar`: reserva avulsa pelo clube (conferências acima + trava).
- Cron próprio para o clube (3 das 5 tarefas gratuitas), de hora em hora: lembretes de vencimento, vencidos
  (+1 dia), preencher horários fixos. Gravação com trava pela API REST: `commit` com `currentDocument.exists = false`
  em cada `ocupacao`.
- Reaproveita `chavesOcupacao` e `expedienteEfetivo` de `src/lib/agenda.ts` (lógica pura; o Worker importa direto).
- ponytail: ~45 reservas por execução (limite de chamadas do plano grátis); acima disso, o preenchimento continua
  na hora seguinte, sem perder nada.

## LGPD
Dados novos: plano escolhido, vencimento e registro de pagamentos (data e valor) entre cliente e casa. Base:
execução de contrato (art. 7º, V). Entram no mapa de dados, no ROPA, na exportação de dados e na exclusão de
conta, e a política de privacidade ganha um item "Clube".

## Fora do escopo
Cobrança pelo app (Pix automático, cartão, Asaas), multa por atraso, fidelidade, plano por barbeiro.

## Etapas (cada uma testada antes da próxima)
1. Modelo, regras e testes de regras.
2. Dono/barbeiro: planos, solicitações, aceitar/recusar, "Recebi o pagamento", listas de vencimento.
3. Cliente: planos na página da casa, solicitar, "Meu clube" (status, vencimento, X de Y cortes, sair).
4. Worker: lembretes de vencimento e vencidos (+1 dia).
5. "Usar o clube" ao agendar (`POST /clube/agendar`) com limite.
6. Horário fixo: escolher no app + preenchimento pelo Worker + selo na agenda.
7. Ponta a ponta no navegador (`tests/e2e/`), LGPD (mapa, política, exportar/excluir) e `docs/status.md`.
