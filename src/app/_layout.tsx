import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth/AuthProvider';
import { TemaProvider } from '../components/TemaProvider';
import { AvisoApp } from '../components/AvisoApp';
import { Botao, Titulo } from '../components/ui';
import { capturarErrosGlobais, registrarErro } from '../services/erros';
import { colors, space, type } from '../theme';

capturarErrosGlobais();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <AvisoApp />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </View>
        </AuthProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
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
