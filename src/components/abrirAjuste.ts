// Abre a primeira tela de ajustes que existir no celular (lista de src/lib/bateria.ts). O expo-intent-launcher
// rejeita na hora quando a tela não existe ou é protegida, então é só tentar a próxima.
import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import type { TelaAjuste } from '../lib/bateria';

export async function abrirAjuste(telas: TelaAjuste[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const t of telas) {
    try {
      // Resolve quando a pessoa volta ao app; até lá a tela de ajustes está aberta.
      await IntentLauncher.startActivityAsync(t.acao, {
        ...(t.pacote ? { packageName: t.pacote } : {}), ...(t.classe ? { className: t.classe } : {}),
        ...(t.dados ? { data: t.dados } : {}), ...(t.extras ? { extra: t.extras } : {}),
      });
      return;
    } catch { /* esta marca/versão não tem essa tela: tenta a próxima */ }
  }
  await Linking.openSettings().catch(() => undefined); // última reserva (a lista já termina nos detalhes do app)
}
