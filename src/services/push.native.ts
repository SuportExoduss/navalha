// Push no Android: pede permissão, pega o token nativo do FCM (sem conta Expo) e guarda no perfil.
// O Worker (cron de hora em hora) usa esse token para os lembretes de 24 h e 2 h.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';
import { atualizarPerfil } from './usuarios';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export type ResultadoPush = 'ativo' | 'negado' | 'indisponivel';

export async function registrarPush(uid: string, tokenAtual?: string): Promise<ResultadoPush> {
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
  if (data !== tokenAtual) await atualizarPerfil(db, uid, { pushToken: data });
  return 'ativo';
}
