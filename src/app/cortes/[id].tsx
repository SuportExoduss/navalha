// Etapa 2 de 3 do agendamento: os cortes do barbeiro escolhido na etapa 1 (página da casa).
// Sem barbeiro válido volta para a casa. Casa, equipe e cardápio em tempo real (useCasa).
import { Image, Pressable, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Carregando, Cartao, FalhaAoCarregar, Tela, Titulo } from '../../components/ui';
import { Etapa } from '../../components/agenda/Etapa';
import { formatarPreco } from '../../lib/agenda';
import { colors, radius, space, type } from '../../theme';
import { useCasa } from '../../hooks/useCasa';

export default function EscolherCorte() {
  const { id, barbeiro: barbeiroId } = useLocalSearchParams<{ id: string; barbeiro?: string }>();
  const { dados, falhou, tentarDeNovo } = useCasa(id);

  if (!id) return <Redirect href="/" />;
  if (!barbeiroId) return <Redirect href={{ pathname: '/barbearia/[id]', params: { id } }} />;
  if (falhou) return <Tela><Voltar /><FalhaAoCarregar onTentar={tentarDeNovo} /></Tela>;
  if (dados === undefined) return <Carregando />;

  const barbeiro = dados.equipe.find(e => e.uid === barbeiroId);
  if (!dados.barbearia || !barbeiro) return <Redirect href={{ pathname: '/barbearia/[id]', params: { id } }} />;
  const nome = barbeiro.apelido || barbeiro.nome.split(' ')[0];
  const cortes = dados.servicos.filter(s => s.barbeiroId === barbeiroId);

  return (
    <Tela>
      <Voltar />
      <Text style={type.caption}>{dados.barbearia.nome}</Text>
      <Titulo>Escolha o corte</Titulo>
      <Etapa numero={1} titulo={`Barbeiro: ${nome}`} feito />
      <Etapa numero={2} titulo="Corte" dica={`Os cortes que o ${nome} faz. Toque para ver os horários.`} />

      {cortes.length === 0 ? <Cartao><Text style={type.caption}>{nome} ainda não cadastrou cortes. Volte e escolha outro barbeiro.</Text></Cartao> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {cortes.map(s => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.nome}, ${s.duracaoMin} minutos, ${formatarPreco(s.precoCentavos)}`}
              onPress={() => router.push({ pathname: '/agendar/[id]', params: { id, barbeiro: barbeiroId, servico: s.id } })}
              style={({ pressed }) => ({ width: '47.5%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface,
                borderWidth: 1, borderColor: pressed ? colors.accent : colors.border })}>
              <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                {s.fotos[0] ? <Image source={{ uri: s.fotos[0] }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Foto do ${s.nome}`} />
                  : <Ionicons name="cut-outline" size={28} color={colors.textMuted} />}
              </View>
              <View style={{ padding: space(3), gap: 2 }}>
                <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{s.nome}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={type.caption}>{s.duracaoMin} min</Text>
                  <Text style={[type.caption, { color: colors.accent, fontWeight: '600' }]}>{formatarPreco(s.precoCentavos)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Etapa numero={3} titulo="Horário" dica="Na próxima tela." />
    </Tela>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar para os barbeiros">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
