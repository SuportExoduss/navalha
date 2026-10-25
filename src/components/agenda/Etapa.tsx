// Cabeçalho de etapa do agendamento (1 barbeiro, 2 corte, 3 horário): número, o que fazer e
// o check quando a etapa já está resolvida. A ordem é fixa: só se agenda passando pelas três.
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, space, type } from '../../theme';

export function Etapa({ numero, titulo, feito, dica }: { numero: 1 | 2 | 3; titulo: string; feito?: boolean; dica?: string }) {
  return (
    <View accessibilityRole="header" accessibilityLabel={`Etapa ${numero} de 3: ${titulo}${feito ? ', concluída' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2) }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: feito ? colors.accent : colors.surfaceRaised, borderWidth: feito ? 0 : 1, borderColor: colors.border }}>
        {feito ? <Ionicons name="checkmark" size={16} color={colors.accentText} />
          : <Text style={[type.caption, { fontWeight: '700', color: colors.text }]}>{numero}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>{titulo}</Text>
        {dica ? <Text style={type.caption}>{dica}</Text> : null}
      </View>
    </View>
  );
}
