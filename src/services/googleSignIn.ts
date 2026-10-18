// Versão web (PWA): login Google por pop-up do próprio Firebase.
// No Android/iOS o Metro usa googleSignIn.native.ts.
import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';

export async function entrarComGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' }); // permite trocar de conta
  await signInWithPopup(auth, provider);
}

export async function sairDoGoogle(): Promise<void> {
  await signOut(auth);
}

/** Confirma a identidade antes de ações sensíveis (ex.: excluir a conta). */
export async function reautenticarGoogle(): Promise<void> {
  if (!auth.currentUser) throw new Error('Entre na sua conta primeiro.');
  await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
}
