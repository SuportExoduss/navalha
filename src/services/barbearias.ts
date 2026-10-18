// Barbearias, equipe, convites e cardápio.
// Busca por perto com geohash (sem API paga): consulta as faixas de geohash
// que cobrem o raio e filtra pela distância real.
import {
  arrayUnion, collection, deleteDoc, doc, endAt, getDoc, getDocs, onSnapshot, orderBy, query,
  setDoc, startAt, updateDoc, where, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import type { Barbearia, Barbeiro, Convite, Expediente, Servico } from '../types/models';

export interface BarbeariaPerto extends Barbearia { distanciaKm: number }

export async function buscarPerto(db: Firestore, lat: number, lng: number, raioKm = 10): Promise<BarbeariaPerto[]> {
  const bounds = geohashQueryBounds([lat, lng], raioKm * 1000);
  const snaps = await Promise.all(bounds.map(([ini, fim]) => getDocs(query(
    collection(db, 'barbearias'),
    where('publicada', '==', true),
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

export interface DadosBarbearia {
  nome: string; endereco: string; cidade: string; lat: number; lng: number; telefone?: string; instagram?: string;
}

const SEMANA = { abre: '09:00', fecha: '19:00', pausas: [{ inicio: '12:00', fim: '13:00' }] };
/** Expediente inicial: terça a sexta 9h–19h com almoço, sábado 9h–17h. O dono ajusta depois. */
export const EXPEDIENTE_PADRAO = { 2: SEMANA, 3: SEMANA, 4: SEMANA, 5: SEMANA, 6: { abre: '09:00', fecha: '17:00' } };

/** Dono cria a barbearia e já entra como primeiro barbeiro da casa, num só lote. */
export async function criarBarbearia(
  db: Firestore, dono: { uid: string; nome: string; fotoUrl?: string }, dados: DadosBarbearia,
): Promise<string> {
  const ref = doc(collection(db, 'barbearias'));
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
    // Piloto: grátis. A cobrança da assinatura entra na Fase 3.
    assinatura: { status: 'teste' },
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
  await batch.commit();
  return ref.id;
}

export async function atualizarBarbearia(db: Firestore, id: string, dados: Partial<Pick<Barbearia,
  'nome' | 'endereco' | 'cidade' | 'telefone' | 'instagram' | 'capaUrl' | 'logoUrl' | 'fotos' | 'publicada' | 'comodidades' | 'googlePlaceId'>>) {
  await updateDoc(doc(db, 'barbearias', id), dados);
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir

export function gerarCodigo(rand: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(rand() * ALFABETO.length)]).join('');
}

/** Código curto (válido por 7 dias, uso único) para o barbeiro entrar na casa. */
export async function criarConvite(db: Firestore, barbeariaId: string, donoUid: string): Promise<string> {
  const codigo = gerarCodigo();
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
  await batch.commit();
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
}

export async function salvarExpedienteBarbeiro(db: Firestore, barbeariaId: string, uid: string, e: Expediente) {
  await updateDoc(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), { expediente: limparExpediente(e) });
}

export async function definirBarbeiroAtivo(db: Firestore, barbeariaId: string, uid: string, ativo: boolean) {
  await updateDoc(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), { ativo });
}

// ---------- Cardápio ----------

export function novoIdServico(db: Firestore, barbeariaId: string): string {
  return doc(collection(db, 'barbearias', barbeariaId, 'servicos')).id;
}

export async function salvarServico(db: Firestore, s: Servico) {
  await setDoc(doc(db, 'barbearias', s.barbeariaId, 'servicos', s.id), s);
}

export async function removerServico(db: Firestore, barbeariaId: string, id: string) {
  await deleteDoc(doc(db, 'barbearias', barbeariaId, 'servicos', id));
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
