import { Redirect, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { colors } from '../../theme';

type Icone = keyof typeof Ionicons.glyphMap;
const icone = (nome: Icone) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={nome} color={color as string} size={size} />;

export default function ClienteLayout() {
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
      <Tabs.Screen name="inicio" options={{ title: 'Início', tabBarIcon: icone('home') }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar', tabBarIcon: icone('search') }} />
      <Tabs.Screen name="agendamentos" options={{ title: 'Agendamentos', tabBarIcon: icone('calendar-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('person-outline') }} />
    </Tabs>
  );
}
