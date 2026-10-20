# Mensalidades pelo Google Play Billing

O código está pronto: tela de planos, compra, conferência no servidor, limite de barbeiros e saída da busca
quando o plano vence. Para cobrar de verdade faltam os passos abaixo, que só o dono consegue fazer.

## Como funciona

| Situação | O que acontece |
| --- | --- |
| Primeira barbearia da conta | 60 dias grátis, até 10 barbeiros, aparece na busca. A conta fica marcada (`testes/{uid}`) e não ganha outro teste. |
| Fim do teste sem plano | O cron do Worker (de hora em hora) tira a casa da busca (`emDia: false`). A equipe continua vendo e usando a agenda. |
| Dono assina pelo app | O Google Play cobra; o app manda a compra ao Worker (`POST /assinatura/verificar`); o Worker confere no Google e grava plano, vencimento, limite e `emDia`. Só então o app conclui a compra. |
| Renovação mensal | Quando o prazo passa, o cron pergunta ao Google; se renovou, estende o vencimento. |
| Pagamento recusado | O Google tenta de novo (período de carência); a casa fica `inadimplente` e sai da busca até acertar. |
| Subir de plano | Vale na hora, cobra a diferença proporcional do mês. |
| Descer de plano | Só depois de o dono desligar os barbeiros que passam do novo limite (ele escolhe quem fica). Vale na próxima renovação. |

| Plano | Produto na Play Console | Mensal | Barbeiros |
| --- | --- | --- | --- |
| Solo | `navalha_solo` | R$ 25 | 1 |
| Equipe | `navalha_equipe` | R$ 70 | 3 |
| Casa (nome provisório) | `navalha_casa` | R$ 100 | 6 |
| Casa cheia (nome provisório) | `navalha_casa_cheia` | R$ 150 | 10 |

Preços, limites e nomes ficam em `src/lib/planos.ts` (usado pelo app e pelo Worker).

## O que falta (dono)

1. **Conta de desenvolvedor no Google Play** (US$ 25, uma vez) e **chave de assinatura própria** (SEC-002).
2. **Enviar o app (AAB) para o teste interno.** O Billing só funciona com o app instalado pela Play Store, com o mesmo pacote `com.trevotec.navalha`.
3. **Criar as 4 assinaturas** em Monetizar › Produtos › Assinaturas, com os IDs da tabela acima.
   Em cada uma, um plano base com ID **`mensal`**, renovação automática mensal e o preço em BRL.
   Não crie avaliação gratuita na Play Console: os 60 dias grátis são controlados pelo próprio Navalha.
4. **Ativar a "Google Play Android Developer API"** no Google Cloud, projeto `navalha-1a8f5`.
5. **Dar acesso ao Worker:** Play Console › Usuários e permissões › Convidar
   `navalha-worker@navalha-1a8f5.iam.gserviceaccount.com` com "Ver informações financeiras" e
   "Gerenciar pedidos e assinaturas". Pode levar até 24 h para valer.
6. **Testadores de licença** (Configuração › Teste de licença): o seu e-mail, para assinar sem ser cobrado.

## Conferir depois de configurar

- Perfil › modo Dono › aba Barbearia › ⚙ Configurações › Plano: os 4 planos aparecem com o preço da loja.
- Assinar o Solo com a conta de teste → "Plano Solo ativo" e a casa na busca.
- Na Play Console, cancelar a assinatura de teste → no vencimento, o cron tira a casa da busca.

## Manutenção

- `POST /admin/migrar-assinaturas` (com `Authorization: Bearer <ADMIN_TOKEN>`) ajusta casas antigas sem os campos novos.
  Já rodou em 20/out/2026 (1 casa migrada, 60 dias de teste a partir dessa data). É idempotente.
- Avisos em tempo real do Google (RTDN via Pub/Sub) não foram ligados: o cron de hora em hora basta no piloto.
