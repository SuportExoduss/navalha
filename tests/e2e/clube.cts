// Clube no navegador (npx tsx tests/e2e/clube.cts): o cliente usa o clube ao agendar, escolhe o horário fixo e sai.
// As rotas do Worker são atendidas pelo código real de worker/src, gravando no emulador (sem publicar nada).
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const path = require('path');
const assert = require('node:assert/strict');
const { agendarPeloClube, horarioFixoAgora } = require('../../worker/src/clube.ts');
const { Firestore } = require('../../worker/src/firestore.ts');

const FS = 'http://127.0.0.1:8080/v1/projects/demo-navalha/databases/(default)/documents';
const H = { 'content-type': 'application/json', Authorization: 'Bearer owner' };
const v = (x: any): any => x === null ? { nullValue: null } : Array.isArray(x) ? { arrayValue: { values: x.map(v) } }
  : typeof x === 'number' ? (Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }) : typeof x === 'boolean' ? { booleanValue: x }
  : typeof x === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } } : { stringValue: x };
const put = (c: string, d: any) => fetch(`${FS}/${c}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: v(d).mapValue.fields }) }).then(r => { if (!r.ok) throw new Error(c + ' ' + r.status); });
const entrar = async (sub: string, name: string) => (await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub, email: `${sub}@teste.com`, name, email_verified: true }))}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }),
})).json());

// Firestore do Worker apontado para o emulador (token "owner" passa pelas regras, como a conta de serviço).
Object.defineProperty(Firestore.prototype, 'base', { get() { return FS; } });

const DIR = 'shots-clube';
(async () => {
  require('node:fs').rmSync(DIR, { recursive: true, force: true }); require('node:fs').mkdirSync(DIR);
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-navalha/databases/(default)/documents', { method: 'DELETE' });
  const dono = await entrar('lucas', 'Lucas Navalha'), ana = await entrar('ana', 'Ana Souza');
  const D = 86400e3, agora = Date.now(), DIA = { abre: '08:00', fecha: '20:00' };
  const exp = { 0: DIA, 1: DIA, 2: DIA, 3: DIA, 4: DIA, 5: DIA, 6: DIA };
  await put(`users/${ana.localId}`, { uid: ana.localId, nome: 'Ana Souza', email: '', papeis: ['cliente'], papelAtivo: 'cliente', barbearias: [], maiorDeIdadeEm: 1,
    favoritos: { barbearias: [], barbeiros: [] }, privacidade: { fotosNoPortfolio: true }, provedores: ['google'], criadoEm: 1 });
  await put('barbearias/b1', { id: 'b1', donoUid: dono.localId, nome: 'Navalha de Ouro', fotos: [], endereco: 'Rua A, 10', cidade: 'Sorocaba',
    geo: { lat: -23.5, lng: -47.45, geohash: '75cm' }, expediente: exp, comodidades: [],
    politica: { cancelamentoGratisHoras: 2, toleranciaMin: 10 }, passoMin: 30, antecedenciaMin: 30, janelaDias: 30,
    resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [] }, pagamento: { pagarNoApp: false, sinalPercent: 0 },
    assinatura: { status: 'teste', venceEm: agora + 30 * D, limiteBarbeiros: 10 }, emDia: true, barbeirosAtivos: 1, publicada: true, criadoEm: 1 });
  await put(`barbearias/b1/barbeiros/${dono.localId}`, { uid: dono.localId, barbeariaId: 'b1', nome: 'Lucas Navalha', especialidades: [], expediente: exp, ativo: true });
  await put('barbearias/b1/servicos/s1', { id: 's1', barbeariaId: 'b1', barbeiroId: dono.localId, nome: 'Corte', categoria: 'cabelo', precoCentavos: 5000, duracaoMin: 30, fotos: [], ativo: true });
  await put('barbearias/b1/clubePlanos/p1', { id: 'p1', nome: 'Clube Corte', precoCentavos: 8000, servicoIds: ['s1'], cortesPorMes: 2, ativo: true, criadoEm: 1, atualizadoEm: 1 });
  await put(`clubeMembros/b1_${ana.localId}`, { barbeariaId: 'b1', barbeariaNome: 'Navalha de Ouro', planoId: 'p1', planoNome: 'Clube Corte', cortesPorMes: 2,
    clienteUid: ana.localId, clienteNome: 'Ana Souza', status: 'ativo', cicloInicio: agora - D, venceEm: agora + 29 * D, criadoEm: 1, atualizadoEm: 1 });

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })).newPage();
  p.on('pageerror', (e: Error) => console.log('ERRO', e.message));
  // O Worker: a rota real com o uid de quem está logado.
  let chamadas = 0;
  await p.route('**/clube/agendar', async (r: any) => {
    chamadas++;
    const c = JSON.parse(r.request().postData());
    const res = await agendarPeloClube(new Firestore('demo-navalha', 'owner'), ana.localId, c.barbeariaId, c.servicoId, c.inicio);
    await r.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.corpo) });
  });
  await p.route('**/clube/horario-fixo', async (r: any) => {
    const c = JSON.parse(r.request().postData());
    const res = await horarioFixoAgora(new Firestore('demo-navalha', 'owner'), ana.localId, c.barbeariaId, c.clienteUid);
    await r.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.corpo) });
  });
  await p.route('**/avisos/agendamento', (r: any) => r.fulfill({ status: 200, body: '{}' }));
  await p.goto('http://127.0.0.1:8099/entrar'); await p.waitForTimeout(2000);
  await p.evaluate(async (j: any) => {
    const user = { uid: j.localId, email: j.email, emailVerified: true, displayName: 'Ana Souza', isAnonymous: false,
      providerData: [{ providerId: 'google.com', uid: j.localId, displayName: 'Ana Souza', email: j.email, phoneNumber: null, photoURL: null }],
      stsTokenManager: { refreshToken: j.refreshToken, accessToken: j.idToken, expirationTime: Date.now() + 3600e3 },
      createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: 'demo-key', appName: '[DEFAULT]' };
    await new Promise((res, rej) => { const q = indexedDB.open('firebaseLocalStorageDb', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
      q.onsuccess = () => { const tx = q.result.transaction('firebaseLocalStorage', 'readwrite');
        tx.objectStore('firebaseLocalStorage').put({ fbase_key: 'firebase:authUser:demo-key:[DEFAULT]', value: user }); tx.oncomplete = res; tx.onerror = rej; };
      q.onerror = rej; });
  }, ana);
  await p.goto(`http://127.0.0.1:8099/agendar/b1?barbeiro=${dono.localId}&servico=s1`); await p.waitForTimeout(4000);
  // Amanhã (hoje pode não ter horário livre conforme a hora).
  await p.getByRole('button').filter({ hasText: /^Amanhã|^Ter|^Qua/ }).first().click().catch(() => undefined);
  await p.waitForTimeout(1500);
  await p.getByText(/^\d\d:\d\d$/).first().click(); await p.waitForTimeout(1500);
  console.log('popup:', await p.getByText(/Usar o clube/).innerText(), '| valor clube:', await p.getByText('Clube', { exact: true }).count());
  assert.match(await p.getByText(/Usar o clube/).innerText(), /Usar o clube \(0 de 2 usados\)/);
  await p.screenshot({ path: path.join(DIR, 'clube-popup.png') });
  await p.getByRole('button', { name: 'Confirmar' }).click(); await p.waitForTimeout(3000);
  const ags = await (await fetch(`${FS}/agendamentos`, { headers: H })).json();
  const ag = ags.documents?.[0]?.fields;
  console.log('chamadas Worker:', chamadas, '| origem:', ag?.origem?.stringValue, '| preço:', ag?.precoCentavos?.integerValue, '| membro:', ag?.clubeMembroId?.stringValue);
  assert.deepEqual([chamadas, ag?.origem?.stringValue, ag?.precoCentavos?.integerValue], [1, 'clube', '0']);
  await p.goto('http://127.0.0.1:8099/agendamentos'); await p.waitForTimeout(3500);
  console.log('lista mostra Clube:', await p.getByText(/min · Clube/).count());
  assert.equal(await p.getByText(/min · Clube/).count(), 1);
  await p.screenshot({ path: path.join(DIR, 'clube-lista.png') });
  await p.goto('http://127.0.0.1:8099/meu-clube'); await p.waitForTimeout(3500);
  console.log('meu clube:', await p.getByText(/usados neste ciclo/).innerText());
  await p.screenshot({ path: path.join(DIR, 'clube-meu.png') });
  // Horário fixo: quarta 10:00, toda semana.
  await p.getByRole('button', { name: 'Escolher horário fixo' }).click(); await p.waitForTimeout(3000);
  await p.getByRole('button', { name: 'Lucas' }).click();
  await p.getByRole('button', { name: /^Corte · 30 min/ }).click();
  await p.getByRole('button', { name: 'Quarta' }).click();
  await p.getByRole('button', { name: '10:00' }).click();
  await p.screenshot({ path: path.join(DIR, 'fixo-escolha.png'), fullPage: true });
  await p.getByRole('button', { name: 'Salvar horário fixo' }).click(); await p.waitForTimeout(4000);
  console.log('resultado:', (await p.getByText(/Reservado:|Não coube/).allInnerTexts()).join(' | '));
  assert.match(await p.getByText(/Reservado:/).innerText(), /Reservado: \S+ \d\d\/\d\d\./); // 1 data (o limite de 2 já tem 1 uso)
  await p.screenshot({ path: path.join(DIR, 'fixo-salvo.png') });
  const todos = (await (await fetch(`${FS}/agendamentos?pageSize=50`, { headers: H })).json()).documents ?? [];
  console.log('fixos no banco:', todos.filter((d: any) => d.fields.fixo?.booleanValue).map((d: any) => d.fields.data.stringValue + ' ' + d.fields.status.stringValue).join(', '));
  await p.getByRole('button', { name: 'Pronto' }).click(); await p.waitForTimeout(2500);
  console.log('meu clube:', (await p.getByText(/Horário fixo:|usados neste ciclo/).allInnerTexts()).join(' | '));
  // Sair do clube libera os horários fixos futuros.
  await p.getByRole('button', { name: 'Sair do clube' }).click();
  await p.getByRole('button', { name: 'Sair', exact: true }).click(); await p.waitForTimeout(4000);
  const depois = (await (await fetch(`${FS}/agendamentos?pageSize=50`, { headers: H })).json()).documents ?? [];
  console.log('depois de sair:', depois.filter((d: any) => d.fields.fixo?.booleanValue).map((d: any) => d.fields.status.stringValue).join(', '));
  assert.ok(depois.filter((d: any) => d.fields.fixo?.booleanValue).every((d: any) => d.fields.status.stringValue === 'cancelado'));
  console.log('E2E CLUBE OK');
  await browser.close();
})().catch((e: Error) => { console.error(e.message); process.exit(1); });
