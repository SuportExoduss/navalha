// Android: falhas nativas o SDK pega sozinho; aqui vão os erros de JavaScript (não fatais) com o lugar onde ocorreram.
// Sem setUserId: o painel do Crashlytics não precisa saber quem é a pessoa (LGPD, minimização).
import { getCrashlytics, log, recordError } from '@react-native-firebase/crashlytics';

export function enviarAoCrashlytics(erro: Error, onde: string) {
  try {
    const c = getCrashlytics();
    log(c, onde);
    recordError(c, erro);
  } catch {} // registrar erro nunca pode causar outro
}
