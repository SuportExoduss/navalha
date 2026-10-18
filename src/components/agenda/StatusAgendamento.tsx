// Etiqueta de status do agendamento, com cor só onde ajuda a decidir.
import { Text } from 'react-native';
import { colors, radius, space } from '../../theme';
import type { StatusAgendamento } from '../../types/models';

const ROTULO: Record<StatusAgendamento, { texto: string; cor: string }> = {
  reservado: { texto: 'Reservado', cor: colors.accent },
  confirmado: { texto: 'Confirmado', cor: colors.success },
  pago: { texto: 'Pago', cor: colors.success },
  concluido: { texto: 'Concluído', cor: colors.textMuted },
  faltou: { texto: 'Faltou', cor: colors.danger },
  cancelado: { texto: 'Cancelado', cor: colors.textMuted },
};

export function EtiquetaStatus({ status }: { status: StatusAgendamento }) {
  const r = ROTULO[status];
  return (
    <Text style={{ color: r.cor, fontSize: 12, fontWeight: '600', borderWidth: 1, borderColor: r.cor, borderRadius: radius.chip, paddingHorizontal: space(2), paddingVertical: 2, alignSelf: 'flex-start' }}>
      {r.texto}
    </Text>
  );
}

export const ATIVOS: StatusAgendamento[] = ['reservado', 'confirmado', 'pago'];
