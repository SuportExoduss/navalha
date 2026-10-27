// Barbearias publicadas da mais perto para a mais longe (o raio cresce até achar), em tempo real: casa nova perto
// aparece sozinha. Os filtros (distância, preço, categoria, horário) são aplicados em memória, sem nova leitura.
import { useEffect, useState } from 'react';
import { useLocalizacao } from './useLocalizacao';
import { ouvirPerto, type BarbeariaPerto } from '../services/barbearias';
import { db } from '../services/firebase';
import { useVersao } from './useAtualizar';

export function useBarbeariasPerto() {
  const { loc, negada, semSinal, tentarDeNovo } = useLocalizacao();
  const [lista, setLista] = useState<BarbeariaPerto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const versao = useVersao();
  // Posição arredondada (~1 km): a rápida e a precisa, que chegam uma logo depois da outra, não abrem duas escutas.
  const lat = loc ? Number(loc.lat.toFixed(2)) : null;
  const lng = loc ? Number(loc.lng.toFixed(2)) : null;

  useEffect(() => {
    if (lat === null || lng === null) return;
    setErro(null);
    return ouvirPerto(db, lat, lng, l => { setLista(l); setErro(null); },
      () => setErro('Não foi possível buscar as barbearias. Verifique a conexão.'));
  }, [lat, lng, tentativa, versao]);

  return { loc, negada, semSinal, tentarDeNovo, lista, erro, recarregar: () => setTentativa(n => n + 1) };
}
