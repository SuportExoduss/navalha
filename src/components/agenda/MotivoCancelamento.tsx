// Motivo do cancelamento: um seletor (spinner) com opções fixas, sem digitar. Usado pelo cliente e pela casa;
// quem está do outro lado vê o motivo na agenda ou no histórico.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, minTouch, radius, space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

export const MOTIVOS = {
  cliente: ['Dia errado', 'Terei um compromisso', 'Sem motivos', 'Não estarei presente', 'Mudança de planos', 'Outros'],
  casa: ['Barbeiro indisponível', 'Barbearia fechada', 'Cliente pediu', 'Imprevisto na barbearia', 'Outros'],
} as const;

/** Campo que abre a lista de motivos e fecha ao escolher; devolve o motivo escolhido. */
export function MotivoCancelamento({ por, onChange }: { por: 'cliente' | 'casa'; onChange: (motivo: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  return (
    <View style={{ gap: space(1) }}>
      <Text style={type.caption}>Motivo (quem está do outro lado vê)</Text>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`Motivo: ${escolhido ?? 'nenhum escolhido'}`} accessibilityState={{ expanded: aberto }}
        onPress={() => setAberto(a => !a)}
        style={{ minHeight: minTouch + 4, borderRadius: radius.input, borderWidth: 1, borderColor: aberto ? colors.accent : colors.border,
          backgroundColor: colors.surfaceRaised, paddingHorizontal: space(4), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={[type.body, !escolhido && { color: colors.textMuted }]}>{escolhido ?? 'Escolha o motivo'}</Text>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {aberto ? (
        <View accessibilityRole="list" style={{ borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
          {MOTIVOS[por].map((m, i) => (
            <Pressable
              key={m} accessibilityRole="button" accessibilityState={{ selected: escolhido === m }}
              onPress={() => { setEscolhido(m); setAberto(false); onChange(m); }}
              style={({ pressed }) => ({ minHeight: minTouch, paddingHorizontal: space(4), justifyContent: 'center',
                borderTopWidth: i ? 1 : 0, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' })}
            >
              <Text style={[type.body, escolhido === m && { color: colors.accent, fontWeight: '600' }]}>{m}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** "Cancelado por você · Dia errado", "Cancelado pela barbearia · Barbeiro indisponível". */
export function textoCancelamento(a: Pick<Agendamento, 'cancelamento'>, quemVe: 'cliente' | 'casa'): string | null {
  const c = a.cancelamento;
  if (!c) return null;
  const quem = c.por === quemVe ? 'por você' : c.por === 'casa' ? 'pela barbearia' : 'pelo cliente';
  return `Cancelado ${quem} · ${c.motivo}`;
}
