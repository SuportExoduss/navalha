# Navalha — Status da execução

Atualizado em 23/out/2026 (MVP completo e testado no celular; avaliação única da barbearia, política v2 e termos de uso no ar).

Código no computador: `C:\Users\andre\AndroidStudioProjects\navalha` (no Android Studio: File › Open › pasta `android`).

## Onde estamos (23/out/2026, validado contra o código)
| Fase | Calendário | Código | Falta |
| --- | --- | --- | --- |
| 0 · Fundação | 19/out – 1/nov | modelo de dados e contas técnicas prontos | dono: entrevistas, INPI/nome (conflito na classe 44), landing, contador; termos e política v2 no ar |
| 1 · MVP | 2/nov – 27/dez | **100%** (adiantado ~6 semanas) + extras | portão: 3 barbearias amigas por 1 semana; cronometrar um dono montando a casa |
| 2 · Piloto | jan – fev/2027 | código pronto (AAB assinado, privacidade, exclusão de conta, acesso de revisão) | dono: teste fechado com 12 testadores/14 dias, onboarding das 10 barbearias, cartaz com QR |
| 3 · Lançamento | — | **fora do plano** (decisão do dono, 20/out) | ficam, já feitos: mensalidades pelo Google Play e avaliação da barbearia + ranking (sem Google) |
| 4 · Crescimento | — | **fora do plano** | — |
| 5 · Escala | — | **fora do plano** | — |

Requisitos da Google Play: `docs/publicar-google-play.md`. Pacote definitivo `com.trevotec.navalha`; `android/` versionada (abre direto no Android Studio).

## Fase 0 — Fundação
- [x] Desenhar o modelo de dados completo (inclui pagamentos, avaliações e assinaturas) — `docs/modelo-de-dados.md` no código
- [ ] Demais itens (entrevistas, nome, contas, termos, backlog) — dependem do dono do projeto

## Fase 1 · Sprint 1 — Base (código concluído)
- [x] Projeto Expo (Android, iOS, web) com Expo Router
- [x] Tema grafite + âmbar e navegação por papel
- [x] Login Google (web e nativo) com Firebase Auth
- [x] Escolha de papel e troca de modo no perfil
- [x] Regras de segurança do Firestore e índices
- [x] Emulador local do Firebase configurado
- [x] Worker de upload para o R2 + lembretes push (adiantado do Sprint 4)
- [x] Lógica de horários e trava contra horário duplo (adiantado do Sprint 3)
- [x] Testes das regras no emulador: 9 de 9 passando (17/out); conferido que uma regra enfraquecida faz o teste falhar
- [x] Ligar o projeto Firebase real e o bucket R2 (18/out: `navalha-1a8f5`, bucket `navalha-fotos`)
- [x] Testar o login num celular Android real (18/out, Redmi Note 13, APK local)

## Fase 1 · Sprint 2 — Barbearia (código concluído)
- [x] Cadastro da barbearia com localização pelo GPS do celular do dono (sem mapa pago)
- [x] Foto de capa e publicação com checklist (capa + pelo menos 1 corte)
- [x] Convite de barbeiros por código de 6 letras, uso único, 7 dias
- [x] Equipe com barbeiro ativo/inativo
- [x] Cardápio do barbeiro: preço, tempo médio, categoria, até 6 fotos, pausar
- [x] Página pública da barbearia com rota Google Maps/Waze e WhatsApp
- [x] 12 testes de lógica e 9 testes de regras passando
- [ ] Cronometrar um dono real montando a casa em menos de 10 min

## Fase 1 · Sprint 3 — Agenda ✅ FINALIZADO (código)
- [x] Expediente semanal editável do barbeiro e da casa (vale o cruzamento dos dois, com as pausas de ambos)
- [x] Folgas de dia inteiro, de vários dias ou por horário
- [x] Tela de horários livres por dia (Manhã/Tarde/Noite), respeitando antecedência e janela da casa
- [x] Reservar com trava contra horário duplo; aviso "acabou de ser ocupado" e grade recarregada
- [x] Meus agendamentos do cliente (próximos e histórico) com cancelamento e aviso da política de 2 h
- [x] Agenda do dia do barbeiro/dono: concluído, faltou, cancelar ("Confirmar" removido em 20/out); filtro por barbeiro para o dono
- [x] Encaixe manual de cliente de balcão, usando a mesma trava
- [x] Regras endurecidas: ninguém trava a agenda de um barbeiro com chaves de outro; folgas só do próprio barbeiro
- [x] **Portão do sprint:** dois celulares no mesmo horário, só um consegue — provado no emulador (teste de regras) e no navegador (2 sessões confirmando ao mesmo tempo)
- [x] Testes: 20 de lógica, 19 de regras no emulador, 4 do Worker, typecheck e bundle web ok
- [x] Corrigido: o cardápio (Sprint 2) não abria na web; virou tela própria, como o expediente
- [x] Testar num celular Android real (18–19/out: reserva, cancelamento, encaixe, roteiro docs/teste-manual.md)

## Fase 1 · Sprint 4 — Cliente ✅ FINALIZADO (código)
- [x] Busca por perto com filtros: distância (Todas, 1/3/5/10/50 km; desde 20/out todas as casas aparecem, da mais perto para a mais longe), preço, tipo de corte, aberta agora, atende ainda hoje; atalhos no Início
- [x] Perfil do cliente: foto, apelido, WhatsApp e exclusão de conta dentro do app (cancela horários futuros, tira o nome do histórico, apaga perfil e login)
- [x] Histórico do cliente com as fotos do corte
- [x] Push de lembrete: o app registra o token do FCM no login (sem Expo Push desde 18/out); o Worker (cron de hora em hora) manda 24 h e 2 h antes
- [x] Foto no "Concluído": o barbeiro tira a foto (ou conclui sem foto) e ela vai para o histórico do cliente
- [x] Painel simples do dono: clientes e previsto de hoje, faturado, faltas e corte mais pedido em 7 dias
- [x] Já pronto para a Fase 3: campo do código do Google (Place ID) no painel, eventos de uso (viu barbearia, agendou, cancelou, faltou, concluiu)
- [x] Corrigido: barbeiro não conseguia atualizar o resumo do cardápio da casa (regra de segurança)
- [x] Testes: 26 de lógica, 22 de regras, 5 do Worker, typecheck e 2 roteiros no navegador (tests/e2e)
- [x] Portão "fluxo inteiro em 3 toques": na página da barbearia, corte → horário → confirmar = 3 toques (medido no navegador)
- [x] O mesmo fluxo num celular Android real (18/out; desde 20/out são 3 telas: barbeiro → corte → horário + confirmação)
  - 21/out: a promessa do login virou "em 3 passos" (são 4 toques a partir da barbearia: barbeiro, corte, horário, confirmar)
- [x] Dogfood na web (21/out, relatório local em `dogfood-output/`, fora do git): 5 achados médios corrigidos e conferidos
  no navegador (3 passos, tela pequena, página de rota inexistente, barbearia não encontrada, foco da busca); os 6 baixos seguem abertos.
  Build de teste contra o emulador: passar também `EXPO_PUBLIC_WORKER_URL=http://127.0.0.1:9` para não chamar o Worker real.
- [ ] Push real: testar no celular com o APK local (o envio pelo FCM já está publicado no Worker)

## Segurança (auditoria /codesec de 18/out/2026)
- [x] SEC-001 corrigido: chave de ocupação comparada pelo prefixo literal (nada de regex com dado do usuário) e barbeiro precisa ser da casa
- [x] SEC-003 corrigido: preço, duração e barbeiro da reserva conferidos com o cardápio
- [x] SEC-004 corrigido: cliente só cancela reserva de pé e futura; reserva cancelada não volta a valer
- [x] 3 testes novos em tests/regras.test.ts (falhavam antes, passam depois); regras publicadas em produção
- [x] SEC-005 (clubes só da própria casa; regra e teste removidos em 25/out junto com o clube, fora do plano), SEC-007 (tipo da foto pelos bytes), SEC-010 (allowBackup desligado), SEC-014 (convite com sorteio criptográfico) — 19/out
- [x] Varredura geral (19/out): expo-font que faltava instalado, SDK 58 alinhado (expo-doctor 20/20), teclado com modo imersivo, deps sem uso removidas, acessibilidade (avisos anunciados, botão desabilitado distinto, fotos descritas)
- [x] SEC-006 limite de uso (regras: 20 s entre reservas por conta; Worker: 20 fotos/min por conta, 429), SEC-008/009 (fotos da casa e do perfil só de URLs do nosso R2), SEC-016 (CORS do Worker só para navalha.web.app e localhost) — 19/out, com testes (regras 32, Worker 7)
- [x] Monitoramento de erros: falhas do app vão para a coleção `erros` (só gravação, 10 por sessão, só logado) + tela "Algo deu errado"
- [x] Lembrete na web/iPhone: PWA (manifesto + service worker do FCM); no iPhone exige o Navalha na Tela de Início e o toque em Perfil › Lembretes
- [x] Identidade: títulos em Barlow Condensed; vibração curta ao confirmar reserva/encaixe
- [x] SEC-002: chave de upload própria (`navalha-upload`, fora do git; SHA-1/256 no Firebase)
- [x] Revisão da auditoria externa (21/out), com testes (regras 41, falhavam antes): SEC-017 os blocos da reserva precisam
  ser os do horário (1º = início, último = o que cobre o fim, quantidade certa, início no passo da casa; antes dava para
  travar blocos de outro horário e marcar por cima de alguém); serviço desativado e barbeiro desligado não recebem reserva;
  motivo da folga saiu de `bloqueios` (todo cliente lê) para `motivosFolga` (só dono e barbeiro); release sem
  `android/keystore.properties` agora falha no Gradle em vez de assinar com a chave de debug. **Falta publicar as regras**
  (`npx firebase deploy --only firestore:rules --project prod`). Brecha restante (ponytail): blocos do meio não são lidos.
- [ ] App Check (avaliado em 23/out): fica para depois do app estar no teste interno do Play. No Android ele usa o Play
  Integrity, que só aprova o app instalado pelo Play, e pede um módulo nativo novo (`@react-native-firebase/app-check`,
  ligado ao SDK web por um CustomProvider); na web, uma chave reCAPTCHA. API ligada; **não** ativar a obrigatoriedade
  antes de integrar no app e no Worker
- [x] `npm audit` (23/out): correções sem quebra aplicadas (Expo 58 e Firebase 13 em versões de correção, pacotes do Expo
  alinhados com `expo install --fix`). Os 24 avisos restantes estão em ferramentas de build (Expo CLI, Firebase CLI) e em
  código só do Node; não vão no app. O `--force` rebaixaria para Expo 44 e Firebase 9: não usar

## Adiantado da Fase 3: mensalidades (decisão do dono, 20/out/2026)
- [x] Planos Solo R$ 25 (1), Equipe R$ 70 (3), R$ 100 (6) e R$ 150 (10) em `src/lib/planos.ts`; 60 dias grátis na primeira casa da conta
- [x] Google Play Billing (expo-iap, sem conta Expo) + conferência no Worker (`/assinatura/verificar`, Android Publisher API)
- [x] Limite de barbeiros garantido nas regras (contador `barbeirosAtivos` andando junto com a equipe); baixar de plano exige o dono escolher quem fica
- [x] Casa sem teste/plano em dia sai da busca (`emDia`, só o servidor grava; cron de hora em hora)
- [x] Testes: lógica 36, regras 36, Worker 10; migração das casas antigas rodada; regras, índices, Worker e web publicados
- [ ] Play Console (dono): conta, AAB no teste interno, 4 assinaturas, API e acesso do Worker — passo a passo em `docs/play-billing.md`
- [x] Nomes dos planos (25/out): Solo, Equipe, Time (R$ 100, `navalha_time`) e Casa cheia (R$ 150)
- [x] As 4 assinaturas criadas e ativas no Play Console (25/out, pela Android Publisher API): plano base `mensal`, renovação automática, só no Brasil, em BRL

## Agendar pelo WhatsApp (plano A em `docs/whatsapp-agendamento.md`)
- [x] Plano A (custo zero): em Configurações, link da casa (`navalha.web.app/barbearia/{id}`) e texto pronto para a saudação do WhatsApp Business / IA da Meta, com botão Compartilhar (decisão do dono: só o plano A)

## Avaliações, nota Google e ranking (da Fase 3, trazidos de volta pelo dono em 20/out/2026)
> Histórico. Substituído em 22/out pela seção "Reestruturação das avaliações" abaixo: sem Google, sem avaliar cliente ou barbeiro.
- [x] Cliente avalia o atendimento concluído (1–5 estrelas + comentário opcional, até 30 dias, uma vez) no histórico; o Worker (`POST /avaliacoes`) confere e soma as notas da casa e do barbeiro
- [x] Página da casa: nota do Navalha e do Google, nota de cada barbeiro e as 5 avaliações mais recentes (primeiro nome do cliente)
- [x] Nota do Google: o cron do Worker consulta a Places API (New) 1 vez por dia por casa com o código do Google em Configurações (5 casas por hora)
- [x] Ranking "Mais bem avaliadas" (Início e Explorar): média bayesiana app + Google, calculada pelo Worker
- [x] Regras: notas, total de avaliações, nota do Google e ranking só o servidor grava; casa não nasce com nota; ninguém cria avaliação pelo app
- [x] Testes: lógica 45, regras 39, Worker 13; conferido no navegador (avaliar, página da casa, ranking)
- [x] 22/out (pedido do dono, roteiro em `docs/roadmap-avaliacoes.md`): avaliações em três direções. Cliente → barbeiro
  (nota interna, `equipePrivado`), cliente → barbearia (pública, ranking) e barbeiro → cliente (o cliente vê no Perfil;
  a casa vê a média no agendamento); cancelamento também avalia (quem foi cancelado avalia quem cancelou); aba
  Avaliações no modo casa; "Pedir avaliação ao cliente" em Configurações; "Publicar também no Google" (copia o
  comentário e abre a janela do Google: o Google não aceita preenchimento automático nem publicação por app)
- [x] 22/out, mesmo roteiro: contorno âmbar em todos os campos; sino com bolinha no Início; abertura nova (transição,
  1,35 s logado, toque pula); capa (banner) no perfil do cliente e no cartão do barbeiro; ficha do barbeiro para o
  dono (foto, capa, telefone, nota, avaliações); seguir cortes (iniciar → tela do corte atual → finalizar → avaliar
  o cliente; um corte aberto por barbeiro). Testes: lógica 50, regras 47, Worker 13; conferido no navegador
- [x] Publicado em 22/out: regras + índices, Worker (versão 65f47711) e web (navalha.web.app). Conferido sem login:
  Worker recusa sem token; regras liberam só a avaliação pública da barbearia; site com a página nova de link quebrado
- [ ] Dono: gerar APK/AAB novo (subir `versionCode`) e testar com a conta real: avaliar e editar, capa, seguir cortes

## Extras de 20/out/2026 (fora do roadmap original, no ar)
- [x] Notificações: sino com painel lateral na Agenda (dono e barbeiro) e em Agendamentos (cliente); push na hora de marcado/cancelado para os outros lados (cliente, barbeiro, dono); resumo do mês no dia 1 para o dono
- [x] Poderes separados nas regras: barbeiro lê e mexe só nos próprios horários; convites, equipe, Configurações, plano, exclusão e números da casa só do dono (testado em tests/regras.test.ts)
- [x] Ícone monocromático nas notificações do Android
- [x] Testes: lógica 40, regras 38, Worker 11; regras, índices, Worker e web publicados
- [ ] Testar no celular com 3 contas (cliente, barbeiro, dono): push de marcado/cancelado e agenda do barbeiro só com os horários dele
- [x] Push com o app fechado (25/out): o servidor entrega na hora, mas a Xiaomi (e outras marcas) descarta o push depois de reiniciar sem o app aberto. Ao escolher barbeiro/dono no Android, a tela `/bateria` mostra os passos da marca (`src/lib/bateria.ts`) e abre os ajustes do app; atalho fixo no Perfil. Sem a permissão de ignorar otimização de bateria (política da Play)
- [x] Botões que levam direto à tela certa (25/out, `expo-intent-launcher`): restrição de bateria do Navalha e, onde é separado, início automático. Mapa por marca em `src/lib/bateria.ts` (Xiaomi, Samsung, Oppo/Realme/OnePlus, Vivo, Huawei/Honor, Asus; demais = tela padrão do Android), com reservas até os detalhes do app. Xiaomi e tela padrão testadas pelo adb no Redmi (HyperOS 2, Android 15)
- [ ] Conferir no Redmi com o APK novo: liberar, reiniciar, não abrir o app e receber o aviso

## LGPD — auditoria /codelgpd (22/out/2026)
Relatório na conversa de 22/out (12 achados, L01–L12; não é parecer jurídico). Etapa 1 = correções de código.
- [x] L01 Exclusão de conta completa: `POST /conta/excluir` no Worker (`worker/src/conta.ts`) anonimiza histórico e
  avaliações (sem nome nem foto), apaga nota do cliente, avisos, perfil e fotos no R2 (perfil, capa, cortes); barbeiro
  (não dono) sai da equipe e perde nome, fotos e telefone. O app cancela os horários futuros, chama o Worker e só então
  apaga o login. Página `/excluir-conta` reescrita para bater com o código
- [x] L02 `notasCliente`: só o próprio cliente ou quem é de verdade de uma barbearia lê (o `barbearias` do perfil é
  editável, então a regra confere a equipe). Limite: barbeiro de qualquer casa ainda lê a nota de qualquer cliente
- [x] L04 Prazos de guarda no cron: `eventos` e `erros` 12 meses, `notificacoes` 90 dias (até 500 por coleção/hora);
  prazos citados na política de privacidade
- [x] L12 `fotosNoPortfolio` começa desligado
- [x] Testes: lógica 53, regras 47, Worker 16. Publicado em 22/out: Worker (versão 17f98175), regras + índices e web.
  Conferido no ar: `/conta/excluir` recusa sem token; o site publicado chama a rota nova
- [x] Avaliação pública (da barbearia) sem foto, capa nem uid do cliente: só o primeiro nome (qualquer um lê o
  documento); a exclusão de conta acha pelo id. Worker 16, regras 47; Worker publicado em 22/out (versão 8f7979e1).
  As públicas gravadas antes disso ainda têm esses campos (limpeza única, se precisar)
- [x] Rascunho da política de privacidade v2 em `.lgpd/policies/privacy-policy-v2-draft.md` (para o advogado)
- [x] Dono: testou a exclusão de conta com uma conta descartável (25/out): excluiu e cancelou os horários
- [x] Etapa 2 (23/out, decisões do dono): política v2 publicada (`/privacidade`, com bases legais, encarregado, onde os
  dados ficam e incidentes), Termos de uso com as regras para barbearias (`/termos`, aceitos no login e ao criar a casa),
  idade mínima 18 anos, roteiro e registro de incidentes (`.lgpd/incidentes.md`), registro das decisões
  (`.lgpd/policies/privacy-policy-v2.md`). Firestore confirmado em São Paulo (southamerica-east1)
- [x] Termos de tratamento de dados (23/out): no Console do Firebase (Configurações › Privacidade dos dados) não há aceite
  à parte; valem com os termos do Firebase. A Cloudflare inclui o DPA no contrato self-serve. Opcional: desligar o uso
  dos "Dados de Serviço do Firebase" para serviços do Google fora do Firebase (mesma tela)
- [ ] Dono: marca "Navalha" no INPI está livre nas classes de software (9 e 42), mas há registro em vigor na classe 44
  (serviços de barbearia, NAVALHA BARBEARIA LTDA): consultar advogado antes de pedir o registro
- [x] Sem advogado (decisão do dono, 25/out): as posições adotadas e o motivo de cada uma estão no fim de
  `.lgpd/policies/privacy-policy-v2.md`
- [x] Etapa 3 (23/out): mapa de dados (`.lgpd/data-map.md`) e registro das operações com teste de legítimo interesse
  (`.lgpd/ropa.md`), conferidos com o código. A política deixou de dizer que a barbearia vê a foto do cliente (não vê)
- [x] Reavaliação /codelgpd (25/out), tudo pedido pelo dono:
  - Idade mínima de verdade: tela `/idade` pede a data de nascimento no 1º acesso (e a quem já tinha conta), guarda só
    `maiorDeIdadeEm`; menor tem conta e dados apagados (com plano B no app se o Worker falhar). As regras barram reserva
    sem a declaração (app antigo também). Conferido no navegador com o emulador: link direto cai em `/idade`; adulto segue;
    menor some do banco e do login
  - WhatsApp do cliente só no horário: o cron apaga `clienteTelefone` 24 h depois do fim; barbeiro desligado ou fora da
    casa perde na hora o acesso aos agendamentos (`barbeiroAtivo` nas regras); regra explícita nos Termos
  - Avaliação guarda só as estrelas (sem nome, comentário, dia); a página e o card mostram média e quantidade
  - Limpeza diária do legado (nota do cliente, avaliações entre cliente e barbeiro, nome/comentário antigos) e dos
    convites vencidos; convites apagados na exclusão da casa
  - Acesso e portabilidade (L05): Perfil › "Baixar meus dados" (`GET /conta/dados` no Worker, JSON com tudo)
  - Política, Termos, `data-map.md`, `ropa.md` e modelo de dados atualizados. Testes: lógica 57, regras 49, Worker 19
- [x] Publicado em 25/out (autorizado pelo dono): Worker (versão aa79689b), regras + índices e web. Conferido no ar:
  `/conta/dados` e `/conta/excluir` recusam sem login (401); o site publicado tem a tela `/idade` e "Baixar meus dados"
- [ ] Dono: gerar APK novo (o antigo não tem a tela de idade; até atualizar, declarar a idade uma vez pelo site libera a reserva)

## Reestruturação das avaliações (decisão do dono, 22/out/2026)
Substitui a seção "Avaliações, nota Google e ranking" acima e o `docs/roadmap-avaliacoes.md`.
- [x] Saíram as avaliações cliente → barbeiro e barbeiro → cliente, a nota do cliente (`notasCliente`, `users.notaCliente`),
  a nota do barbeiro e a aba Avaliações do modo casa. O Worker responde 410 a `alvo: 'cliente'` (app antigo)
- [x] Saiu tudo do Google: nota, Place ID nas Configurações, cron do Places, "Publicar no Google" e o `expo-clipboard`
- [x] Uma avaliação por cliente por barbearia (id = hash de casa + cliente, sem uid no documento público). Avaliar de novo
  edita ("Salvar nova avaliação" / "Cancelar edição"); "Como foi o corte?" só aparece para quem ainda não avaliou a casa
- [x] Nota mostrada = média pura 0,0–5,0 com a quantidade; a busca ordena pela média bayesiana (1 avaliação 5★ não passa 80 de 4,8)
- [x] ~~Aba "Avaliações (n)" na página pública da barbearia~~ — retirada em 25/out (decisão do dono): a página e o card mostram só as estrelas da média, sem quem avaliou nem quantos; o formulário pede só as estrelas; regras fecham a leitura de `avaliacoes`; política de privacidade atualizada (vigência 25/out)
- [x] Exclusão de conta: a avaliação fica assinada "Cliente"; fotos no R2 apagadas; o barbeiro sai da equipe; o dono precisa
  excluir a barbearia antes (o app confere antes de cancelar qualquer horário)
- [x] Política de privacidade e página de exclusão atualizadas
- [x] Testes: lógica 50, regras 47, Worker 15, typecheck e export web; conferido no navegador com o emulador
- [x] Publicado em 22/out: regras + índices, Worker (versão 3f5e37f6) e web. Conferido no ar: rotas recusam sem login,
  site com a tela nova, `notasCliente` fechada. Ficaram 4 índices antigos sem uso no Firebase (só saem com `--force`)
- [x] Limpeza em produção (22/out): 1 avaliação de teste apagada, marca antiga tirada de 1 agendamento, nota da casa zerada

## 25/out/2026 (pedidos do dono, no ar)
- [x] App menor: ícones e fonte Barlow importados por arquivo (~3,5 MB a menos de fontes)
- [x] Revisão de código: excluir barbearia apaga antes as avaliações e as fotos da casa e do cardápio (`POST /barbearia/excluir`);
  avaliação editada volta ao topo; um pedido de avaliação por casa
- [x] Página da casa: "Ver no mapa" (pergunta Google Maps, Waze ou Uber, se instalados) no lugar de Google Maps + Waze
- [x] Saiu a foto do corte ao finalizar (app, regras e Worker); no site as fotos não têm "salvar imagem"
- [x] Publicado: regras, Worker (versão bc148a0e) e web. Produção limpa: 1 foto de corte apagada do R2 e o campo de
  foto tirado dos 15 agendamentos
- [ ] Dono: APK/AAB novo (o "Ver no mapa" com Waze/Uber depende do AndroidManifest novo)

## Fase 1 — o que falta para o portão da Fase 2
O código do MVP está completo. O portão é "3 barbearias amigas usando por 1 semana sem erro grave e nenhum horário duplicado".
Para isso, nesta ordem:
1. [x] Projeto Firebase real `navalha-1a8f5` (Spark): Google Login ativo, regras e índices publicados (`npx firebase deploy --only firestore --project prod`). Chaves em `.env.local` (fora do git). O `default` do `.firebaserc` segue `demo-navalha` para os testes nunca tocarem o real.
2. [x] Bucket R2 `navalha-fotos` + Worker publicado em https://navalha-worker.navalha-worker.workers.dev (cron de lembretes de hora em hora). Conta de serviço `navalha-worker@navalha-1a8f5.iam.gserviceaccount.com` (papel Cloud Datastore User) guardada como segredo do Worker; acesso ao Firestore conferido.
3. [x] APK Android gerado localmente, sem conta Expo (18/out): `android/app/build/outputs/apk/release/app-release.apk` (28,8 MB, arm64), apontando para o Firebase e o Worker reais; SHA-1 da chave cadastrado no Firebase. **Só para o celular do dono:** assinado com a chave pública de debug (SEC-002).
   - [x] Teste real no celular (18/out, Redmi Note 13): login Google, criação da barbearia, capa enviada ao R2, cardápio, publicação, reserva em 3 toques, cancelamento (blocos liberados), lembrete de 2 h entregue pelo cron do Worker às 20:06.
   - [x] Foto no "Concluído" → aparece no histórico do cliente; Faltou; painel do dono; lembrete com o app fechado (19/out)
   - [x] Rodada completa do roteiro docs/teste-manual.md pelo adb (19/out): 9 bugs achados e corrigidos; falta só o que exige 2ª conta, câmera, iPhone ou ficar sem internet
   - Bugs achados e corrigidos no teste: Firestore travava no Android (long polling), capa recusada pelo Worker (tipo pelos bytes), permissão de push engolida no 1º login, falha do FCM silenciosa no Worker (agora vai para o log).
4. [x] Versão web publicada em **https://navalha.web.app** (Firebase Hosting, plano gratuito; `npm run export:web && npx firebase deploy --only hosting --project prod`; o `export:web` move as fontes para fora de `assets/node_modules`, que o Hosting não publica — corrigido em 25/out); domínio autorizado no login do Firebase. A versão antiga na Cloudflare (navalha-web) foi desativada em 19/out; o Worker de fotos e lembretes segue lá. Falta o dono entrar com Google uma vez para conferir.
   - Corrigido: `src/services/firebase.ts` lia `env.EXPO_PUBLIC_*` por um apelido de `process.env`, que o Expo não embute no build; o app real cairia no emulador.
5. Colocar 3 barbearias amigas para usar de 28/dez a 3/jan.

## Próximo no roadmap: Fase 2 — Piloto fechado (4/jan – 7/fev 2027)
Teste fechado com 12+ testadores por 14 dias (conta Play e fichas já em andamento), onboarding presencial de 10 barbearias,
correções por nova versão no Play (sem EAS Update; subir `versionCode` a cada AAB — hoje 3 (0.3.0) em `android/app/build.gradle`; no Play: 1 no teste interno, 2 em rascunho no fechado).
Depois do piloto: publicação aberta no Google Play. As Fases 3 a 5 estão fora do plano por enquanto (decisão do dono, 20/out/2026).
