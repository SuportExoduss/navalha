// Barbearias publicadas da mais perto para a mais longe (o raio cresce até achar). Os filtros
// (distância, preço, categoria, horário) são aplicados em memória, sem nova leitura.
// Início e Explorar usam o mesmo hook: a consulta é guardada 5 min e vale para as duas.
import { useEffect, useState } from 'react';
import { useLocalizacao } from './useLocalizacao';
import { buscarPerto, type BarbeariaPerto } from '../services/barbearias';
import { db } from '../services/firebase';

export function useBarbeariasPerto() {
  const { loc, negada, semSinal, tentarDeNovo } = useLocalizacao();
  const [lista, setLista] = useState<BarbeariaPerto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!loc) return;
    setErro(null);
    buscarPerto(db, loc.lat, loc.lng, { forcar: tentativa > 0 })
      .then(setLista)
      .catch(() => setErro('Não foi possível buscar as barbearias. Verifique a conexão.'));
  }, [loc?.lat, loc?.lng, tentativa]);

  return { loc, negada, semSinal, tentarDeNovo, lista, erro, recarregar: () => setTentativa(n => n + 1) };
}
