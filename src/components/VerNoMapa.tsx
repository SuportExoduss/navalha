// "Ver no mapa": só o Google Maps no celular abre direto; com Waze ou Uber instalados, pergunta qual usar.
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Botao, Linha } from './ui';
import { linksDeRota } from '../services/barbearias';
import { colors, radius, sobreFoto, space, type } from '../theme';

const ICONE = { 'Google Maps': 'map-outline', Waze: 'navigate-outline', Uber: 'car-outline' } as const;

export function VerNoMapa({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const [opcoes, setOpcoes] = useState<ReturnType<typeof linksDeRota> | null>(null);

  async function abrir() {
    const todas = linksDeRota(lat, lng, nome);
    // Na web não dá para saber o que está instalado: mostra todas (os links abrem no navegador).
    const disponiveis = Platform.OS === 'web' ? todas
      : (await Promise.all(todas.map(async o => (!o.esquema || await Linking.canOpenURL(o.esquema).catch(() => false)) ? o : null)))
        .filter((o): o is (typeof todas)[number] => !!o);
    if (disponiveis.length === 1) Linking.openURL(disponiveis[0].url);
    else setOpcoes(disponiveis);
  }

  return (
    <>
      <Botao titulo="Ver no mapa" variante="secundario" style={{ flex: 1 }} onPress={abrir}
        icone={<Ionicons name="navigate-outline" size={16} color={colors.text} />} />
      <Modal visible={!!opcoes} transparent animationType="fade" onRequestClose={() => setOpcoes(null)}>
        <Pressable onPress={() => setOpcoes(null)} accessibilityLabel="Fechar"
          style={{ flex: 1, backgroundColor: sobreFoto.veu, justifyContent: 'flex-end', padding: space(4) }}>
          {/* Tocar no cartão não fecha: só fora dele. */}
          <Pressable accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space(4), gap: space(3),
            borderWidth: 1, borderColor: colors.border, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <Text style={type.heading}>Abrir com</Text>
            <View style={{ gap: space(2) }}>
              {opcoes?.map(o => (
                <Linha key={o.app} icone={ICONE[o.app as keyof typeof ICONE]} titulo={o.app}
                  onPress={() => { setOpcoes(null); Linking.openURL(o.url); }} />
              ))}
            </View>
            <Botao titulo="Cancelar" variante="secundario" onPress={() => setOpcoes(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
