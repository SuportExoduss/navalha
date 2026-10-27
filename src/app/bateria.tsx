// Receber avisos com o app fechado (só Android, só barbeiro e dono). O botão abre direto a tela certa da marca do
// celular (src/lib/bateria.ts). O app confere sozinho se a bateria já está sem restrição (BateriaPackage.kt): ao
// escolher barbeiro/dono a tela nem aparece se já estiver; aqui, ao voltar dos ajustes liberado, segue sozinho.
// Não usamos o pedido automático de "ignorar otimização de bateria": a Google Play só aceita essa permissão
// para poucos tipos de app e ela arriscaria a aprovação.
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Device from 'expo-device';
import { Aviso, Botao, Cartao, Carregando, Tela, Titulo } from '../components/ui';
import { abrirAjuste, bateriaLiberada } from '../components/abrirAjuste';
import { passosBateria, telasBateria } from '../lib/bateria';
import { colors, space, type } from '../theme';

export default function Bateria() {
  const { depois } = useLocalSearchParams<{ depois?: string }>();
  const seguir = () => (depois ? router.replace(depois as never) : router.back());
  const [liberada, setLiberada] = useState<boolean | null>(null);

  // Confere ao abrir e sempre que a pessoa volta dos ajustes do Android.
  useEffect(() => {
    const conferir = () => bateriaLiberada().then(setLiberada);
    conferir();
    const sub = AppState.addEventListener('change', e => { if (e === 'active') conferir(); });
    return () => sub.remove();
  }, []);
  useEffect(() => { if (liberada && depois) seguir(); }, [liberada]);

  if (liberada === null || (liberada && depois)) return <Carregando />;
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
      {liberada ? <Aviso tom="ok" texto="Tudo certo: a bateria do Navalha já está sem restrição e os avisos chegam com o app fechado." /> : (
        <Cartao style={{ gap: space(3) }}>
          <Text style={type.heading}>Bateria sem restrição</Text>
          <Text style={type.caption}>{passosBateria(Device.manufacturer)}</Text>
          <Botao titulo="Abrir a bateria do Navalha" onPress={() => abrirAjuste(telasBateria(Device.manufacturer))}
            icone={<Ionicons name="open-outline" size={18} color={colors.accentText} />} />
        </Cartao>
      )}
      {liberada ? <Botao titulo="Voltar" variante="secundario" onPress={seguir} /> : depois ? (
        <Pressable onPress={seguir} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>Agora não</Text>
        </Pressable>
      ) : null}
    </Tela>
  );
}
