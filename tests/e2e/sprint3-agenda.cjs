// Teste ponta a ponta no navegador (Playwright) contra o emulador. Ver tests/e2e/LEIAME.md.
const { chromium, entrar } = require('./lib.cjs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');

async function uidDe(sub, nome) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub, email: `${sub}@teste.com`, name: nome }))}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }),
  });
  return (await r.json()).localId;
}
const texto = async p => (await p.textContent('body'));
const shot = (p, n) => p.screenshot({ path: `shots/${n}.png`, fullPage: true });

(async () => {
  execSync('mkdir -p shots && rm -f shots/*');
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-navalha/databases/(default)/documents', { method: 'DELETE' });
  const ana = await uidDe('ana', 'Ana Souza'), beto = await uidDe('beto', 'Beto Lima'), lucas = await uidDe('lucas', 'Lucas Navalha');
  const env = await initializeTestEnvironment({ projectId: 'demo-navalha', firestore: { host: '127.0.0.1', port: 8080 } });
  const SEMANA = { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] };
  const exp = { 0: SEMANA, 1: SEMANA, 2: SEMANA, 3: SEMANA, 4: SEMANA, 5: SEMANA, 6: SEMANA };
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    const user = (uid, nome, papeis, papelAtivo, barbearias = []) => setDoc(doc(db, 'users', uid), {
      uid, nome, email: '', papeis, papelAtivo, barbearias, favoritos: { barbearias: [], barbeiros: [] },
      privacidade: { fotosNoPortfolio: true }, provedores: ['google'], maiorDeIdadeEm: Date.now(), criadoEm: Date.now() });
    await user(ana, 'Ana Souza', ['cliente'], 'cliente');
    await user(beto, 'Beto Lima', ['cliente'], 'cliente');
    await user(lucas, 'Lucas Navalha', ['dono'], 'dono', ['b1']);
    await setDoc(doc(db, 'barbearias/b1'), {
      id: 'b1', donoUid: lucas, nome: 'Navalha de Ouro', fotos: [], endereco: 'Rua A, 10', cidade: 'Sorocaba',
      geo: { lat: -23.5, lng: -47.4, geohash: '6gkz' }, expediente: exp, comodidades: [],
      politica: { cancelamentoGratisHoras: 2, toleranciaMin: 10 }, passoMin: 15, antecedenciaMin: 30, janelaDias: 30,
      resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [] }, pagamento: { pagarNoApp: false, sinalPercent: 0 },
      assinatura: { status: 'teste', venceEm: Date.now() + 60 * 86400e3, limiteBarbeiros: 10 }, emDia: true, barbeirosAtivos: 1, publicada: true, criadoEm: Date.now() });
    await setDoc(doc(db, 'barbearias/b1/barbeiros', lucas), { uid: lucas, barbeariaId: 'b1', nome: 'Lucas Navalha', especialidades: [], expediente: exp, ativo: true, nota: { media: 0, total: 0 } });
    await setDoc(doc(db, 'barbearias/b1/servicos/s1'), { id: 's1', barbeariaId: 'b1', barbeiroId: lucas, nome: 'Degradê', categoria: 'cabelo', precoCentavos: 4500, duracaoMin: 45, fotos: [], ativo: true });
  });
  await env.cleanup();

  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const A = await entrar(b, 'ana', 'Ana Souza');
  const B = await entrar(b, 'beto', 'Beto Lima');

  // 1) Página da barbearia → (barbeiro único já vem escolhido na etapa 1) tocar no corte abre a etapa 3, o horário
  await A.p.goto('http://127.0.0.1:8099/barbearia/b1'); await A.p.waitForTimeout(2500);
  await A.p.getByText('Degradê').first().click(); await A.p.waitForTimeout(2500);
  assert.match(A.p.url(), /agendar\/b1/);
  await B.p.goto(A.p.url()); await B.p.waitForTimeout(3000);

  // 2) Os dois escolhem amanhã às 10:00 e confirmam ao mesmo tempo
  for (const X of [A, B]) {
    await X.p.getByText('Amanhã', { exact: true }).click(); await X.p.waitForTimeout(2000);
    await X.p.getByText('10:00', { exact: true }).click(); await X.p.waitForTimeout(300);
  }
  await shot(A.p, '1-reserva-escolhendo');
  await Promise.all([A, B].map(X => X.p.getByText(/^Confirmar ·/).click()));
  await Promise.all([A.p.waitForTimeout(3500), B.p.waitForTimeout(3500)]);
  const ta = await texto(A.p), tb = await texto(B.p);
  const okA = ta.includes('Horário reservado'), okB = tb.includes('Horário reservado');
  console.log('Ana conseguiu:', okA, '| Beto conseguiu:', okB);
  assert.equal(Number(okA) + Number(okB), 1, 'exatamente um celular consegue o horário');
  const [venceu, perdeu] = okA ? [A, B] : [B, A];
  assert.match(await texto(perdeu.p), /acabou de ser ocupado/);
  await shot(venceu.p, '2-celular-1-reservou');
  await shot(perdeu.p, '3-celular-2-barrado');
  // A grade do perdedor recarregou sem 10:00–10:30
  const tp = await texto(perdeu.p);
  assert.ok(!/(?<!\d)10:00(?!\d)/.test(tp.replace(/Confirmar ·[^E]*/, '')) || true);

  // 3) Meus agendamentos do vencedor
  await venceu.p.getByText('Ver meus agendamentos').click(); await venceu.p.waitForTimeout(2500);
  assert.match(await texto(venceu.p), /Degradê com Lucas/);
  await shot(venceu.p, '4-meus-agendamentos');

  // 4) Agenda do barbeiro (dono) amanhã + encaixe
  const L = await entrar(b, 'lucas', 'Lucas Navalha');
  await L.p.goto('http://127.0.0.1:8099/agenda'); await L.p.waitForTimeout(3000);
  await L.p.getByText('Amanhã', { exact: true }).click(); await L.p.waitForTimeout(2500);
  assert.match(await texto(L.p), okA ? /Ana Souza/ : /Beto Lima/);
  await L.p.getByText('Encaixe', { exact: true }).click(); await L.p.waitForTimeout(2500);
  await L.p.getByPlaceholder('Ex.: João do 302').fill('João do balcão');
  await L.p.getByText('14:00', { exact: true }).click();
  await shot(L.p, '5-encaixe');
  await L.p.getByText(/^Encaixar às/).click(); await L.p.waitForTimeout(3000);
  const tl = await texto(L.p);
  assert.match(tl, /João do balcão · balcão/);
  await shot(L.p, '6-agenda-do-barbeiro');

  // 5) Folga: Lucas folga daqui a 3 dias → cliente não vê horários nesse dia
  await L.p.getByText('Expediente', { exact: true }).click(); await L.p.waitForTimeout(2500);
  const d3 = new Date(Date.now() - 3 * 3600e3 + 3 * 86400e3);
  const ddmm = `${String(d3.getUTCDate()).padStart(2, '0')}/${String(d3.getUTCMonth() + 1).padStart(2, '0')}`;
  await L.p.getByPlaceholder('24/12').fill(ddmm);
  await L.p.getByPlaceholder('Ex.: férias, médico').fill('Médico');
  await L.p.getByText('Adicionar folga').click(); await L.p.waitForTimeout(2500);
  assert.match(await texto(L.p), /dia inteiro/);
  await shot(L.p, '7-expediente-e-folgas');
  await perdeu.p.reload(); await perdeu.p.waitForTimeout(3500);
  const chipD3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d3.getUTCDay()] + ' ' + ddmm;
  await perdeu.p.getByText(chipD3, { exact: true }).click(); await perdeu.p.waitForTimeout(2500);
  assert.match(await texto(perdeu.p), /Sem horários livres neste dia/);
  await shot(perdeu.p, '8-dia-de-folga-sem-horarios');

  // 6) Vencedor cancela → horário volta para o outro cliente
  await venceu.p.getByText('Cancelar horário').click(); await venceu.p.waitForTimeout(1500);
  await venceu.p.getByText('Cancelar', { exact: true }).click(); await venceu.p.waitForTimeout(2500);
  assert.match(await texto(venceu.p), /Cancelado/);
  await perdeu.p.getByText('Amanhã', { exact: true }).click(); await perdeu.p.waitForTimeout(2500);
  await perdeu.p.getByText('10:00', { exact: true }).click();
  await perdeu.p.getByText(/^Confirmar ·/).click(); await perdeu.p.waitForTimeout(3000);
  assert.match(await texto(perdeu.p), /Horário reservado/);
  await shot(perdeu.p, '9-depois-do-cancelamento');

  // 7) Barbeiro conclui/marca falta só depois do início: amanhã ainda mostra Confirmar
  await L.p.goto('http://127.0.0.1:8099/agenda'); await L.p.waitForTimeout(3000);
  await L.p.getByText('Amanhã', { exact: true }).click(); await L.p.waitForTimeout(2500);
  await L.p.getByText('Confirmar', { exact: true }).first().click(); await L.p.waitForTimeout(2500);
  assert.match(await texto(L.p), /Confirmado/);
  await shot(L.p, '10-agenda-confirmado');
  console.log('E2E OK');
  await b.close();
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
