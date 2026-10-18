// Faixa de dias rolável ("Hoje", "Amanhã", "Sex 06/11") usada na reserva e na agenda.
import { ScrollView } from 'react-native';
import { Chip } from '../ui';
import { rotuloDia } from '../../lib/agenda';
import { space } from '../../theme';
import type { ISODate } from '../../types/models';

export function SeletorDia({ dias, hoje, valor, onChange }: { dias: ISODate[]; hoje: ISODate; valor: ISODate; onChange: (d: ISODate) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
      {dias.map(d => <Chip key={d} rotulo={rotuloDia(d, hoje)} ativo={d === valor} onPress={() => onChange(d)} />)}
    </ScrollView>
  );
}
