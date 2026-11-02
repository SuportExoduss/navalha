// Ponta a ponta: resumos anteriores (dono: geral + filtro por barbeiro; barbeiro: só o dele), a notificação do
// resumo abre o mês, os números abrem listas, o mês abre o relatório, segurar seleciona para exportar, e o expediente do barbeiro segue o da casa até ele mudar.
// Os resumos são gravados direto no emulador (no real quem grava é o Worker; a rotina tem teste no worker).
// Rodar com o emulador e o web-e2e no ar (LEIAME.md): node tests/e2e/resumos.cjs
const assert = require('assert');
const { chromium, entrar, BASE } = require('./lib.cjs');

const API = 'http://127.0.0.1:8080/v1/projects/demo-navalha/databases/(default)/documents';
const valor = x => typeof x === 'number' ? { integerValue: String(x) } : typeof x === 'boolean' ? { booleanValue: x }
  : Array.isArray(x) ? { arrayValue: { values: x.map(valor) } } : x === null ? { nullValue: null }
  : typeof x === 'object' ? { mapValue: { fields: campos(x) } } : { stringValue: x };
const campos = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)]));
async function gravar(caminho, dados, mesclar = false) {
  const mask = mesclar ? '?' + Object.keys(dados).map(k => `updateMask.fieldPaths=${k}`).join('&') : '';
  const r = await fetch(`${API}/${caminho}${mask}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ fields: campos(dados) }) });
  if (!r.ok) throw new Error(`${caminho}: ${await r.text()}`);
}
// A tela muda pelo cache local antes de o servidor confirmar: espera o campo chegar.
const esperarCampo = async (c, campo, v) => { for (let i = 0; i < 20; i++) { if ((await lerDoc(c))[campo]?.booleanValue === v) return; await new Promise(r => setTimeout(r, 250)); } assert.fail(`${c}.${campo} != ${v}`); };
const lerDoc = async c => (await (await fetch(`${API}/${c}`, { headers: { Authorization: 'Bearer owner' } })).json()).fields;
const resumo = (bid, mes, barbeiroId, nome, faturadoCentavos, porBarbeiro = []) => gravar(`resumos/${bid}_${mes}_${barbeiroId}`, {
  barbeariaId: bid, mes, barbeiroId, nome, em: Date.now(), agendamentos: 3, concluidos: 2, faltas: 0, cancelados: 1,
  faturadoCentavos, pelaApp: 2, maisPedido: { nome: 'Degradê', vezes: 2 }, porBarbeiro,
});

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-navalha/databases/(default)/documents', { method: 'DELETE' });
  const D = await entrar(b, `dono${Date.now()}`, 'Dono Resumo', { geolocation: { latitude: -23.5, longitude: -47.45 }, permissions: ['geolocation'] });
  const p = D.p;
  if (p.url().includes('/idade')) {
    await p.getByPlaceholder('DD/MM/AAAA').fill('01011990');
    await p.getByText('Continuar', { exact: true }).click(); await p.waitForTimeout(3000);
  }
  await p.getByText('Tenho uma barbearia').click(); await p.waitForTimeout(3000);
  if (!p.url().includes('/casa')) { await p.goto(`${BASE}/casa`); await p.waitForTimeout(3000); }
  await p.getByPlaceholder('Ex.: The Lord Barbearia').fill('Casa dos Resumos');
  await p.getByText('Usar minha localização atual').click(); await p.waitForTimeout(2000);
  await p.getByPlaceholder('Rua, número – bairro').fill('Rua C, 30');
  const cidade = p.getByText('Cidade', { exact: true }).locator('..').locator('input');
  if (!(await cidade.inputValue())) await cidade.fill('Sorocaba');
  await p.getByText('Criar barbearia', { exact: true }).click();
  await p.getByText('Começar grátis', { exact: true }).click();
  await p.getByText(/Pronto! Sua barbearia foi criada/).waitFor({ timeout: 30_000 });
  const bid = (await lerDoc(`users/${D.uid}`)).barbearias.arrayValue.values[0].stringValue;

  // Barbeiro Zeca na equipe: entra (cria o perfil) e é posto na casa direto no banco.
  const Z = await entrar(b, `zeca${Date.now()}`, 'Zeca Navalha');
  await gravar(`users/${Z.uid}`, { barbearias: [bid], papeis: ['cliente', 'barbeiro'], papelAtivo: 'barbeiro', maiorDeIdadeEm: Date.now() }, true);
  await gravar(`barbearias/${bid}/barbeiros/${Z.uid}`, { uid: Z.uid, barbeariaId: bid, nome: 'Zeca Navalha', apelido: 'Zeca', especialidades: [], expediente: {}, segueCasa: true, ativo: true });

  await resumo(bid, '2026-10', 'casa', 'Casa', 12000, [{ nome: 'Dono Resumo', concluidos: 1, faturadoCentavos: 7000 }, { nome: 'Zeca', concluidos: 1, faturadoCentavos: 5000 }]);
  await resumo(bid, '2026-10', D.uid, 'Dono Resumo', 7000);
  await resumo(bid, '2026-10', Z.uid, 'Zeca', 5000);
  await resumo(bid, '2026-09', 'casa', 'Casa', 9000);
  await resumo(bid, '2026-09', Z.uid, 'Zeca', 4000);
  // Atendimentos de outubro para exportar: um do dono, um do Zeca (cliente com ";" testa o CSV).
  const ag = (id, barbeiroId, barbeiroNome, clienteNome, dia, precoCentavos) => gravar(`agendamentos/${id}`, {
    id, barbeariaId: bid, barbeiroId, barbeiroNome, clienteUid: null, clienteNome, servicoId: 's1', servicoNome: 'Degradê',
    precoCentavos, duracaoMin: 30, data: `2026-10-${dia}`, inicio: Date.UTC(2026, 9, +dia, 17), fim: Date.UTC(2026, 9, +dia, 17, 30),
    slots: [], status: 'concluido', origem: 'balcao', lembretes: {}, criadoEm: Date.now(), atualizadoEm: Date.now(),
  });
  await ag('exp1', D.uid, 'Dono Resumo', 'Ana', '05', 7000);
  await ag('exp2', Z.uid, 'Zeca', 'Bia; Jr', '06', 5000);
  // Cancelado com motivo (outubro) e um corte que ainda vem no fim deste mês (o "A receber" do painel).
  await ag('exp3', Z.uid, 'Zeca', 'Caio', '07', 4000);
  await gravar('agendamentos/exp3', { status: 'cancelado', cancelamento: { por: 'cliente', motivo: 'Viagem', em: Date.now() } }, true);
  const agora = new Date(Date.now() - 3 * 3600e3); // Brasília
  const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0));
  const fimISO = fim.toISOString().slice(0, 10);
  await gravar('agendamentos/exp4', {
    id: 'exp4', barbeariaId: bid, barbeiroId: D.uid, barbeiroNome: 'Dono Resumo', clienteUid: null, clienteNome: 'Duda', servicoId: 's1',
    servicoNome: 'Barba', precoCentavos: 3500, duracaoMin: 30, data: fimISO, inicio: fim.getTime() + 23 * 3600e3, fim: fim.getTime() + 23.5 * 3600e3,
    slots: [], status: 'reservado', origem: 'balcao', lembretes: {}, criadoEm: Date.now(), atualizadoEm: Date.now(),
  });
  await gravar(`notificacoes/resumo_2026-09_${bid}`, { id: `resumo_2026-09_${bid}`, paraUid: D.uid, barbeariaId: bid, tipo: 'resumo_mes', titulo: 'Resumo de setembro de 2026', corpo: 'Faturado: R$ 90,00', em: Date.now(), lida: false });

  // Painel da casa: filtro Mês (o mês inteiro); "A receber" abre a lista com o corte do fim do mês.
  await p.goto(`${BASE}/casa`); await p.waitForTimeout(3500);
  await p.getByRole('button', { name: 'Mês', exact: true }).click(); await p.waitForTimeout(500);
  await p.getByLabel(/^A receber: R\$\s?35,00/).click();
  await p.waitForURL(/\/resumo-lista\?/, { timeout: 10_000 });
  await p.getByText('Duda', { exact: false }).first().waitFor({ timeout: 10_000 });
  let t = await p.innerText('body');
  assert.match(t, /Barba · Dono Resumo/); assert.match(t, /Reservado/); assert.match(t, /20:00/);
  await p.screenshot({ path: 'shots4/12-resumo-a-receber.png', fullPage: true });

  // Resumos anteriores: os meses viram cartões que abrem o relatório.
  await p.goto(`${BASE}/casa`); await p.waitForTimeout(3500);
  await p.getByText('Resumos anteriores', { exact: true }).click();
  await p.getByText('outubro de 2026', { exact: true }).waitFor({ timeout: 10_000 });
  t = await p.innerText('body');
  assert.match(t, /setembro de 2026/);
  assert.match(t, /R\$\s?120,00/);
  await p.screenshot({ path: 'shots4/9-resumos-geral.png', fullPage: true });
  await p.getByRole('button', { name: 'Zeca', exact: true }).click(); await p.waitForTimeout(500);
  t = await p.innerText('body');
  assert.match(t, /R\$\s?50,00/);
  assert.match(t, /R\$\s?40,00/);
  assert.doesNotMatch(t, /R\$\s?120,00/);
  await p.getByRole('button', { name: 'Geral', exact: true }).click(); await p.waitForTimeout(300);

  // Segurar seleciona; com seleção, o toque marca outro mês. O disquete exporta os selecionados num PDF só.
  const segurar = async loc => { const c = await loc.boundingBox(); await p.mouse.move(c.x + 20, c.y + 20); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); };
  await segurar(p.getByRole('button', { name: 'setembro de 2026' }));
  await p.getByText('1 mês selecionado').waitFor({ timeout: 5000 });
  await p.getByRole('button', { name: 'outubro de 2026' }).click();
  await p.getByText('2 meses selecionados').waitFor();
  await p.getByLabel('Exportar meses').click();
  await p.getByText('Exportar 2 meses').waitFor();
  await p.getByText('PDF', { exact: true }).click();
  await p.getByText('Pronto.').waitFor({ timeout: 10_000 });
  let pdf = await p.frames().filter(f => f !== p.mainFrame()).pop()?.content();
  assert.match(pdf ?? '', /Resumos de setembro de 2026 a outubro de 2026/);
  assert.equal(pdf.split('<section').length - 1, 2);
  assert.match(pdf, /Viagem/);
  await p.screenshot({ path: 'shots4/13-resumos-selecionados.png', fullPage: true });
  await p.getByText('Limpar', { exact: true }).click();
  await p.getByLabel('Exportar meses').click(); // fecha o menu

  // Toque em outubro: relatório completo (por barbeiro, serviços, dia a dia com o motivo do cancelamento).
  await p.getByRole('button', { name: 'outubro de 2026' }).click();
  await p.waitForURL(/\/resumo-mes\?mes=2026-10/, { timeout: 10_000 });
  await p.getByText('Dia a dia').waitFor({ timeout: 10_000 });
  await p.waitForTimeout(800);
  t = await p.innerText('body');
  assert.match(t, /Zeca: R\$\s?50,00 em 1 atendimento/);
  assert.match(t, /Degradê: 2× · R\$\s?120,00/);
  assert.match(t, /Cliente: Viagem/);
  await p.screenshot({ path: 'shots4/14-resumo-mes.png', fullPage: true });
  // "Faltas" do mês abre faltas e cancelados.
  await p.getByLabel(/^Faltas:/).filter({ visible: true }).click();
  await p.waitForURL(/\/resumo-lista\?/, { timeout: 10_000 });
  await p.getByText('Cancelados', { exact: true }).waitFor({ timeout: 10_000 });
  t = await p.innerText('body');
  assert.match(t, /Caio/); assert.match(t, /Cliente: Viagem/); assert.doesNotMatch(t, /Ana/);
  await p.goBack(); await p.getByText('Dia a dia').waitFor({ timeout: 10_000 });

  // Disquete do mês: só outubro. CSV do Zeca só com as linhas dele; PDF da casa com todas.
  const baixarCsv = async pg => {
    const [d] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: 'Planilha (CSV)' }).click()]);
    assert.match(d.suggestedFilename(), /^resumo-2026-10-.*\.csv$/);
    return require('fs').readFileSync(await d.path(), 'utf8');
  };
  await p.getByLabel('Exportar o mês').click();
  await p.getByText('Exportar outubro de 2026').waitFor();
  await p.getByRole('button', { name: 'Zeca', exact: true }).last().click();
  let csv = await baixarCsv(p);
  assert.match(csv, /^﻿Data;Hora;Barbeiro/);
  assert.match(csv, /06\/10\/2026;14:00;Zeca;"Bia; Jr";Degradê;50,00;Concluído;Balcão;/);
  assert.match(csv, /07\/10\/2026;14:00;Zeca;Caio;Degradê;40,00;Cancelado;Balcão;Cliente: Viagem/);
  assert.doesNotMatch(csv, /Ana/);
  await p.getByRole('button', { name: 'Barbearia toda', exact: true }).click();
  await p.getByText('PDF', { exact: true }).click();
  await p.getByText('Pronto.').waitFor({ timeout: 10_000 });
  pdf = await p.frames().filter(f => f !== p.mainFrame()).pop()?.content();
  assert.match(pdf ?? '', /Casa dos Resumos/);
  assert.match(pdf, /Ana/); assert.match(pdf, /Bia; Jr/);
  await p.screenshot({ path: 'shots4/11-resumos-exportar.png', fullPage: true });

  // Toque na notificação do resumo de setembro abre o relatório daquele mês.
  await p.goto(`${BASE}/agenda`); await p.waitForTimeout(3500);
  await p.getByLabel(/Notificações/).first().click(); await p.waitForTimeout(800);
  await p.getByText('Ver o resumo completo').click();
  await p.waitForURL(/\/resumo-mes\?mes=2026-09/, { timeout: 10_000 });
  await p.getByText('setembro de 2026').first().waitFor({ timeout: 10_000 });
  // Link antigo (push de versões anteriores) também cai no relatório.
  await p.goto(`${BASE}/resumos?mes=2026-10`);
  await p.waitForURL(/\/resumo-mes\?mes=2026-10/, { timeout: 10_000 });
  // Links forjados: tipo do protótipo, período de 10 anos ou data inexistente não derrubam a tela nem leem tudo.
  for (const q of ['tipo=toString&de=2016-01-01&ate=2026-12-31', 'tipo=faltas&de=2026-02-30&ate=2026-03-01', 'tipo=__proto__']) {
    await p.goto(`${BASE}/resumo-lista?${q}`);
    await p.getByText(/Período inválido/).filter({ visible: true }).waitFor({ timeout: 10_000 });
  }
  await p.goto(`${BASE}/resumo-lista?tipo=constructor&de=2026-10-01&ate=2026-10-31`);
  await p.getByText(/Todos os horários marcados/).filter({ visible: true }).waitFor({ timeout: 10_000 });

  // Barbeiro: só os dele, sem filtro e sem o geral, na lista, no relatório e na exportação.
  await Z.p.goto(`${BASE}/resumos`); await Z.p.getByText('outubro de 2026', { exact: true }).waitFor({ timeout: 10_000 });
  t = await Z.p.innerText('body');
  assert.match(t, /R\$\s?50,00/);
  assert.doesNotMatch(t, /R\$\s?120,00|Geral/);
  await Z.p.screenshot({ path: 'shots4/10-resumos-barbeiro.png', fullPage: true });
  await Z.p.getByRole('button', { name: 'outubro de 2026' }).click();
  await Z.p.getByText('Dia a dia').waitFor({ timeout: 10_000 });
  await Z.p.waitForTimeout(800);
  t = await Z.p.innerText('body');
  assert.match(t, /Bia; Jr/); assert.doesNotMatch(t, /Ana|Geral|Por barbeiro/);
  await Z.p.getByLabel('Exportar o mês').click();
  assert.doesNotMatch(await Z.p.innerText('body'), /Barbearia toda/);
  csv = await baixarCsv(Z.p);
  assert.match(csv, /Bia; Jr/); assert.doesNotMatch(csv, /Ana/);
  // Barbeiro forjando o link com o uid do dono (ou vazio, o "geral") continua vendo só os dele.
  for (const outro of [D.uid, '']) {
    await Z.p.goto(`${BASE}/resumo-lista?tipo=agendamentos&de=2026-10-01&ate=2026-10-31&barbeiro=${outro}`);
    await Z.p.getByText(/Bia; Jr/).filter({ visible: true }).first().waitFor({ timeout: 10_000 });
    assert.doesNotMatch(await Z.p.innerText('body'), /Ana/);
  }

  // Troca de papel pela URL: um cliente de fora abre as telas da casa direto pelo endereço. Nada da casa vaza e nada cai.
  const C = await entrar(b, `curioso${Date.now()}`, 'Curioso');
  await gravar(`users/${C.uid}`, { papeis: ['cliente'], papelAtivo: 'cliente', maiorDeIdadeEm: Date.now() }, true);
  const quedas = []; C.p.on('pageerror', e => quedas.push(e.message));
  for (const rota of ['/casa', '/agenda', '/resumos', '/resumo-mes?mes=2026-10', `/resumo-mes?mes=2026-10&barbeiro=${Z.uid}`,
    '/resumo-lista?tipo=agendamentos&de=2026-10-01&ate=2026-10-31', `/equipe/${D.uid}`, `/equipe/${Z.uid}`, '/expediente?alvo=casa',
    '/cardapio', '/configuracoes', '/clube', '/atendimento/exp1', '/atendimento/../../users', `/horario-fixo?casa=${bid}`, '/plano']) {
    await C.p.goto(`${BASE}${rota}`); await C.p.waitForTimeout(2500);
    assert.doesNotMatch(await C.p.innerText('body'), /Ana|Bia; Jr|Duda|R\$\s?120,00|R\$\s?50,00/, `cliente viu dados da casa em ${rota}`);
  }
  assert.deepEqual(quedas, [], 'tela caiu com URL forjada');
  // Link de fora no "depois" da tela da bateria: fica no Navalha (antes ia para o site do atacante).
  for (const fora of ['https://example.com', '//example.com', 'javascript:alert(1)']) {
    await C.p.goto(`${BASE}/bateria?depois=${encodeURIComponent(fora)}`); await C.p.waitForTimeout(3000);
    assert.ok(C.p.url().startsWith(BASE), `bateria redirecionou para ${C.p.url()}`);
  }
  await C.ctx.close();

  // Expediente: Zeca segue a casa; ao salvar o dele, aparece o botão para voltar ao da casa.
  await Z.p.goto(`${BASE}/expediente`); await Z.p.waitForTimeout(3000);
  assert.match(await Z.p.innerText('body'), /Você segue o horário da casa/);
  await Z.p.getByText('Salvar expediente', { exact: true }).click();
  await Z.p.getByText('Usar o horário da casa', { exact: true }).waitFor({ timeout: 10_000 });
  await esperarCampo(`barbearias/${bid}/barbeiros/${Z.uid}`, 'segueCasa', false);
  await Z.p.getByText('Usar o horário da casa', { exact: true }).click();
  await Z.p.getByText(/Você segue o horário da casa/).waitFor({ timeout: 10_000 });
  await esperarCampo(`barbearias/${bid}/barbeiros/${Z.uid}`, 'segueCasa', true);

  console.log('E2E RESUMOS OK');
  await b.close();
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
