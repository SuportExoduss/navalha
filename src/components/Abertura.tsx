// Abertura do app: cópia exata da splash nativa (mesmo fundo e logo) que assume assim que o JS carrega e faz a
// transição. A nativa só sai quando esta já está na tela, então não há salto. Tocar em qualquer ponto pula.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../auth/AuthProvider';
import { ENTRADA_MS, SAIDA_MS, esperaRestante } from '../lib/abertura';
import { paletas } from '../theme';

// A splash nativa (app.json) é sempre escura, nos dois temas; a cópia também.
const FUNDO = paletas.escuro.bg;
const inicio = Date.now();

export function Abertura() {
  const { carregando, user } = useAuth();
  const [visivel, setVisivel] = useState(true);
  const opacidade = useRef(new Animated.Value(1)).current;
  const subida = useRef(new Animated.Value(0)).current;
  const saindo = useRef(false);

  function sair(rapido = false) {
    if (saindo.current) return;
    saindo.current = true;
    const primeiraVez = !user && !rapido;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduzir => {
      const duracao = rapido ? 150 : primeiraVez ? ENTRADA_MS : SAIDA_MS;
      Animated.parallel([
        Animated.timing(opacidade, { toValue: 0, duration: duracao, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        // Entrada da primeira vez: o logo sobe um pouco enquanto some. Com "reduzir movimento", só o fade.
        Animated.timing(subida, { toValue: primeiraVez && !reduzir ? -24 : 0, duration: duracao, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setVisivel(false));
      // Garantia: com a página em segundo plano a animação pode não terminar; a abertura nunca fica presa na tela.
      setTimeout(() => setVisivel(false), duracao + 250);
    });
  }

  useEffect(() => {
    if (carregando) return;
    const t = setTimeout(() => sair(), esperaRestante(inicio, Date.now(), !!user));
    return () => clearTimeout(t);
  }, [carregando, user]);

  if (!visivel) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidade, backgroundColor: FUNDO }]}
      // Esta cópia já está desenhada: agora a nativa pode sair sem piscar.
      onLayout={() => SplashScreen.hide()}>
      <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={() => sair(true)}
        accessibilityRole="button" accessibilityLabel="Pular abertura">
        <Animated.Image source={require('../../assets/splash-icon.png')} resizeMode="contain"
          style={{ width: 200, height: 200, transform: [{ translateY: subida }] }} accessibilityIgnoresInvertColors />
      </Pressable>
    </Animated.View>
  );
}
