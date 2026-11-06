// Push na web (navegador e iPhone com o Navalha na Tela de Início): token do FCM pelo service worker
// public/firebase-messaging-sw.js. O Worker manda o mesmo lembrete que vai para o Android.
// O iPhone só deixa pedir permissão dentro de um toque: o pedido fica no botão "Ativar lembretes" do Perfil;
// no login só pegamos o token se a pessoa já tinha permitido.
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, db } from './firebase';
import { atualizarPerfil } from './usuarios';
import type { UserProfile } from '../types/models';

type Tokens = Pick<UserProfile, 'pushToken' | 'pushTokenWeb'>;

export type ResultadoPush = 'ativo' | 'negado' | 'indisponivel';
/** Na web o toque é tratado pelo service worker (abre o link da mensagem). */
export function ouvirToquePush(_abrir: (rota: string) => void): () => void { return () => {}; }
/** "pedir" = dá para ativar com um toque; "instalar" = iPhone fora da Tela de Início (lá o push não existe). */
export type EstadoLembretesWeb = 'ativo' | 'pedir' | 'negado' | 'instalar' | 'indisponivel';

const ehIphoneNoNavegador = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;

async function suporte() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
    && (await isSupported().catch(() => false));
}

async function salvarToken(uid: string, tokenAtual?: string): Promise<ResultadoPush> {
  const registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  // Sem vapidKey: o SDK usa a chave padrão do FCM do projeto.
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: registro });
  if (!token) return 'indisponivel';
  // Campo próprio da web: o `pushToken` é do app Android e um não apaga o outro.
  if (token !== tokenAtual) await atualizarPerfil(db, uid, { pushTokenWeb: token });
  return 'ativo';
}

export async function registrarPush(uid: string, perfil?: Tokens): Promise<ResultadoPush> {
  if (!(await suporte())) return 'indisponivel';
  if (Notification.permission === 'denied') return 'negado';
  if (Notification.permission !== 'granted') return 'indisponivel'; // espera o toque no botão do Perfil
  return salvarToken(uid, perfil?.pushTokenWeb);
}

/** Chamado no toque do botão: pede a permissão (exigência do iPhone) e guarda o token. */
export async function ativarLembretesWeb(uid: string): Promise<ResultadoPush> {
  if (!(await suporte())) return 'indisponivel';
  if ((await Notification.requestPermission()) !== 'granted') return 'negado';
  return salvarToken(uid);
}

export async function estadoLembretesWeb(): Promise<EstadoLembretesWeb> {
  if (typeof navigator !== 'undefined' && ehIphoneNoNavegador()) return 'instalar';
  if (!(await suporte())) return 'indisponivel';
  return Notification.permission === 'granted' ? 'ativo' : Notification.permission === 'denied' ? 'negado' : 'pedir';
}
