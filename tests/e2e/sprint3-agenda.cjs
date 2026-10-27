// Teste ponta a ponta no navegador (Playwright) contra o emulador. Ver tests/e2e/LEIAME.md.
const { chromium, entrar } = require('./lib.cjs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const assert = require('node:assert/strict');

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
  // Funciona no Windows também (o cmd não tem mkdir -p).
  require('node:fs').rmSync('shots', { recursive: true, force: true }); require('node:fs').mkdirSync('shots');
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-navalha/databases/(default)/documents', { method: 'DELETE' });
  const ana = await uidDe('ana', 'Ana Souza'), beto = await uidDe('beto', 'Beto Lima'), lucas = await uidDe('lucas', 'Lucas Navalha');
  const env = await initializeTestEnvironment({ projectId: 'demo-navalha', firestore: { host: '127.0.0.1', port: 8080 } });
  const SEMANA = { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] };
  const exp = { 0: SEMANA, 1: SEMANA, 2: SEMANA, 3: SEMANA, 4: SEMANA, 5: SEMANA, 6: SEMANA };
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    const user = (uid, nome, papeis, papelAtivo, barbearias = []) => setDoc(doc(db, 'users', uid), {
      uid, nome, email: '', papeis, papelAtivo, barbearias, favoritos: { barbearias: [], barbeiros: [] },
      provedores: ['google'], maiorDeIdadeEm: Date.now(), criadoEm: Date.now() });
    await user(ana, 'Ana Souza', ['cliente'], 'cliente');
    await user(beto, 'Beto Lima', ['cliente'], 'cliente');
    await user(lucas, 'Lucas Navalha', ['dono'], 'dono', ['b1']);
    await setDoc(doc(db, 'barbearias/b1'), {
      id: 'b1', donoUid: lucas, nome: 'Navalha de Ouro', fotos: [], endereco: 'Rua A, 10', cidade: 'Sorocaba',
      geo: { lat: -23.5, lng: -47.4, geohash: '6gkz' }, expediente: exp, comodidades: [],
      politica: { cancelamentoGratisHoras: 2, toleranciaMin: 10 }, passoMin: 15, antecedenciaMin: 30, janelaDias: 30,
      resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [] },
      assinatura: { status: 'teste', venceEm: Date.now() + 60 * 86400e3, limiteBarbeiros: 10 }, emDia: true, barbeirosAtivos: 1, publicada: true, criadoEm: Date.now() });
    await setDoc(doc(db, 'barbearias/b1/barbeiros', lucas), { uid: lucas, barbeariaId: 'b1', nome: 'Lucas Navalha', especialidades: [], expediente: exp, ativo: true, nota: { media: 0, total: 0 } });
    await setDoc(doc(db, 'barbearias/b1/servicos/s1'), { id: 's1', barbeariaId: 'b1', barbeiroId: lucas, nome: 'Degradê', categoria: 'cabelo', precoCentavos: 4500, duracaoMin: 45, fotos: [], ativo: true });
  });
  await env.cleanup();

  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const A = await entrar(b, 'ana', 'Ana Souza');
  const B = await entrar(b, 'beto', 'Beto Lima');

  // 1) Página da barbearia → barbeiro (etapa 1) → corte (etapa 2) → dia e horário (etapa 3)
  await A.p.goto('http://127.0.0.1:8099/barbearia/b1'); await A.p.waitForTimeout(2500);
  await A.p.getByText('Lucas Navalha').first().click(); await A.p.waitForTimeout(2000);
  await A.p.getByText('Degradê').first().click(); await A.p.waitForTimeout(2500);
  assert.match(A.p.url(), /agendar\/b1/);
  await B.p.goto(A.p.url()); await B.p.waitForTimeout(3000);

  // 2) Os dois escolhem amanhã às 10:00 e confirmam no popup ao mesmo tempo: só um consegue
  const amanha = async X => { await X.p.getByText('Amanhã', { exact: true }).click(); await X.p.waitForTimeout(2000); };
  for (const X of [A, B]) {
    await amanha(X);
    await X.p.getByText('10:00', { exact: true }).click(); await X.p.waitForTimeout(500);
  }
  await shot(A.p, '1-reserva-confirmar');
  await Promise.all([A, B].map(X => X.p.getByRole('button', { name: 'Confirmar', exact: true }).click()));
  await Promise.all([A.p.waitForTimeout(4000), B.p.waitForTimeout(4000)]);
  // Quem conseguiu volta para a página da casa (com o aviso); quem perdeu fica no horário com o aviso de ocupado.
  const okA = /\/barbearia\/b1/.test(A.p.url()), okB = /\/barbearia\/b1/.test(B.p.url());
  console.log('Ana conseguiu:', okA, '| Beto conseguiu:', okB);
  assert.equal(Number(okA) + Number(okB), 1, 'exatamente um celular consegue o horário');
  const [venceu, perdeu] = okA ? [A, B] : [B, A];
  assert.match(await texto(perdeu.p), /acabou de ser (ocupado|reservado)/);
  await shot(venceu.p, '2-celular-1-reservou');
  await shot(perdeu.p, '3-celular-2-barrado');

  // 3) Meus agendamentos do vencedor
  await venceu.p.goto('http://127.0.0.1:8099/agendamentos'); await venceu.p.waitForTimeout(3000);
  assert.match(await texto(venceu.p), /Degradê com Lucas/);
  await shot(venceu.p, '4-meus-agendamentos');

  // 4) Agenda do barbeiro (dono) amanhã + encaixe
  const L = await entrar(b, 'lucas', 'Lucas Navalha');
  await L.p.goto('http://127.0.0.1:8099/agenda'); await L.p.waitForTimeout(3000);
  await amanha(L);
  assert.match(await texto(L.p), okA ? /Ana Souza/ : /Beto Lima/);
  await L.p.getByText('Encaixe', { exact: true }).click(); await L.p.waitForTimeout(2500);
  await L.p.getByPlaceholder('Ex.: João do 302').fill('João do balcão');
  await L.p.getByText('Degradê').first().click().catch(() => undefined);
  await L.p.getByText('14:00', { exact: true }).click();
  await shot(L.p, '5-encaixe');
  await L.p.getByText(/^Encaixar às/).click(); await L.p.waitForTimeout(3000);
  assert.match(await texto(L.p), /João do balcão · balcão/);
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

  // 6) Vencedor cancela (com motivo) → horário volta para o outro cliente
  await venceu.p.getByText('Cancelar horário').first().click(); await venceu.p.waitForTimeout(1000);
  await venceu.p.getByText('Escolha o motivo').click();
  await venceu.p.getByText('Dia errado', { exact: true }).click();
  await venceu.p.getByRole('button', { name: 'Cancelar', exact: true }).click(); await venceu.p.waitForTimeout(3000);
  assert.match(await texto(venceu.p), /Cancelado/);
  await amanha(perdeu);
  await perdeu.p.getByText('10:00', { exact: true }).click(); await perdeu.p.waitForTimeout(500);
  await perdeu.p.getByRole('button', { name: 'Confirmar', exact: true }).click(); await perdeu.p.waitForTimeout(4000);
  assert.match(perdeu.p.url(), /\/barbearia\/b1/);
  await shot(perdeu.p, '9-depois-do-cancelamento');

  // 7) A agenda do dono mostra o novo cliente às 10:00 (o "Confirmar" da casa saiu em 20/out)
  await L.p.goto('http://127.0.0.1:8099/agenda'); await L.p.waitForTimeout(3000);
  await amanha(L);
  assert.match(await texto(L.p), okA ? /Beto Lima/ : /Ana Souza/);
  await shot(L.p, '10-agenda-final');
  console.log('E2E OK');
  await b.close();
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
