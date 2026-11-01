// Resumos dos meses anteriores (o Worker grava no dia 1). Ficam no servidor para trocar de aparelho, e no celular
// também no AsyncStorage: cada abertura pede ao servidor só os que chegaram depois do último guardado.
// Na web não guarda: sempre puxa do servidor.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, orderBy, query, where, type Firestore } from 'firebase/firestore';
import type { ResumoSalvo } from '../lib/notificacoes';

/** `barbeiroUid` null = dono (todos da casa); com uid = barbeiro (só os dele, as regras não deixam ler outros). */
export async function carregarResumos(db: Firestore, barbeariaId: string, uid: string, barbeiroUid: string | null): Promise<ResumoSalvo[]> {
  const chave = `resumos:${barbeariaId}:${uid}:${barbeiroUid ? 'meu' : 'casa'}`;
  const guardado = Platform.OS === 'web' ? null
    : await AsyncStorage.getItem(chave).then(t => (t ? JSON.parse(t) as ResumoSalvo[] : null)).catch(() => null);
  const docs = guardado ?? [];
  const ultimoEm = Math.max(0, ...docs.map(d => d.em));
  const s = await getDocs(query(collection(db, 'resumos'),
    where('barbeariaId', '==', barbeariaId),
    ...(barbeiroUid ? [where('barbeiroId', '==', barbeiroUid)] : []),
    where('em', '>', ultimoEm), orderBy('em')));
  if (s.empty) return docs;
  const porId = new Map(docs.map(d => [d.id, d]));
  for (const d of s.docs) porId.set(d.id, { ...(d.data() as ResumoSalvo), id: d.id });
  const todos = [...porId.values()];
  if (Platform.OS !== 'web') await AsyncStorage.setItem(chave, JSON.stringify(todos)).catch(() => {});
  return todos;
}
