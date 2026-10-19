// Localização a cada abertura do app: primeiro a última posição conhecida
// (instantânea), depois a posição precisa — a lista se reorganiza se a
// pessoa mudou de cidade. Permissão só "enquanto o app estiver aberto".
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

export interface Localizacao {
  lat: number; lng: number; cidade?: string; bairro?: string;
}

// O GPS pode nunca responder (ambiente fechado, à noite): sem prazo a tela ficava em "Localizando…" para sempre.
const PRAZO_MS = 12_000;
const comPrazo = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), PRAZO_MS))]).catch(() => null);

export function useLocalizacao() {
  const [loc, setLoc] = useState<Localizacao | null>(null);
  const [negada, setNegada] = useState(false);
  /** Nenhuma posição dentro do prazo: a tela oferece tentar de novo em vez de girar. */
  const [semSinal, setSemSinal] = useState(false);
  const ativo = useRef(true);

  const atualizar = useCallback(async () => {
      setSemSinal(false);
      // Só pede se ainda não tem: pedir de novo abre a tela de permissões do sistema a cada abertura
      // (no MIUI isso chegava a mandar o app para trás).
      const atual = await Location.getForegroundPermissionsAsync();
      const { status } = atual.granted ? atual : await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { if (ativo.current) setNegada(true); return; }
      setNegada(false);
      const rapida = await Location.getLastKnownPositionAsync().catch(() => null);
      if (rapida && ativo.current) setLoc({ lat: rapida.coords.latitude, lng: rapida.coords.longitude });
      const precisa = await comPrazo(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!ativo.current) return;
      if (!precisa) { if (!rapida) setSemSinal(true); return; }
      const base = { lat: precisa.coords.latitude, lng: precisa.coords.longitude };
      setLoc(base);
      // Nome da cidade pelo geocoder do próprio aparelho (gratuito).
      const [end] = (await comPrazo(Location.reverseGeocodeAsync({ latitude: base.lat, longitude: base.lng }))) ?? [];
      if (end && ativo.current) setLoc({ ...base, cidade: end.city ?? end.subregion ?? undefined, bairro: end.district ?? undefined });
  }, []);

  useEffect(() => {
    ativo.current = true;
    atualizar();
    // Volta do segundo plano = nova abertura: atualiza de novo.
    const sub = AppState.addEventListener('change', s => { if (s === 'active') atualizar(); });
    return () => { ativo.current = false; sub.remove(); };
  }, [atualizar]);

  return { loc, negada, semSinal, tentarDeNovo: atualizar };
}
