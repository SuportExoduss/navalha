// Avaliações da barbearia (aba Avaliações da página da casa): primeiro nome, dia do corte, estrelas e comentário.
// Pública: nada de foto, capa ou horário do cliente.
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Cartao } from '../ui';
import { Estrelas } from './Avaliar';
import { dataLocal, rotuloDia } from '../../lib/agenda';
import { colors, space, type } from '../../theme';
import type { Avaliacao } from '../../types/models';

export function ItemAvaliacao({ a }: { a: Avaliacao }) {
  const dia = rotuloDia(dataLocal(a.inicio ?? a.criadoEm), dataLocal(Date.now()));
  return (
    <Cartao style={{ gap: space(2) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) }}>
        <Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>{a.clienteNome || 'Cliente'}</Text>
        <Text style={type.caption}>{dia}</Text>
      </View>
      <Estrelas valor={a.estrelas} />
      {a.comentario ? <Text style={type.body}>{a.comentario}</Text> : null}
    </Cartao>
  );
}

/** Média em destaque: "★ 4,7 · 23 avaliações" (0 avaliações: "Ainda sem avaliações"). */
export function MediaAvaliacoes({ media, total }: { media: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <Ionicons name="star" size={20} color={total ? colors.accent : colors.textMuted} />
      <Text style={type.heading}>{total ? media.toFixed(1).replace('.', ',') : '—'}</Text>
      <Text style={type.caption}>{total ? `${total} ${total === 1 ? 'avaliação' : 'avaliações'}` : 'Ainda sem avaliações'}</Text>
    </View>
  );
}
