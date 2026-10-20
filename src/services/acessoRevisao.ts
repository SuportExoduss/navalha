// Acesso para a revisão das lojas (Google Play, depois App Store): o revisor não consegue usar uma conta
// Google de terceiros, então entra com e-mail e senha de uma conta de demonstração criada pelo dono no
// Firebase (Authentication › Users). Só entra em conta existente; não há cadastro por aqui.
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

export async function entrarComEmail(email: string, senha: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  } catch (e) {
    const codigo = (e as { code?: string })?.code ?? '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(codigo)) throw new Error('E-mail ou senha incorretos.');
    if (/too-many-requests/.test(codigo)) throw new Error('Muitas tentativas. Espere alguns minutos.');
    if (/operation-not-allowed/.test(codigo)) throw new Error('Acesso por e-mail desligado no servidor.');
    throw new Error('Não foi possível entrar. Verifique a conexão.');
  }
}
