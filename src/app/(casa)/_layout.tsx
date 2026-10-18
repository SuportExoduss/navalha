// Modo barbearia (dono e barbeiro).
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../theme';

type Icone = keyof typeof Ionicons.glyphMap;
const icone = (nome: Icone) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={nome} color={color as string} size={size} />;

export default function CasaLayout() {
  const { carregando, user } = useAuth();
  if (!carregando && !user) return <Redirect href="/entrar" />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: icone('calendar') }} />
      <Tabs.Screen name="casa" options={{ title: 'Barbearia', tabBarIcon: icone('storefront-outline') }} />
      <Tabs.Screen name="conta" options={{ title: 'Perfil', tabBarIcon: icone('person-outline') }} />
    </Tabs>
  );
}
