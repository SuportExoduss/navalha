// Média do cliente nas avaliações das barbearias, no card da agenda e na tela do corte (1 leitura, guardada 5 min).
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { db } from '../../services/firebase';
import { notaDoCliente } from '../../services/avaliacoes';
import { type } from '../../theme';

export function NotaDoCliente({ uid }: { uid: string }) {
  const [nota, setNota] = useState<{ media: number; total: number } | null>(null);
  useEffect(() => { notaDoCliente(db, uid).then(setNota).catch(() => setNota(null)); }, [uid]);
  if (!nota?.total) return null;
  return <Text style={type.caption}>{`★ ${nota.media.toFixed(1).replace('.', ',')} como cliente (${nota.total})`}</Text>;
}
