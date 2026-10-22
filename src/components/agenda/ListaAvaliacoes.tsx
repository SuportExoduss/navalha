// Lista de avaliações (aba Avaliações da casa, ficha do barbeiro e Perfil do cliente). Cada uma mostra quem é o
// cliente (com a capa dele, se tiver), o dia e o horário do corte, o serviço, as estrelas e o comentário.
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Cartao } from '../ui';
import { Estrelas } from './Avaliar';
import { dataLocal, formatarHora, rotuloDia } from '../../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Avaliacao } from '../../types/models';

/** O que a avaliação é, do ponto de vista de quem lê a lista. */
function sobre(a: Avaliacao, vista: 'casa' | 'cliente') {
  if (a.direcao === 'cliente_para_barbearia') return 'Avaliou a barbearia';
  if (a.direcao === 'cliente_para_barbeiro') return a.barbeiroNome ? `Avaliou ${a.barbeiroNome}` : 'Avaliou o barbeiro';
  return vista === 'cliente' ? `${a.barbeiroNome || 'O barbeiro'} avaliou você` : `${a.barbeiroNome || 'O barbeiro'} avaliou o cliente`;
}

function quando(a: Avaliacao) {
  const inicio = a.inicio ?? a.criadoEm;
  const dia = rotuloDia(dataLocal(inicio), dataLocal(Date.now()));
  return `${dia} · ${formatarHora(inicio)}${a.servicoNome ? ` · ${a.servicoNome}` : ''}`;
}

export function ItemAvaliacao({ a, vista = 'casa' }: { a: Avaliacao; vista?: 'casa' | 'cliente' }) {
  const nome = a.clienteNome || 'Cliente';
  const avatar = a.clienteFotoUrl
    ? <Image source={{ uri: a.clienteFotoUrl }} style={{ width: 36, height: 36, borderRadius: radius.chip }} />
    : <View style={{ width: 36, height: 36, borderRadius: radius.chip, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-outline" size={16} color={colors.textMuted} />
      </View>;
  // No Perfil do cliente, quem aparece é o barbeiro que avaliou (o cliente já sabe quem ele é).
  const titulo = vista === 'cliente' ? sobre(a, vista) : nome;
  const sub = vista === 'cliente' ? quando(a) : `${sobre(a, vista)} · ${quando(a)}`;
  return (
    <Cartao style={{ gap: space(2), padding: 0, overflow: 'hidden' }}>
      {vista === 'casa' && a.clienteBannerUrl ? (
        // Com capa: a foto do cliente ao fundo e o nome numa faixa com véu (legível sobre qualquer imagem).
        <View style={{ height: 76, justifyContent: 'flex-end' }}>
          <Image source={{ uri: a.clienteBannerUrl }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2), backgroundColor: sobreFoto.veu }}>
            {avatar}
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: '600', color: sobreFoto.texto }]} numberOfLines={1}>{titulo}</Text>
              <Text style={[type.caption, { color: sobreFoto.texto }]} numberOfLines={1}>{sub}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingTop: space(4) }}>
          {vista === 'casa' ? avatar : null}
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{titulo}</Text>
            <Text style={type.caption} numberOfLines={2}>{sub}</Text>
          </View>
        </View>
      )}
      <View style={{ gap: space(1), paddingHorizontal: space(4), paddingBottom: space(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Estrelas valor={a.estrelas} />
          {a.origem === 'cancelamento' ? <Text style={type.caption}>· no cancelamento</Text> : null}
        </View>
        {a.comentario ? <Text style={type.body}>{a.comentario}</Text> : null}
      </View>
    </Cartao>
  );
}

/** Média em destaque no topo das listas: "★ 4,7 · 23 avaliações". */
export function MediaAvaliacoes({ nota, rotulo }: { nota?: { media: number; total: number }; rotulo: string }) {
  const tem = !!nota?.total;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
      <Ionicons name="star" size={20} color={tem ? colors.accent : colors.textMuted} />
      <Text style={type.heading}>{tem ? nota!.media.toFixed(1).replace('.', ',') : '—'}</Text>
      <Text style={type.caption}>{tem ? `${rotulo} · ${nota!.total} ${nota!.total === 1 ? 'avaliação' : 'avaliações'}` : `${rotulo} · sem avaliações ainda`}</Text>
    </View>
  );
}
