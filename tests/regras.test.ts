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
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, runTransaction, where, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { chavesOcupacao, paraMillis } from '../src/lib/agenda';
import {
  agendamentosDaSemana, cancelar, concluir, criarFolga, definirStatus, horariosLivres, reservar, type NovaReserva,
} from '../src/services/agendamentos';
import { NOME_REMOVIDO } from '../src/services/usuarios';
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
    await setDoc(doc(db, 'barbearias/b1'), { id: 'b1', donoUid: 'dono', publicada: true, assinatura: { status: 'teste' }, resumo: {} });
    await setDoc(doc(db, 'barbearias/b1/barbeiros/lucas'), { uid: 'lucas', ativo: true });
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
  });
}

test('cliente reserva; o segundo cliente no mesmo horário é barrado', async () => {
  await assertSucceeds(reservaDe('ana', 'a1'));
  await assert.rejects(reservaDe('beto', 'a2'));
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

test('dono cria a barbearia e entra como barbeiro no mesmo lote', async () => {
  const db = env.authenticatedContext('novo').firestore();
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'users/novo'), { uid: 'novo', barbearias: [] }));
  const batch = writeBatch(db);
  batch.set(doc(db, 'barbearias/b2'), { id: 'b2', donoUid: 'novo', publicada: false, assinatura: { status: 'teste' }, resumo: {} });
  batch.set(doc(db, 'barbearias/b2/barbeiros/novo'), { uid: 'novo', ativo: true });
  batch.update(doc(db, 'users/novo'), { barbearias: ['b2'] });
  await assertSucceeds(batch.commit());
  // Ninguém cria barbearia em nome de outro dono.
  await assertFails(setDoc(doc(db, 'barbearias/b3'), { id: 'b3', donoUid: 'outro', publicada: false, assinatura: { status: 'teste' }, resumo: {} }));
});

test('barbeiro entra só com convite válido, uma única vez', async () => {
  const dono = env.authenticatedContext('dono').firestore();
  await assertSucceeds(setDoc(doc(dono, 'convites/ABC234'), { codigo: 'ABC234', barbeariaId: 'b1', criadoPor: 'dono', expiraEm: Date.now() + 86_400_000 }));
  await assertFails(setDoc(doc(env.authenticatedContext('intruso').firestore(), 'convites/ZZZ999'), { codigo: 'ZZZ999', barbeariaId: 'b1', criadoPor: 'intruso', expiraEm: Date.now() + 86_400_000 }));

  const aceitar = (uid: string) => {
    const db = env.authenticatedContext(uid).firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, 'convites/ABC234'), { usadoPor: uid });
    batch.set(doc(db, 'barbearias/b1/barbeiros', uid), { uid, ativo: true, conviteCodigo: 'ABC234' });
    return batch.commit();
  };
  await assertSucceeds(aceitar('rafael'));
  await assertFails(aceitar('bruno')); // código já usado
  // Sem convite, ninguém se coloca na equipe.
  await assertFails(setDoc(doc(env.authenticatedContext('bruno').firestore(), 'barbearias/b1/barbeiros/bruno'), { uid: 'bruno', ativo: true }));
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
  await assert.rejects(reservar(dbDe('beto'), novaReserva('beto', inicio + 30 * 60_000, { servico: { ...corte, duracaoMin: 30 } })));
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

test('agenda do dia: a casa lê, quem é de fora não', async () => {
  await reservar(dbDe('ana'), novaReserva('ana', inicio));
  const agenda = (uid: string) => getDocs(query(collection(dbDe(uid), 'agendamentos'),
    where('barbeariaId', '==', 'b1'), where('data', '==', '2030-01-10'), orderBy('inicio')));
  const s = await assertSucceeds(agenda('lucas'));
  assert.equal(s.size, 1);
  await assertSucceeds(agenda('dono'));
  await assertFails(agenda('beto'));
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
  await assertFails(deleteDoc(doc(dbDe('beto'), 'barbearias/b1/bloqueios', folgas.docs[0].id)));
  await assertSucceeds(deleteDoc(doc(dbDe('lucas'), 'barbearias/b1/bloqueios', folgas.docs[0].id)));
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
