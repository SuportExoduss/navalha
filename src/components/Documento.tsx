// Página de leitura (política de privacidade, exclusão de conta): título, seções numeradas por assunto
// e largura de leitura confortável no computador. Pública: abre sem login, no app e na web.
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tela, Titulo } from './ui';
import { colors, space, type } from '../theme';

export function Documento({ titulo, resumo, children }: { titulo: string; resumo: string; children: ReactNode }) {
  return (
    <Tela>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: space(6) }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}
          accessibilityRole="button" accessibilityLabel="Voltar" style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={type.caption}>Navalha</Text>
        </Pressable>
        <View style={{ gap: space(2) }}>
          <Titulo>{titulo}</Titulo>
          <Text style={[type.body, { color: colors.textMuted }]}>{resumo}</Text>
        </View>
        {children}
      </View>
    </Tela>
  );
}

export function Topico({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <Text accessibilityRole="header" style={type.heading}>{titulo}</Text>
      {children}
    </View>
  );
}

export function Paragrafo({ children }: { children: ReactNode }) {
  return <Text style={[type.body, { lineHeight: 24 }]}>{children}</Text>;
}

/** Item de lista com marcador; `forte` destaca o começo (ex.: o nome do dado). */
export function Item({ forte, children }: { forte?: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(2) }}>
      <Text style={[type.body, { color: colors.accent }]}>•</Text>
      <Text style={[type.body, { flex: 1, lineHeight: 24 }]}>
        {forte ? <Text style={{ fontWeight: '700' }}>{forte} </Text> : null}{children}
      </Text>
    </View>
  );
}

export function Link({ href, children }: { href: string; children: ReactNode }) {
  const abrir = () => (href.startsWith('/') ? router.push(href as never) : Linking.openURL(href));
  return <Text accessibilityRole="link" onPress={abrir} style={{ color: colors.accent, textDecorationLine: 'underline' }}>{children}</Text>;
}
