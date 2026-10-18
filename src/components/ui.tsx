import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, minTouch, radius, space, type } from '../theme';

export function Tela({ children, rolar = true }: { children: ReactNode; rolar?: boolean }) {
  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      {rolar ? <ScrollView contentContainerStyle={s.conteudo}>{children}</ScrollView>
        : <View style={[s.conteudo, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

type BotaoProps = Omit<PressableProps, 'children'> & {
  titulo: string;
  variante?: 'primario' | 'secundario';
  carregando?: boolean;
  icone?: ReactNode;
};

export function Botao({ titulo, variante = 'primario', carregando, icone, style, disabled, ...p }: BotaoProps) {
  const primario = variante === 'primario';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || carregando}
      style={({ pressed }) => [
        s.botao,
        primario ? s.botaoPrimario : s.botaoSecundario,
        (pressed || disabled) && { opacity: 0.75 },
        style as StyleProp<ViewStyle>,
      ]}
      {...p}
    >
      {carregando ? <ActivityIndicator color={primario ? colors.accentText : colors.text} /> : (
        <>
          {icone}
          <Text style={[s.botaoTexto, { color: primario ? colors.accentText : colors.text }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!ativo }}
      onPress={onPress}
      style={[s.chip, ativo && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[s.chipTexto, ativo && { color: colors.accentText, fontWeight: '600' }]}>{rotulo}</Text>
    </Pressable>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.cartao, style]}>{children}</View>;
}

export function Titulo({ children, destaque }: { children: ReactNode; destaque?: string }) {
  return (
    <Text style={type.title}>
      {children}
      {destaque ? <Text style={{ color: colors.accent }}>{destaque}</Text> : null}
    </Text>
  );
}

export function Campo({ rotulo, dica, ...p }: TextInputProps & { rotulo: string; dica?: string }) {
  return (
    <View style={{ gap: space(1) }}>
      <Text style={type.caption}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...p}
        style={[s.campo, p.multiline && { minHeight: 88, paddingTop: space(3), textAlignVertical: 'top' }, p.style]}
      />
      {dica ? <Text style={[type.caption, { fontSize: 12 }]}>{dica}</Text> : null}
    </View>
  );
}

export function Secao({ titulo, acao, onAcao, children }: { titulo: string; acao?: string; onAcao?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={type.heading}>{titulo}</Text>
        {acao ? (
          <Pressable accessibilityRole="button" onPress={onAcao} hitSlop={12}>
            <Text style={[type.caption, { color: colors.accent, fontWeight: '600' }]}>{acao}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Aviso({ texto, tom = 'neutro' }: { texto: string; tom?: 'neutro' | 'erro' | 'ok' }) {
  const cor = tom === 'erro' ? colors.danger : tom === 'ok' ? colors.success : colors.textMuted;
  return <Text style={[type.caption, { color: cor }]}>{texto}</Text>;
}

export function Carregando() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space(10) }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** Switch com as cores do tema também na web (onde o polegar seria verde-água). */
export function Interruptor({ value, onValueChange, rotulo }: { value: boolean; onValueChange: (v: boolean) => void; rotulo: string }) {
  const web = { activeThumbColor: colors.text, activeTrackColor: colors.accent } as object;
  return (
    <Switch value={value} onValueChange={onValueChange} accessibilityLabel={rotulo}
      trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.text} {...web} />
  );
}

export function EmBreve({ titulo, texto, fase }: { titulo: string; texto: string; fase: string }) {
  return (
    <Cartao style={{ gap: space(2) }}>
      <Text style={type.heading}>{titulo}</Text>
      <Text style={type.caption}>{texto}</Text>
      <Text style={[type.caption, { color: colors.accent }]}>{fase}</Text>
    </Cartao>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.bg },
  conteudo: { padding: space(5), gap: space(5), paddingBottom: space(10) },
  botao: {
    minHeight: minTouch + 8, borderRadius: radius.card, paddingHorizontal: space(5),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2),
  },
  botaoPrimario: { backgroundColor: colors.accent },
  botaoSecundario: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  botaoTexto: { fontSize: 16, fontWeight: '600' },
  chip: {
    minHeight: minTouch - 4, paddingHorizontal: space(4), borderRadius: radius.chip,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  chipTexto: { color: colors.text, fontSize: 14 },
  campo: {
    minHeight: 48, color: colors.text, fontSize: 15, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.input, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.border,
  },
  cartao: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space(4), borderWidth: 1, borderColor: colors.border },
});
