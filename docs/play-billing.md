# Mensalidades pelo Google Play Billing

O código está pronto: tela de planos, compra, conferência no servidor, limite de barbeiros, aviso de vencimento,
5 dias para regularizar e bloqueio. Para cobrar de verdade faltam os passos abaixo, que só o dono consegue fazer.

## Como funciona

| Situação | O que acontece |
| --- | --- |
| Primeira barbearia da conta | 60 dias grátis, até 10 barbeiros, aparece na busca. A conta fica marcada (`testes/{uid}`) e não ganha outro teste. |
| Faltam 7 dias (teste, ou plano com renovação desligada) | O dono vê "Seu acesso vence em N dias" na Agenda e na aba Barbearia. Plano pago renovando sozinho não avisa. |
| Fim do teste ou do plano sem renovar | Mais **5 dias** de uso normal para regularizar ("Regularize em N dias", em vermelho). |
| Passaram os 5 dias | O cron do Worker (de hora em hora) bloqueia (`emDia: false`): sai da busca, as regras barram novos horários (app e encaixe) e o app troca a Agenda e a aba Barbearia pela tela "Barbearia bloqueada". Assinou: libera na hora. |
| Dono assina pelo app | O Google Play cobra; o app manda a compra ao Worker (`POST /assinatura/verificar`); o Worker confere no Google e grava plano, vencimento, limite e `emDia`. Só então o app conclui a compra. |
| Renovação mensal | Automática pelo Google Play. No vencimento, o cron pergunta ao Google; se renovou, estende o vencimento (sem aviso ao dono). |
| Pagamento recusado | O Google tenta de novo; a casa fica `inadimplente` com o aviso de regularizar e, se não acertar, bloqueia 5 dias depois do vencimento. |
| Subir de plano | Vale na hora, cobra a diferença proporcional do mês. |
| Descer de plano | A tela de planos mostra os barbeiros ativos com "−": o dono escolhe quem sai e confirma no popup (sai = desligado, o cadastro fica para religar). Com a equipe no limite, assina; vale na próxima renovação. |

| Plano | Produto na Play Console | Mensal | Barbeiros |
| --- | --- | --- | --- |
| Solo | `navalha_solo` | R$ 25 | 1 |
| Equipe | `navalha_equipe` | R$ 70 | 3 |
| Time | `navalha_time` | R$ 100 | 6 |
| Casa cheia | `navalha_casa_cheia` | R$ 150 | 10 |

Preços, limites e nomes ficam em `src/lib/planos.ts` (usado pelo app e pelo Worker).

## O que falta (dono)

1. **Conta de desenvolvedor no Google Play** (US$ 25, uma vez) e **chave de assinatura própria** (SEC-002).
2. **Enviar o app (AAB) para o teste interno.** O Billing só funciona com o app instalado pela Play Store, com o mesmo pacote `com.trevotec.navalha`.
3. **Criar as 4 assinaturas** (precisa de um AAB já enviado, em qualquer faixa de teste, porque o app tem a
   permissão de cobrança). Para cada linha da tabela:
   1. Play Console › app Navalha › **Monetizar com o Google Play › Produtos › Assinaturas › Criar assinatura**.
   2. **ID do produto** exatamente como na tabela (ex.: `navalha_solo`; não dá para mudar depois) e o **nome** (ex.: Solo).
   3. **Adicionar plano básico**: ID **`mensal`**, tipo **renovação automática**, período de cobrança **mensal**.
   4. **Definir preço**: Brasil em BRL (R$ 25, 70, 100 ou 150). Os outros países podem ficar com a conversão automática.
   5. Deixe o período de carência e a suspensão de conta no padrão do Google. Não crie oferta de teste grátis:
      os 60 dias são do próprio Navalha (e uma oferta grátis na Play daria outro mês de graça).
   6. **Salvar** e **Ativar** o plano básico.
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
