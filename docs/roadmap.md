# Navalha — Roadmap de execução

Oct 17, 2026 · @Andre R.

## Visão geral

Em 12 meses o Navalha vai do protótipo a 3 cidades, e até o piloto com barbearias reais (jan/2027) o custo de infraestrutura é **zero**: o primeiro gasto obrigatório é a conta Google Play (US$ 25, uma vez).

| Fase | Período | Objetivo | Prepara a próxima com |
| --- | --- | --- | --- |
| 0 · Fundação | 19/out – 1/nov 2026 | Validar com barbeiros e clientes, fechar nome, protótipo clicável | Requisitos validados e telas aprovadas |
| 1 · MVP | 2/nov – 27/dez 2026 | App funcionando: login, barbearia, cardápio, agenda, busca | Versão Android + web pronta para teste |
| 2 · Piloto fechado | 4/jan – 7/fev 2027 | 10 barbearias reais usando de graça | Métricas, depoimentos, lista de bugs |
| 3 · Lançamento | fev – abr 2027 | Pagamentos, assinatura, iOS, avaliações | Receita recorrente e base pagante |
| 4 · Crescimento | mai – jul 2027 | Clube de assinatura, fidelidade, indicação | Retenção alta e caixa para expandir |
| 5 · Escala | ago – out 2027 | Outras cidades, time de vendas, recursos pagos | Base para série de investimento ou crescimento orgânico |

**Regra de ouro:** cada fase só começa quando o portão da anterior foi atingido. Tudo que é construído numa fase já deixa o terreno pronto para a seguinte — por exemplo, o banco do MVP já nasce com as coleções de pagamento e avaliação modeladas, para a Fase 3 não exigir migração.

Premissa das datas: 1 a 2 desenvolvedores com dedicação quase integral. Com dedicação parcial, multiplique as fases 1 a 3 por 1,5 a 2.

**Stack definida:** Firebase como banco geral (login, Firestore e push no plano gratuito, sem cartão) e Cloudflare R2 + Workers para fotos e tarefas de servidor. Isso evita o plano pago do Firebase, que desde fevereiro de 2026 é obrigatório para o Storage de fotos e já era para as Cloud Functions (detalhes na seção Stack).

## Linha do tempo

&#91;embedded content: roadmap proposto · 6 fases, out/2026 a out/2027\]

O piloto começa logo após as festas de fim de ano; a semana entre 28/dez e 3/jan é o teste com 3 barbearias amigas (portão da Fase 1) e as correções finais.

## Stack custo zero: Firebase + Cloudflare

Firebase no plano gratuito Spark (sem cartão) cuida de login, banco e push; o Cloudflare R2 guarda as fotos e o Cloudflare Workers faz o papel de servidor. Tudo cabe nos planos gratuitos até o lançamento.

| Camada | Ferramenta | Limite gratuito | Quando paga |
| --- | --- | --- | --- |
| App (Android, iOS e web) | [Expo / React Native](https://expo.dev/pricing.md) | Código aberto; nuvem com 15 builds Android + 15 iOS por mês | Mais builds: US$ 19/mês (ou compilar local, grátis) |
| Login Google | Firebase Auth | Gratuito | — |
| Banco de dados | [Cloud Firestore](https://cloud.google.com/firestore/quotas) | 1 GiB armazenado, 50 mil leituras/dia, 20 mil gravações/dia, 10 GiB de transferência/mês | Plano Blaze, pago por uso acima disso |
| Notificações push | Expo Push + Firebase Cloud Messaging | Gratuito | — |
| Fotos | [Cloudflare R2](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/) | 10 GB/mês armazenados, download sem custo | US$ 0,015 por GB/mês acima disso |
| Servidor (upload de fotos, lembretes, webhooks de pagamento) | [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits) | 100 mil requisições/dia, 5 tarefas agendadas (cron), 10 ms de CPU por requisição | Workers Paid, US$ 5/mês |
| Busca por perto | Geohash no Firestore (biblioteca geofire-common) | Incluído | — |
| Nota e avaliações Google | [Places API (New)](https://openplacesapi.com/blog/google-places-api-pricing) | Grátis por mês: 10 mil chamadas Essentials, 5 mil Pro, 1 mil Enterprise por SKU | Por mil chamadas acima da franquia |
| Monitoramento de erros e uso | [EAS Observe](https://releasebot.io/updates/expo) | 100 mil eventos/mês | Plano Starter |
| Painel do dono e landing page | Cloudflare Workers (arquivos estáticos) | Arquivos estáticos gratuitos e ilimitados ([DEV](https://dev.to/301st/every-job-your-vps-does-and-what-cloudflares-free-plan-does-with-it-5eao)) | — |
| Pagamentos (fase 3) | [Asaas](https://www.asaas.com/precos-e-taxas) | Sem mensalidade nem adesão | Taxa por Pix/cartão recebido |
| Design e código | Figma (grátis), GitHub + GitHub Projects | Gratuito | — |

**Por que Workers e não Cloud Functions:** as Cloud Functions do Firebase exigem o plano Blaze (com cartão). O Workers faz o mesmo trabalho de servidor no plano grátis e fica na mesma conta do R2.

**Como as peças conversam**

1. O app entra com Google pelo Firebase Auth.
2. O app lê e grava direto no Firestore, protegido por regras de segurança (cliente só vê os próprios agendamentos; barbeiro só edita o próprio cardápio).
3. **Agendamento sem horário duplo:** cada horário ocupado vira um documento com ID fixo (`barbeiro_data_hora`), criado dentro de uma transação. Se o documento já existe, a gravação falha e o segundo cliente vê "horário acabou de ser ocupado".
4. **Foto:** o app comprime para \~150 KB, pede ao Worker um link de envio assinado (o Worker confere o token do Firebase), envia direto ao R2 e grava o endereço da foto no Firestore.
5. **Tarefas agendadas no Worker:** a cada hora, envia lembretes push de 24 h e 2 h pelo Expo Push (gratuito, entrega pelo FCM e pela Apple sem o Worker precisar assinar credenciais); uma vez por dia, a partir da Fase 3, atualiza a nota Google de cada barbearia.
6. **Fase 3:** o Worker recebe os avisos de pagamento do Asaas e marca o agendamento como pago no Firestore.

**Truques para ficar no grátis**

- Na agenda em tempo real, escutar só o dia aberto na tela, não o mês: é o que mais consome as 50 mil leituras/dia.
- Ativar o cache offline do Firestore no app: telas já vistas não geram nova leitura.
- Guardar um resumo por barbearia (nota, próximo horário livre, faixa de preço) num só documento, para a lista "Perto de você" custar 1 leitura por card.
- No Worker, guardar o token de acesso do Google em cache para não estourar os 10 ms de CPU assinando a cada chamada.
- Nota do Google 1 vez por dia: 30 barbearias × 30 dias = 900 chamadas, dentro da franquia de 1 mil; guardar de forma permanente só o Place ID, conforme as regras de cache do Google.
- Lembretes por **push** (grátis) em vez da API do WhatsApp, que passou a cobrar até mensagens de serviço desde 1/out/2026; para contato, link *wa.me* com mensagem pronta.

**Ponto a confirmar:** a Cloudflare pode pedir um cartão para ativar o R2 mesmo no gratuito. Se pedir e você preferir evitar, o plano B é o Storage do Firebase no Blaze, que também tem franquia gratuita (5 GB e 100 GB de download por mês).

## Fase 0 — Fundação e validação (19/out – 1/nov 2026)

Duas semanas para provar que barbeiros e clientes querem o app antes de escrever código. Custo: R$ 0.

**Produto e validação**

- [ ] Entrevistar 10 donos/barbeiros: como agendam hoje (WhatsApp, caderno, outro app), quanto pagam, o que mais dói (faltas, horário duplo, cobrar)
- [ ] Entrevistar 15 clientes: como escolhem barbearia, se pagariam pelo app, se escolheriam o corte pela foto
- [ ] Listar 30 barbearias da região para o piloto e conseguir 10 "sim, quero testar"
- [ ] Aplicar os ajustes de tela da revisão (próximo horário no card, "Qualquer barbeiro", resumo no botão, nome da barbearia em Serviços)
- [ ] Protótipo clicável no Figma com as 9 telas do MVP e teste com 5 clientes e 2 barbeiros

**Marca e base legal**

- [ ] Confirmar o nome: busca no INPI, no Registro.br e nas lojas de apps
- [ ] Criar e-mail do projeto (Gmail), perfil no Instagram e uma landing page simples com lista de espera para barbearias
- [ ] Rascunhar Termos de Uso e Política de Privacidade (LGPD): dados de localização, fotos, avaliações, exclusão de conta
- [ ] Conversar com contador sobre a forma jurídica (CNPJ será necessário na Fase 3 para pagamentos)

**Técnico**

- [ ] Criar contas gratuitas: GitHub, Expo, Firebase (plano Spark) e Cloudflare (R2 + Workers)
- [ ] Desenhar o modelo de dados completo, já incluindo pagamentos, avaliações e assinaturas (mesmo que vazios no MVP)
- [ ] Montar o quadro de tarefas no GitHub Projects com o backlog da Fase 1

**Prepara a próxima com:** telas aprovadas por usuários reais, modelo de dados fechado e backlog priorizado — a Fase 1 começa codando no primeiro dia.

**Portão para a Fase 1:** 10 barbearias confirmadas para o piloto e pelo menos 70% dos clientes entrevistados dizendo que usariam.

## Fase 1 — MVP (2/nov – 27/dez 2026)

Oito semanas em quatro sprints de duas semanas entregam o ciclo completo — cliente acha a barbearia, escolhe corte pela foto, agenda, e o barbeiro atende e fotografa. Pagamento fica no balcão nesta fase. Custo: R$ 0.

| Sprint | Datas | Entrega | Pronto quando |
| --- | --- | --- | --- |
| 1 · Base | 2 – 15/nov | Projeto Expo, Firebase, Worker de upload para o R2, login Google, escolha de papel, tema grafite + âmbar, navegação, emulador local do Firebase para testar sem gastar cota | Pessoa entra com Google e cai no modo certo |
| 2 · Barbearia | 16 – 29/nov | Perfil da barbearia com localização pelo GPS do celular do dono (sem mapa pago) e botão de rota que abre Google Maps/Waze, convite de barbeiros, cardápio com preço, tempo e fotos | Dono monta a casa sozinho em menos de 10 min |
| 3 · Agenda | 30/nov – 13/dez | Expediente, folgas, geração de horários, bloqueio anti-duplo, agendar, cancelar, agenda do barbeiro, encaixe manual | Dois celulares tentando o mesmo horário: só um consegue |
| 4 · Cliente | 14 – 27/dez | Busca por perto (geohash), filtros, perfil do cliente com exclusão de conta, histórico, push de lembrete (cron no Worker + Expo Push), foto no "Concluído", painel simples do dono | Fluxo inteiro em 3 toques num celular real |

**Fica de fora de propósito (entra depois):** pagamento no app, assinatura da barbearia, avaliações, nota do Google, iOS na App Store, WhatsApp.

**Já deixar pronto para as próximas fases**

- Coleções de pagamentos, avaliações e assinaturas já modeladas e cobertas pelas regras de segurança, mesmo vazias.
- Campo *Place ID do Google* no cadastro da barbearia (preenchido agora, usado na Fase 3). Login estruturado para receber "Entrar com Apple" na Fase 3 sem refazer contas.
- Status de agendamento com todos os estados futuros: *reservado, confirmado, pago, concluído, faltou, cancelado*.
- Eventos de uso registrados desde o dia 1 (agendou, cancelou, faltou, tempo até agendar) para medir o piloto.
- Painel do dono como página web (mesmo código Expo), onde a assinatura será vendida na Fase 3.

**Distribuição para teste:** APK Android por link e versão web instalável (PWA) para iPhone. Sem lojas ainda. No iPhone, o lembrete por push só chega com a versão web adicionada à tela de início.

**Portão para a Fase 2:** 3 barbearias amigas usando por 1 semana (28/dez a 3/jan) sem erro grave e nenhum horário duplicado.

## Fase 2 — Piloto fechado (4/jan – 7/fev 2027)

Cinco semanas com 10 barbearias reais usando o app de graça, em troca de feedback semanal e depoimento. É aqui que se descobre o que importa de verdade antes de cobrar. Custo: US$ 25 (conta Google Play, para usar o canal de teste fechado da loja).

**O que fazer**

- [ ] Pagar a conta Google Play, concluir a verificação de identidade do desenvolvedor e publicar no canal de teste fechado (conta pessoal nova precisa de pelo menos 12 testadores antes de liberar a produção — as 10 barbearias e seus clientes servem)
- [ ] Preencher na Play Console a política de privacidade e o formulário de Segurança de Dados (localização, fotos, dados de conta)
- [ ] Onboarding presencial em cada barbearia: cadastrar a casa, os barbeiros e as fotos junto com o dono
- [ ] Cartaz com QR Code no balcão: "Agende seu próximo corte pelo app"
- [ ] Ensinar clientes de iPhone a adicionar a versão web à tela de início (sem isso não chega lembrete)
- [ ] Grupo de WhatsApp com os donos para suporte e ideias
- [ ] Visita ou ligação semanal: o que travou, o que faltou
- [ ] Corrigir bugs em ciclos de 2–3 dias usando atualização pelo ar (EAS Update, sem nova versão na loja)
- [ ] **Preparar a Fase 3 em paralelo:** abrir o CNPJ, criar a conta Asaas e testar Pix e cartão no ambiente de testes; criar a conta de faturamento do Google Cloud com alerta de orçamento (a Places API exige cartão mesmo dentro da franquia gratuita); se a Apple for em nome da empresa, pedir o número D-U-N-S
- [ ] Na última semana, perguntar a cada dono: "Você pagaria R$ 29,90 / R$ 49,90 para continuar?"

**Métricas que decidem o lançamento**

| Métrica | Meta |
| --- | --- |
| Barbearias usando toda semana | 8 de 10 |
| Agendamentos pelo app por barbearia/semana | 15 ou mais |
| Faltas de clientes | Menor que antes do app (comparar com o relato do dono) |
| Tempo médio para agendar | Menos de 60 segundos |
| Donos que pagariam | 6 de 10 |
| Horários duplicados | Zero |

**Prepara a próxima com:** lista de correções, preço validado, 6+ barbearias prontas para virar as primeiras pagantes (preço de fundador) e depoimentos em vídeo para o lançamento.

**Portão para a Fase 3:** metas da tabela atingidas em pelo menos 4 de 6.

## Fase 3 — Lançamento público (fev – abr 2027)

O app passa a cobrar a mensalidade, aceita Pix e cartão, entra na App Store e liga as avaliações — a fase que transforma o piloto em negócio. Custo novo: conta Apple (US$ 99/ano) e taxas do Asaas só sobre o que entrar.

**Pagamentos e assinatura (fev)**

- [ ] Integrar o Asaas (conta aberta na Fase 2): cobrança Pix (QR + copia-e-cola), cartão tokenizado, subconta por barbearia e split
- [ ] Configuração do dono: "pagar no app" ligado/desligado, sinal opcional via Pix
- [ ] Assinatura da barbearia vendida no painel web (cartão recorrente, boleto ou Pix Automático), com 30 dias grátis e preço de fundador para os 100 primeiros
- [ ] Regras de inadimplência: aviso em 3 dias, some da busca em 10

**Confiança e descoberta (mar)**

- [ ] Avaliação mútua (cliente ↔ barbeiro), dupla-cega, só para atendimento concluído
- [ ] Nota do Google no card e no ranking (Places API, no máximo 1 consulta por dia por barbearia; guardar de forma permanente só o Place ID, conforme as regras do Google)
- [ ] Ranking "Mais bem avaliadas" com média bayesiana Google + app, e o botão "Ver mapa" da tela inicial
- [ ] Fotos do dia com aprovação do cliente e feed da barbearia

**Lojas e lançamento (abr)**

- [ ] Conta Apple Developer e publicação na App Store, com "Entrar com Apple" ao lado do Google (exigência da Apple para apps com login de terceiros) e exclusão de conta dentro do app; iniciar o cadastro em fevereiro, pois contas de empresa podem levar semanas
- [ ] Publicação aberta no Google Play (liberada após o teste fechado da Fase 2)
- [ ] Lançamento local: as barbearias do piloto divulgam no Instagram e no balcão; vídeos curtos com os depoimentos
- [ ] Programa de indicação entre donos: indicou e a outra assinou, ganha 1 mês grátis

**Prepara a próxima com:** receita recorrente, dados reais de pagamento e de no-show e uma base de clientes avaliados — tudo o que o clube de assinatura e a fidelidade da Fase 4 precisam.

**Portão para a Fase 4:** 30 barbearias pagantes e 1.000 agendamentos pelo app em um mês.

## Fase 4 — Crescimento e retenção (mai – jul 2027)

Com a base pagando, o foco vira fazer o cliente voltar e a barbearia faturar mais pelo app — o que reduz cancelamento e justifica a mensalidade. Custo: provavelmente a primeira infra paga: Firebase Blaze (por uso) quando o Firestore passar de 50 mil leituras/dia, e Workers Paid (US$ 5/mês) se passar de 100 mil requisições/dia.

**Recursos**

- [ ] **Clube de assinatura do cliente:** a barbearia cria planos (ex.: 2 cortes/mês) cobrados no automático pelo Asaas — o recurso que mais gera receita recorrente nos concorrentes
- [ ] **Lista de espera:** dia cheio → cliente entra na fila e recebe push se alguém cancelar
- [ ] **Fidelidade:** a cada 10 cortes, 1 grátis (regra definida pelo dono)
- [ ] **"Repetir último corte"** e lembrete inteligente ("faz 3 semanas do seu degradê")
- [ ] **Relatórios do dono:** faturamento por barbeiro, ocupação por horário, clientes que sumiram
- [ ] **Indicação de cliente:** convide um amigo, os dois ganham desconto no próximo corte
- [ ] Acompanhar o volume de fotos no R2: acima de 10 GB paga US$ 0,015 por GB/mês

**Prepara a próxima com:** um "manual de implantação" testado (como colocar uma barbearia nova no ar em 15 min), métricas de retenção e caixa positivo para expandir para outras cidades.

**Portão para a Fase 5:** 80 barbearias pagantes, cancelamento mensal de barbearias abaixo de 5% e receita cobrindo todos os custos fixos.

## Fase 5 — Escala (ago – out 2027)

Com o modelo provado numa região, a fase 5 repete a receita em mais 2 cidades e liga os recursos que cobram mais por barbearia. Custo: marketing local e, se preciso, um vendedor por comissão.

- [ ] **Expansão por cidade:** escolher 2 cidades vizinhas, 1 embaixador local (barbeiro respeitado) com comissão por barbearia que assinar
- [ ] **Plano Casa cheia completo:** todas as avaliações do Google (conectando a conta do dono), lembretes por WhatsApp oficial (custo repassado no plano), destaque na busca
- [ ] **Multiunidades:** dono com 2+ barbearias gerencia tudo numa conta
- [ ] **Nota fiscal de serviço** emitida pelo app (via Asaas ou integração fiscal)
- [ ] **Loja de produtos** da barbearia (pomada, óleo de barba) com retirada no balcão
- [ ] **Sugestão de corte com IA** a partir das fotos do portfólio (estudar custo antes)
- [ ] Revisar preços com base no custo real por barbearia e na concorrência

**Prepara o futuro com:** números de crescimento por cidade que permitem decidir entre seguir orgânico (com o caixa próprio) ou buscar investimento para ir a capitais.

**Meta ao fim de 12 meses:** 200 barbearias pagantes em 3 cidades.

## Custos: o que é grátis e quando começa a pagar

Até o lançamento, o gasto obrigatório total é de cerca de US$ 124 (as duas lojas); a infraestrutura só começa a cobrar quando já houver barbearias pagando.

| Item | Fase em que entra | Custo | Observação |
| --- | --- | --- | --- |
| Ferramentas de design, código, banco, push, servidor | 0 a 3 | R$ 0 | Planos gratuitos da seção Stack |
| Conta Google Play | 2 | [US$ 25, uma vez](https://magora-systems.com/google-play-developer-account-cost/) | Sem renovação |
| Conta Apple Developer | 3 | [US$ 99 por ano](https://playcode.io/blog/how-much-does-it-cost-to-publish-an-app) | Adiar até o lançamento; no piloto o iPhone usa a versão web |
| Conta de faturamento Google Cloud (Places API e mapa) | 2 (preparo) e 3 (uso) | R$ 0 dentro da franquia | Exige cartão cadastrado; criar com alerta de orçamento |
| Cloudflare R2 | 1 | R$ 0 até 10 GB | Pode pedir cartão para ativar; plano B é o Storage do Firebase |
| Domínio .com.br | 0 (opcional) | Taxa anual do Registro.br | Pode usar subdomínio gratuito até a Fase 3 |
| Registro da marca | 0 ou 3 | Taxas do INPI | Recomendado antes do lançamento público |
| CNPJ e contador | 3 | Depende da forma jurídica | Necessário para receber pagamentos com split |
| Taxas do Asaas | 3 | Por transação, sem mensalidade | Pago pela barbearia no split, não pela plataforma |
| Firebase Blaze e Workers Paid | 4 | Por uso + US$ 5/mês | Acima de 50 mil leituras/dia no Firestore ou 100 mil requisições/dia nos Workers |
| Builds extras na nuvem | 4 (opcional) | US$ 19/mês | Ou compilar no próprio computador |
| WhatsApp oficial | 5 | Por mensagem | Custo embutido no plano Casa cheia |

**Conta de equilíbrio:** com 30 barbearias numa média de R$ 45/mês (mistura dos planos), a receita é de R$ 1.350/mês — cobre com folga Apple + Firebase e Workers pagos. A margem cresce porque o custo por barbearia nova é quase zero.

## Próximos 7 dias

A primeira semana é toda gratuita e serve para destravar a Fase 0.

- [ ] **Dom 18/out** — Confirmar o nome (INPI, Registro.br, lojas) e criar Gmail e Instagram do projeto
- [ ] **Seg 19/out** — Criar contas GitHub, Expo, Firebase (Spark) e Cloudflare; listar 30 barbearias da região
- [ ] **Ter 20/out** — Montar o roteiro de entrevista (10 perguntas para donos, 8 para clientes)
- [ ] **Qua 21/out** — Visitar as 5 primeiras barbearias: entrevista + convite para o piloto
- [ ] **Qui 22/out** — Aplicar os ajustes nas 3 telas e desenhar as 6 restantes (perfil da barbearia, pagamento, agenda do barbeiro, painel do dono, perfil do cliente, entrar)
- [ ] **Sex 23/out** — Mais 5 visitas; entrevistar clientes na sala de espera
- [ ] **Sáb 24/out** — Revisar respostas, ajustar prioridades da Fase 1 e montar o backlog no GitHub Projects

## Riscos e perguntas em aberto

| Risco | Impacto | Como evitar |
| --- | --- | --- |
| Barbeiro não atualiza a agenda e marca cliente por fora | Horário duplo, cliente frustrado | Encaixe manual em 2 toques; lembrete diário ao barbeiro |
| Poucos clientes baixam o app | Barbearia não vê valor e cancela | QR no balcão, link de agendamento para a bio do Instagram, versão web sem instalar |
| Firestore passa de 50 mil leituras/dia | Leituras falham até a cota zerar no dia seguinte | Escutar só o dia aberto, cache offline, documento-resumo por barbearia; ativar o Blaze com alerta de orçamento antes do lançamento aberto |
| Mudança de preço de APIs (Google, Meta, Firebase) | Custo inesperado | Alerta de orçamento no Google Cloud; push em vez de WhatsApp |
| Rejeição na App Store | Atraso no lançamento iOS | Vender assinatura só no site; "Entrar com Apple" e exclusão de conta no app; iniciar o cadastro Apple em fevereiro |
| Concorrente baixa preço | Perda de diferencial | Diferencial na experiência (foto, 3 toques, nota Google + app), não só no preço |

**Perguntas em aberto**

- Quem desenvolve: você, um sócio, um freelancer? E com quantas horas por semana? Isso muda as datas.
- Em qual cidade ou região será o piloto?
- O nome "Navalha" continua? Se mudar, troca o título deste documento.

## Fontes

- [Firestore: cotas gratuitas](https://cloud.google.com/firestore/quotas)
- [Firebase: Cloud Storage exige plano Blaze desde 3/fev/2026](https://dev.to/androve2k/spark-vs-blaze-the-firebase-pricing-guide-i-wish-id-read-sooner-onb)
- [Cloudflare Workers: limites do plano gratuito](https://developers.cloudflare.com/workers/platform/limits) · [Cloudflare R2: plano gratuito](https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/)
- [Expo: planos e builds gratuitos](https://expo.dev/pricing.md) · [EAS Observe gratuito](https://releasebot.io/updates/expo)
- [Google Maps Platform: franquias por SKU](https://mapsplatform.google.com/lp/maps-apis/) · [Places API (New) em 2026](https://openplacesapi.com/blog/google-places-api-pricing)
- [Asaas: preços e taxas](https://www.asaas.com/precos-e-taxas)
- [WhatsApp: cobrança de mensagens de serviço a partir de 1/out/2026](https://support.zenvia.com/kb/en/article/600343/preguntas-frecuentes-nuevas-reglas-de-cobro-de-whatsapp-business)
- [Google Play: taxa de US$ 25 e testadores](https://magora-systems.com/google-play-developer-account-cost/) · [Apple: US$ 99/ano](https://playcode.io/blog/how-much-does-it-cost-to-publish-an-app)
