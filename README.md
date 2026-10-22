# Navalha

App de agendamento para barbearias: cliente acha a barbearia mais perto, escolhe o corte pela foto e agenda em 3 toques.
Stack custo zero: **Expo (React Native) + Firebase (plano Spark) + Cloudflare R2/Workers**.

Estado atual: **Fase 1 (MVP) com os 4 sprints de código concluídos** — falta ligar os serviços reais e testar em celular. Roadmap em `docs/roadmap.md`, andamento em `docs/status.md`.

## O que já está pronto

- Projeto Expo (Android, iOS e web/PWA) com Expo Router e tema grafite + âmbar
- Login Google (pop-up na web; nativo no Android/iOS) ligado ao Firebase Auth
- Escolha de papel (cliente, dono, barbeiro) e troca de modo no perfil, sem trocar de conta
- Navegação por papel: abas do cliente (Início, Explorar, Agendamentos, Perfil) e da barbearia (Agenda, Barbearia, Perfil)
- Tela inicial com localização atual e lista "Perto de você" por geohash
- Modelo de dados completo (`src/types/models.ts`, `docs/modelo-de-dados.md`) e regras de segurança (`firestore.rules`)
- Lógica de horários livres + trava contra horário duplo (`src/lib/agenda.ts`, testada)
- Worker da Cloudflare: upload de fotos para o R2 com verificação do token do Firebase e lembretes push de 24 h e 2 h
- Emulador local do Firebase configurado (`firebase.json`)
- **Sprint 4:** busca por perto com filtros (distância, preço, tipo de corte, aberta agora, ainda hoje), perfil do cliente com foto, WhatsApp e exclusão de conta, histórico com fotos do corte, push de lembrete (token no app + cron no Worker), foto no "Concluído" e painel simples do dono
- **Sprint 3:** expediente semanal editável (do barbeiro e da casa; vale o cruzamento dos dois), folgas de dia inteiro ou por horário, tela de horários livres por dia (Manhã/Tarde/Noite), reservar com trava contra horário duplo, "Meus agendamentos" com cancelamento, agenda do dia do barbeiro/dono (confirmar, concluído, faltou, cancelar) e encaixe manual de cliente de balcão
- **Sprint 2:** cadastro da barbearia com localização pelo GPS do dono, foto de capa, publicação com checklist, convite de barbeiros por código de 6 letras, equipe ativa/inativa, cardápio do barbeiro (preço, tempo médio, categoria, até 6 fotos, pausar) e página pública da barbearia com rota para Google Maps/Waze e WhatsApp

## Rodar no seu computador

Requisitos: Node 20+, e Java 21+ para o emulador do Firebase. Rode os comandos **dentro da pasta do projeto** (ex.: `cd C:\projetos\navalha`).

```bash
npm install
npm test                 # lógica de agenda
npm run typecheck
npm run emulators        # terminal 1: Auth + Firestore locais (não gasta cota)
npm run web              # terminal 2: abre o app no navegador
```

Sem `.env.local`, o app usa o projeto `demo-navalha` no emulador: o login Google abre uma tela falsa do emulador, ótimo para testar.

Testes das regras de segurança (sobe o emulador sozinho):

```bash
npm run test:regras
```

Testes ponta a ponta no navegador (dois celulares simulados): ver `tests/e2e/LEIAME.md`.

Worker:

```bash
cd worker && npm install
npm test && npm run typecheck
npx wrangler dev         # http://127.0.0.1:8787/saude
```

## Ligar os serviços reais (todos gratuitos)

1. **Firebase** (console.firebase.google.com): criar projeto no plano Spark → ativar Authentication › Google → criar Firestore → adicionar App da Web e copiar as chaves para `.env.local` (modelo em `.env.example`) → `npx firebase deploy --only firestore` publica regras e índices.
2. **Login Google no Android/iOS**: no Google Cloud do mesmo projeto, copiar o *Web client ID* para `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; para iOS, criar o cliente iOS e trocar `SUBSTITUA_PELO_IOS_CLIENT_ID` em `app.json`. O login nativo exige o app Android gerado localmente (ver "App Android sem conta Expo"), não roda no Expo Go.
3. **Cloudflare**: `npx wrangler r2 bucket create navalha-fotos`; em `worker/wrangler.toml` trocar `FIREBASE_PROJECT_ID`; para os lembretes, criar uma conta de serviço no Google Cloud com papel *Cloud Datastore User* e guardar com `npx wrangler secret put GOOGLE_SA_EMAIL` e `GOOGLE_SA_PRIVATE_KEY`; `npm run deploy` dentro de `worker/`. Colocar a URL do Worker em `EXPO_PUBLIC_WORKER_URL`.

## Estrutura

```
src/app/            telas (Expo Router)
  (cliente)/        abas do cliente
  (casa)/           abas do dono/barbeiro
src/services/       Firebase, login, barbearias, agendamentos, upload
src/lib/agenda.ts   horários livres, expediente, folgas e trava anti-duplo (+ testes)
src/types/models.ts modelo de dados
firestore.rules     regras de segurança
tests/              testes das regras (emulador) e e2e/ (navegador)
docs/               roadmap, status, modelo de dados
worker/             Cloudflare Worker (R2 + lembretes)
```

## Próximo passo: ligar os serviços reais e testar no celular

1. Seguir "Ligar os serviços reais" acima (Firebase, Google Login, R2 e Worker).
2. Gerar o APK localmente (seção "App Android sem conta Expo" abaixo) e instalar no celular.
3. No celular: login, reserva, cancelamento, push de lembrete e foto no "Concluído".
4. Portão da Fase 2: 3 barbearias amigas usando por 1 semana sem erro grave e sem horário duplicado.

## Versão web

Publicada em **https://navalha.web.app** (Firebase Hosting do projeto, site `navalha`, plano gratuito):
`npx expo export --platform web && npx firebase deploy --only hosting --project prod`.

## App Android sem conta Expo

Decisão do dono (18/out/2026): nada de EAS/conta Expo. O app é gerado no computador e o push vai direto pelo
Firebase Cloud Messaging (o app guarda o token do FCM; o Worker manda pelo FCM HTTP v1 com a conta de serviço).

- **Pacote:** `com.trevotec.navalha` (definitivo; desde 20/out/2026). O app antigo `br.com.navalha.app` é outro app no
  celular: desinstale-o. No Firebase os dois apps Android estão cadastrados; o antigo pode ser apagado depois.
- `android/` **está no git** (desde 20/out/2026): é um projeto Android comum. Ajustes nativos podem ser feitos direto
  nele pelo Android Studio. Os plugins de `plugins/` e o `app.json` continuam valendo se um dia rodar
  `npx expo prebuild` — **não rode**: no SDK 58 ele tenta apagar a pasta `android/` inteira (mesmo sem `--clean`) e
  perde o que foi editado à mão. Mudança nativa nova: direto em `android/` (e anote no plugin, para referência).
- **Modo imersivo** (`plugins/modo-imersivo.js`): barra de status e de navegação ocultas, voltam num arrasto da borda e somem sozinhas; reaplicado quando a tela recupera o foco. Mesma lógica do `WindowHelper` do Cronos e do LystSync, injetada no `MainActivity.kt` a cada prebuild.
- `google-services.json` (raiz) liga o app ao Firebase `navalha-1a8f5`; o prebuild copia para `android/app/`.
- **Android Studio** (como qualquer projeto Android):
  1. Uma vez, na pasta do projeto: `npm install` (o Gradle usa o Node para achar os módulos e empacotar o JS).
  2. File › Open › pasta **`android`** › aguarde o Gradle Sync (a primeira vez demora).
  3. Escolha o celular/emulador e clique **Run ▶** (configuração `app`). O debug já leva o JS empacotado
     (`plugins/android-studio.js`), então abre sem precisar de mais nada.
  4. Recarga ao vivo enquanto edita o JS: com o app aberto, rode `npx expo start` na pasta do projeto.
  5. APK/AAB: Build › Generate Signed App Bundle or APK (ou `gradlew assembleRelease` / `bundleRelease`).
  Requisitos: Android Studio com SDK 36 (Android 16), NDK e CMake 4.x pelo SDK Manager; JDK 17+ (o embutido serve);
  Node 20+ no PATH. Cache do Gradle: `GRADLE_USER_HOME=C:\Users\andre\.gradle` (SSD interno). Não use o HD externo (D:): o Windows
  desliga o disco parado e o Sync falha com "dispositivo não está pronto".
- **Windows (obrigatório):** caminhos longos ligados (`LongPathsEnabled=1`, PowerShell como administrador) e CMake 4.x do SDK Manager, com `cmake.dir` em `android/local.properties` (o plugin `plugins/local-properties.js` recria esse arquivo em todo `npx expo prebuild`, apontando o SDK e o CMake mais novo instalados). O CMake 3.22 traz um ninja que não aceita caminhos acima de 260 caracteres. Com isso o projeto pode ficar em `C:\Users\andre\AndroidStudioProjects\navalha` (a pasta padrão do Android Studio); sem caminhos longos ligados, o build só passa num caminho curto como `C:\dev\navalha`.
- **APK de teste pela linha de comando:** `cd android && .\gradlew.bat assembleDebug` →
  `android/app/build/outputs/apk/debug/app-debug.apk` (instalar com `adb install -r` ou copiar para o celular).
- **Assinatura:** o debug usa a chave do template (SHA-1 `5E:8F:16:...:F6:25`, já cadastrado no Firebase para o
  login Google). O release (`assembleRelease`/`bundleRelease`) **só sai com `android/keystore.properties`** (chave de
  upload); sem ele o Gradle para com o aviso, em vez de assinar com a chave pública de debug. Para o Google Play (Fase 2), gere a chave de upload no Android Studio
  (Build › Generate Signed App Bundle) e cadastre o SHA-1 dela e o do Play App Signing no Firebase
  (`firebase apps:android:sha:create <appId> <SHA> --project prod`), senão o login Google falha na versão da loja.
- Variáveis `EXPO_PUBLIC_*` do `.env.local` entram no bundle na hora do build: mudou o `.env.local`, gere de novo.
