import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth/AuthProvider';
import { TemaProvider } from '../components/TemaProvider';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </AuthProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}
