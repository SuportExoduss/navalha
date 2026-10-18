// Inicialização única do Firebase (plano Spark: Auth + Firestore, sem cartão).
// Fotos NÃO usam Firebase Storage (exige Blaze desde fev/2026): vão para o
// Cloudflare R2 via Worker — ver src/services/upload.ts e worker/.
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator, persistentLocalCache,
  persistentMultipleTabManager, memoryLocalCache, type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Acesso direto a process.env.EXPO_PUBLIC_*: o Expo só embute no build essa forma exata.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-navalha.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-navalha',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? 'demo-app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
};

/** Com o projeto "demo-*" ou a flag ligada, tudo roda no emulador local (não gasta cota). */
export const usandoEmulador =
  process.env.EXPO_PUBLIC_USE_EMULATORS === '1' || firebaseConfig.projectId.startsWith('demo-');

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function criarAuth(): FirebaseAuth.Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);
  // No React Native o Metro resolve o build RN do Firebase, que expõe
  // getReactNativePersistence (ausente dos tipos padrão).
  const { getReactNativePersistence } = FirebaseAuth as unknown as {
    getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence;
  };
  try {
    return FirebaseAuth.initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return FirebaseAuth.getAuth(app); // hot reload: já inicializado
  }
}

export const auth = criarAuth();

// Cache offline: telas já vistas não geram nova leitura (economiza a cota de 50 mil/dia).
export const db: Firestore = initializeFirestore(app, {
  localCache: Platform.OS === 'web'
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
});

const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');
if (usandoEmulador) {
  FirebaseAuth.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
