// Card da lista "Perto de você": 1 leitura por card, graças ao resumo desnormalizado.
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BarbeariaPerto } from '../services/barbearias';
import { formatarPreco } from '../lib/agenda';
import { abertaAgora } from '../lib/busca';
import { colors, radius, space, type } from '../theme';

export const distancia = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
const nota = (n: number) => n.toFixed(1).replace('.', ',');

export function CardBarbearia({ b }: { b: BarbeariaPerto }) {
  const capa = b.capaUrl ?? b.fotos[0];
  const notaRanking = b.resumo.notaRanking ?? b.resumo.notaApp;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/barbearia/[id]', params: { id: b.id } })} style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ height: 150, backgroundColor: colors.surfaceRaised }}>
        {capa ? <Image source={{ uri: capa }} style={{ width: '100%', height: '100%' }} /> : null}
        <View style={{ position: 'absolute', top: space(3), left: space(3), flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(14,15,17,0.8)', borderRadius: radius.chip, paddingHorizontal: space(3), paddingVertical: space(1) }}>
          <Ionicons name="location-outline" size={13} color={colors.text} />
          <Text style={[type.caption, { color: colors.text }]}>{distancia(b.distanciaKm)}</Text>
        </View>
      </View>
      <View style={{ padding: space(4), gap: space(1) }}>
        <Text style={type.heading}>{b.nome}</Text>
        <View style={{ flexDirection: 'row', gap: space(4), flexWrap: 'wrap' }}>
          <Text style={type.caption}>
            <Text style={{ color: colors.accent }}>★ </Text>
            {notaRanking > 0 ? `${nota(notaRanking)} (${b.resumo.totalAvaliacoesApp + (b.resumo.totalAvaliacoesGoogle ?? 0)})` : 'Novo'}
          </Text>
          {b.resumo.precoMin ? <Text style={type.caption}>a partir de {formatarPreco(b.resumo.precoMin)}</Text> : null}
          {abertaAgora(b, Date.now()) ? <Text style={[type.caption, { color: colors.success }]}>Aberta agora</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
