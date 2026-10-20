// Escolha de papel após o primeiro login. A mesma conta pode ter vários
// papéis e alternar entre eles no perfil.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tela, Titulo } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../services/firebase';
import { registrarPush } from '../services/push';
import { escolherPapel } from '../services/usuarios';
import { colors, radius, space, type } from '../theme';
import type { Role } from '../types/models';

const OPCOES: { papel: Role; icone: keyof typeof Ionicons.glyphMap; titulo: string; texto: string }[] = [
  { papel: 'cliente', icone: 'cut-outline', titulo: 'Quero agendar', texto: 'Encontrar barbearias perto e marcar meu corte.' },
  { papel: 'dono', icone: 'storefront-outline', titulo: 'Tenho uma barbearia', texto: 'Cadastrar a casa, a equipe e receber agendamentos.' },
  { papel: 'barbeiro', icone: 'person-outline', titulo: 'Trabalho numa barbearia', texto: 'Entrar com o código de convite do dono.' },
];

export default function Papel() {
  const { user, perfil } = useAuth();
  const [salvando, setSalvando] = useState<Role | null>(null);
  if (!user) return <Redirect href="/entrar" />;

  async function escolher(papel: Role) {
    if (!perfil) return;
    setSalvando(papel);
    // No 1º login o pedido feito no AuthProvider dispara com a tela do Google ainda por cima e o
    // Android nega sem mostrar o diálogo. Aqui o app está em primeiro plano, por um toque da pessoa.
    if (!perfil.pushToken) registrarPush(perfil.uid).catch(() => undefined);
    await escolherPapel(db, perfil, papel);
    // Dono e barbeiro caem direto na aba Barbearia: lá está o cadastro da casa ou o campo do convite.
    router.replace(papel === 'cliente' ? '/inicio' : '/casa');
  }

  return (
    <Tela>
      <Titulo destaque="o app?">Como você vai usar </Titulo>
      <Text style={type.caption}>Quem tem barbearia também marca o próprio corte como cliente. Dá para trocar no Perfil, sem sair da conta.</Text>
      <View style={{ gap: space(3) }}>
        {OPCOES.map(o => (
          <Pressable
            key={o.papel}
            accessibilityRole="button"
            onPress={() => escolher(o.papel)}
            disabled={!!salvando}
            style={({ pressed }) => ({
              flexDirection: 'row', gap: space(4), alignItems: 'center', padding: space(4),
              borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1,
              borderColor: salvando === o.papel ? colors.accent : colors.border, opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={o.icone} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.heading}>{o.titulo}</Text>
              <Text style={type.caption}>{o.texto}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Tela>
  );
}
