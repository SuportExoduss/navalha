// Horários livres agrupados em Manhã / Tarde / Noite.
import { Text, View } from 'react-native';
import { Chip } from '../ui';
import { agruparPorPeriodo, formatarHora } from '../../lib/agenda';
import { space, type } from '../../theme';
import type { Millis } from '../../types/models';

const PERIODOS = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']] as const;

export function GradeHorarios({ horarios, valor, onChange }: { horarios: Millis[]; valor: Millis | null; onChange: (h: Millis) => void }) {
  const g = agruparPorPeriodo(horarios);
  return (
    <View style={{ gap: space(4) }}>
      {PERIODOS.filter(([k]) => g[k].length).map(([k, nome]) => (
        <View key={k} style={{ gap: space(2) }}>
          <Text style={type.caption}>{nome}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {g[k].map(h => <Chip key={h} rotulo={formatarHora(h)} ativo={h === valor} onPress={() => onChange(h)} />)}
          </View>
        </View>
      ))}
    </View>
  );
}
