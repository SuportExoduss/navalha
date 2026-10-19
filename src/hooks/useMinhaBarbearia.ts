// Barbearia da pessoa logada (dono ou barbeiro), em tempo real.
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../services/firebase';
import { ouvirBarbearia, ouvirBarbeiros } from '../services/barbearias';
import type { Barbearia, Barbeiro } from '../types/models';

export function useMinhaBarbearia() {
  const { perfil } = useAuth();
  // A mais recente: se a casa antiga foi excluída e a pessoa entrou em outra, vale a nova.
  const id = perfil?.barbearias.at(-1);
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [equipe, setEquipe] = useState<Barbeiro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil) return;
    if (!id) { setBarbearia(null); setEquipe([]); setCarregando(false); return; }
    setCarregando(true);
    const a = ouvirBarbearia(db, id, b => { setBarbearia(b); setCarregando(false); });
    const b = ouvirBarbeiros(db, id, setEquipe);
    return () => { a(); b(); };
  }, [id, !!perfil]);

  const ehDono = !!perfil && !!barbearia && barbearia.donoUid === perfil.uid;
  return { barbearia, equipe, carregando: carregando || !perfil, ehDono, uid: perfil?.uid };
}
