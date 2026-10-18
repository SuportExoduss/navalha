// Localização a cada abertura do app: primeiro a última posição conhecida
// (instantânea), depois a posição precisa — a lista se reorganiza se a
// pessoa mudou de cidade. Permissão só "enquanto o app estiver aberto".
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

export interface Localizacao {
  lat: number; lng: number; cidade?: string; bairro?: string;
}

export function useLocalizacao() {
  const [loc, setLoc] = useState<Localizacao | null>(null);
  const [negada, setNegada] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function atualizar() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { if (ativo) setNegada(true); return; }
      setNegada(false);
      const rapida = await Location.getLastKnownPositionAsync().catch(() => null);
      if (rapida && ativo) setLoc({ lat: rapida.coords.latitude, lng: rapida.coords.longitude });
      const precisa = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (!precisa || !ativo) return;
      const base = { lat: precisa.coords.latitude, lng: precisa.coords.longitude };
      setLoc(base);
      // Nome da cidade pelo geocoder do próprio aparelho (gratuito).
      const [end] = await Location.reverseGeocodeAsync({ latitude: base.lat, longitude: base.lng }).catch(() => []);
      if (end && ativo) setLoc({ ...base, cidade: end.city ?? end.subregion ?? undefined, bairro: end.district ?? undefined });
    }
    atualizar();
    // Volta do segundo plano = nova abertura: atualiza de novo.
    const sub = AppState.addEventListener('change', s => { if (s === 'active') atualizar(); });
    return () => { ativo = false; sub.remove(); };
  }, []);

  return { loc, negada };
}
