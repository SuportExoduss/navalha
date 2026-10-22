import {
  collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where,
  type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { deleteUser, type User } from 'firebase/auth';
import { cancelar } from './agendamentos';
import type { Agendamento, Role, UserProfile } from '../types/models';

/** Cria o perfil no primeiro login, com nome e foto vindos do Google. Só é chamado quando a escuta não acha o documento. */
export async function criarPerfil(db: Firestore, user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const perfil: UserProfile = {
    uid: user.uid,
    nome: user.displayName ?? 'Sem nome',
    email: user.email ?? '',
    ...(user.photoURL ? { fotoUrl: user.photoURL } : {}),
    papeis: [],
    papelAtivo: 'cliente',
    barbearias: [],
    favoritos: { barbearias: [], barbeiros: [] },
    privacidade: { fotosNoPortfolio: true },
    provedores: ['google'],
    criadoEm: Date.now(),
  };
  await setDoc(ref, perfil);
  return perfil;
}

export function ouvirPerfil(db: Firestore, uid: string, cb: (p: UserProfile | null) => void, erro?: (e: Error) => void): Unsubscribe {
  // "Não existe" vindo do cache (sem internet) não é resposta do servidor: ignora, senão o primeiro
  // login recriaria o perfil por cima do verdadeiro (perdendo papéis e barbearias).
  return onSnapshot(doc(db, 'users', uid), s => {
    if (!s.exists() && s.metadata.fromCache) return;
    cb(s.exists() ? (s.data() as UserProfile) : null);
  }, erro);
}

/**
 * Ativa um papel (primeira escolha) ou troca o modo ativo. Todo mundo também é cliente:
 * quem abre a conta para ter uma barbearia (ou entra como barbeiro) já pode marcar o próprio corte.
 */
export async function escolherPapel(db: Firestore, perfil: UserProfile, papel: Role) {
  const papeis = [...new Set<Role>([...perfil.papeis, 'cliente', papel])];
  await updateDoc(doc(db, 'users', perfil.uid), { papeis, papelAtivo: papel });
}

export async function atualizarPerfil(
  db: Firestore, uid: string, dados: Partial<Pick<UserProfile, 'nome' | 'apelido' | 'fotoUrl' | 'bannerUrl' | 'telefone' | 'privacidade' | 'pushToken'>>,
) {
  await updateDoc(doc(db, 'users', uid), dados);
}

/**
 * Foto e capa do perfil também no cartão de barbeiro de cada casa onde a pessoa atende (é o que o cliente vê
 * ao escolher o barbeiro). Antes a foto só era copiada ao entrar na casa e ficava velha.
 */
export async function refletirNaEquipe(db: Firestore, uid: string, barbearias: string[], campos: { fotoUrl?: string; bannerUrl?: string }) {
  // Casa onde a pessoa não é mais barbeiro: o documento não existe e a gravação é ignorada.
  await Promise.all(barbearias.map(bid => updateDoc(doc(db, 'barbearias', bid, 'barbeiros', uid), campos).catch(() => undefined)));
}

export const NOME_REMOVIDO = 'Cliente removido';

/**
 * Exclusão de conta (LGPD e exigência das lojas): cancela os horários futuros,
 * tira o nome do histórico das barbearias, apaga o perfil e por fim a conta de login.
 * Quem é dono continua dono da barbearia até transferi-la (o documento da casa não é apagado).
 */
export async function excluirConta(db: Firestore, user: User, agora = Date.now()) {
  const meus = (await getDocs(query(collection(db, 'agendamentos'), where('clienteUid', '==', user.uid))))
    .docs.map(d => d.data() as Agendamento);
  for (const a of meus) {
    // Só o que ainda não começou: a regra não deixa o cliente cancelar horário em andamento (SEC-004).
    if (['reservado', 'confirmado'].includes(a.status) && a.inicio > agora) await cancelar(db, a, { por: 'cliente', motivo: 'Conta excluída' });
    if (a.clienteNome !== NOME_REMOVIDO) {
      await updateDoc(doc(db, 'agendamentos', a.id), { clienteNome: NOME_REMOVIDO, clienteTelefone: deleteField(), atualizadoEm: agora });
    }
  }
  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}
