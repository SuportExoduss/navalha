# Navalha — Status da execução

Atualizado em 18/out/2026 (Sprint 4 concluído; Firebase, R2, Worker e web ligados nos serviços reais).

Código no computador: `C:\dev\navalha` (caminho curto: o build Android no Windows falha com caminhos longos).

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
- [ ] SEC-002: chave de assinatura própria (dono) · SEC-005/006 e endurecimento: pendentes

## Fase 1 — o que falta para o portão da Fase 2
O código do MVP está completo. O portão é "3 barbearias amigas usando por 1 semana sem erro grave e nenhum horário duplicado".
Para isso, nesta ordem:
1. [x] Projeto Firebase real `navalha-1a8f5` (Spark): Google Login ativo, regras e índices publicados (`npx firebase deploy --only firestore --project prod`). Chaves em `.env.local` (fora do git). O `default` do `.firebaserc` segue `demo-navalha` para os testes nunca tocarem o real.
2. [x] Bucket R2 `navalha-fotos` + Worker publicado em https://navalha-worker.navalha-worker.workers.dev (cron de lembretes de hora em hora). Conta de serviço `navalha-worker@navalha-1a8f5.iam.gserviceaccount.com` (papel Cloud Datastore User) guardada como segredo do Worker; acesso ao Firestore conferido.
3. [ ] `npx eas-cli@latest login` (dono) → `eas init` e `eas build --profile development` para Android; registrar o SHA-1 do build no Firebase para o login Google nativo; testar login, reserva, push e foto no celular.
4. [x] Versão web publicada em https://navalha-web.navalha-worker.workers.dev (`npx expo export --platform web && npx wrangler deploy -c web.wrangler.toml`); domínio autorizado no login do Firebase. Falta o dono entrar com Google uma vez para conferir.
   - Corrigido: `src/services/firebase.ts` lia `env.EXPO_PUBLIC_*` por um apelido de `process.env`, que o Expo não embute no build; o app real cairia no emulador.
5. Colocar 3 barbearias amigas para usar de 28/dez a 3/jan.

## Próximo no roadmap: Fase 2 — Piloto fechado (4/jan – 7/fev 2027)
Conta Google Play (US$ 25), teste fechado com 12+ testadores, onboarding presencial de 10 barbearias, correções por nova versão no Play (sem EAS Update), e preparar a Fase 3 (CNPJ, Asaas, faturamento Google Cloud).
