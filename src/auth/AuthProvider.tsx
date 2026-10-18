import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { garantirPerfil, ouvirPerfil } from '../services/usuarios';
import { registrarPush } from '../services/push';
import type { UserProfile } from '../types/models';

interface AuthState {
  carregando: boolean;
  user: User | null;
  perfil: UserProfile | null;
}

const Ctx = createContext<AuthState>({ carregando: true, user: null, perfil: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ carregando: true, user: null, perfil: null });

  useEffect(() => {
    let pararPerfil: (() => void) | undefined;
    const pararAuth = onAuthStateChanged(auth, async user => {
      pararPerfil?.();
      if (!user) { setState({ carregando: false, user: null, perfil: null }); return; }
      setState(s => ({ ...s, carregando: true, user }));
      try {
        const p = await garantirPerfil(db, user);
        // Lembretes: registra (ou atualiza) o token de push a cada login; nunca bloqueia a entrada.
        registrarPush(user.uid, p.pushToken).catch(e => console.warn('Push indisponível', e));
        pararPerfil = ouvirPerfil(db, user.uid, perfil => setState({ carregando: false, user, perfil }));
      } catch (e) {
        console.warn('Falha ao carregar o perfil', e);
        setState({ carregando: false, user, perfil: null });
      }
    });
    return () => { pararAuth(); pararPerfil?.(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
