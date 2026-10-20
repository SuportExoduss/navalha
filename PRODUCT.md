# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

O app nativo Android é o principal. A versão web (https://navalha.web.app) e o iPhone (pela Tela de Início, até o app iOS da Fase 3) seguem a mesma linguagem visual.

## Users

Duas pontas com o mesmo peso; qual vem primeiro depende de quem abre o app e com que intenção:

- **Cliente:** quer achar uma barbearia perto, escolher o corte pelo resultado e garantir o horário sem ligar nem mandar mensagem.
- **Barbeiro e dono:** tocam a agenda do dia no balcão, com as mãos ocupadas, entre um cliente e outro: encaixe de quem chega sem marcar, concluir com foto, falta, cancelamento. O dono também monta a casa (cardápio, equipe, horário) e acompanha os números.

Uma mesma conta pode ser cliente, barbeiro e dono, trocando de modo.

## Product Purpose

Agendamento para barbearias de bairro: o cliente marca o corte em 3 toques e a barbearia para de perder horário e de atender no WhatsApp. Sucesso no piloto = barbearias reais usando por semanas sem erro grave e sem nenhum horário duplicado.

## Positioning

- **Corte escolhido pela foto:** o cliente escolhe pelo resultado real (fotos do cardápio e do corte concluído), não por um nome de serviço.
- **3 toques, sem horário duplo:** corte → horário → confirmar; uma trava no servidor garante que dois clientes nunca levam o mesmo horário.
- **Grátis para começar:** 60 dias de uso liberado para os primeiros usuários.

## Operating Context

- Barbearia de bairro: balcão, pagamento na hora (pagar no app só a partir da Fase 3), WhatsApp como canal paralelo, cliente que chega sem marcar (encaixe).
- Cliente no celular, na rua, com localização ligada para a lista "Perto de você".
- Lembretes de 24 h e 2 h antes do horário por push.
- Cancelamento com motivo escolhido numa lista (o outro lado vê o motivo).
- Fuso fixo de Brasília; dinheiro em reais.

## Capabilities and Constraints

**Já existe (Fase 1):** login Google; modos cliente / barbeiro / dono; busca perto com filtros; página da barbearia; reserva em tempo real; meus agendamentos; agenda do dia com encaixe, concluir com foto, falta e cancelar; cardápio com fotos; expediente e folgas; convite de barbeiro por código; painel do dono; Configurações só do dono (foto, capa, nome, publicação, horário da casa, código do Google, excluir barbearia); exclusão de conta; temas claro e escuro; lembretes push (Android e web).

**Assinatura da barbearia (implementado em 20/out/2026; cobrança real depende da Play Console, ver `docs/play-billing.md`):**

| Plano | Mensal | Barbeiros na casa |
| --- | --- | --- |
| Solo | R$ 25 | 1 (só o dono) |
| Equipe | R$ 70 | até 3 (dono + 2) |
| Casa (nome provisório) | R$ 100 | até 6 |
| Casa cheia (nome provisório) | R$ 150 | até 10 |

- Primeiros usuários: 60 dias liberados antes de cobrar.
- Todos os planos com renovação mensal; cada plano limita quantos barbeiros podem ser adicionados.
- Com a renovação em dia (verificada pelo billing), o dono pode criar a barbearia e ela fica visível na busca. Em atraso, a barbearia sai da busca.
- Cobrança pelo **Google Play Billing** (decidido). Ao baixar de plano, o dono escolhe quem fica (desliga os excedentes antes).
- Teste de 60 dias com o limite do maior plano (10), uma vez por conta.
- **Em aberto:** nomes definitivos dos planos de R$ 100 e R$ 150.

**Troca de modo e entrada na barbearia (implementado):**

- A troca cliente / barbeiro / dono fica no Perfil.
- Conta criada com a intenção de abrir uma barbearia já nasce como cliente + dono.
- Conta criada só como cliente tem, no Perfil (junto da troca de modo), a opção "Abrir uma barbearia" e um campo para o código de convite de barbeiro.

**Restrições técnicas:** custo zero até o piloto (Firebase Spark + Cloudflare R2/Workers; sem Cloud Functions, Firebase Storage, Places API ou WhatsApp API); sem conta Expo (build Android local, push direto pelo FCM); cota grátis do Firestore de 50 mil leituras/dia orienta as telas (cache curto, tempo real só onde precisa).

## Brand Commitments

- Nome **Navalha**; frase "Seu próximo corte, em 3 toques."
- Ícone: um "N" feito de navalha com cabos de poste de barbearia (vermelho e branco) e metal dourado (`icones imgs/`, `assets/icon.png`).
- Grafite + âmbar; âmbar só para ação e seleção. Dois temas (escuro e claro) escolhidos no Perfil.
- Tudo em português do Brasil, linguagem de balcão: direta, sem jargão.

## Evidence on Hand

- App em teste pelo dono num Redmi Note 13; nenhuma barbearia real ainda (piloto com 3 barbearias amigas a partir de 28/dez/2026).
- Não há depoimentos, clientes, números de uso, avaliações nem imprensa. Não inventar nenhum desses até o piloto gerar.

## Product Principles

1. **Três toques ou menos** para o caminho principal de cada ponta (reservar; encaixar; concluir).
2. **O horário é sagrado:** nenhuma tela ou atalho pode abrir caminho para horário duplo.
3. **Mãos ocupadas, olhar rápido:** a agenda do barbeiro se lê de relance e se opera com um polegar.
4. **A foto vende o corte:** o resultado real aparece antes do texto sempre que existir.
5. **Grátis até provar valor:** nada no piloto pode gerar custo para o dono nem para o projeto.

## Accessibility & Inclusion

Alvo de toque mínimo de 44 pt; contraste WCAG AA nos dois temas (testado em `src/lib/contraste.test.ts`); avisos de erro e confirmação anunciados pelo leitor de tela.
