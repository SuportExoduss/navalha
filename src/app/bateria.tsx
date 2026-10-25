// Receber avisos com o app fechado (só Android, só barbeiro e dono). Cada botão abre direto a tela certa da marca
// do celular (src/lib/bateria.ts): a restrição de bateria do Navalha e, onde é separado, o início automático.
// Aparece ao escolher barbeiro/dono (com `depois`, para onde seguir) e pelo Perfil.
// Não usamos o pedido automático de "ignorar otimização de bateria": a Google Play só aceita essa permissão
// para poucos tipos de app e ela arriscaria a aprovação.
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Device from 'expo-device';
import { Botao, Cartao, Tela, Titulo } from '../components/ui';
import { abrirAjuste } from '../components/abrirAjuste';
import { passosBateria, telasBateria, telasInicioAutomatico } from '../lib/bateria';
import { colors, space, type } from '../theme';

export default function Bateria() {
  const { depois } = useLocalSearchParams<{ depois?: string }>();
  const seguir = () => (depois ? router.replace(depois as never) : router.back());
  const passos = passosBateria(Device.manufacturer);
  const inicio = telasInicioAutomatico(Device.manufacturer);

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
      <Passo numero={1} titulo="Bateria sem restrição" texto={passos.bateria}
        botao="Abrir a bateria do Navalha" onPress={() => abrirAjuste(telasBateria(Device.manufacturer))} />
      {inicio.length && passos.inicio ? (
        <Passo numero={2} titulo="Início automático" texto={passos.inicio}
          botao="Abrir o início automático" onPress={() => abrirAjuste(inicio)} />
      ) : null}
      <Botao titulo={depois ? 'Já liberei, continuar' : 'Pronto'} variante="secundario" onPress={seguir} />
      {depois ? (
        <Pressable onPress={seguir} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>Agora não</Text>
        </Pressable>
      ) : null}
    </Tela>
  );
}

function Passo({ numero, titulo, texto, botao, onPress }: { numero: number; titulo: string; texto: string; botao: string; onPress: () => void }) {
  return (
    <Cartao style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'baseline' }}>
        <Text style={[type.heading, { color: colors.accent }]}>{numero}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.heading}>{titulo}</Text>
          <Text style={type.caption}>{texto}</Text>
        </View>
      </View>
      <Botao titulo={botao} onPress={onPress} icone={<Ionicons name="open-outline" size={18} color={colors.accentText} />} />
    </Cartao>
  );
}
