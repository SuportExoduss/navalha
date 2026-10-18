// Porta de entrada: decide para onde cada pessoa vai depois do login.
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../theme';

export default function Index() {
  const { carregando, user, perfil } = useAuth();
  if (carregando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!user) return <Redirect href="/entrar" />;
  if (!perfil || perfil.papeis.length === 0) return <Redirect href="/papel" />;
  return perfil.papelAtivo === 'cliente' ? <Redirect href="/inicio" /> : <Redirect href="/agenda" />;
}
