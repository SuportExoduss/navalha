# Registro das operações de tratamento (ROPA) — LGPD art. 37

Formato simplificado para agente de pequeno porte (Res. CD/ANPD nº 2/2022, art. 9º). Atualizado em 23/out/2026.
Detalhe de cada dado em `data-map.md`.

- **Controlador**: Andre Luiz R.P de Barros, pessoa física, marca TrevoTec (sem CNPJ). Contato: trevotecsuport@gmail.com
- **Encarregado**: o próprio controlador, pelo mesmo e-mail (dispensa da Res. 2/2022, art. 11; canal publicado)
- **Operadores**: Google (Firebase, Google Play) e Cloudflare (Worker, R2). Ver `data-map.md`
- **Medidas de segurança (gerais)**: HTTPS; regras do Firestore testadas (`tests/regras.test.ts`) com acesso por papel
  (cliente, barbeiro, dono); notas, assinaturas e avisos só pelo Worker com conferência do login; limite de envio de
  fotos; chaves fora do código (segredos do Worker, `.env.local`); exclusão de conta pelo app; prazos de guarda por cron;
  roteiro de incidentes (`incidentes.md`)

| # | Operação | Finalidade | Base legal | Titulares | Dados | Compartilhamento | Transferência internacional | Guarda |
|---|---|---|---|---|---|---|---|---|
| 1 | Conta e login | criar a conta e entrar | execução de contrato (art. 7º, V) | todos | nome, e-mail, foto, uid | Google (Auth) | sim (Auth global) | enquanto a conta existir |
| 2 | Perfil | identificar e contatar sobre horários | execução de contrato | todos | apelido, capa, WhatsApp | barbearia do horário | não (Firestore SP) | enquanto a conta existir |
| 3 | Busca por perto | mostrar barbearias próximas | consentimento (art. 7º, I) | clientes | localização do aparelho (não gravada) | — | não | não guarda |
| 4 | Agendamento | marcar, lembrar, cancelar, evitar horário duplo | execução de contrato | clientes, barbeiros | horário, serviço, preço, situação, motivo de cancelamento | barbearia | não | enquanto a conta existir; depois anonimizado |
| 5 | ~~Foto do corte~~ | saiu do app em 25/out (decisão do dono); as antigas são apagadas na exclusão de conta | — | — | — | — | — | — |
| 6 | Avaliação da barbearia | nota e ranking das casas | consentimento (opcional) | clientes | primeiro nome, estrelas, comentário, dia | **público** | não | enquanto a casa existir; depois "Cliente" |
| 7 | Cadastro da barbearia e equipe | página pública e agenda da casa | execução de contrato | donos, barbeiros | dados da casa, nome/foto do barbeiro, telefone (privado) | público (menos o telefone) | não | enquanto existir |
| 8 | Assinatura da barbearia | cobrar e controlar o plano | execução de contrato; obrigação legal (art. 7º, II) | donos | plano, vencimento, token de compra, marca do teste | Google Play | sim | prazo legal |
| 9 | Notificações | lembretes e avisos de horário | consentimento (permissão do aparelho) | todos | token do aparelho, texto do aviso | Google (FCM) | sim | avisos 90 dias |
| 10 | Uso e erros | corrigir falhas, medir o piloto, evitar abuso | legítimo interesse (art. 7º, IX e art. 10) | todos | uid, ação, mensagem de erro, sistema, versão | — | não | 12 meses |
| 11 | Pedidos de titulares | atender direitos do art. 18 | obrigação legal | todos | e-mail e o pedido | — | não (Gmail do contato) | 5 anos (prova de atendimento) |

## Legítimo interesse (operação 10) — teste de balanceamento resumido
- **Interesse**: manter o app funcionando e medir se o piloto dá certo.
- **Necessidade**: só ações e erros, sem conteúdo de mensagens, sem localização, sem publicidade.
- **Expectativa do titular**: registro técnico é esperado num app; está descrito na política.
- **Salvaguardas**: ninguém lê pelo app; apagado em 12 meses; desligado da pessoa na exclusão; direito de oposição pelo e-mail.

## Pendente
- Script de acesso e portabilidade (L05): hoje o pedido é atendido à mão pelo console, em até 15 dias.
