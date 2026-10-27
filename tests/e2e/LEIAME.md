# Testes ponta a ponta (navegador + emulador)

Simulam celulares reais no Chrome contra o emulador do Firebase. O login Google é
substituído por uma sessão do emulador gravada no navegador (`lib.cjs`), porque o
pop-up do Google não abre em ambiente de teste.

```bash
npx expo export --platform web --output-dir dist   # 1. gera a versão web
npm run emulators                                    # 2. terminal 1: Auth + Firestore
node tests/e2e/servidor.cjs                          # 3. terminal 2: serve dist/ em http://127.0.0.1:8099
node tests/e2e/sprint3-agenda.cjs                    # 4. terminal 3: dois celulares no mesmo horário, encaixe, folga, cancelamento
node tests/e2e/sprint4-cliente.cjs                   #    busca com filtros, barbeiro → corte → horário, concluído, painel, perfil
npx tsx tests/e2e/clube.cts                          #    clube: usar ao agendar, horário fixo e sair (rotas do Worker pelo código real)
node tests/e2e/criar-barbearia.cjs                  #    dono cria a casa: popup dos 60 dias, botão gira até o servidor confirmar, uma casa só
```

Para o build, use `EXPO_NO_DOTENV=1 npx expo export --platform web --output-dir dist-e2e` e `WEB_DIR=dist-e2e` no servidor:
sem o `.env.local`, o app fala com o emulador e nunca com o Firebase ou o Worker reais. Atualizados em 26/out para as
3 etapas (barbeiro, corte, horário) e o popup de confirmação.

Requer o Playwright (`npm i -D playwright && npx playwright install chromium`, uma vez).
Variáveis opcionais: `PLAYWRIGHT_PATH`, `CHROMIUM_PATH`, `WEB_DIR`. As capturas saem em `shots/`, `shots4/` e `shots-clube/`.
Cada roteiro apaga o banco do emulador antes de começar.
