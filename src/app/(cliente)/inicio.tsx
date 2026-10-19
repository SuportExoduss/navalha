// Início do cliente: localização atual → barbearias mais próximas.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Cartao, Chip, SemSinal, Tela, Titulo, FalhaAoCarregar } from '../../components/ui';
import { CardBarbearia } from '../../components/CardBarbearia';
import { useBarbeariasPerto } from '../../hooks/useBarbeariasPerto';
import { FILTROS_PADRAO, filtrarBarbearias, type Filtros } from '../../lib/busca';
import { colors, radius, space, type } from '../../theme';

// Atalhos rápidos; os filtros completos ficam na aba Explorar.
const ATALHOS: { rotulo: string; filtro: Partial<Filtros> }[] = [
  { rotulo: 'Todos', filtro: {} },
  { rotulo: 'Aberto agora', filtro: { abertoAgora: true } },
  { rotulo: 'Ainda hoje', filtro: { aindaHoje: true } },
  { rotulo: 'Cabelo', filtro: { categoria: 'cabelo' } },
  { rotulo: 'Barba', filtro: { categoria: 'barba' } },
  { rotulo: 'Combo', filtro: { categoria: 'combo' } },
];

export default function Inicio() {
  const { loc, negada, semSinal, tentarDeNovo, lista, erro, recarregar } = useBarbeariasPerto();
  const [atalho, setAtalho] = useState(0);
  const [busca, setBusca] = useState('');

  const filtrada = filtrarBarbearias(lista ?? [], { ...FILTROS_PADRAO, ...ATALHOS[atalho].filtro, texto: busca }, Date.now());

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="location" size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Sua localização</Text>
          <Text style={[type.body, { fontWeight: '600' }]}>
            {negada ? 'Permita a localização' : semSinal ? 'Sem sinal de localização' : loc?.cidade ? [...new Set([loc.bairro, loc.cidade].filter(Boolean))].join(', ') : loc ? 'Perto de você' : 'Localizando…'}
          </Text>
        </View>
      </View>

      <Titulo destaque="mais perto de você.">{'Seu próximo corte\n'}</Titulo>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.surface, borderRadius: radius.input, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome ou bairro…"
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 15 }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
        {ATALHOS.map((a, i) => <Chip key={a.rotulo} rotulo={a.rotulo} ativo={i === atalho} onPress={() => setAtalho(i)} />)}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={type.heading}>Perto de você</Text>
        <Pressable onPress={() => router.push('/explorar')} hitSlop={8}>
          <Text style={[type.caption, { color: colors.accent }]}>Mais filtros</Text>
        </Pressable>
      </View>

      {negada ? (
        <Cartao><Text style={type.caption}>Sem a localização não dá para ordenar por distância. Ative a permissão nas configurações do aparelho.</Text></Cartao>
      ) : semSinal ? (
        <SemSinal onTentar={tentarDeNovo} />
      ) : erro ? (
        <FalhaAoCarregar texto={erro} onTentar={recarregar} />
      ) : lista === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : filtrada.length === 0 ? (
        <Cartao><Text style={type.caption}>{lista.length ? 'Nenhuma barbearia com esse filtro.' : 'Nenhuma barbearia publicada num raio de 10 km ainda.'}</Text></Cartao>
      ) : filtrada.map(b => <CardBarbearia key={b.id} b={b} />)}
    </Tela>
  );
}
