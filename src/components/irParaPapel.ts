// Depois de escolher o papel: barbeiro e dono no Android passam antes pela tela de liberar a bateria
// (senão os avisos de horário não chegam com o app fechado); cliente, web e iPhone seguem direto.
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { Role } from '../types/models';

export function irParaPapel(papel: Role, destino: string) {
  if (Platform.OS === 'android' && papel !== 'cliente') router.replace({ pathname: '/bateria', params: { depois: destino } });
  else router.replace(destino as never);
}
