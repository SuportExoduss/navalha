// Métricas do Navalha numa página só (GET /metricas), para o dono do app.
// Fontes, todas gratuitas e com a mesma conta de serviço:
//  - Play Console: relatórios em CSV no bucket do desenvolvedor (instalações, desinstalações, visitas à página da loja).
//    A conta precisa de "Ver informações do app" GLOBAL na Play Console; o ID do bucket vai em PLAY_BUCKET.
//  - Play Developer Reporting API (Android vitals): falhas e ANRs do app, os mesmos que o Crashlytics veria no nativo.
//  - Firestore: contagens (usuários, casas, agendamentos) e a coleção `erros` (erros de JavaScript do app).
// O cron grava o retrato em `metricas/atual` 2x por dia; a página só lê. O botão "Recarregar" refaz na hora.
import { Firestore } from './firestore';
import { PACOTE } from './assinatura';

export interface Retrato {
  em: number;
  play: { dias: { data: string; instalacoes: number; desinstalacoes: number; visitas: number }[]; ativos: number | null } | null;
  falhas: { tipo: string; causa: string; ocorrencias: number; usuarios: number; versao: string; link: string }[] | null;
  firebase: { usuarios: number; barbearias: number; agendamentos30d: number; erros7d: number } | null;
  /** Fonte que falhou → mensagem (a página mostra o que deu e avisa o resto). */
  falhou: Record<string, string>;
}

const DIA = 86_400_000;

/** CSV da Play Console: UTF-16 com BOM, primeira linha é o cabeçalho. Devolve uma linha por objeto. */
export function lerCsv(bytes: ArrayBuffer): Record<string, string>[] {
  const u8 = new Uint8Array(bytes);
  const utf16 = u8[0] === 0xff && u8[1] === 0xfe;
  const texto = new TextDecoder(utf16 ? 'utf-16le' : 'utf-8').decode(u8).replace(/^﻿/, '');
  const [cab, ...linhas] = texto.split(/\r?\n/).filter(l => l.trim());
  if (!cab) return [];
  // ponytail: split simples; os relatórios usados aqui não têm vírgula dentro de campo (país, data, números).
  const nomes = cab.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  return linhas.map(l => Object.fromEntries(l.split(',').map((v, i) => [nomes[i], v.trim().replace(/^"|"$/g, '')])));
}

/** Primeiro número achado entre os nomes de coluna (a Play já renomeou colunas mais de uma vez). */
function num(linha: Record<string, string>, ...colunas: string[]): number {
  for (const c of colunas) if (linha[c] !== undefined && linha[c] !== '') return Number(linha[c]) || 0;
  return 0;
}

/** Junta o CSV de instalações (overview) e o de desempenho da loja (por país) num total por dia. */
export function juntarPlay(instalacoes: Record<string, string>[], loja: Record<string, string>[]): NonNullable<Retrato['play']> {
  const dias = new Map<string, { data: string; instalacoes: number; desinstalacoes: number; visitas: number }>();
  const dia = (data: string) => dias.get(data) ?? dias.set(data, { data, instalacoes: 0, desinstalacoes: 0, visitas: 0 }).get(data)!;
  let ativos: number | null = null, ultimo = '';
  for (const l of instalacoes) {
    if (!l.Date) continue;
    const d = dia(l.Date);
    d.instalacoes += num(l, 'Daily Device Installs', 'Install events', 'Daily User Installs');
    d.desinstalacoes += num(l, 'Daily Device Uninstalls', 'Uninstall events', 'Daily User Uninstalls');
    if (l.Date >= ultimo) { ultimo = l.Date; ativos = num(l, 'Installs on active devices', 'Active Device Installs', 'Current Device Installs'); }
  }
  for (const l of loja) if (l.Date) dia(l.Date).visitas += num(l, 'Store listing visitors', 'Store Listing Visitors');
  return { dias: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-30), ativos };
}

/** yyyyMM do mês de `agora` e do anterior (os 30 dias passam pela virada do mês). */
export function meses(agora: number): string[] {
  const d = new Date(agora);
  const ant = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const f = (x: Date) => `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
  return [f(ant), f(d)];
}

async function csvDoBucket(token: string, bucket: string, caminho: string): Promise<Record<string, string>[]> {
  const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(caminho)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return []; // mês sem relatório ainda (começo do mês ou app novo)
  if (!r.ok) throw new Error(`Bucket ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return lerCsv(await r.arrayBuffer());
}

async function play(token: string, bucket: string, agora: number) {
  const inst: Record<string, string>[] = [];
  const loja: Record<string, string>[] = [];
  for (const m of meses(agora)) {
    inst.push(...await csvDoBucket(token, bucket, `stats/installs/installs_${PACOTE}_${m}_overview.csv`));
    loja.push(...await csvDoBucket(token, bucket, `stats/store_performance/store_performance_${PACOTE}_${m}_country.csv`));
  }
  return juntarPlay(inst, loja);
}

async function falhas(token: string) {
  const r = await fetch(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACOTE}/errorIssues:search?pageSize=10`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Android vitals ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const { errorIssues = [] } = (await r.json()) as { errorIssues?: { type?: string; cause?: string; location?: string; errorReportCount?: string; distinctUsers?: string; lastAppVersion?: { versionCode?: string }; issueUri?: string }[] };
  return errorIssues.map(e => ({
    tipo: e.type === 'APPLICATION_NOT_RESPONDING' ? 'ANR' : e.type === 'CRASH' ? 'Falha' : (e.type ?? '?'),
    causa: [e.cause, e.location].filter(Boolean).join(' · ').slice(0, 200),
    ocorrencias: Number(e.errorReportCount ?? 0),
    usuarios: Number(e.distinctUsers ?? 0),
    versao: e.lastAppVersion?.versionCode ?? '',
    link: e.issueUri ?? '',
  }));
}

async function firebase(db: Firestore, agora: number) {
  const desde = (dias: number, campo: string) => ({ fieldFilter: { field: { fieldPath: campo }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(agora - dias * DIA) } } });
  const [usuarios, barbearias, agendamentos30d, erros7d] = await Promise.all([
    db.contar({ from: [{ collectionId: 'users' }] }),
    db.contar({ from: [{ collectionId: 'barbearias' }] }),
    db.contar({ from: [{ collectionId: 'agendamentos' }], where: desde(30, 'criadoEm') }),
    db.contar({ from: [{ collectionId: 'erros' }], where: desde(7, 'em') }),
  ]);
  return { usuarios, barbearias, agendamentos30d, erros7d };
}

/** Busca tudo, grava em `metricas/atual` e devolve. Uma fonte que falha não derruba as outras. */
export async function atualizarMetricas(db: Firestore, token: string, bucket: string | undefined, agora = Date.now()): Promise<Retrato> {
  const falhou: Record<string, string> = {};
  const tentar = <T>(nome: string, f: () => Promise<T>) => f().catch(e => { falhou[nome] = String((e as Error).message ?? e); return null; });
  const [p, c, fb] = await Promise.all([
    bucket ? tentar('play', () => play(token, bucket, agora)) : (falhou.play = 'Falta PLAY_BUCKET no wrangler.toml.', null),
    tentar('falhas', () => falhas(token)),
    tentar('firebase', () => firebase(db, agora)),
  ]);
  const retrato: Retrato = { em: agora, play: p, falhas: c, firebase: fb, falhou };
  // JSON num campo só: a página lê de uma vez e o formato pode mudar sem migrar documento.
  await db.escrever([{ caminho: 'metricas/atual', campos: { json: JSON.stringify(retrato), em: agora }, criar: true }]);
  return retrato;
}

export async function lerMetricas(db: Firestore): Promise<Retrato | null> {
  const doc = (await db.varios(['metricas/atual'])).get('metricas/atual');
  return typeof doc?.json === 'string' ? (JSON.parse(doc.json) as Retrato) : null;
}

// Página sem dado nenhum: pede a chave (ADMIN_TOKEN) uma vez, guarda no navegador e busca o JSON.
export const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Navalha · Métricas</title>
<style>
:root{--fundo:#16181b;--card:#1f2226;--texto:#eceae6;--fraco:#9a9894;--ambar:#f2a93b;--ruim:#e5675a;--bom:#5fb47a}
@media (prefers-color-scheme:light){:root{--fundo:#f4f2ee;--card:#fff;--texto:#1d1f22;--fraco:#6a6864;--ambar:#b8730f;--ruim:#c0392b;--bom:#2e7d4a}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--texto);font:15px/1.4 system-ui,sans-serif}
header{position:sticky;top:0;background:var(--fundo);display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--card)}
h1{font-size:18px;margin:0;flex:1;white-space:nowrap}button{background:var(--ambar);color:#16181b;border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer}
button:disabled{opacity:.5}main{max-width:960px;margin:0 auto;padding:16px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--fraco);margin:24px 0 8px}
.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.card{background:var(--card);border-radius:10px;padding:12px}
.n{font-size:28px;font-weight:700}.r{color:var(--fraco);font-size:13px}.aviso{color:var(--ruim);font-size:13px;margin:4px 0}
.barras{display:flex;align-items:flex-end;gap:2px;height:80px}.barras div{flex:1;display:flex;flex-direction:column-reverse;gap:1px}
.i{background:var(--bom)}.d{background:var(--ruim)}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px;border-bottom:1px solid var(--fundo)}
a{color:var(--ambar)}#quando{color:var(--fraco);font-size:13px;order:3;flex-basis:100%}
</style></head><body>
<header><h1>Navalha · Métricas</h1><span id="quando"></span><button id="recarregar">Recarregar</button></header>
<main id="conteudo"><p class="r">Carregando…</p></main>
<script>
const $ = s => document.querySelector(s);
const fmt = n => n == null ? '—' : typeof n === 'string' ? n : n.toLocaleString('pt-BR');
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
function chave() {
  let k = null; try { k = localStorage.getItem('chaveMetricas'); } catch {}
  if (!k) { k = prompt('Chave de administrador (ADMIN_TOKEN):') || ''; try { localStorage.setItem('chaveMetricas', k); } catch {} }
  return k;
}
async function buscar(metodo, rota) {
  const r = await fetch(rota, { method: metodo, headers: { Authorization: 'Bearer ' + chave() } });
  if (r.status === 401) { try { localStorage.removeItem('chaveMetricas'); } catch {} throw new Error('Chave errada. Recarregue a página.'); }
  const j = await r.json(); if (!r.ok) throw new Error(j.erro || r.status); return j;
}
const card = (n, rotulo) => '<div class="card"><div class="n">' + fmt(n) + '</div><div class="r">' + rotulo + '</div></div>';
const aviso = (r, fonte) => r.falhou && r.falhou[fonte] ? '<p class="aviso">Não consegui ler: ' + esc(r.falhou[fonte]) + '</p>' : '';
function desenhar(r) {
  if (!r) { $('#conteudo').innerHTML = '<p class="r">Ainda sem dados. Toque em Recarregar.</p>'; return; }
  $('#quando').textContent = 'Atualizado ' + new Date(r.em).toLocaleString('pt-BR');
  const dias = r.play ? r.play.dias : [], soma = k => dias.reduce((s, d) => s + d[k], 0);
  const max = Math.max(1, ...dias.map(d => d.instalacoes + d.desinstalacoes));
  const vis = soma('visitas'), ins = soma('instalacoes');
  let h = '<h2>Google Play · últimos 30 dias</h2>' + aviso(r, 'play');
  if (r.play) h += '<div class="grade">' + card(ins, 'Instalações') + card(soma('desinstalacoes'), 'Desinstalações') + card(vis, 'Acessos à página do app na Play')
    + card(vis ? Math.round(ins / vis * 100) + '%' : null, 'Visitas que instalaram') + card(r.play.ativos, 'Instalado em aparelhos ativos') + '</div>'
    + '<div class="card" style="margin-top:10px"><div class="barras">' + dias.map(d => '<div title="' + d.data + ': +' + d.instalacoes + ' / −' + d.desinstalacoes + '">'
    + '<span class="i" style="height:' + d.instalacoes / max * 80 + 'px"></span><span class="d" style="height:' + d.desinstalacoes / max * 80 + 'px"></span></div>').join('')
    + '</div><div class="r">Verde: instalações · vermelho: desinstalações (por dia; a Play publica com ~2 dias de atraso)</div></div>';
  h += '<h2>Falhas e travamentos (Android vitals)</h2>' + aviso(r, 'falhas');
  if (r.falhas) h += r.falhas.length ? '<div class="card" style="overflow-x:auto"><table><tr><th>Tipo</th><th>Causa</th><th>Ocorrências</th><th>Usuários</th><th>Versão</th></tr>'
    + r.falhas.map(f => '<tr><td>' + esc(f.tipo) + '</td><td>' + (f.link ? '<a href="' + esc(f.link) + '" target="_blank" rel="noopener">' + esc(f.causa || 'ver') + '</a>' : esc(f.causa)) + '</td><td>' + fmt(f.ocorrencias)
    + '</td><td>' + fmt(f.usuarios) + '</td><td>' + esc(f.versao) + '</td></tr>').join('') + '</table></div>' : '<p class="r">Nenhuma falha registrada. 🎉</p>';
  h += '<h2>Firebase</h2>' + aviso(r, 'firebase');
  if (r.firebase) h += '<div class="grade">' + card(r.firebase.usuarios, 'Contas') + card(r.firebase.barbearias, 'Barbearias') + card(r.firebase.agendamentos30d, 'Agendamentos (30 dias)')
    + card(r.firebase.erros7d, 'Erros do app (7 dias)') + '</div>';
  $('#conteudo').innerHTML = h;
}
async function carregar(metodo, rota) {
  $('#recarregar').disabled = true;
  try { desenhar(await buscar(metodo, rota)); } catch (e) { $('#conteudo').innerHTML = '<p class="aviso">' + esc(e.message) + '</p>'; }
  $('#recarregar').disabled = false;
}
$('#recarregar').onclick = () => carregar('POST', '/metricas/atualizar');
carregar('GET', '/metricas/dados');
setInterval(() => carregar('GET', '/metricas/dados'), 12 * 3600 * 1000); // aba aberta: pega o retrato novo do cron
</script></body></html>`;
