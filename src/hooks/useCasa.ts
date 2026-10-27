// Casa, equipe e cardápio em tempo real (ouvirCasa). dados undefined = carregando; falhou = sem conexão.
import { useEffect, useState } from 'react';
import { ouvirCasa, type DadosCasa } from '../services/barbearias';
import { db } from '../services/firebase';
import { useVersao } from './useAtualizar';

export function useCasa(id: string | undefined) {
  const [dados, setDados] = useState<DadosCasa | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const versao = useVersao();
  useEffect(() => {
    if (!id) return;
    setFalhou(false);
    return ouvirCasa(db, id, d => { setDados(d); setFalhou(false); }, () => setFalhou(true));
  }, [id, tentativa, versao]);
  return { dados, falhou: falhou && !dados, tentarDeNovo: () => { setDados(undefined); setTentativa(n => n + 1); } };
}
