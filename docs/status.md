# Navalha — Status da execução

Atualizado em 18/out/2026 (Sprint 4 concluído; Firebase, R2, Worker e web ligados nos serviços reais).

Código no computador: `C:\Users\andre\AndroidStudioProjects\navalha` (no Android Studio: File › Open › pasta `android`).

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
- [ ] Testar o login num celular Android real (development build)

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
- [x] Agenda do dia do barbeiro/dono: confirmar, concluído, faltou, cancelar; filtro por barbeiro para o dono
- [x] Encaixe manual de cliente de balcão, usando a mesma trava
- [x] Regras endurecidas: ninguém trava a agenda de um barbeiro com chaves de outro; folgas só do próprio barbeiro
- [x] **Portão do sprint:** dois celulares no mesmo horário, só um consegue — provado no emulador (teste de regras) e no navegador (2 sessões confirmando ao mesmo tempo)
- [x] Testes: 20 de lógica, 19 de regras no emulador, 4 do Worker, typecheck e bundle web ok
- [x] Corrigido: o cardápio (Sprint 2) não abria na web; virou tela própria, como o expediente
- [ ] Testar num celular Android real (junto com o login, item do Sprint 1)

## Fase 1 · Sprint 4 — Cliente ✅ FINALIZADO (código)
- [x] Busca por perto com filtros: distância (1/3/5/10 km), preço, tipo de corte, aberta agora, atende ainda hoje; atalhos no Início
- [x] Perfil do cliente: foto, apelido, WhatsApp e exclusão de conta dentro do app (cancela horários futuros, tira o nome do histórico, apaga perfil e login)
- [x] Histórico do cliente com as fotos do corte
- [x] Push de lembrete: o app registra o token do FCM no login (sem Expo Push desde 18/out); o Worker (cron de hora em hora) manda 24 h e 2 h antes
- [x] Foto no "Concluído": o barbeiro tira a foto (ou conclui sem foto) e ela vai para o histórico do cliente
- [x] Painel simples do dono: clientes e previsto de hoje, faturado, faltas e corte mais pedido em 7 dias
- [x] Já pronto para a Fase 3: campo do código do Google (Place ID) no painel, eventos de uso (viu barbearia, agendou, cancelou, faltou, concluiu)
- [x] Corrigido: barbeiro não conseguia atualizar o resumo do cardápio da casa (regra de segurança)
- [x] Testes: 26 de lógica, 22 de regras, 5 do Worker, typecheck e 2 roteiros no navegador (tests/e2e)
- [x] Portão "fluxo inteiro em 3 toques": na página da barbearia, corte → horário → confirmar = 3 toques (medido no navegador)
- [ ] O mesmo fluxo num celular Android real (precisa do Firebase real e de um development build)
- [ ] Push real: testar no celular com o APK local (o envio pelo FCM já está publicado no Worker)

## Segurança (auditoria /codesec de 18/out/2026)
- [x] SEC-001 corrigido: chave de ocupação comparada pelo prefixo literal (nada de regex com dado do usuário) e barbeiro precisa ser da casa
- [x] SEC-003 corrigido: preço, duração e barbeiro da reserva conferidos com o cardápio
- [x] SEC-004 corrigido: cliente só cancela reserva de pé e futura; reserva cancelada não volta a valer
- [x] 3 testes novos em tests/regras.test.ts (falhavam antes, passam depois); regras publicadas em produção
- [x] SEC-005 (clubes só da própria casa, + teste), SEC-007 (tipo da foto pelos bytes), SEC-010 (allowBackup desligado), SEC-014 (convite com sorteio criptográfico) — 19/out
- [x] Varredura geral (19/out): expo-font que faltava instalado, SDK 58 alinhado (expo-doctor 20/20), teclado com modo imersivo, deps sem uso removidas, acessibilidade (avisos anunciados, botão desabilitado distinto, fotos descritas)
- [x] SEC-006 limite de uso (regras: 20 s entre reservas por conta; Worker: 20 fotos/min por conta, 429), SEC-008/009 (fotos da casa e do perfil só de URLs do nosso R2), SEC-016 (CORS do Worker só para navalha.web.app e localhost) — 19/out, com testes (regras 32, Worker 7)
- [x] Monitoramento de erros: falhas do app vão para a coleção `erros` (só gravação, 10 por sessão, só logado) + tela "Algo deu errado"
- [x] Lembrete na web/iPhone: PWA (manifesto + service worker do FCM); no iPhone exige o Navalha na Tela de Início e o toque em Perfil › Lembretes
- [x] Identidade: títulos em Barlow Condensed; vibração curta ao confirmar reserva/encaixe
- [ ] SEC-002: chave de assinatura própria (dono) · App Check: API ligada, **não** ativar a obrigatoriedade antes de integrar no app (depende da SEC-002)
- [ ] `npm audit`: avisos restantes vêm de dependências do Expo; resolver na próxima atualização do SDK

## Adiantado da Fase 3: mensalidades (decisão do dono, 20/out/2026)
- [x] Planos Solo R$ 25 (1), Equipe R$ 70 (3), R$ 100 (6) e R$ 150 (10) em `src/lib/planos.ts`; 60 dias grátis na primeira casa da conta
- [x] Google Play Billing (expo-iap, sem conta Expo) + conferência no Worker (`/assinatura/verificar`, Android Publisher API)
- [x] Limite de barbeiros garantido nas regras (contador `barbeirosAtivos` andando junto com a equipe); baixar de plano exige o dono escolher quem fica
- [x] Casa sem teste/plano em dia sai da busca (`emDia`, só o servidor grava; cron de hora em hora)
- [x] Testes: lógica 36, regras 36, Worker 10; migração das casas antigas rodada; regras, índices, Worker e web publicados
- [ ] Play Console (dono): conta, AAB no teste interno, 4 assinaturas, API e acesso do Worker — passo a passo em `docs/play-billing.md`
- [ ] Nomes dos planos de R$ 100 e R$ 150 (hoje provisórios: Casa e Casa cheia)

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
4. [x] Versão web publicada em **https://navalha.web.app** (Firebase Hosting, plano gratuito; `npx expo export --platform web && npx firebase deploy --only hosting --project prod`); domínio autorizado no login do Firebase. A versão antiga na Cloudflare (navalha-web) foi desativada em 19/out; o Worker de fotos e lembretes segue lá. Falta o dono entrar com Google uma vez para conferir.
   - Corrigido: `src/services/firebase.ts` lia `env.EXPO_PUBLIC_*` por um apelido de `process.env`, que o Expo não embute no build; o app real cairia no emulador.
5. Colocar 3 barbearias amigas para usar de 28/dez a 3/jan.

## Próximo no roadmap: Fase 2 — Piloto fechado (4/jan – 7/fev 2027)
Conta Google Play (US$ 25), teste fechado com 12+ testadores, onboarding presencial de 10 barbearias, correções por nova versão no Play (sem EAS Update), e preparar a Fase 3 (CNPJ, Asaas, faturamento Google Cloud).
