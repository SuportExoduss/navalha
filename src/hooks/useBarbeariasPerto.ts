// Barbearias publicadas num raio de 10 km da localização atual. Os filtros
// (raio menor, preço, categoria, horário) são aplicados em memória, sem nova leitura.
import { useEffect, useState } from 'react';
import { useLocalizacao } from './useLocalizacao';
import { buscarPerto, type BarbeariaPerto } from '../services/barbearias';
import { db } from '../services/firebase';

export function useBarbeariasPerto() {
  const { loc, negada } = useLocalizacao();
  const [lista, setLista] = useState<BarbeariaPerto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!loc) return;
    buscarPerto(db, loc.lat, loc.lng, 10)
      .then(l => { setLista(l); setErro(null); })
      .catch(() => setErro('Não foi possível buscar as barbearias. Verifique a conexão.'));
  }, [loc?.lat, loc?.lng]);

  return { loc, negada, lista, erro };
}
