// Capa (banner) de perfil: faixa no topo do perfil do cliente e da ficha do barbeiro. Sem capa, um espaço discreto
// para adicionar; com capa, a foto ocupa a faixa. O selo da câmera indica que dá para trocar.
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, space, type, sobreFoto } from '../theme';

export const ALTURA_CAPA = 120;

export function Capa({ url, onTrocar, enviando }: { url?: string; onTrocar?: () => void; enviando?: boolean }) {
  const conteudo = (
    <View style={{ height: ALTURA_CAPA, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceRaised,
      borderWidth: url ? 0 : 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      {url ? <Image source={{ uri: url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        : onTrocar ? (
          <View style={{ alignItems: 'center', gap: space(1) }}>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
            <Text style={type.caption}>Adicionar capa</Text>
          </View>
        ) : null}
      {onTrocar && url ? (
        <View style={{ position: 'absolute', top: space(2), right: space(2), backgroundColor: sobreFoto.veu, borderRadius: radius.chip, padding: space(2) }}>
          <Ionicons name={enviando ? 'hourglass-outline' : 'camera'} size={14} color={sobreFoto.texto} />
        </View>
      ) : null}
    </View>
  );
  if (!onTrocar) return conteudo;
  return (
    <Pressable onPress={onTrocar} disabled={enviando} accessibilityRole="button" accessibilityLabel={url ? 'Trocar capa' : 'Adicionar capa'}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {conteudo}
    </Pressable>
  );
}
