// Android/iOS: login Google nativo (exige development build, não roda no Expo Go).
// O idToken do Google vira credencial do Firebase Auth.
import {
  GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, reauthenticateWithCredential, signInWithCredential, signOut } from 'firebase/auth';
import { auth } from './firebase';

let configurado = false;
function configurar() {
  if (configurado) return;
  GoogleSignin.configure({
    // "Web client ID" do OAuth do projeto Firebase (necessário para receber o idToken).
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configurado = true;
}

export async function entrarComGoogle(): Promise<void> {
  configurar();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return; // usuário cancelou
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o idToken. Confira o EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return;
    throw e;
  }
}

/** Sai do Firebase e do Google: o próximo login abre o seletor de contas. */
export async function sairDoGoogle(): Promise<void> {
  configurar();
  await GoogleSignin.signOut().catch(() => undefined);
  await signOut(auth);
}

/** Confirma a identidade antes de ações sensíveis (ex.: excluir a conta). */
export async function reautenticarGoogle(): Promise<void> {
  configurar();
  if (!auth.currentUser) throw new Error('Entre na sua conta primeiro.');
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res) || !res.data.idToken) throw new Error('Confirmação cancelada.');
  await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(res.data.idToken));
}
