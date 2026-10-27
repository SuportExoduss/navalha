// Teste ponta a ponta no navegador (Playwright) contra o emulador. Ver tests/e2e/LEIAME.md.
const { chromium, entrar } = require('./lib.cjs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { geohashForLocation } = require('geofire-common');
const assert = require('node:assert/strict');

async function uidDe(sub, nome) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub, email: `${sub}@teste.com`, name: nome }))}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }),
  });
  return (await r.json()).localId;
}
const texto = p => p.textContent('body');
const shot = (p, n) => p.screenshot({ path: `shots4/${n}.png`, fullPage: true });
const AQUI = { latitude: -23.5015, longitude: -47.4526 };

(async () => {
  // Funciona no Windows também (o cmd não tem mkdir -p).
  require('node:fs').rmSync('shots4', { recursive: true, force: true }); require('node:fs').mkdirSync('shots4');
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-navalha/databases/(default)/documents', { method: 'DELETE' });
  const ana = await uidDe('ana', 'Ana Souza'), lucas = await uidDe('lucas', 'Lucas Navalha');
  const env = await initializeTestEnvironment({ projectId: 'demo-navalha', firestore: { host: '127.0.0.1', port: 8080 } });
  const DIA = { abre: '00:00', fecha: '24:00' };
  const sempre = { 0: DIA, 1: DIA, 2: DIA, 3: DIA, 4: DIA, 5: DIA, 6: DIA };
  const agora = Date.now();
  const hoje = new Date(agora - 3 * 3600e3).toISOString().slice(0, 10);
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    const user = (uid, nome, papeis, papelAtivo, barbearias = []) => setDoc(doc(db, 'users', uid), {
      uid, nome, email: '', papeis, papelAtivo, barbearias, favoritos: { barbearias: [], barbeiros: [] },
      provedores: ['google'], maiorDeIdadeEm: agora, criadoEm: agora });
    await user(ana, 'Ana Souza', ['cliente'], 'cliente');
    await user(lucas, 'Lucas Navalha', ['dono'], 'dono', ['b1']);
    const casa = (id, nome, lat, lng, extra) => setDoc(doc(db, 'barbearias', id), {
      id, donoUid: lucas, nome, fotos: [], endereco: 'Rua A, 10', cidade: 'Sorocaba',
      geo: { lat, lng, geohash: geohashForLocation([lat, lng]) }, expediente: sempre, comodidades: [],
      politica: { cancelamentoGratisHoras: 2, toleranciaMin: 10 }, passoMin: 15, antecedenciaMin: 30, janelaDias: 30,
      resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [], ...extra },
      assinatura: { status: 'teste', venceEm: agora + 60 * 86400e3, limiteBarbeiros: 10 }, emDia: true, barbeirosAtivos: 1, publicada: true, criadoEm: agora });
    await casa('b1', 'Navalha de Ouro', -23.5020, -47.4530, { precoMin: 4500, precoMax: 4500, categorias: ['cabelo'] });
    await casa('b2', 'Barba Negra', -23.5300, -47.4600, { precoMin: 8000, precoMax: 9000, categorias: ['combo'] });
    await setDoc(doc(db, 'barbearias/b1/barbeiros', lucas), { uid: lucas, barbeariaId: 'b1', nome: 'Lucas Navalha', especialidades: [], expediente: sempre, ativo: true, nota: { media: 0, total: 0 } });
    await setDoc(doc(db, 'barbearias/b1/servicos/s1'), { id: 's1', barbeariaId: 'b1', barbeiroId: lucas, nome: 'Degradê', categoria: 'cabelo', precoCentavos: 4500, duracaoMin: 45, fotos: [], ativo: true });
    // Cliente que já está na cadeira (começou há 10 min), para o "Concluído".
    const ini = Math.floor((agora - 10 * 60e3) / 900e3) * 900e3;
    await setDoc(doc(db, 'agendamentos/em-andamento'), {
      id: 'em-andamento', barbeariaId: 'b1', barbeiroId: lucas, barbeariaNome: 'Navalha de Ouro', barbeiroNome: 'Lucas',
      clienteUid: ana, clienteNome: 'Ana Souza', servicoId: 's1', servicoNome: 'Degradê', precoCentavos: 4500, duracaoMin: 45,
      data: new Date(ini - 3 * 3600e3).toISOString().slice(0, 10), inicio: ini, fim: ini + 45 * 60e3, slots: [], status: 'confirmado',
      origem: 'app', lembretes: {}, fotos: [], criadoEm: agora, atualizadoEm: agora });
  });
  await env.cleanup();

  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const A = await entrar(b, 'ana', 'Ana Souza', { geolocation: AQUI, permissions: ['geolocation'] });

  // 1) Início: duas barbearias por perto; atalho "Combo" filtra
  await A.p.goto('http://127.0.0.1:8099/inicio'); await A.p.waitForTimeout(4000);
  let t = await texto(A.p);
  assert.match(t, /Navalha de Ouro/); assert.match(t, /Barba Negra/);
  await shot(A.p, '1-inicio');
  await A.p.getByText('Combo', { exact: true }).click(); await A.p.waitForTimeout(500);
  t = await texto(A.p);
  assert.doesNotMatch(t, /Navalha de Ouro/); assert.match(t, /Barba Negra/);

  // 2) Explorar: raio de 1 km e preço
  await A.p.goto('http://127.0.0.1:8099/explorar'); await A.p.waitForTimeout(4000);
  await A.p.getByText('Até 1 km', { exact: true }).click(); await A.p.waitForTimeout(400);
  t = await texto(A.p);
  assert.match(t, /1 barbearia/); assert.match(t, /Navalha de Ouro/);
  await A.p.getByText('R$ 70 ou mais', { exact: true }).click(); await A.p.waitForTimeout(400);
  assert.match(await texto(A.p), /Nenhuma barbearia com esses filtros/);
  await A.p.getByText(/Limpar filtros/).click(); await A.p.waitForTimeout(400);
  assert.match(await texto(A.p), /2 barbearias/);
  await shot(A.p, '2-explorar');

  // 3) Gate: 4 toques a partir da página da barbearia (barbeiro → corte → horário → confirmar no popup)
  await A.p.goto('http://127.0.0.1:8099/barbearia/b1'); await A.p.waitForTimeout(3000);
  let toques = 0;
  await A.p.getByText('Lucas Navalha').first().click(); toques++; await A.p.waitForTimeout(2500);
  await A.p.getByText('Degradê').first().click(); toques++; await A.p.waitForTimeout(3000);
  await A.p.getByText('Amanhã', { exact: true }).click(); await A.p.waitForTimeout(2000); // dia: hoje pode não ter mais horário
  await A.p.locator('text=/^\\d\\d:\\d\\d$/').first().click(); toques++; await A.p.waitForTimeout(500);
  await A.p.getByRole('button', { name: 'Confirmar', exact: true }).click(); toques++; await A.p.waitForTimeout(4000);
  assert.match(A.p.url(), /\/barbearia\/b1/); // reservou e voltou para a casa
  console.log('Toques da barbearia até reservar (fora a troca de dia):', toques);
  await shot(A.p, '3-reservado');

  // 4) Dono: o corte de agora (já começou) é concluído direto na agenda; depois o painel da casa
  const L = await entrar(b, 'lucas', 'Lucas Navalha');
  await L.p.goto('http://127.0.0.1:8099/agenda'); await L.p.waitForTimeout(3500);
  await L.p.getByText('Concluído', { exact: true }).first().click(); await L.p.waitForTimeout(2500);
  assert.match(await texto(L.p), /Concluído/);
  await shot(L.p, '4-concluido');
  await L.p.goto('http://127.0.0.1:8099/casa'); await L.p.waitForTimeout(4000);
  t = await texto(L.p);
  assert.match(t, /Resumo da casa/); assert.match(t, /Faturado/);
  // O corte concluído entra no faturado de algum dos filtros (o dia reservado pode ser amanhã ou na outra semana).
  let achou = false;
  for (const f of ['Hoje', 'Semana', 'Mês']) {
    await L.p.getByText(f, { exact: true }).first().click(); await L.p.waitForTimeout(400);
    if (/Faturado\s*R\$ 45,00/.test(await texto(L.p))) achou = true;
  }
  assert.ok(achou, 'faturado de R$ 45,00 em nenhum filtro');
  await shot(L.p, '5-painel-do-dono');

  // 5) Perfil do cliente: telefone e opção de excluir conta
  await A.p.goto('http://127.0.0.1:8099/perfil'); await A.p.waitForTimeout(3000);
  await A.p.getByPlaceholder('(15) 99999-0000').fill('15 99999-0000');
  await A.p.getByText('Salvar', { exact: true }).click(); await A.p.waitForTimeout(2500);
  assert.match(await texto(A.p), /Dados atualizados/);
  await A.p.getByText('Excluir minha conta').click(); await A.p.waitForTimeout(400);
  assert.match(await texto(A.p), /não pode ser desfeito/);
  await shot(A.p, '6-perfil-excluir-conta');
  // Histórico com o concluído
  await A.p.goto('http://127.0.0.1:8099/agendamentos'); await A.p.waitForTimeout(3000);
  assert.match(await texto(A.p), /Histórico/);
  console.log('E2E SPRINT 4 OK');
  await b.close();
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
