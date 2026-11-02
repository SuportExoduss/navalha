// Versão mínima do app (config/app › versaoMinima), gravada pelo console/Admin depois que a versão nova já
// aparece na Play Store. Sem rede ou sem o doc: null (não bloqueia ninguém).
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export function ouvirVersaoMinima(cb: (minima: string | null) => void) {
  return onSnapshot(doc(db, 'config', 'app'), s => {
    const v = s.data()?.versaoMinima;
    cb(typeof v === 'string' ? v : null);
  }, () => cb(null));
}
