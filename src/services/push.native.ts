// Push no Android: pede permissão, pega o token nativo do FCM (sem conta Expo) e guarda no perfil.
// O Worker (cron de hora em hora) usa esse token para os lembretes de 24 h e 2 h.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';
import { atualizarPerfil } from './usuarios';
import { rotaInterna } from '../lib/dispositivo';
import type { UserProfile } from '../types/models';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type ResultadoPush = 'ativo' | 'negado' | 'indisponivel';

/** Toque na notificação: abre a tela que o Worker mandou em `data.rota` (ex.: o resumo do mês). Inclui o toque que abriu o app. */
export function ouvirToquePush(abrir: (rota: string) => void): () => void {
  const rotaDe = (r: Notifications.NotificationResponse | null) => {
    const c = r?.notification.request;
    const rota = (c?.content.data?.rota ?? (c?.trigger as { remoteMessage?: { data?: Record<string, string> } } | null)?.remoteMessage?.data?.rota) as string | undefined;
    const alvo = rotaInterna(rota);
    if (alvo) abrir(alvo);
  };
  rotaDe(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(rotaDe);
  return () => sub.remove();
}

export async function registrarPush(uid: string, perfil?: Pick<UserProfile, 'pushToken' | 'pushTokenWeb'>): Promise<ResultadoPush> {
  if (!Device.isDevice) return 'indisponivel'; // emulador não recebe push
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lembretes', {
      name: 'Lembretes de horário', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'negado';
  // iOS fica para a Fase 3 (APNs); aqui só Android, cujo token é do FCM.
  if (Platform.OS !== 'android') return 'indisponivel';
  const { data } = await Notifications.getDevicePushTokenAsync();
  if (data !== perfil?.pushToken) await atualizarPerfil(db, uid, { pushToken: data });
  return 'ativo';
}

// Na web o pedido de permissão precisa de um toque (Perfil); no Android ele acontece no login e na escolha de papel.
export type EstadoLembretesWeb = 'ativo' | 'pedir' | 'negado' | 'instalar' | 'indisponivel';
export async function ativarLembretesWeb(uid: string): Promise<ResultadoPush> { return registrarPush(uid); }
export async function estadoLembretesWeb(): Promise<EstadoLembretesWeb> { return 'indisponivel'; }
