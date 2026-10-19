import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { criarPerfil, ouvirPerfil } from '../services/usuarios';
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
      // Uma leitura por abertura: a própria escuta traz o perfil (antes havia um getDoc antes dela).
      let primeira = true;
      let pushFeito = false;
      pararPerfil = ouvirPerfil(db, user.uid, perfil => {
        const eraPrimeira = primeira;
        primeira = false;
        // Sem documento logo na 1ª resposta = primeiro login: cria (a escuta recebe o novo em seguida).
        // Sumiu depois = conta sendo excluída: não recria.
        if (!perfil && !eraPrimeira) { setState({ carregando: false, user, perfil: null }); return; }
        if (!perfil) {
          criarPerfil(db, user).catch(e => { console.warn('Falha ao criar o perfil', e); setState({ carregando: false, user, perfil: null }); });
          return;
        }
        if (!pushFeito) {
          pushFeito = true;
          // Lembretes: registra (ou atualiza) o token de push a cada login; nunca bloqueia a entrada.
          registrarPush(user.uid, perfil.pushToken).catch(e => console.warn('Push indisponível', e));
        }
        setState({ carregando: false, user, perfil });
      }, e => {
        // Sem isto a tela de carregamento girava para sempre quando o servidor recusava ou caía.
        console.warn('Falha ao carregar o perfil', e);
        setState({ carregando: false, user, perfil: null });
      });
    });
    return () => { pararAuth(); pararPerfil?.(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
