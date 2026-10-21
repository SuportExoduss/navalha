# Navalha — guia para o Claude Code

App de agendamento para barbearias (Expo/React Native + Firebase Spark + Cloudflare R2/Workers).
Leia também `AGENTS.md` (regras do Expo SDK 58: não confie na memória, consulte a doc da versão).

## Onde estamos
- Roadmap completo: `docs/roadmap.md` (6 fases, out/2026 → out/2027). Andamento: `docs/status.md`.
- **Fase 1 (MVP): código dos 4 sprints concluído** (Base, Barbearia, Agenda, Cliente).
- Falta para fechar a Fase 1: ligar Firebase/R2/Worker reais, APK Android gerado localmente (sem conta Expo, ver README),
  testar no celular e rodar com 3 barbearias amigas (portão da Fase 2). Itens da Fase 0 que dependem do dono
  (entrevistas, nome no INPI, termos/LGPD, contas) seguem abertos.
- Próxima fase: **Fase 2 (piloto)**, código pronto; o resto é do dono (teste fechado no Play, barbearias).
- **Fases 3, 4 e 5 estão fora do plano** (decisão do dono, 20/out/2026): não proponha nem construa pagamento do corte,
  avaliações, nota Google, iOS, clube, fidelidade, multiunidades etc. sem o dono pedir. As mensalidades pelo Google Play ficam.

## Sem conta Expo (decisão do dono)
Não use EAS (build, update, submit) nem Expo Push, mesmo que o AGENTS.md sugira. Build Android local (`npx expo prebuild` + Gradle/Android Studio); push pelo FCM direto do Worker.
Pacote: `com.trevotec.navalha`. A pasta `android/` é versionada (abre direto no Android Studio): mudança nativa vai nela
(e no plugin/app.json correspondente). **Não rode `npx expo prebuild`** (nem sem `--clean`): no SDK 58 ele tenta apagar a pasta
`android/` inteira. Ex.: o ícone de notificação foi posto à mão em `res/drawable-*/notification_icon.png` + AndroidManifest.

## Regra do projeto
Seguir o roadmap em ordem, garantir que cada item está concluído e testado, e então marcar como finalizado
em `docs/status.md` (e no arquivo de status do projeto, se houver). Não pular portões entre fases.

## Comandos (rodar na pasta do projeto)
```bash
npm test               # lógica pura (src/lib, src/services) — tsx --test
npm run typecheck
npm run test:regras    # regras do Firestore no emulador (precisa de Java 21+)
cd worker && npm test && npm run typecheck
npx expo export --platform web   # garante que o bundle compila
```
Ponta a ponta no navegador: `tests/e2e/LEIAME.md` (Playwright + emulador; login injetado, sem pop-up Google).
Antes de dizer que algo está pronto: testes, typecheck, regras e export web passando.

## Convenções do código
- Tudo em português (nomes de funções, variáveis, textos). Comentários curtos explicando o *porquê*.
- Dinheiro sempre em **centavos** (`precoCentavos`); datas como `Millis` (número) e `ISODate` "YYYY-MM-DD".
- Fuso fixo de Brasília (UTC−3, sem horário de verão): use `paraMillis`, `dataLocal`, `formatarHora` de `src/lib/agenda.ts`.
- Lógica pura fica em `src/lib/*.ts` com teste ao lado (`*.test.ts`); Firebase só em `src/services/`.
- Telas em `src/app/` (Expo Router). **Não use abas ocultas (`href: null`)**: na web elas redirecionam.
  Subtelas (cardápio, expediente, agendar) ficam na raiz de `src/app/` com botão voltar.
- UI: componentes de `src/components/ui.tsx` e tema de `src/theme.ts` (grafite + âmbar; âmbar só para ação/seleção).
- **Dois temas (escuro e claro)**, escolhidos no Perfil (seguir o celular / escuro / claro, `TemaProvider`). Nunca escreva cor fixa
  (hex/rgba) em tela: leia `colors.x` na hora de desenhar (nada de `StyleSheet.create` ou constante de módulo com cor).
  Sobre foto use `sobreFoto` (véu escuro + texto claro nos dois temas). Paleta nova passa por `src/lib/contraste.test.ts`.
- Firestore não aceita `undefined`: omita o campo (`...(x ? { x } : {})`).

## Regras de negócio que não podem quebrar
- **Trava contra horário duplo**: reservar cria o agendamento e um doc `ocupacao/{barbeiro_data_HHMM}` por bloco de
  `passoMin` na MESMA transação (`src/services/agendamentos.ts › reservar`). Encaixe de balcão usa a mesma função.
  Cancelar libera os blocos na mesma transação. Testado em `tests/regras.test.ts` e `tests/e2e/sprint3-agenda.cjs`.
- Horários livres = expediente do barbeiro ∩ expediente da casa − ocupação − folgas (`horariosLivres`).
- Toda mudança em `firestore.rules` precisa de teste em `tests/regras.test.ts` (o que pode E o que não pode).
- Custo zero até o piloto: nada de Cloud Functions, Firebase Storage, Places API ou WhatsApp API no MVP.
  Servidor = Cloudflare Worker (`worker/`); fotos = R2. Leituras: escutar só o dia aberto, 1 leitura por card.

## Mapa rápido
- `src/lib/agenda.ts` horários, expediente, folgas · `src/lib/busca.ts` filtros · `src/lib/painel.ts` números do dono
- `src/services/agendamentos.ts` reservar/cancelar/agenda/folgas/eventos · `barbearias.ts` casa, equipe, cardápio
- `src/services/usuarios.ts` perfil e exclusão de conta · `push(.native).ts` token do FCM (sem Expo Push; web via `public/firebase-messaging-sw.js`) · `upload.ts` fotos → Worker · `erros.ts` falhas → coleção `erros`
- `worker/src/index.ts` upload R2 + cron de lembretes · `docs/modelo-de-dados.md` coleções e trava
