// Push no Android/iOS: pede permissão, pega o token do Expo Push e guarda no perfil.
// O Worker (cron de hora em hora) usa esse token para os lembretes de 24 h e 2 h.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  // O projectId do EAS aparece depois do primeiro `eas build` (fica em app.json › extra.eas).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'indisponivel';
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (data !== tokenAtual) await atualizarPerfil(db, uid, { pushToken: data });
  return 'ativo';
}
