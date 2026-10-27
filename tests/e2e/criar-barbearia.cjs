// Ponta a ponta: o dono cria a barbearia, o botão gira até o servidor confirmar e a tela mostra
// "Barbearia criada. Dados atualizados." com uma casa só (antes a tela voltava ao cadastro e a casa saía duplicada).
// Rodar com o emulador e o web-e2e no ar (LEIAME.md): node tests/e2e/criar-barbearia.cjs
const assert = require('assert');
const { chromium, entrar, BASE } = require('./lib.cjs');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const sub = `dono${Date.now()}`;
  const D = await entrar(b, sub, 'Dono Novo', { geolocation: { latitude: -23.5, longitude: -47.45 }, permissions: ['geolocation'] });
  const p = D.p;
  // Idade e papel, como no primeiro login.
  if (p.url().includes('/idade')) {
    await p.getByPlaceholder('DD/MM/AAAA').fill('01011990');
    await p.getByText('Continuar', { exact: true }).click(); await p.waitForTimeout(3000);
  }
  await p.getByText('Tenho uma barbearia').click(); await p.waitForTimeout(3000);
  if (!p.url().includes('/casa')) { await p.goto(`${BASE}/casa`); await p.waitForTimeout(3000); }
  await p.getByPlaceholder('Ex.: The Lord Barbearia').fill('Casa Conferida');
  await p.getByText('Usar minha localização atual').click(); await p.waitForTimeout(2000);
  await p.getByPlaceholder('Rua, número – bairro').fill('Rua B, 20');
  const cidade = p.getByText('Cidade', { exact: true }).locator('..').locator('input');
  if (!(await cidade.inputValue())) await cidade.fill('Sorocaba');
  await p.getByText('Criar barbearia', { exact: true }).click();
  // Popup do teste grátis: explica e só cria no "Começar grátis".
  await p.getByText('60 dias grátis', { exact: true }).waitFor({ timeout: 5000 });
  assert.match(await p.innerText('body'), /Sem cartão e sem cobrança/);
  await p.waitForTimeout(600); await p.screenshot({ path: 'shots4/7-teste-gratis.png' });
  await p.getByText('Começar grátis', { exact: true }).click();
  await p.getByText(/Barbearia criada\. Dados atualizados\. Seus 60 dias grátis vão até/).waitFor({ timeout: 30_000 });
  const t = await p.innerText('body');
  assert.match(t, /Casa Conferida/);
  assert.doesNotMatch(t, /Cadastre sua/);
  // Uma casa só no perfil.
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-navalha/databases/(default)/documents/users/${D.uid}`, { headers: { Authorization: 'Bearer owner' } });
  const casas = (await r.json()).fields?.barbearias?.arrayValue?.values?.length ?? 0;
  assert.equal(casas, 1);
  await p.screenshot({ path: 'shots4/8-barbearia-criada.png', fullPage: true });
  console.log('E2E CRIAR BARBEARIA OK');
  await b.close();
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
