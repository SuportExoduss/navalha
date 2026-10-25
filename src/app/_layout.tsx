import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Redirect, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { TemaProvider } from '../components/TemaProvider';
import { AvisoApp } from '../components/AvisoApp';
import { Abertura } from '../components/Abertura';
import * as SplashScreen from 'expo-splash-screen';
import { Botao, Titulo } from '../components/ui';
import { capturarErrosGlobais, registrarErro } from '../services/erros';
import { colors, space, type } from '../theme';

capturarErrosGlobais();
// A splash nativa espera a Abertura (cópia em JS) aparecer por cima; é ela que some com a transição.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <AvisoApp />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            <PortaoIdade />
            <Abertura />
          </View>
        </AuthProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

// Páginas que qualquer um abre sem ter informado a idade (as públicas e a própria tela da idade).
const SEM_IDADE = ['/idade', '/entrar', '/privacidade', '/termos', '/excluir-conta'];

/**
 * Logado sem ter informado a idade (1º login ou conta de antes da regra): vai para /idade, venha de onde vier
 * (link direto para uma barbearia, notificação etc.), não só pela porta de entrada.
 */
function PortaoIdade() {
  const { user, perfil } = useAuth();
  const caminho = usePathname();
  if (!user || !perfil || perfil.maiorDeIdadeEm || SEM_IDADE.includes(caminho)) return null;
  return <Redirect href="/idade" />;
}

/** Uma tela quebrou: em vez de tela branca, explica, registra o erro e deixa tentar de novo. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { registrarErro(error, 'tela'); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space(6), gap: space(4) }}>
      <Titulo>Algo deu errado</Titulo>
      <Text style={type.body}>Essa tela teve um problema. Já registramos o erro para corrigir.</Text>
      <Botao titulo="Tentar de novo" onPress={retry} />
    </View>
  );
}
