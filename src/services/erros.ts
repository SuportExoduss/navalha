// Monitoramento de erros gratuito: o erro vai para a coleção `erros` do Firestore (só gravação; o dono lê no
// console do Firebase). Cobre erros de JavaScript, que são a maioria num app React Native; falha nativa ficaria
// para o Crashlytics, se um dia precisar.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from './firebase';

const LIMITE_POR_SESSAO = 10; // um erro em loop não pode gastar a cota de gravações
let enviados = 0;

export function registrarErro(e: unknown, onde: string) {
  const uid = auth.currentUser?.uid;
  if (!uid || enviados >= LIMITE_POR_SESSAO) return; // a regra só aceita logado (evita spam anônimo)
  enviados++;
  const erro = e instanceof Error ? e : new Error(String(e));
  addDoc(collection(db, 'erros'), {
    uid,
    onde: onde.slice(0, 100),
    mensagem: (erro.message || 'sem mensagem').slice(0, 500),
    pilha: (erro.stack ?? '').slice(0, 2000),
    plataforma: Platform.OS,
    versao: Constants.expoConfig?.version ?? '?',
    em: Date.now(),
  }).catch(() => undefined); // registrar erro nunca pode causar outro
}

/** Erros fora das telas (callbacks, timers): o handler global do React Native. Chamado uma vez na raiz. */
export function capturarErrosGlobais() {
  const global = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (!global) return; // web: o ErrorBoundary da raiz cobre as telas
  const anterior = global.getGlobalHandler();
  global.setGlobalHandler((e, fatal) => { registrarErro(e, fatal ? 'global (fatal)' : 'global'); anterior(e, fatal); });
}
