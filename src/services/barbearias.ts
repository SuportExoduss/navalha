// Barbearias, equipe, convites e cardápio.
// Busca por perto com geohash (sem API paga): consulta as faixas de geohash
// que cobrem o raio e filtra pela distância real. O raio cresce até juntar barbearias suficientes.
import {
  limit,
  arrayRemove, arrayUnion, collection, increment, serverTimestamp, deleteDoc, doc, endAt, getDoc, getDocs, onSnapshot, orderBy, query,
  setDoc, startAt, updateDoc, where, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { distanceBetween, geohashForLocation, geohashQueryBounds } from 'geofire-common';
import type { User } from 'firebase/auth';
import { cancelar } from './agendamentos';
import { esquecer, lembrar } from './cache';
import { dataLocal } from '../lib/agenda';
import { DIAS_TESTE, LIMITE_TESTE } from '../lib/planos';
import type { Agendamento, AssinaturaCasa, Barbearia, Barbeiro, Convite, Expediente, Servico } from '../types/models';

export interface BarbeariaPerto extends Barbearia { distanciaKm: number }

/**
 * Lista "Perto de você". Cacheada por ~1 km (2 casas decimais): a posição rápida e a precisa,
 * que chegam uma logo depois da outra, caem na mesma chave e custam uma consulta só.
 */
export function buscarPerto(db: Firestore, lat: number, lng: number, { forcar = false } = {}): Promise<BarbeariaPerto[]> {
  return lembrar(`perto:${lat.toFixed(2)},${lng.toFixed(2)}`, () => buscarPertoServidor(db, lat, lng), { forcar });
}

/** Anéis da busca: para no primeiro que junta MINIMO_PERTO casas; null = todas (sem limite de distância). */
const ANEIS_KM = [10, 50, 300, null] as const;
const MINIMO_PERTO = 20;
// ponytail: o último anel lê até 100 casas sem ordem de distância; com milhares de casas no país, trocar por mais anéis.
const LIMITE_TODAS = 100;

async function buscarPertoServidor(db: Firestore, lat: number, lng: number): Promise<BarbeariaPerto[]> {
  let res: BarbeariaPerto[] = [];
  for (const raio of ANEIS_KM) {
    res = await buscarNoRaio(db, lat, lng, raio);
    if (res.length >= MINIMO_PERTO) break;
  }
  return res;
}

async function buscarNoRaio(db: Firestore, lat: number, lng: number, raioKm: number | null): Promise<BarbeariaPerto[]> {
  const base = [
    where('publicada', '==', true),
    where('emDia', '==', true), // teste ou mensalidade em dia; as regras também exigem
  ];
  const consultas = raioKm === null
    ? [query(collection(db, 'barbearias'), ...base, limit(LIMITE_TODAS))]
    : geohashQueryBounds([lat, lng], raioKm * 1000).map(([ini, fim]) =>
      query(collection(db, 'barbearias'), ...base, orderBy('geo.geohash'), startAt(ini), endAt(fim)));
  const snaps = await Promise.all(consultas.map(q => getDocs(q)));
  const vistos = new Set<string>();
  const res: BarbeariaPerto[] = [];
  for (const s of snaps) for (const d of s.docs) {
    if (vistos.has(d.id)) continue;
    vistos.add(d.id);
    const b = d.data() as Barbearia;
    const km = distanceBetween([b.geo.lat, b.geo.lng], [lat, lng]);
    if (raioKm === null || km <= raioKm) res.push({ ...b, distanciaKm: km });
  }
  return res.sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export function geoDe(lat: number, lng: number) {
  return { lat, lng, geohash: geohashForLocation([lat, lng]) };
}

export async function lerBarbearia(db: Firestore, id: string) {
  // Casa que não existe ou saiu do ar (despublicada, plano vencido): as regras recusam a leitura.
  // Para quem vê de fora é o mesmo que não existir; erro de conexão segue sendo erro.
  const s = await getDoc(doc(db, 'barbearias', id)).catch((e: { code?: string }) => {
    if (e?.code === 'permission-denied') return null;
    throw e;
  });
  return s?.exists() ? (s.data() as Barbearia) : null;
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

/** Parte privada do barbeiro (telefone): só o dono e ele mesmo leem. */
export interface EquipePrivado { telefone?: string }

export function ouvirEquipePrivado(db: Firestore, barbeariaId: string, uid: string, cb: (d: EquipePrivado) => void): Unsubscribe {
  return onSnapshot(doc(db, 'barbearias', barbeariaId, 'equipePrivado', uid), s => cb((s.data() ?? {}) as EquipePrivado), () => cb({}));
}

/** O telefone que o barbeiro salva no perfil vale para o dono de cada casa onde ele atende. */
export async function telefoneNaEquipe(db: Firestore, barbearias: string[], uid: string, telefone: string) {
  await Promise.all(barbearias.map(bid =>
    setDoc(doc(db, 'barbearias', bid, 'equipePrivado', uid), { telefone }, { merge: true }).catch(() => undefined)));
}

/** Foto e capa do cartão do barbeiro (o dono também pode trocar). */
export async function atualizarCartaoBarbeiro(db: Firestore, barbeariaId: string, uid: string, campos: { fotoUrl?: string; bannerUrl?: string }) {
  await updateDoc(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), campos);
  esquecer(`casa:${barbeariaId}`);
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
    const [barbearia, equipe, servicos] = await Promise.allSettled([lerBarbearia(db, id), listarBarbeiros(db, id), listarServicos(db, id)]);
    if (barbearia.status === 'rejected') throw barbearia.reason;
    // Casa que não existe: as regras recusam listar equipe e cardápio dela, e isso não é falha de conexão.
    if (!barbearia.value) return { barbearia: null, equipe: [], servicos: [] };
    if (equipe.status === 'rejected') throw equipe.reason;
    if (servicos.status === 'rejected') throw servicos.reason;
    return { barbearia: barbearia.value, equipe: equipe.value, servicos: servicos.value };
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
    especialidades: [], expediente: EXPEDIENTE_PADRAO, ativo: true,
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
  'nome' | 'endereco' | 'cidade' | 'telefone' | 'instagram' | 'capaUrl' | 'logoUrl' | 'fotos' | 'publicada' | 'comodidades' | 'pedirAvaliacao'>>) {
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
    especialidades: [], expediente: EXPEDIENTE_PADRAO, ativo: true, conviteCodigo: codigo,
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

/**
 * Liga/desliga o barbeiro e ajusta o contador de ativos no mesmo lote (as regras barram passar do plano).
 * Desligar cancela antes os horários futuros dele (libera os blocos) e avisa cada cliente: desligado, ele não vê
 * mais a agenda, e o cliente chegaria para ninguém. Devolve os ids cancelados (a tela avisa cada cliente).
 */
export async function definirBarbeiroAtivo(db: Firestore, barbeariaId: string, uid: string, ativo: boolean) {
  let cancelados: string[] = [];
  if (!ativo) {
    const agora = Date.now();
    const futuros = (await getDocs(query(collection(db, 'agendamentos'), where('barbeariaId', '==', barbeariaId),
      where('barbeiroId', '==', uid), where('data', '>=', dataLocal(agora)), orderBy('data'), orderBy('inicio'))))
      .docs.map(d => d.data() as Agendamento).filter(a => ['reservado', 'confirmado', 'pago'].includes(a.status) && a.inicio > agora);
    for (const a of futuros) await cancelar(db, a, { por: 'casa', motivo: 'O barbeiro não atende mais nesta barbearia.' });
    cancelados = futuros.map(a => a.id);
  }
  const lote = writeBatch(db);
  lote.update(doc(db, 'barbearias', barbeariaId, 'barbeiros', uid), { ativo });
  lote.update(doc(db, 'barbearias', barbeariaId), { barbeirosAtivos: increment(ativo ? 1 : -1), mudouBarbeiro: uid });
  await lote.commit();
  casaMudou(barbeariaId);
  return cancelados;
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

/**
 * Apps para chegar na casa ("Ver no mapa"), sem API paga. `esquema` é o que o celular confere para saber se o app
 * está instalado; o Google Maps sempre aparece (abre no navegador se faltar o app).
 * O 99 não tem link público para destino, então fica de fora.
 */
export function linksDeRota(lat: number, lng: number, nome: string) {
  const destino = `dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodeURIComponent(nome)}`;
  return [
    { app: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
    { app: 'Waze', esquema: 'waze://', url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
    { app: 'Uber', esquema: 'uber://', url: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&${destino}` },
  ];
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
export async function excluirBarbearia(db: Firestore, user: User, barbeariaId: string, agora = Date.now()) {
  const donoUid = user.uid;
  // Primeiro o Worker: avaliações públicas e fotos (o app não pode apagar). Se falhar, nada foi mexido ainda.
  const r = await fetch(`${process.env.EXPO_PUBLIC_WORKER_URL}/barbearia/excluir`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ barbeariaId }),
  });
  if (!r.ok) throw new Error(`Falha ao apagar as avaliações e fotos (${r.status}).`);
  // Sem índice novo: lê os agendamentos da casa e filtra os futuros aqui (exclusão é rara).
  const daCasa = await getDocs(query(collection(db, 'agendamentos'), where('barbeariaId', '==', barbeariaId)));
  for (const d of daCasa.docs) {
    const a = d.data() as Agendamento;
    if (a.inicio > agora && ['reservado', 'confirmado'].includes(a.status)) {
      await cancelar(db, a, { por: 'casa', motivo: MOTIVO_CASA_ENCERRADA });
    }
  }
  // Equipe por último: as regras de cardápio e folgas ainda olham quem é da casa.
  for (const sub of ['servicos', 'bloqueios', 'motivosFolga', 'equipePrivado']) {
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
