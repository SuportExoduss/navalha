# Agendar pelo WhatsApp — ideia (20/out/2026)

Objetivo: o cliente manda mensagem no WhatsApp da barbearia e sai com o horário marcado no Navalha, identificado
pelo número de telefone, seguindo a mesma ordem do app: **barbeiro → corte → horário → confirmação**.

## O que existe hoje (pesquisa)

- **IA da Meta no WhatsApp Business (Business Agent):** lançada no mundo todo em jun/2026, grátis no app WhatsApp Business.
  Responde dúvidas e marca horário, mas na agenda **dela** (Google Agenda). Não chama sistemas de fora: ações sob medida
  ainda são só para grandes empresas. Ou seja, **não consegue gravar direto no Navalha**.
- **WhatsApp Cloud API + "Coexistence":** o mesmo número continua no app do celular e passa a mandar as mensagens também
  para um servidor (o nosso Worker). É o único jeito de um robô nosso ler e responder.
- **Custo da API no Brasil:** cobrança por mensagem. As fontes divergem se as respostas dentro de 24 h seguem grátis
  depois de 1/out/2026 (algumas falam em ~US$ 0,0068 por mensagem). Marketing ~US$ 0,0625. Conferir na tabela oficial da Meta.
- **Identidade:** o número que chega pela API é verificado pelo próprio WhatsApp. É confiável para saber quem é o cliente
  (diferente de um número digitado num formulário).

## Proposta em duas etapas

### Etapa A — agora, custo zero (cabe no piloto)
O WhatsApp da barbearia vira a porta de entrada para o agendamento do Navalha:
1. **Link curto por barbearia**, por exemplo `navalha.web.app/b/navalha-de-ouro`, abrindo direto na escolha do barbeiro.
2. **Texto pronto** em Configurações, para o dono colar na mensagem de saudação ou de ausência do WhatsApp Business e nas
   instruções da IA da Meta: "Para marcar, escolha barbeiro, corte e horário aqui: <link>".
3. O barbeiro já recebe o push quando o cliente marca (feito em 20/out).

Limite: o cliente entra com a conta Google no site ou no app. A IA da Meta só manda o link, não marca sozinha.

### Etapa B — IA que marca de verdade (depois do piloto; o roadmap prevê "WhatsApp oficial" na Fase 5)
```
Cliente (WhatsApp) ─► número da barbearia (Coexistence: o dono continua no celular)
                    └► webhook ─► Worker /whatsapp ─► IA (Claude, modelo pequeno) com 4 ferramentas:
                         listarBarbeiros · listarCortes(barbeiro) · horariosLivres(barbeiro, corte, dia) · reservar(...)
                    ◄── resposta no WhatsApp ("Lucas tem amanhã 10:00, 10:30 ou 14:00. Qual prefere?")
```
- **Quem é o cliente:** o número verificado do WhatsApp. Se bater com o WhatsApp de um perfil do Navalha, a reserva aparece
  no app da pessoa. Se não, entra como cliente "pelo WhatsApp" (nome do perfil do WhatsApp + número), como o encaixe de balcão.
- **Mesma trava contra horário duplo:** o Worker reserva com os blocos de ocupação na mesma gravação (commit com
  "documento não pode existir"), e a regra do app continua valendo para o resto.
- **A IA não inventa:** só oferece o que as ferramentas devolvem e sempre confirma o resumo antes de reservar.
- **Cancelar e remarcar** pelo WhatsApp entram com as mesmas ferramentas, e o barbeiro recebe o push.
- **Custo estimado por agendamento:** algumas mensagens da Meta (centavos de real, a confirmar) + alguns centavos de IA.
  Faz sentido como recurso dos planos maiores (Casa / Casa cheia).
- **Pré-requisitos (dono):** verificação da empresa na Meta (CNPJ), app no Meta for Developers, número em Coexistence,
  cartão na Meta. Para várias barbearias, cada uma conecta o próprio número (Embedded Signup como provedor de tecnologia).

## Recomendação
Fazer a **Etapa A já** (1 dia de código, custo zero, respeita a regra de custo zero até o piloto). Medir no piloto
quantos clientes chegam pelo WhatsApp. Fazer a **Etapa B** só depois, com CNPJ e com o plano pago cobrindo o custo.

## Fontes
- [Meta Business Agent disponível no mundo (TechCrunch, jun/2026)](https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/)
- [Business AI x agentes próprios (SleekFlow)](https://sleekflow.io/blog/meta-whatsapp-business-ai-vs-ai-agents)
- [Business Agent no app: Google Agenda e limites](https://www.greenadsglobal.com/post/meta-business-agent-for-whatsapp-business-app) · [Limites de integração](https://www.pragma-code.de/en/blog-whatsapp-business-ai-agent)
- [Coexistence: app e API no mesmo número (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-2-public-preview) · [Telnyx](https://telnyx.com/release-notes/whatsapp-coexistence) · [Cliengo](https://guiawabusiness.cliengo.com/coexistence)
- [Preços da API no Brasil 2026 (SleekFlow)](https://sleekflow.io/en-us/blog/whatsapp-business-price) · [Engagelab](https://www.engagelab.com/blog/whatsapp-business-api-pricing) · [Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
