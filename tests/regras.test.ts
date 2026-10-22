/// <reference types="node" />
// Testes das regras de segurança contra o emulador do Firestore.
// Rodar com:  npm run test:regras   (requer Java e o emulador do Firebase)
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, setDoc, updateDoc, runTransaction, where, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { chavesOcupacao, paraMillis } from '../src/lib/agenda';
import {
  agendamentosDaSemana, cancelar, concluir, criarFolga, definirStatus, horariosLivres, removerFolga, reservar, type NovaReserva,
} from '../src/services/agendamentos';
import { NOME_REMOVIDO } from '../src/services/usuarios';
import { MOTIVO_CASA_ENCERRADA, definirBarbeiroAtivo, excluirBarbearia } from '../src/services/barbearias';
import type { Barbearia, Barbeiro } from '../src/types/models';

let env: RulesTestEnvironment;
const inicio = paraMillis('2030-01-10', 10 * 60);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-navalha',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'barbearias/b1'), {
      id: 'b1', donoUid: 'dono', publicada: true, resumo: {},
      assinatura: { status: 'teste', venceEm: Date.now() + 86400e3, limiteBarbeiros: 10 }, emDia: true, barbeirosAtivos: 1, passoMin: 15,
    });
    await setDoc(doc(db, 'barbearias/b1/barbeiros/lucas'), { uid: 'lucas', ativo: true });
    // Cardápio: a reserva precisa bater preço, duração e barbeiro com estes serviços (SEC-003).
    await setDoc(doc(db, 'barbearias/b1/servicos/s'), { id: 's', barbeiroId: 'lucas', precoCentavos: 4500, duracaoMin: 30, ativo: true });
    await setDoc(doc(db, 'barbearias/b1/servicos/s1'), { id: 's1', barbeiroId: 'lucas', precoCentavos: 4500, duracaoMin: 45, ativo: true });
  });
});

function reservaDe(uid: string, id: string) {
  const db = env.authenticatedContext(uid).firestore();
  const slots = chavesOcupacao('lucas', inicio, 30, 15);
  return runTransaction(db, async tx => {
    for (const k of slots) {
      if ((await tx.get(doc(db, 'ocupacao', k))).exists()) throw new Error('ocupado');
    }
    tx.set(doc(db, 'agendamentos', id), {
      id, barbeariaId: 'b1', barbeiroId: 'lucas', clienteUid: uid, clienteNome: uid,
      servicoId: 's', servicoNome: 'Corte', precoCentavos: 4500, duracaoMin: 30,
      data: '2030-01-10', inicio, fim: inicio + 30 * 60_000, slots, status: 'reservado', origem: 'app',
      lembretes: {}, fotos: [], criadoEm: Date.now(), atualizadoEm: Date.now(),
    });
    for (const k of slots) tx.set(doc(db, 'ocupacao', k), { barbeariaId: 'b1', barbeiroId: 'lucas', agendamentoId: id, inicio });
    tx.set(doc(db, 'users', uid), { uid, ultimaReserva: serverTimestamp() }, { merge: true });
  });
}

test('cliente reserva; o segundo cliente no mesmo horário é barrado', async () => {
  await assertSucceeds(reservaDe('ana', 'a1'));
  await assert.rejects(reservaDe('beto', 'a2'));
});

// Reserva gravada à mão, como um app modificado faria: cria a ocupação de cada chave que mandar.
function reservaForjada(uid: string, id: string, f: { inicio: number; slots: string[]; duracaoMin?: number; fim?: number; servicoId?: string }) {
  const db = env.authenticatedContext(uid).firestore();
  const duracaoMin = f.duracaoMin ?? 30;
  return runTransaction(db, async tx => {
    tx.set(doc(db, 'agendamentos', id), {
      id, barbeariaId: 'b1', barbeiroId: 'lucas', clienteUid: uid, clienteNome: uid,
      servicoId: f.servicoId ?? 's', servicoNome: 'Corte', precoCentavos: 4500, duracaoMin,
      data: '2030-01-10', inicio: f.inicio, fim: f.fim ?? f.inicio + duracaoMin * 60_000, slots: f.slots, status: 'reservado', origem: 'app',
      lembretes: {}, fotos: [], criadoEm: Date.now(), atualizadoEm: Date.now(),
    });
    for (const k of f.slots) tx.set(doc(db, 'ocupacao', k), { barbeariaId: 'b1', barbeiroId: 'lucas', agendamentoId: id, inicio: f.inicio });
    tx.set(doc(db, 'users', uid), { uid, ultimaReserva: serverTimestamp() }, { merge: true });
  });
}

test('trava (SEC-017): os blocos precisam ser os do horário reservado', async () => {
  await reservaDe('ana', 'a1'); // 10:00–10:30
  const as18 = paraMillis('2030-01-10', 18 * 60);
  // Por cima da Ana, travando blocos de outro horário: não.
  await assertFails(reservaForjada('beto', 'f1', { inicio, slots: chavesOcupacao('lucas', as18, 30, 15) }));
  // 45 min com um bloco só, fim que não bate com a duração, início fora do passo: não.
  const as11 = paraMillis('2030-01-10', 11 * 60);
  await assertFails(reservaForjada('beto', 'f2', { inicio: as11, duracaoMin: 45, servicoId: 's1', slots: chavesOcupacao('lucas', as11, 15, 15) }));
  await assertFails(reservaForjada('beto', 'f3', { inicio: as11, fim: as11 + 15 * 60_000, slots: chavesOcupacao('lucas', as11, 30, 15) }));
  const as1107 = as11 + 7 * 60_000;
  await assertFails(reservaForjada('beto', 'f4', { inicio: as1107, slots: chavesOcupacao('lucas', as1107, 30, 15) }));
  // Com os blocos certos, a mesma gravação passa (45 min = 3 blocos).
  await assertSucceeds(reservaForjada('beto', 'f5', { inicio: as11, duracaoMin: 45, servicoId: 's1', slots: chavesOcupacao('lucas', as11, 45, 15) }));
});

test('não reserva serviço desativado nem barbeiro desligado', async () => {
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'barbearias/b1/servicos/s'), { ativo: false }));
  await assertFails(reservaDe('ana', 'a1'));
  await env.withSecurityRulesDisabled(async ctx => {
    await updateDoc(doc(ctx.firestore(), 'barbearias/b1/servicos/s'), { ativo: true });
    await updateDoc(doc(ctx.firestore(), 'barbearias/b1/barbeiros/lucas'), { ativo: false });
  });
  await assertFails(reservaDe('ana', 'a1'));
});

test('cliente não lê agendamento de outro; barbeiro da casa lê', async () => {
  await reservaDe('ana', 'a1');
  await assertFails(getDoc(doc(env.authenticatedContext('beto').firestore(), 'agendamentos/a1')));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('lucas').firestore(), 'agendamentos/a1')));
});

test('cliente não pode mudar preço nem marcar como pago', async () => {
  await reservaDe('ana', 'a1');
  const db = env.authenticatedContext('ana').firestore();
  await assertFails(updateDoc(doc(db, 'agendamentos/a1'), { precoCentavos: 1 }));
  await assertFails(updateDoc(doc(db, 'agendamentos/a1'), { status: 'pago' }));
});

test('ninguém se dá a assinatura ativa', async () => {
  const db = env.authenticatedContext('dono').firestore();
  await assertFails(updateDoc(doc(db, 'barbearias/b1'), { assinatura: { status: 'ativa' } }));
  await assertSucceeds(updateDoc(doc(db, 'barbearias/b1'), { nome: 'The Lord' }));
});

test('barbeiro só edita o próprio cardápio', async () => {
  const db = env.authenticatedContext('lucas').firestore();
  await assertSucceeds(setDoc(doc(db, 'barbearias/b1/servicos/s1'), { barbeiroId: 'lucas', ativo: true }));
  await assertFails(setDoc(doc(db, 'barbearias/b1/servicos/s2'), { barbeiroId: 'rafael', ativo: true }));
});

test('usuário só lê o próprio perfil', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/ana'), { uid: 'ana' }));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('ana').firestore(), 'users/ana')));
  await assertFails(getDoc(doc(env.authenticatedContext('beto').firestore(), 'users/ana')));
});

const casaNova = (id: string, dono: string, assinatura: object, emDia: boolean) => ({
  id, donoUid: dono, publicada: false, resumo: {}, assinatura, emDia, barbeirosAtivos: 1, mudouBarbeiro: dono,
});
const teste60 = () => ({ status: 'teste', venceEm: Date.now() + 60 * 86_400_000, limiteBarbeiros: 10 });

test('dono cria a barbearia com 60 dias grátis, uma vez por conta; depois só rascunho', async () => {
  const db = env.authenticatedContext('novo').firestore();
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/novo'), { uid: 'novo', barbearias: [] }));
  const criar = (id: string, assinatura: object, emDia: boolean, marca: boolean) => {
    const b = writeBatch(db);
    b.set(doc(db, 'barbearias', id), casaNova(id, 'novo', assinatura, emDia));
    b.set(doc(db, `barbearias/${id}/barbeiros/novo`), { uid: 'novo', ativo: true });
    if (marca) b.set(doc(db, 'testes/novo'), { em: serverTimestamp() });
    return b.commit();
  };
  await assertFails(criar('b2', teste60(), true, false)); // teste sem a marca
  await assertFails(criar('b2', { ...teste60(), venceEm: Date.now() + 365 * 86_400_000 }, true, true)); // teste de 1 ano
  await assertSucceeds(criar('b2', teste60(), true, true));
  await assertFails(criar('b3', teste60(), true, true)); // segundo teste da mesma conta
  await assertFails(criar('b3', { status: 'rascunho', limiteBarbeiros: 1 }, true, false)); // rascunho "em dia"
  await assertSucceeds(criar('b3', { status: 'rascunho', limiteBarbeiros: 1 }, false, false));
  await assertFails(deleteDoc(doc(db, 'testes/novo'))); // a marca não some
  // Ninguém cria barbearia em nome de outro dono.
  await assertFails(setDoc(doc(db, 'barbearias/b4'), casaNova('b4', 'outro', { status: 'rascunho', limiteBarbeiros: 1 }, false)));
});

const aceitarConvite = (uid: string, codigo = 'ABC234') => {
  const db = env.authenticatedContext(uid).firestore();
  const batch = writeBatch(db);
  batch.update(doc(db, 'convites', codigo), { usadoPor: uid });
  batch.set(doc(db, 'barbearias/b1/barbeiros', uid), { uid, ativo: true, conviteCodigo: codigo });
  batch.update(doc(db, 'barbearias/b1'), { barbeirosAtivos: increment(1), mudouBarbeiro: uid });
  return batch.commit();
};

test('barbeiro entra só com convite válido, uma única vez', async () => {
  const dono = env.authenticatedContext('dono').firestore();
  await assertSucceeds(setDoc(doc(dono, 'convites/ABC234'), { codigo: 'ABC234', barbeariaId: 'b1', criadoPor: 'dono', expiraEm: Date.now() + 86_400_000 }));
  await assertFails(setDoc(doc(env.authenticatedContext('intruso').firestore(), 'convites/ZZZ999'), { codigo: 'ZZZ999', barbeariaId: 'b1', criadoPor: 'intruso', expiraEm: Date.now() + 86_400_000 }));
  await assertSucceeds(aceitarConvite('rafael'));
  await assertFails(aceitarConvite('bruno')); // código já usado
  // Sem convite, ninguém se coloca na equipe.
  await assertFails(setDoc(doc(env.authenticatedContext('bruno').firestore(), 'barbearias/b1/barbeiros/bruno'), { uid: 'bruno', ativo: true }));
});

test('plano: equipe cheia barra convite e religar barbeiro; desligar libera a vaga', async () => {
  // Plano Equipe (3) com 3 ativos: dono, lucas e rafa.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'barbearias/b1'), { assinatura: { status: 'ativa', plano: 'equipe', limiteBarbeiros: 3 }, barbeirosAtivos: 3 });
    await setDoc(doc(db, 'barbearias/b1/barbeiros/rafa'), { uid: 'rafa', ativo: true });
    await setDoc(doc(db, 'barbearias/b1/barbeiros/zeca'), { uid: 'zeca', ativo: false });
    await setDoc(doc(db, 'convites/CHEIO2'), { codigo: 'CHEIO2', barbeariaId: 'b1', criadoPor: 'dono', expiraEm: Date.now() + 86_400_000 });
  });
  await assertFails(aceitarConvite('bruno', 'CHEIO2'));
  await assertFails(definirBarbeiroAtivo(dbDe('dono'), 'b1', 'zeca', true));
  // Burlar o contador: zerar sem desligar ninguém, ou desligar sem descontar.
  await assertFails(updateDoc(doc(dbDe('dono'), 'barbearias/b1'), { barbeirosAtivos: 0 }));
  await assertFails(updateDoc(doc(dbDe('dono'), 'barbearias/b1/barbeiros/rafa'), { ativo: false }));
  await assertSucceeds(definirBarbeiroAtivo(dbDe('dono'), 'b1', 'rafa', false));
  await assertSucceeds(definirBarbeiroAtivo(dbDe('dono'), 'b1', 'zeca', true));
});

test('assinatura e "em dia" só o servidor muda; casa vencida some da busca', async () => {
  const dono = dbDe('dono');
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'barbearias/b1'), { emDia: false }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { emDia: true, nome: 'x' }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { 'assinatura.limiteBarbeiros': 99 }));
  await assertFails(setDoc(doc(dono, 'assinaturas/b1'), { token: 'x' }));
  await assertFails(getDoc(doc(dbDe('ana'), 'barbearias/b1')));
  await assertSucceeds(getDoc(doc(dono, 'barbearias/b1')));
});

test('barbearia em rascunho só aparece para a própria casa', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'barbearias/rasc'), { id: 'rasc', donoUid: 'dono', publicada: false, assinatura: { status: 'teste' }, resumo: {} }));
  await assertFails(getDoc(doc(env.authenticatedContext('ana').firestore(), 'barbearias/rasc')));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('dono').firestore(), 'barbearias/rasc')));
});

// ---------- Sprint 3: agenda ----------

const corte = { id: 's1', nome: 'Degradê', precoCentavos: 4500, duracaoMin: 45 };
const novaReserva = (uid: string | null, inicioMs: number, extra: Partial<NovaReserva> = {}): NovaReserva => ({
  barbeariaId: 'b1', barbeiroId: 'lucas', servico: corte, cliente: { uid, nome: uid ?? 'Balcão' },
  inicio: inicioMs, passoMin: 15, origem: uid ? 'app' : 'balcao', ...extra,
});
// O contexto de teste devolve o tipo "compat"; em tempo de execução é o mesmo Firestore modular.
const dbDe = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
async function contarAgendamentos() {
  let n = 0;
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await getDocs(collection(ctx.firestore(), 'agendamentos'));
    n = s.docs.filter(d => d.data().status !== 'cancelado').length;
  });
  return n;
}

test('portão do Sprint 3: dois celulares no mesmo horário, só um consegue', async () => {
  const r = await Promise.allSettled([
    reservar(dbDe('ana'), novaReserva('ana', inicio)),
    reservar(dbDe('beto'), novaReserva('beto', inicio)),
  ]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(await contarAgendamentos(), 1);
});

test('horário que só se sobrepõe em parte também é barrado', async () => {
  await assertSucceeds(reservar(dbDe('ana'), novaReserva('ana', inicio))); // 10:00–10:45
  await assert.rejects(reservar(dbDe('beto'), novaReserva('beto', inicio + 30 * 60_000, { servico: { ...corte, id: 's', duracaoMin: 30 } })));
  await assertSucceeds(reservar(dbDe('beto'), novaReserva('beto', inicio + 45 * 60_000))); // 10:45 está livre
});

test('cliente cancela e o horário volta a ficar livre', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  const ag = (await getDoc(doc(dbDe('ana'), 'agendamentos', id))).data()!;
  await assertFails(cancelar(dbDe('beto'), { id, slots: ag.slots })); // ninguém cancela o dos outros
  await assertSucceeds(cancelar(dbDe('ana'), { id, slots: ag.slots }));
  await assertSucceeds(reservar(dbDe('beto'), novaReserva('beto', inicio)));
});

test('encaixe manual: só a casa lança cliente de balcão', async () => {
  await assertSucceeds(reservar(dbDe('lucas'), novaReserva(null, inicio)));
  await assertFails(reservar(dbDe('estranho'), novaReserva(null, inicio + 3_600_000)));
  // O encaixe também respeita a trava.
  await assert.rejects(reservar(dbDe('dono'), novaReserva(null, inicio)));
});

test('ninguém trava a agenda de um barbeiro com chaves de outro', async () => {
  const db = dbDe('ana');
  const slots = chavesOcupacao('rafael', inicio, 30, 15);
  await assertFails(runTransaction(db, async tx => {
    tx.set(doc(db, 'agendamentos', 'x1'), {
      id: 'x1', barbeariaId: 'b1', barbeiroId: 'lucas', clienteUid: 'ana', clienteNome: 'ana', servicoId: 's', servicoNome: 'c',
      precoCentavos: 1, duracaoMin: 30, data: '2030-01-10', inicio, fim: inicio + 1800000, slots, status: 'reservado',
      origem: 'app', lembretes: {}, fotos: [], criadoEm: 0, atualizadoEm: 0,
    });
    for (const k of slots) tx.set(doc(db, 'ocupacao', k), { barbeariaId: 'b1', barbeiroId: 'lucas', agendamentoId: 'x1', inicio });
  }));
});

test('agenda do dia: o dono lê a casa toda; o barbeiro só a dele; quem é de fora não', async () => {
  await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'barbearias/b1/barbeiros/rafael'), { uid: 'rafael', ativo: true }); });
  const daCasa = (uid: string) => getDocs(query(collection(dbDe(uid), 'agendamentos'),
    where('barbeariaId', '==', 'b1'), where('data', '==', '2030-01-10'), orderBy('inicio')));
  const doBarbeiro = (uid: string, barbeiroId: string) => getDocs(query(collection(dbDe(uid), 'agendamentos'),
    where('barbeariaId', '==', 'b1'), where('barbeiroId', '==', barbeiroId), where('data', '==', '2030-01-10'), orderBy('inicio')));
  assert.equal((await assertSucceeds(daCasa('dono'))).size, 1);
  assert.equal((await assertSucceeds(doBarbeiro('lucas', 'lucas'))).size, 1);
  await assertFails(daCasa('lucas')); // barbeiro não vê os clientes dos colegas
  await assertFails(doBarbeiro('rafael', 'lucas'));
  await assertFails(daCasa('beto'));
});

test('poderes: barbeiro só mexe nos próprios horários; o dono, em todos', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'barbearias/b1/barbeiros/rafael'), { uid: 'rafael', ativo: true }); });
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await assertFails(definirStatus(dbDe('rafael'), id, 'confirmado'));
  await assertFails(cancelar(dbDe('rafael'), { id, slots: chavesOcupacao('lucas', inicio, 45, 15) }, { por: 'casa', motivo: 'x' }));
  await assertFails(getDoc(doc(dbDe('rafael'), 'agendamentos', id)));
  // Encaixe na agenda de outro barbeiro: só o dono.
  await assertFails(reservar(dbDe('rafael'), novaReserva(null, inicio + 3_600_000)));
  await assertSucceeds(reservar(dbDe('dono'), novaReserva(null, inicio + 3_600_000)));
  await assertSucceeds(cancelar(dbDe('dono'), { id, slots: chavesOcupacao('lucas', inicio, 45, 15) }, { por: 'casa', motivo: 'Chuva' }));
  // Convite de barbeiro novo: só o dono.
  const convite = (uid: string) => setDoc(doc(dbDe(uid), 'convites/ABCDEF'), { codigo: 'ABCDEF', barbeariaId: 'b1', criadoPor: uid, expiraEm: Date.now() + 86400e3 });
  await assertFails(convite('lucas'));
  await assertSucceeds(convite('dono'));
});

test('a casa conclui ou marca falta; o cliente não', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await assertFails(definirStatus(dbDe('ana'), id, 'concluido'));
  await assertSucceeds(definirStatus(dbDe('lucas'), id, 'confirmado'));
  await assertSucceeds(definirStatus(dbDe('lucas'), id, 'faltou'));
});

test('folgas: barbeiro cuida só das próprias e elas somem dos horários livres', async () => {
  const dia = '2030-01-10'; // quinta
  const ini = paraMillis(dia, 0), fim = paraMillis(dia, 24 * 60);
  await assertSucceeds(criarFolga(dbDe('lucas'), 'b1', { barbeiroId: 'lucas', inicio: ini, fim, motivo: 'Médico' }));
  await assertFails(criarFolga(dbDe('lucas'), 'b1', { barbeiroId: 'rafael', inicio: ini, fim }));
  await assertFails(criarFolga(dbDe('beto'), 'b1', { barbeiroId: 'beto', inicio: ini, fim }));

  const exp = { 4: { abre: '09:00', fecha: '18:00' } };
  const barbearia = { id: 'b1', expediente: exp, passoMin: 15, antecedenciaMin: 0 } as unknown as Barbearia;
  const lucas = { uid: 'lucas', expediente: exp } as unknown as Barbeiro;
  const livres = (d: string) => horariosLivres(dbDe('ana'), { barbearia, barbeiro: lucas, duracaoMin: 30, data: d, agora: 0 });
  assert.deepEqual(await livres(dia), []);
  assert.ok((await livres('2030-01-17')).length > 0);

  const folgas = await getDocs(collection(dbDe('lucas'), 'barbearias/b1/bloqueios'));
  const fid = folgas.docs[0].id;
  // O motivo não vai no bloqueio (que todo cliente lê): fica à parte, só para a equipe.
  assert.equal(folgas.docs[0].data().motivo, undefined);
  await assertFails(setDoc(doc(dbDe('lucas'), 'barbearias/b1/bloqueios/x'), { id: 'x', barbeiroId: 'lucas', inicio: ini, fim, motivo: 'Médico' }));
  await assertFails(getDoc(doc(dbDe('ana'), 'barbearias/b1/motivosFolga', fid)));
  await assertSucceeds(getDoc(doc(dbDe('dono'), 'barbearias/b1/motivosFolga', fid)));
  assert.equal((await getDoc(doc(dbDe('lucas'), 'barbearias/b1/motivosFolga', fid))).data()?.motivo, 'Médico');

  await assertFails(deleteDoc(doc(dbDe('beto'), 'barbearias/b1/bloqueios', fid)));
  await assertSucceeds(removerFolga(dbDe('lucas'), 'b1', fid));
  // Folga sem motivo também sai (o lote apaga um motivo que não existe).
  const semMotivo = await criarFolga(dbDe('lucas'), 'b1', { barbeiroId: 'lucas', inicio: ini, fim });
  await assertSucceeds(removerFolga(dbDe('lucas'), 'b1', semMotivo));
});

test('horários livres descontam o que já foi reservado', async () => {
  const exp = { 4: { abre: '10:00', fecha: '12:00' } };
  const barbearia = { id: 'b1', expediente: exp, passoMin: 15, antecedenciaMin: 0 } as unknown as Barbearia;
  const lucas = { uid: 'lucas', expediente: exp } as unknown as Barbeiro;
  await reservar(dbDe('ana'), novaReserva('ana', inicio)); // 10:00–10:45
  const l = await horariosLivres(dbDe('beto'), { barbearia, barbeiro: lucas, duracaoMin: 45, data: '2030-01-10', agora: 0 });
  assert.equal(l[0], inicio + 45 * 60_000);
});

test('expediente: barbeiro edita o próprio; o da casa só o dono', async () => {
  const exp = { 2: { abre: '10:00', fecha: '18:00' } };
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/barbeiros/lucas'), { expediente: exp }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1'), { expediente: exp }));
  await assertSucceeds(updateDoc(doc(dbDe('dono'), 'barbearias/b1'), { expediente: exp }));
});

test('configurações: nome, capa e foto de perfil da casa só o dono troca', async () => {
  const foto = 'https://navalha-worker.navalha-worker.workers.dev/fotos/barbearia/b1/y.webp';
  for (const campos of [{ nome: 'Outro nome' }, { capaUrl: foto }, { logoUrl: foto }, { googlePlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }]) {
    await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1'), campos));
    await assertFails(updateDoc(doc(dbDe('ana'), 'barbearias/b1'), campos));
    await assertSucceeds(updateDoc(doc(dbDe('dono'), 'barbearias/b1'), campos));
  }
});

test('excluir barbearia: só o dono; cancela o futuro, libera os horários e apaga a casa', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'users/dono'), { uid: 'dono', barbearias: ['b1'] });
    await setDoc(doc(ctx.firestore(), 'barbearias/b1/barbeiros/dono'), { uid: 'dono', ativo: true });
  });
  await reservaDe('ana', 'a1');
  await assertFails(deleteDoc(doc(dbDe('lucas'), 'barbearias/b1')));
  await assertFails(deleteDoc(doc(dbDe('ana'), 'barbearias/b1')));

  await excluirBarbearia(dbDe('dono'), 'b1', 'dono', 0);
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const a = (await getDoc(doc(db, 'agendamentos/a1'))).data()!;
    assert.equal(a.status, 'cancelado');
    assert.equal(a.cancelamento.motivo, MOTIVO_CASA_ENCERRADA);
    assert.equal((await getDocs(query(collection(db, 'ocupacao'), where('agendamentoId', '==', 'a1')))).size, 0);
    assert.equal((await getDoc(doc(db, 'barbearias/b1'))).exists(), false);
    assert.equal((await getDocs(collection(db, 'barbearias/b1/servicos'))).size, 0);
    assert.equal((await getDocs(collection(db, 'barbearias/b1/barbeiros'))).size, 0);
    assert.deepEqual((await getDoc(doc(db, 'users/dono'))).data()!.barbearias, []);
  });
});

test('notificações: só o destinatário lê; só marca como lida; ninguém cria pelo app', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'notificacoes/n1'), {
    id: 'n1', paraUid: 'lucas', barbeariaId: 'b1', tipo: 'agendado', titulo: 't', corpo: 'c', em: 1, lida: false,
  }));
  await assertSucceeds(getDoc(doc(dbDe('lucas'), 'notificacoes/n1')));
  await assertFails(getDoc(doc(dbDe('ana'), 'notificacoes/n1')));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'notificacoes/n1'), { corpo: 'outro' }));
  await assertFails(updateDoc(doc(dbDe('ana'), 'notificacoes/n1'), { lida: true }));
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'notificacoes/n1'), { lida: true }));
  await assertFails(setDoc(doc(dbDe('lucas'), 'notificacoes/n2'), { paraUid: 'lucas', lida: false }));
  await assertFails(deleteDoc(doc(dbDe('lucas'), 'notificacoes/n1')));
});

// ---------- Sprint 4: cliente ----------

test('barbeiro atualiza só o resumo do cardápio da casa', async () => {
  const db = dbDe('lucas');
  await assertSucceeds(updateDoc(doc(db, 'barbearias/b1'), { 'resumo.precoMin': 3000, 'resumo.categorias': ['cabelo'] }));
  await assertFails(updateDoc(doc(db, 'barbearias/b1'), { 'resumo.notaApp': 5 }));
  await assertFails(updateDoc(doc(db, 'barbearias/b1'), { nome: 'Outro nome' }));
  await assertFails(updateDoc(doc(dbDe('beto'), 'barbearias/b1'), { 'resumo.precoMin': 1 }));
});

test('exclusão de conta: cliente cancela e tira o nome do histórico, e só isso', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  const ref = doc(dbDe('ana'), 'agendamentos', id);
  await assertFails(updateDoc(ref, { clienteNome: 'Outra pessoa', atualizadoEm: 1 }));
  await assertFails(updateDoc(doc(dbDe('beto'), 'agendamentos', id), { clienteNome: NOME_REMOVIDO, atualizadoEm: 1 }));
  const ag = (await getDoc(ref)).data()!;
  await assertSucceeds(cancelar(dbDe('ana'), { id, slots: ag.slots }));
  await assertSucceeds(updateDoc(ref, { clienteNome: NOME_REMOVIDO, atualizadoEm: 1 }));
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/ana'), { uid: 'ana' }));
  await assertSucceeds(deleteDoc(doc(dbDe('ana'), 'users/ana')));
});

test('barbeiro conclui com foto; painel do dono lê a semana', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await assertSucceeds(concluir(dbDe('lucas'), id, ['https://fotos/corte/x.webp']));
  await assertFails(concluir(dbDe('ana'), id, []));
  const l = await assertSucceeds(agendamentosDaSemana(dbDe('dono'), 'b1', '2030-01-12'));
  assert.equal(l.length, 1);
  await assertFails(agendamentosDaSemana(dbDe('beto'), 'b1', '2030-01-12'));
});

// ---------- Correções de segurança (auditoria 18/out/2026) ----------

/** Reserva "na mão", com campos à escolha do atacante, criando a ocupação na mesma transação. */
function reservaCrua(uid: string, id: string, campos: Record<string, unknown>, slots: string[]) {
  const db = dbDe(uid);
  const barbeiroId = (campos.barbeiroId ?? 'lucas') as string;
  return runTransaction(db, async tx => {
    tx.set(doc(db, 'agendamentos', id), {
      id, barbeariaId: 'b1', barbeiroId, clienteUid: uid, clienteNome: uid, servicoId: 's1', servicoNome: 'Degradê',
      precoCentavos: 4500, duracaoMin: 45, data: '2030-01-10', inicio, fim: inicio + 45 * 60_000, slots,
      status: 'reservado', origem: 'app', lembretes: {}, fotos: [], criadoEm: 0, atualizadoEm: 0, ...campos,
    });
    for (const k of slots) tx.set(doc(db, 'ocupacao', k), { barbeariaId: 'b1', barbeiroId, agendamentoId: id, inicio });
    tx.set(doc(db, 'users', uid), { uid, ultimaReserva: serverTimestamp() }, { merge: true });
  });
}

test('SEC-001: barbeiroId com caracteres de regex não trava a agenda de outro barbeiro', async () => {
  const slotsDoLucas = chavesOcupacao('lucas', inicio, 45, 15);
  await assertFails(reservaCrua('ana', 'x1', { barbeiroId: '.*' }, slotsDoLucas));
  // Barbeiro que não é da casa também não serve de chave.
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'barbearias/b1/servicos/sr'), { id: 'sr', barbeiroId: 'rafael', precoCentavos: 4500, duracaoMin: 45 }));
  await assertFails(reservaCrua('ana', 'x2', { barbeiroId: 'rafael', servicoId: 'sr' }, chavesOcupacao('rafael', inicio, 45, 15)));
  // A reserva honesta continua passando.
  await assertSucceeds(reservaCrua('ana', 'x3', {}, slotsDoLucas));
});

test('SEC-003: preço, duração e barbeiro precisam bater com o cardápio', async () => {
  const slots = chavesOcupacao('lucas', inicio, 45, 15);
  await assertFails(reservaCrua('ana', 'p1', { precoCentavos: 100 }, slots));
  await assertFails(reservaCrua('ana', 'p2', { duracaoMin: 15 }, slots));
  await assertFails(reservaCrua('ana', 'p3', { servicoId: 'nao-existe' }, slots));
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'barbearias/b1/servicos/sx'), { id: 'sx', barbeiroId: 'outro', precoCentavos: 4500, duracaoMin: 45 }));
  await assertFails(reservaCrua('ana', 'p4', { servicoId: 'sx' }, slots));
  await assertSucceeds(reservaCrua('ana', 'p5', {}, slots));
});

test('SEC-004: cliente não apaga a própria falta; a casa não reativa reserva cancelada', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await assertSucceeds(definirStatus(dbDe('lucas'), id, 'faltou'));
  await assertFails(updateDoc(doc(dbDe('ana'), 'agendamentos', id), { status: 'cancelado', atualizadoEm: 1 }));

  const id2 = await reservar(dbDe('beto'), novaReserva('beto', inicio + 3_600_000));
  const ag = (await getDoc(doc(dbDe('beto'), 'agendamentos', id2))).data()!;
  await assertSucceeds(cancelar(dbDe('beto'), { id: id2, slots: ag.slots }));
  await assertFails(definirStatus(dbDe('lucas'), id2, 'confirmado'));
});

test('cancelamento com motivo: cada lado assina o seu, e o motivo só vale junto com o cancelar', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  const ag = (await getDoc(doc(dbDe('ana'), 'agendamentos', id))).data()!;
  const ref = (uid: string) => doc(dbDe(uid), 'agendamentos', id);
  // Motivo sem cancelar, motivo grande demais ou assinado como a casa: não.
  await assertFails(updateDoc(ref('ana'), { cancelamento: { por: 'cliente', motivo: 'x', em: 1 }, atualizadoEm: 1 }));
  await assertFails(cancelar(dbDe('ana'), { id, slots: ag.slots }, { por: 'casa', motivo: 'Fingindo ser a barbearia' }));
  // O app corta em 200; aqui grava direto, como um atacante faria, para provar que a regra barra.
  await assertFails(updateDoc(ref('ana'), { status: 'cancelado', atualizadoEm: 1, cancelamento: { por: 'cliente', motivo: 'x'.repeat(201), em: 1 } }));
  // O certo passa e fica registrado.
  await assertSucceeds(cancelar(dbDe('ana'), { id, slots: ag.slots }, { por: 'cliente', motivo: 'Imprevisto' }));
  const c = (await getDoc(ref('lucas'))).data()!.cancelamento;
  assert.equal(c.por, 'cliente');
  assert.equal(c.motivo, 'Imprevisto');

  // A casa cancela com o motivo dela; não consegue assinar como o cliente.
  const id2 = await reservar(dbDe('beto'), novaReserva('beto', inicio + 3_600_000));
  const ag2 = (await getDoc(doc(dbDe('beto'), 'agendamentos', id2))).data()!;
  await assertFails(cancelar(dbDe('lucas'), { id: id2, slots: ag2.slots }, { por: 'cliente', motivo: 'Desisti' }));
  await assertSucceeds(cancelar(dbDe('lucas'), { id: id2, slots: ag2.slots }, { por: 'casa', motivo: 'Barbeiro indisponível' }));
  // Cancelar sem motivo continua valendo (versões antigas do app).
  const id3 = await reservar(dbDe('carla'), novaReserva('carla', inicio + 7_200_000));
  const ag3 = (await getDoc(doc(dbDe('carla'), 'agendamentos', id3))).data()!;
  await assertSucceeds(cancelar(dbDe('carla'), { id: id3, slots: ag3.slots }));
});

test('SEC-005: dono só mexe no clube da própria casa', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'barbearias/b2'), { id: 'b2', donoUid: 'outroDono', publicada: true, assinatura: { status: 'teste' }, resumo: {} }));
  await assertSucceeds(setDoc(doc(dbDe('dono'), 'clubes/c1'), { barbeariaId: 'b1', nome: 'Clube 2 cortes' }));
  // O dono da b2 não sequestra o clube da b1 trocando o barbeariaId para a casa dele.
  await assertFails(setDoc(doc(dbDe('outroDono'), 'clubes/c1'), { barbeariaId: 'b2', nome: 'Meu agora' }));
  await assertFails(deleteDoc(doc(dbDe('outroDono'), 'clubes/c1')));
  // O próprio dono edita, mas não muda a casa do clube.
  await assertSucceeds(updateDoc(doc(dbDe('dono'), 'clubes/c1'), { nome: 'Clube 3 cortes' }));
  await assertFails(updateDoc(doc(dbDe('dono'), 'clubes/c1'), { barbeariaId: 'b2' }));
  await assertSucceeds(deleteDoc(doc(dbDe('dono'), 'clubes/c1')));
});

test('SEC-006: a mesma conta espera 20 s entre reservas, e a marca é sempre do servidor', async () => {
  await assertSucceeds(reservar(dbDe('ana'), novaReserva('ana', inicio)));
  // Logo em seguida, outro horário livre: barrado pelo intervalo.
  await assertFails(reservar(dbDe('ana'), novaReserva('ana', inicio + 3_600_000)));
  // Outra pessoa não é afetada.
  await assertSucceeds(reservar(dbDe('beto'), novaReserva('beto', inicio + 3_600_000)));
  // Ninguém "volta o relógio" gravando uma data antiga na marca.
  await assertFails(updateDoc(doc(dbDe('ana'), 'users/ana'), { ultimaReserva: new Date(0) }));
  // Reserva "na mão" sem a marca também não passa.
  const db = dbDe('carla');
  const slots = chavesOcupacao('lucas', inicio + 7_200_000, 45, 15);
  await assertFails(runTransaction(db, async tx => {
    tx.set(doc(db, 'agendamentos', 'sem-marca'), {
      id: 'sem-marca', barbeariaId: 'b1', barbeiroId: 'lucas', clienteUid: 'carla', clienteNome: 'carla', servicoId: 's1', servicoNome: 'Degradê',
      precoCentavos: 4500, duracaoMin: 45, data: '2030-01-10', inicio: inicio + 7_200_000, fim: inicio + 7_200_000 + 45 * 60_000, slots,
      status: 'reservado', origem: 'app', lembretes: {}, fotos: [], criadoEm: 0, atualizadoEm: 0,
    });
    for (const k of slots) tx.set(doc(db, 'ocupacao', k), { barbeariaId: 'b1', barbeiroId: 'lucas', agendamentoId: 'sem-marca', inicio: inicio + 7_200_000 });
  }));
});

test('SEC-006: eventos só com campos e tipos conhecidos', async () => {
  const db = dbDe('ana');
  await assertSucceeds(setDoc(doc(db, 'eventos/e1'), { tipo: 'agendou', uid: 'ana', barbeariaId: 'b1', em: 1 }));
  await assertFails(setDoc(doc(db, 'eventos/e2'), { tipo: 'agendou', uid: 'ana', em: 1, lixo: 'x'.repeat(1000) }));
  await assertFails(setDoc(doc(db, 'eventos/e3'), { tipo: 'qualquer', uid: 'ana', em: 1 }));
});
test('SEC-008: comissão não entra no perfil público do barbeiro', async () => {
  await assertFails(updateDoc(doc(dbDe('dono'), 'barbearias/b1/barbeiros/lucas'), { comissaoPercent: 40 }));
  await assertSucceeds(updateDoc(doc(dbDe('dono'), 'barbearias/b1/barbeiros/lucas'), { ativo: true }));
});

test('SEC-009: foto só do nosso Worker ou da conta Google', async () => {
  const dono = dbDe('dono');
  await assertSucceeds(updateDoc(doc(dono, 'barbearias/b1'), { capaUrl: 'https://navalha-worker.navalha-worker.workers.dev/fotos/barbearia/b1/x.webp' }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { capaUrl: 'https://rastreio.exemplo.com/pixel.gif' }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { capaUrl: 'https://navalha-worker.navalha-worker.workers.dev.malicioso.com/fotos/x.webp' }));
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/ana'), { uid: 'ana' }));
  await assertSucceeds(updateDoc(doc(dbDe('ana'), 'users/ana'), { fotoUrl: 'https://lh3.googleusercontent.com/a/abc=s96-c' }));
  await assertFails(updateDoc(doc(dbDe('ana'), 'users/ana'), { fotoUrl: 'javascript:alert(1)' }));
  // Cardápio: no máximo 6 fotos por corte.
  const sete = Array.from({ length: 7 }, (_, i) => `https://navalha-worker.navalha-worker.workers.dev/fotos/servico/s/${i}.webp`);
  await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/servicos/s1'), { fotos: sete }));
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/servicos/s1'), { fotos: sete.slice(0, 6) }));
});

test('capa (banner): só do nosso Worker, no perfil e no cartão do barbeiro', async () => {
  const capa = 'https://navalha-worker.navalha-worker.workers.dev/fotos/banner/lucas/lucas-x.webp';
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/lucas'), { uid: 'lucas' }));
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'users/lucas'), { bannerUrl: capa }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'users/lucas'), { bannerUrl: 'https://rastreio.exemplo.com/pixel.gif' }));
  // O próprio barbeiro e o dono põem a capa no cartão; outro cliente não.
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/barbeiros/lucas'), { bannerUrl: capa }));
  await assertSucceeds(updateDoc(doc(dbDe('dono'), 'barbearias/b1/barbeiros/lucas'), { bannerUrl: capa }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/barbeiros/lucas'), { bannerUrl: 'javascript:alert(1)' }));
  await assertFails(updateDoc(doc(dbDe('ana'), 'barbearias/b1/barbeiros/lucas'), { bannerUrl: capa }));
});

test('equipe privada: telefone e nota do barbeiro só para o dono e o próprio barbeiro', async () => {
  const ref = (uid: string) => doc(dbDe(uid), 'barbearias/b1/equipePrivado/lucas');
  await assertSucceeds(setDoc(ref('lucas'), { telefone: '15999990000' }, { merge: true }));
  await assertSucceeds(setDoc(ref('lucas'), { telefone: '15988880000' }, { merge: true }));
  // Nota é do Worker; ninguém grava pelo app. Outro barbeiro e cliente não leem nem gravam.
  await assertFails(setDoc(ref('lucas'), { nota: { media: 5, total: 10 } }, { merge: true }));
  await assertFails(setDoc(ref('dono'), { telefone: '1' }, { merge: true }));
  await assertSucceeds(getDoc(ref('dono')));
  await assertSucceeds(getDoc(ref('lucas')));
  await assertFails(getDoc(ref('ana')));
  await assertFails(setDoc(doc(dbDe('ana'), 'barbearias/b1/equipePrivado/ana'), { telefone: '1' }));
});

test('erros: o app só grava, com campos e tamanhos fixos', async () => {
  const ok = { uid: 'ana', onde: 'tela', mensagem: 'x', pilha: 'y', plataforma: 'android', versao: '0.1.0', em: 1 };
  await assertSucceeds(setDoc(doc(dbDe('ana'), 'erros/e1'), ok));
  await assertFails(setDoc(doc(dbDe('ana'), 'erros/e2'), { ...ok, uid: 'beto' }));
  await assertFails(setDoc(doc(dbDe('ana'), 'erros/e3'), { ...ok, pilha: 'y'.repeat(2001) }));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'erros/e4'), ok));
  await assertFails(getDoc(doc(dbDe('ana'), 'erros/e1')));
});

test('avaliações e notas: só o servidor grava; ninguém infla a própria nota', async () => {
  // Casa já nasce com nota: barrado. Sem nota: passa.
  const novo = dbDe('novo2');
  const criar = (id: string, resumo: object) => {
    const b = writeBatch(novo);
    b.set(doc(novo, 'barbearias', id), { ...casaNova(id, 'novo2', { status: 'rascunho', limiteBarbeiros: 1 }, false), resumo });
    b.set(doc(novo, `barbearias/${id}/barbeiros/novo2`), { uid: 'novo2', ativo: true });
    return b.commit();
  };
  await assertFails(criar('b8', { notaApp: 5, totalAvaliacoesApp: 80 }));
  await assertFails(criar('b8', { notaGoogle: 5, totalAvaliacoesGoogle: 900 }));
  await assertSucceeds(criar('b8', { notaApp: 0, totalAvaliacoesApp: 0 }));

  // O dono muda o nome, mas não as notas da casa nem a dos barbeiros.
  const dono = dbDe('dono');
  await assertSucceeds(updateDoc(doc(dono, 'barbearias/b1'), { nome: 'Nova' }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { 'resumo.notaApp': 5, 'resumo.totalAvaliacoesApp': 99 }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { 'resumo.notaRanking': 5 }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1'), { googleAtualizadoEm: 1 }));
  await assertFails(updateDoc(doc(dono, 'barbearias/b1/barbeiros/lucas'), { nota: { media: 5, total: 50 } }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/barbeiros/lucas'), { nota: { media: 5, total: 50 } }));
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'barbearias/b1/barbeiros/lucas'), { apelido: 'Lu' }));

  // Avaliação: o app não cria; a da barbearia qualquer um lê; a do barbeiro e a do cliente, só a casa e o cliente.
  await assertFails(setDoc(doc(dbDe('ana'), 'avaliacoes/a1_barbearia'), {
    id: 'a1_barbearia', clienteUid: 'ana', barbeariaId: 'b1', barbeiroId: 'lucas', direcao: 'cliente_para_barbearia', estrelas: 5, visivel: true,
  }));
  const base = { barbeariaId: 'b1', barbeiroId: 'lucas', clienteUid: 'ana', estrelas: 5, visivel: true };
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'avaliacoes/v1_barbearia'), { ...base, direcao: 'cliente_para_barbearia', criadoEm: 2 });
    await setDoc(doc(ctx.firestore(), 'avaliacoes/o1'), { ...base, direcao: 'cliente_para_barbearia', visivel: false, criadoEm: 1 });
    await setDoc(doc(ctx.firestore(), 'avaliacoes/v1_barbeiro'), { ...base, direcao: 'cliente_para_barbeiro', criadoEm: 3 });
    await setDoc(doc(ctx.firestore(), 'avaliacoes/v1_cliente'), { ...base, direcao: 'barbeiro_para_cliente', criadoEm: 4 });
  });
  const publicas = getDocs(query(collection(env.unauthenticatedContext().firestore(), 'avaliacoes'),
    where('barbeariaId', '==', 'b1'), where('visivel', '==', true), where('direcao', '==', 'cliente_para_barbearia'), orderBy('criadoEm', 'desc')));
  assert.equal((await assertSucceeds(publicas)).size, 1);
  await assertFails(getDoc(doc(dbDe('beto'), 'avaliacoes/o1')));
  for (const id of ['v1_barbeiro', 'v1_cliente']) {
    await assertFails(getDoc(doc(dbDe('beto'), 'avaliacoes', id))); // outro cliente
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'avaliacoes', id)));
    for (const quem of ['ana', 'lucas', 'dono']) await assertSucceeds(getDoc(doc(dbDe(quem), 'avaliacoes', id)));
  }
  // Listas das telas: dono pela casa, barbeiro pelas dele, cliente pelas dele.
  await assertSucceeds(getDocs(query(collection(dbDe('dono'), 'avaliacoes'), where('barbeariaId', '==', 'b1'), orderBy('criadoEm', 'desc'))));
  await assertSucceeds(getDocs(query(collection(dbDe('lucas'), 'avaliacoes'), where('barbeiroId', '==', 'lucas'), orderBy('criadoEm', 'desc'))));
  await assertSucceeds(getDocs(query(collection(dbDe('ana'), 'avaliacoes'), where('clienteUid', '==', 'ana'), orderBy('criadoEm', 'desc'))));
  await assertFails(getDocs(query(collection(dbDe('beto'), 'avaliacoes'), where('barbeariaId', '==', 'b1'))));
  await assertFails(updateDoc(doc(dbDe('dono'), 'avaliacoes/v1_barbearia'), { estrelas: 1 }));
});

test('pedir avaliação: só o dono liga ou desliga', async () => {
  await assertSucceeds(updateDoc(doc(dbDe('dono'), 'barbearias/b1'), { pedirAvaliacao: true }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'barbearias/b1'), { pedirAvaliacao: false }));
  await assertFails(updateDoc(doc(dbDe('ana'), 'barbearias/b1'), { pedirAvaliacao: false }));
});

test('nota do cliente: a casa lê por id; ninguém lista nem grava pelo app', async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'notasCliente/ana'), { media: 4.5, total: 2 }));
  await assertSucceeds(getDoc(doc(dbDe('lucas'), 'notasCliente/ana')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'notasCliente/ana')));
  await assertFails(getDocs(collection(dbDe('lucas'), 'notasCliente')));
  await assertFails(setDoc(doc(dbDe('ana'), 'notasCliente/ana'), { media: 5, total: 99 }));
});

test('marcas de avaliação no agendamento: só o Worker', async () => {
  const id = await reservar(dbDe('ana'), novaReserva('ana', inicio));
  await assertFails(updateDoc(doc(dbDe('ana'), 'agendamentos', id), { avaliacoes: { barbeiro: { estrelas: 5, em: 1 } }, atualizadoEm: 1 }));
  await assertFails(updateDoc(doc(dbDe('lucas'), 'agendamentos', id), { status: 'confirmado', avaliacoes: { cliente: { estrelas: 1, em: 1 } } }));
  await assertSucceeds(updateDoc(doc(dbDe('lucas'), 'agendamentos', id), { status: 'confirmado' }));
});
