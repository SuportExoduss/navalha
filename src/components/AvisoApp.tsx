// Só na versão web, num celular Android: convida a baixar o app na Play Store (lembretes e câmera
// funcionam melhor lá). Fechou, some por 7 dias. No app nativo, no iPhone e no computador não aparece.
import { useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LINK_PLAY_STORE, ehAndroidNoNavegador, mostrarAvisoApp } from '../lib/dispositivo';
import { colors, radius, space, type } from '../theme';

const CHAVE = 'navalha.avisoApp.fechadoEm';

export function AvisoApp() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const abertoComoApp = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
      const fechadoEm = Number(localStorage.getItem(CHAVE)) || null;
      setVisivel(ehAndroidNoNavegador(navigator.userAgent, abertoComoApp) && mostrarAvisoApp(fechadoEm, Date.now()));
    } catch { /* modo privado sem localStorage: segue sem aviso */ }
  }, []);

  if (!visivel) return null;

  function fechar() {
    try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* ignora */ }
    setVisivel(false);
  }

  return (
    // Uma linha só: em celular pequeno o aviso de duas linhas tirava um quinto da tela de todas as telas.
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(2),
      backgroundColor: colors.surfaceRaised, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Image source={require('../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: radius.input }} accessibilityIgnoresInvertColors />
      <Text style={[type.caption, { flex: 1, color: colors.text }]} numberOfLines={2}>
        <Text style={{ fontWeight: '600' }}>Melhor no app:</Text> lembretes do horário.
      </Text>
      <Pressable onPress={() => Linking.openURL(LINK_PLAY_STORE)} accessibilityRole="link" accessibilityLabel="Baixar o app na Play Store"
        style={{ backgroundColor: colors.accent, borderRadius: radius.chip, paddingHorizontal: space(3), minHeight: 36, justifyContent: 'center' }}>
        <Text style={[type.caption, { color: colors.accentText, fontWeight: '700' }]}>Baixar</Text>
      </Pressable>
      <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar aviso">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
