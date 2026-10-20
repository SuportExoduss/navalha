// Barbearias, equipe, convites e cardápio.
// Busca por perto com geohash (sem API paga): consulta as faixas de geohash
// que cobrem o raio e filtra pela distância real.
import {
  arrayRemove, arrayUnion, collection, increment, serverTimestamp, deleteDoc, doc, endAt, getDoc, getDocs, onSnapshot, orderBy, query,
  setDoc, startAt, updateDoc, where, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import { cancelar } from './agendamentos';
import { esquecer, lembrar } from './cache';
import { DIAS_TESTE, LIMITE_TESTE } from '../lib/planos';
import type { Agendamento, AssinaturaCasa, Barbearia, Barbeiro, Convite, Expediente, Servico } from '../types/models';

export interface BarbeariaPerto extends Barbearia { distanciaKm: number }

/**
 * Lista "Perto de você". Cacheada por ~1 km (2 casas decimais): a posição rápida e a precisa,
 * que chegam uma logo depois da outra, caem na mesma chave e custam uma consulta só.
 */
export function buscarPerto(db: Firestore, lat: number, lng: number, raioKm = 10, { forcar = false } = {}): Promise<BarbeariaPerto[]> {
  return lembrar(`perto:${lat.toFixed(2)},${lng.toFixed(2)},${raioKm}`, () => buscarPertoServidor(db, lat, lng, raioKm), { forcar });
}

async function buscarPertoServidor(db: Firestore, lat: number, lng: number, raioKm: number): Promise<BarbeariaPerto[]> {
  const bounds = geohashQueryBounds([lat, lng], raioKm * 1000);
  const snaps = await Promise.all(bounds.map(([ini, fim]) => getDocs(query(
    collection(db, 'barbearias'),
    where('publicada', '==', true),
    where('emDia', '==', true), // teste ou mensalidade em dia; as regras também exigem
    orderBy('geo.geohash'), startAt(ini), endAt(fim),
  ))));
  const vistos = new Set<string>();
  const res: BarbeariaPerto[] = [];
  for (const s of snaps) for (const d of s.docs) {
    if (vistos.has(d.id)) continue;
    vistos.add(d.id);
    const b = d.data() as Barbearia;
    const km = distanceBetween([b.geo.lat, b.geo.lng], [lat, lng]);
    if (km <= raioKm) res.push({ ...b, distanciaKm: km });
  }
  return res.sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export function geoDe(lat: number, lng: number) {
  return { lat, lng, geohash: geohashForLocation([lat, lng]) };
}

export async function lerBarbearia(db: Firestore, id: string) {
  const s = await getDoc(doc(db, 'barbearias', id));
  return s.exists() ? (s.data() as Barbearia) : null;
}

export function ouvirBarbearia(db: Firestore, id: string, cb: (b: Barbearia | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'barbearias', id), s => cb(s.exists() ? (s.data() as Barbearia) : null), () => cb(null));
}

export async function listarBarbeiros(db: Firestore, barbeariaId: string) {
  const s = await getDocs(query(collection(db, 'barbearias', barbeariaId, 'barbeiros'), where('ativo', '==', true)));
  return s.docs.map(d => d.data() as Barbeiro);
}

export function ouvirBarbeiros(db: Firestore, barbeariaId: string, cb: (l: Barbeiro[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'barbearias', barbeariaId, 'barbeiros'), s => cb(s.docs.map(d => d.data() as Barbeiro)));
}

export async function listarServicos(db: Firestore, barbeariaId: string) {
  const s = await getDocs(query(collection(db, 'barbearias', barbeariaId, 'servicos'), where('ativo', '==', true)));
  return s.docs.map(d => d.data() as Servico);
}

export function ouvirServicosDoBarbeiro(
  db: Firestore, barbeariaId: string, barbeiroId: string, cb: (l: Servico[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'barbearias', barbeariaId, 'servicos'), where('barbeiroId', '==', barbeiroId));
  return onSnapshot(q, s => cb(s.docs.map(d => d.data() as Servico).sort((a, b) => a.nome.localeCompare(b.nome))));
}

/** Página pública da casa e o agendar usam os mesmos dados: lidos uma vez e guardados 5 min. */
export function dadosDaCasa(db: Firestore, id: string, { forcar = false } = {}) {
  return lembrar(`casa:${id}`, async () => {
    const [barbearia, equipe, servicos] = await Promise.all([lerBarbearia(db, id), listarBarbeiros(db, id), listarServicos(db, id)]);
    return { barbearia, equipe, servicos };
  }, { forcar });
}

/** Depois de qualquer gravação na casa: a próxima leitura (inclusive a lista perto) vem do servidor. */
function casaMudou(id: string) { esquecer(`casa:${id}`); esquecer('perto:'); }

export interface DadosBarbearia {
  nome: string; endereco: string; cidade: string; lat: number; lng: number; telefone?: string; instagram?: string;
}

const SEMANA = { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] };
/** Expediente inicial: terça a sexta 9h–19h com almoço, sábado 9h–17h. O dono ajusta depois. */
export const EXPEDIENTE_PADRAO = { 2: SEMANA, 3: SEMANA, 4: SEMANA, 5: SEMANA, 6: { abre: '09:00', fecha: '17:00' } };

/** A conta já usou os 60 dias grátis? (1 leitura, só no cadastro da casa) */
export async function jaUsouTeste(db: Firestore, uid: string): Promise<boolean> {
  return (await getDoc(doc(db, 'testes', uid))).exists();
}

/**
 * Dono cria a barbearia e já entra como primeiro barbeiro da casa, num só lote.
 * Primeira casa da conta: 60 dias grátis (as regras conferem que a conta ainda não usou o teste).
 * Depois disso (ex.: excluiu e criou outra), a casa nasce como rascunho e só entra na busca com um plano.
 */
export async function criarBarbearia(
  db: Firestore, dono: { uid: string; nome: string; fotoUrl?: string }, dados: DadosBarbearia,
): Promise<string> {
  const ref = doc(collection(db, 'barbearias'));
  const comTeste = !(await jaUsouTeste(db, dono.uid));
  const assinatura: AssinaturaCasa = comTeste
    ? { status: 'teste', venceEm: Date.now() + DIAS_TESTE * 86_400_000, limiteBarbeiros: LIMITE_TESTE }
    : { status: 'rascunho', limiteBarbeiros: 1 };
  const b: Barbearia = {
    id: ref.id,
    donoUid: dono.uid,
    nome: dados.nome.trim(),
    fotos: [],
    endereco: dados.endereco.trim(),
    cidade: dados.cidade.trim(),
    geo: geoDe(dados.lat, dados.lng),
    ...(dados.telefone?.trim() ? { telefone: dados.telefone.trim() } : {}),
    ...(dados.instagram?.trim() ? { instagram: dados.instagram.trim().replace(/^@/, '') } : {}),
    expediente: EXPEDIENTE_PADRAO,
    comodidades: [],
    politica: { cancelamentoGratisHoras: 2, toleranciaMin: 10 },
    passoMin: 15,
    antecedenciaMin: 30,
    janelaDias: 30,
    resumo: { notaApp: 0, totalAvaliacoesApp: 0, fotosDestaque: [] },
    pagamento: { pagarNoApp: false, sinalPercent: 0 },
    assinatura,
    emDia: comTeste,
    barbeirosAtivos: 1,
    mudouBarbeiro: dono.uid,
    publicada: false,
    criadoEm: Date.now(),
  };
  const barbeiro: Barbeiro = {
    uid: dono.uid, barbeariaId: ref.id, nome: dono.nome,
    ...(dono.fotoUrl ? { fotoUrl: dono.fotoUrl } : {}),
    especialidades: [], expediente: EXPEDIENTE_PADRAO, ativo: true, nota: { media: 0, total: 0 },
  };
  const batch = writeBatch(db);
  batch.set(ref, b);
  batch.set(doc(db, 'barbearias', ref.id, 'barbeiros', dono.uid), barbeiro);
  batch.update(doc(db, 'users', dono.uid), { barbearias: arrayUnion(ref.id) });
  // Marca de teste usado: coleção que só aceita criação (apagar o perfil não devolve o teste).
  if (comTeste) batch.set(doc(db, 'testes', dono.uid), { em: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export async function atualizarBarbearia(db: Firestore, id: string, dados: Partial<Pick<Barbearia,
  'nome' | 'endereco' | 'cidade' | 'telefone' | 'instagram' | 'capaUrl' | 'logoUrl' | 'fotos' | 'publicada' | 'comodidades' | 'googlePlaceId'>>) {
  await updateDoc(doc(db, 'barbearias', id), dados);
  casaMudou(id);
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir

export function gerarCodigo(rand: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(rand() * ALFABETO.length)]).join('');
}

/** Código curto (válido por 7 dias, uso único) para o barbeiro entrar na casa. */
export async function criarConvite(db: Firestore, barbeariaId: string, donoUid: string): Promise<string> {
  // Sorteio criptográfico (Math.random é previsível; SEC-014). 32 letras: byte % 32 não tem viés.
  // Import dinâmico: o expo-crypto é nativo e não carrega nos testes de Node que importam este arquivo.
  const { getRandomBytes } = await import('expo-crypto');
  const bytes = getRandomBytes(6);
  let i = 0;
  const codigo = gerarCodigo(() => (bytes[i++] % ALFABETO.length) / ALFABETO.length);
  const c: Convite = { codigo, barbeariaId, criadoPor: donoUid, expiraEm: Date.now() + 7 * 86_400_000 };
  await setDoc(doc(db, 'convites', codigo), c);
  return codigo;
}

export class ConviteInvalidoError extends Error {}

/** Barbeiro aceita o convite: marca o uso, cria seu perfil na casa e liga a casa à conta — tudo junto. */
export async function aceitarConvite(db: Firestore, codigoDigitado: string, eu: { uid: string; nome: string; fotoUrl?: string }) {
  const codigo = codigoDigitado.trim().toUpperCase();
  const snap = await getDoc(doc(db, 'convites', codigo)).catch(() => null);
  if (!snap?.exists()) throw new ConviteInvalidoError('Código não encontrado. Confira com o dono da barbearia.');
  const c = snap.data() as Convite;
  if (c.usadoPor) throw new ConviteInvalidoError('Este código já foi usado. Peça um novo ao dono.');
  if (c.expiraEm < Date.now()) throw new ConviteInvalidoError('Este código expirou. Peça um novo ao dono.');

  const batch = writeBatch(db);
  batch.update(doc(db, 'convites', codigo), { usadoPor: eu.uid });
  batch.set(doc(db, 'barbearias', c.barbeariaId, 'barbeiros', eu.uid), {
    uid: eu.uid, barbeariaId: c.barbeariaId, nome: eu.nome, ...(eu.fotoUrl ? { fotoUrl: eu.fotoUrl } : {}),
    especialidades: [], expediente: EXPEDIENTE_PADRAO, ativo: true, nota: { media: 0, total: 0 }, conviteCodigo: codigo,
  });
  batch.update(doc(db, 'users', eu.uid), { barbearias: arrayUnion(c.barbeariaId) });
  // Contador de ativos no mesmo lote: as regras recusam se o plano da casa já está cheio.
  batch.update(doc(db, 'barbearias', c.barbeariaId), { barbeirosAtivos: increment(1), mudouBarbeiro: eu.uid });
  await batch.commit().catch(e => {
    if ((e as { code?: string })?.code === 'permission-denied') {
      throw new ConviteInvalidoError('Não deu para entrar: a equipe dessa barbearia está completa no plano atual. Fale com o dono.');
    }
    throw e;
  });
  return c.barbeariaId;
}

/** Firestore não aceita `undefined`: dia fechado simplesmente não entra no mapa. */
export function limparExpediente(e: Expediente): Expediente {
  const r: Expediente = {};
  for (let d = 0; d < 7; d++) {
    const dia = e[d];
    if (!dia) continue;
    const pausas = (dia.pausas ?? []).filter(p => p.inicio && p.fim);
    r[d] = { abre: dia.abre, fecha: dia.fecha, ...(pausas.length ? { pausas } : {}) };
  }
  return r;
}

export async function salvarExpedienteCasa(db: Firestore, barbeariaId: string, e: Expediente) {
  await updateDoc(doc(db, 'barbearias', barbeariaId), { expediente: limparExpediente(e) });
  casaMudou(barbeariaId);
}

export async function salvarExpedienteBarbeiro(db: Firestore, barbeariaId: string, uid: string, e: Expediente) {
  await updateDoc(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), { expediente: limparExpediente(e) });
  casaMudou(barbeariaId);
}

/** Liga/desliga o barbeiro e ajusta o contador de ativos no mesmo lote (as regras barram passar do plano). */
export async function definirBarbeiroAtivo(db: Firestore, barbeariaId: string, uid: string, ativo: boolean) {
  const lote = writeBatch(db);
  lote.update(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), { ativo });
  lote.update(doc(db, 'barbearias', barbeariaId), { barbeirosAtivos: increment(ativo ? 1 : -1), mudouBarbeiro: uid });
  await lote.commit();
  casaMudou(barbeariaId);
}

// ---------- Cardápio ----------

export function novoIdServico(db: Firestore, barbeariaId: string): string {
  return doc(collection(db, 'barbearias', barbeariaId, 'servicos')).id;
}

export async function salvarServico(db: Firestore, s: Servico) {
  await setDoc(doc(db, 'barbearias', s.barbeariaId, 'servicos', s.id), s);
  casaMudou(s.barbeariaId);
}

export async function removerServico(db: Firestore, barbeariaId: string, id: string) {
  await deleteDoc(doc(db, 'barbearias', barbeariaId, 'servicos', id));
  casaMudou(barbeariaId);
}

/**
 * Recalcula a faixa de preço e as fotos de destaque do resumo da casa,
 * para a lista "Perto de você" continuar custando 1 leitura por card.
 */
export function resumoDoCardapio(servicos: Pick<Servico, 'precoCentavos' | 'fotos' | 'ativo' | 'categoria'>[]) {
  const ativos = servicos.filter(s => s.ativo);
  if (!ativos.length) return { fotosDestaque: [] as string[], categorias: [] as Servico['categoria'][] };
  const precos = ativos.map(s => s.precoCentavos);
  return {
    precoMin: Math.min(...precos),
    precoMax: Math.max(...precos),
    fotosDestaque: ativos.flatMap(s => s.fotos).slice(0, 3),
    categorias: [...new Set(ativos.map(s => s.categoria))].sort(),
  };
}

export async function atualizarResumoCardapio(db: Firestore, barbeariaId: string) {
  const todos = (await getDocs(collection(db, 'barbearias', barbeariaId, 'servicos'))).docs.map(d => d.data() as Servico);
  const r = resumoDoCardapio(todos);
  await updateDoc(doc(db, 'barbearias', barbeariaId), {
    'resumo.fotosDestaque': r.fotosDestaque,
    'resumo.categorias': r.categorias,
    ...(r.precoMin !== undefined ? { 'resumo.precoMin': r.precoMin, 'resumo.precoMax': r.precoMax } : {}),
  });
  casaMudou(barbeariaId);
}

/** Link de rota que abre Google Maps ou Waze — sem API paga. */
export function linksDeRota(lat: number, lng: number) {
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

/** Converte "45,90" ou "45" em centavos; null se inválido. */
export function precoParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!limpo) return null;
  const v = Number(limpo);
  if (!Number.isFinite(v) || v < 0 || v > 10_000) return null;
  return Math.round(v * 100);
}

export const MOTIVO_CASA_ENCERRADA = 'Barbearia encerrada';

/**
 * Exclui a barbearia (só o dono): cancela os horários futuros (o cliente vê o motivo e o horário é liberado),
 * apaga cardápio, folgas, equipe e a casa, e tira a casa do perfil do dono.
 * Os atendimentos passados ficam no histórico dos clientes (com o nome da casa gravado neles).
 */
export async function excluirBarbearia(db: Firestore, barbeariaId: string, donoUid: string, agora = Date.now()) {
  // Sem índice novo: lê os agendamentos da casa e filtra os futuros aqui (exclusão é rara).
  const daCasa = await getDocs(query(collection(db, 'agendamentos'), where('barbeariaId', '==', barbeariaId)));
  for (const d of daCasa.docs) {
    const a = d.data() as Agendamento;
    if (a.inicio > agora && ['reservado', 'confirmado'].includes(a.status)) {
      await cancelar(db, a, { por: 'casa', motivo: MOTIVO_CASA_ENCERRADA });
    }
  }
  // Equipe por último: as regras de cardápio e folgas ainda olham quem é da casa.
  for (const sub of ['servicos', 'bloqueios']) {
    const docs = (await getDocs(collection(db, 'barbearias', barbeariaId, sub))).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const lote = writeBatch(db);
      docs.slice(i, i + 400).forEach(x => lote.delete(x.ref));
      await lote.commit();
    }
  }
  // Cada barbeiro sai junto com o ajuste do contador (a regra do contador vale também aqui).
  for (const x of (await getDocs(collection(db, 'barbearias', barbeariaId, 'barbeiros'))).docs) {
    const lote = writeBatch(db);
    lote.delete(x.ref);
    lote.update(doc(db, 'barbearias', barbeariaId), { barbeirosAtivos: increment((x.data() as Barbeiro).ativo ? -1 : 0), mudouBarbeiro: x.id });
    await lote.commit();
  }
  const fim = writeBatch(db);
  fim.delete(doc(db, 'barbearias', barbeariaId));
  fim.update(doc(db, 'users', donoUid), { barbearias: arrayRemove(barbeariaId) });
  await fim.commit();
  casaMudou(barbeariaId);
}
