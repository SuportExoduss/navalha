// Tema do app: "seguir o dispositivo", escuro ou claro. A escolha fica salva no aparelho.
// Trocar o tema redesenha o app inteiro (as telas leem `colors` ao desenhar) e volta para a tela em que a pessoa estava.
import { createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { aplicarPaleta, paletas, type NomePaleta, type PreferenciaTema } from '../theme';

const CHAVE = 'navalha.tema';
const Ctx = createContext<{ preferencia: PreferenciaTema; ativo: NomePaleta; escolher: (p: PreferenciaTema) => void }>({
  preferencia: 'sistema', ativo: 'escuro', escolher: () => undefined,
});

export function TemaProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const caminho = usePathname();
  const [preferencia, setPreferencia] = useState<PreferenciaTema | null>(null);
  const voltarPara = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then(v => setPreferencia(v === 'escuro' || v === 'claro' ? v : 'sistema'))
      .catch(() => setPreferencia('sistema'));
  }, []);

  // Escuro é a identidade de origem: sem preferência do sistema, fica nele.
  const ativo: NomePaleta = (preferencia ?? 'sistema') === 'sistema' ? (sistema === 'light' ? 'claro' : 'escuro') : (preferencia as NomePaleta);
  aplicarPaleta(ativo); // antes de desenhar os filhos: eles leem as cores já trocadas

  // Fundo da janela nativa na cor do tema: sem isso pisca a cor antiga ao trocar de tela.
  useEffect(() => { SystemUI.setBackgroundColorAsync(paletas[ativo].bg).catch(() => undefined); }, [ativo]);

  useEffect(() => {
    if (voltarPara.current) { router.replace(voltarPara.current as never); voltarPara.current = null; }
  }, [ativo]);

  function escolher(p: PreferenciaTema) {
    voltarPara.current = caminho;
    setPreferencia(p);
    AsyncStorage.setItem(CHAVE, p).catch(() => undefined);
  }

  if (preferencia === null) return null; // milissegundos, por baixo da tela de abertura: evita piscar o tema errado
  return (
    <Ctx.Provider value={{ preferencia, ativo, escolher }}>
      <StatusBar style={ativo === 'escuro' ? 'light' : 'dark'} />
      {/* A chave troca com o tema: o app é redesenhado inteiro com a paleta nova. */}
      <Fragment key={ativo}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export const useTema = () => useContext(Ctx);
