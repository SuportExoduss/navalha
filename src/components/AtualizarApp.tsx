// Atualização obrigatória (só no app Android): versão instalada atrás da mínima em config/app cobre a tela toda
// e abre a Play Store sozinha, uma vez por abertura do app (se a loja ainda não mostrar a versão, não fica num laço).
// Na web não aparece: o site já é sempre o mais novo. Sem rede, o app segue aberto.
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Botao, Titulo } from './ui';
import { LINK_PLAY_STORE, PACOTE_ANDROID } from '../lib/dispositivo';
import { precisaAtualizar } from '../lib/versao';
import { ouvirVersaoMinima } from '../services/versao';
import { colors, radius, space, type } from '../theme';

const INSTALADA = Constants.expoConfig?.version;

function abrirLoja() {
  Linking.openURL(`market://details?id=${PACOTE_ANDROID}`).catch(() => Linking.openURL(LINK_PLAY_STORE).catch(() => undefined));
}

export function AtualizarApp() {
  const [minima, setMinima] = useState<string | null>(null);
  const abriu = useRef(false);
  useEffect(() => (Platform.OS === 'android' ? ouvirVersaoMinima(setMinima) : undefined), []);

  const bloquear = precisaAtualizar(INSTALADA, minima);
  useEffect(() => {
    if (!bloquear || abriu.current) return;
    abriu.current = true;
    abrirLoja();
  }, [bloquear]);

  if (!bloquear) return null;
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
      backgroundColor: colors.bg, justifyContent: 'center', padding: space(6), gap: space(4) }}>
      <Image source={require('../../assets/icon.png')} style={{ width: 64, height: 64, borderRadius: radius.input, alignSelf: 'center' }} accessibilityIgnoresInvertColors />
      <Titulo>Atualize o Navalha</Titulo>
      <Text style={type.body}>
        Saiu uma versão nova do app. Para continuar usando, atualize pela Play Store e abra o app de novo.
      </Text>
      <Botao titulo="Atualizar na Play Store" onPress={abrirLoja} />
      <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>Versão instalada: {INSTALADA} · nova: {minima}</Text>
    </View>
  );
}
