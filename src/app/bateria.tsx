// Receber avisos com o app fechado (só Android, só barbeiro e dono): passos da marca do celular e um botão que abre
// os ajustes do Navalha. Aparece ao escolher barbeiro/dono (com `depois`, para onde seguir) e pelo Perfil.
// Não usamos o pedido automático de "ignorar otimização de bateria": a Google Play só aceita essa permissão
// para poucos tipos de app e ela arriscaria a aprovação.
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { Botao, Cartao, Tela, Titulo } from '../components/ui';
import { passosBateria } from '../lib/bateria';
import { colors, space, type } from '../theme';

export default function Bateria() {
  const { depois } = useLocalSearchParams<{ depois?: string }>();
  const seguir = () => (depois ? router.replace(depois as never) : router.back());

  return (
    <Tela>
      {depois ? null : (
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      )}
      <View style={{ gap: space(2) }}>
        <Ionicons name="notifications-outline" size={32} color={colors.accent} />
        <Titulo destaque="com o app fechado">Receba os avisos </Titulo>
        <Text style={type.caption}>
          Para saber na hora quando um cliente marca ou cancela, o celular precisa deixar o Navalha funcionar em segundo
          plano. Sem isso, depois de reiniciar, os avisos só chegam quando você abre o app.
        </Text>
      </View>
      <Cartao style={{ gap: space(3) }}>
        <Text style={type.heading}>Nos ajustes do Navalha</Text>
        {passosBateria(Device.manufacturer).map((p, i) => (
          <View key={p} style={{ flexDirection: 'row', gap: space(3) }}>
            <Text style={[type.body, { color: colors.accent, fontWeight: '700', width: 16 }]}>{i + 1}</Text>
            <Text style={[type.body, { flex: 1 }]}>{p}</Text>
          </View>
        ))}
      </Cartao>
      <Botao titulo="Abrir ajustes do Navalha" onPress={() => Linking.openSettings()}
        icone={<Ionicons name="settings-outline" size={18} color={colors.accentText} />} />
      <Botao titulo={depois ? 'Já liberei, continuar' : 'Pronto'} variante="secundario" onPress={seguir} />
      {depois ? (
        <Pressable onPress={seguir} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>Agora não</Text>
        </Pressable>
      ) : null}
    </Tela>
  );
}
