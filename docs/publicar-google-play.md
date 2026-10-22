# Publicar o Navalha na Google Play — lista de requisitos (pesquisa de 20/out/2026)

Legenda: ✅ o app já cumpre · 🔧 falta no código/projeto · 👤 só o dono faz (conta, documentos, console).

## Conta e identidade
- 👤 Conta de desenvolvedor Google Play (US$ 25, uma vez), com verificação de identidade.
  Desde 30/set/2026 o Brasil está na primeira fase da **verificação de desenvolvedor Android**: app de desenvolvedor
  não verificado deixa de instalar pelas lojas participantes; APK direto ainda instala (às vezes com o "fluxo avançado").
  Quem publica pela Play Console é registrado por lá.
- 👤 **Conta pessoal nova:** teste fechado com **pelo menos 12 testadores inscritos por 14 dias seguidos** antes de pedir
  acesso à produção (quem sai e volta reinicia a contagem; convidado que não instalou não conta).
  Conta de **empresa** (com D-U-N-S, ex.: TrevoTec com CNPJ) não passa por essa regra.

## Técnico (o app enviado)
- ✅ Pacote definitivo: `com.trevotec.navalha` (não muda depois de publicado).
- ✅ **API alvo 36 (Android 16)**: exigida para apps novos e atualizações desde 31/ago/2026 (o projeto já usa targetSdk 36).
- ✅ Suporte a páginas de memória de 16 KB (exigido para quem tem código nativo): React Native 0.88 já atende.
- ✅ **Play Billing Library 8 ou superior** (exigida desde 31/ago/2026): o expo-iap usa a versão atual (openiap-google 4).
- 🔧 Enviar **AAB** (Android App Bundle), não APK: `cd android && gradlew bundleRelease`.
- 🔧 **Chave de upload própria** (SEC-002). Sem `android/keystore.properties` o release não é gerado (o Gradle para com o aviso).
  Gerar uma vez (e guardar em dois lugares seguros): `keytool -genkeypair -v -keystore navalha-upload.jks -alias navalha -keyalg RSA -keysize 2048 -validity 10000`,
  ligar no `android/app/build.gradle` e cadastrar o SHA-1 dela no Firebase. A Play guarda a chave final (Play App Signing):
  cadastrar também o SHA-1 da "chave de assinatura do app" que a Play Console mostra, senão o login Google falha nas cópias baixadas da loja.
- ✅ Permissões só as necessárias: localização (busca perto), câmera (foto do corte). Sem acesso amplo a fotos
  (a galeria usa o seletor do sistema, como a política de Fotos e Vídeos exige); microfone e sobreposição de tela removidos.
- 🔧 `versionCode` crescente a cada envio (`android/app/build.gradle`) e `version` em `app.json`.

## Conteúdo do app no console (App content)
- 👤🔧 **Política de privacidade** em URL pública (pode ser uma página em navalha.web.app): localização, fotos, dados de conta, avaliações, exclusão.
- ✅ **Exclusão de conta dentro do app** (Perfil › Excluir minha conta).
- 🔧 **Exclusão também pela web, sem instalar o app**: a Play exige um link no formulário de Segurança de Dados.
  A versão web já tem o Perfil com exclusão; falta uma página pública explicando o caminho (ex.: navalha.web.app/excluir-conta).
- 👤 **Segurança de Dados**: declarar localização aproximada/precisa, fotos, nome/e-mail, ID do usuário, histórico de compras (assinatura);
  criptografado em trânsito; o usuário pode pedir exclusão.
- 👤 **Acesso ao app para a revisão**: o app exige login. O revisor precisa de uma conta de teste que funcione.
  Como o Navalha só tem "Entrar com Google", criar uma conta Google só para a revisão e informar e-mail/senha em
  App access (ou oferecer um login de demonstração). Falhar aqui é a causa mais comum de rejeição.
- 👤 Classificação etária (questionário), público-alvo (18+ / adultos), declaração de anúncios (não tem), app de notícias (não), etc.
- 👤 Assinaturas: os 4 produtos e preços (ver `docs/play-billing.md`).

## Ficha da loja
- 👤 Nome (até 30 caracteres), descrição curta (80) e completa (4.000).
- 👤 Ícone 512×512 PNG (pode sair de `icones imgs/icone app com fundo.png`), imagem de destaque 1024×500,
  pelo menos 2 capturas de tela de celular (de preferência 4 a 8), categoria (Estilo de vida ou Beleza), e-mail de contato.

## Prontos no código (20/out/2026)

- **Assinatura com a chave de upload:** crie a chave no Android Studio (Build › Generate Signed App Bundle or APK ›
  Create new..., alias `navalha-upload`, arquivo fora do projeto). Para gerar pelo terminal também, copie
  `android/keystore.properties.exemplo` para `android/keystore.properties` (fora do git) e preencha.
  Depois: `cd android && .\gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
  Cadastrar no Firebase o SHA-1/SHA-256 da chave (`keytool -list -v -keystore <arquivo.jks> -alias navalha-upload`)
  e, depois do primeiro envio, os da "chave de assinatura do app" (Play Console › Integridade do app).
- **A cada envio:** aumentar `versionCode` (e `versionName`) em `android/app/build.gradle`.
- **Política de privacidade:** https://navalha.web.app/privacidade
- **Exclusão de conta sem o app (campo do formulário de Segurança de Dados):** https://navalha.web.app/excluir-conta
- **Acesso para a revisão:** link "Acesso para revisão" na tela de entrada (e-mail e senha, só contas existentes).

### Para o acesso da revisão funcionar (dono, uma vez)
1. Firebase Console › Authentication › Sign-in method › **E-mail/senha** › Ativar (só o primeiro botão; sem "link de e-mail").
2. Authentication › Users › **Add user**: um e-mail só para isso (ex.: `revisao.navalha@gmail.com`, não precisa existir caixa
   de entrada) e uma senha forte. Não use a sua conta pessoal.
3. Play Console › Conteúdo do app › **Acesso ao app** › "Todas ou algumas funcionalidades são restritas" › Adicionar instruções,
   colando o texto abaixo com o e-mail e a senha criados.

```
Login: on the first screen tap "Acesso para revisão" (below the Google button) and sign in with:
  E-mail: <REVIEW E-MAIL>
  Password: <REVIEW PASSWORD>
Then choose "Tenho uma barbearia" (I own a barbershop).

Navalha is a barbershop booking app (Brazil, Portuguese UI). To see every feature from your location:
1. Barbershop side: in the "Barbearia" tab, fill the name, tap "Usar minha localização atual", address and city,
   then "Criar barbearia". Open "Cardápio de cortes" and add one service (name, price, duration).
   Open the gear icon (Configurações): tap the cover area to add a cover photo, then turn on "Aparecendo na busca"
   (publish; it needs the cover photo and one service). New shops get a 60-day free trial.
2. Customer side: Perfil (profile) › Modo › "Cliente". The shop you created appears in "Início" (nearby list).
   Open it, pick the service, pick a time and confirm. "Agendamentos" shows the booking; you can cancel it there.
3. Subscriptions (Google Play Billing): barbershop side › Configurações › Plano.
4. Account deletion: Perfil › "Excluir minha conta" (also documented at https://navalha.web.app/excluir-conta).
```

## Fontes
- [Requisitos de API alvo (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB)
- [12 testadores por 14 dias para contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Verificação de desenvolvedor Android (blog oficial)](https://android-developers.googleblog.com/2026/06/android-developer-verification.html) · [Ajuda](https://support.google.com/android-developer-console/answer/16561738?hl=en) · [O que mudou em 30/set](https://android.gadgethacks.com/news/google-android-sideloading-restrictions-sept-30-explained/)
- [Política de permissões de fotos e vídeos](https://support.google.com/googleplay/android-developer/answer/14115180)
- [Play Billing Library 8 até 31/ago/2026](https://foresightmobile.com/blog/google-play-billing-library-8-migration)
- [Páginas de 16 KB no React Native](https://www.appsonair.com/blogs/16-kb-memory-page-size-support-in-android-react-native-apps)
- [Exclusão de conta e Segurança de Dados](https://stora.sh/blog/2026-05-20-google-play-data-safety-form-2026-guide)
- [Credenciais de acesso para a revisão](https://support.google.com/googleplay/android-developer/answer/15191715)
