// Página pública da barbearia: o que o cliente vê antes de agendar.
// Agendar é sempre em 3 etapas, nesta ordem: 1) barbeiro, 2) corte (só os daquele barbeiro), 3) horário (tela /agendar).
// Casa com um barbeiro só: a etapa 1 já vem escolhida. "Agendar de novo" chega aqui com ?barbeiro= preenchido.
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Carregando, Cartao, FalhaAoCarregar, Tela, Titulo } from '../../components/ui';
import { Etapa } from '../../components/agenda/Etapa';
import { dadosDaCasa, linksDeRota } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { registrarEvento } from '../../services/agendamentos';
import { useAuth } from '../../auth/AuthProvider';
import { formatarPreco } from '../../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro, Servico } from '../../types/models';

export default function PaginaBarbearia() {
  const { id, barbeiro: barbeiroInicial } = useLocalSearchParams<{ id: string; barbeiro?: string }>();
  const { perfil } = useAuth();
  const [b, setB] = useState<Barbearia | null | undefined>(undefined);
  const [equipe, setEquipe] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiro, setBarbeiro] = useState<string | null>(barbeiroInicial ?? null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!id) return;
    if (perfil && !tentativa) registrarEvento(db, { tipo: 'viu_barbearia', uid: perfil.uid, barbeariaId: id, em: Date.now() });
    setFalhou(false);
    // Uma leitura guardada por 5 min, reaproveitada pelo agendar (ir e voltar não relê).
    dadosDaCasa(db, id, { forcar: tentativa > 0 })
      .then(d => {
        setB(d.barbearia); setEquipe(d.equipe); setServicos(d.servicos);
        if (d.equipe.length === 1) setBarbeiro(d.equipe[0].uid); // um barbeiro só: etapa 1 já resolvida
      })
      .catch(() => { setFalhou(true); setB(null); });
  }, [id, tentativa]);

  // Etapa 2 só mostra os cortes do barbeiro escolhido na etapa 1.
  const cortes = useMemo(() => (barbeiro ? servicos.filter(s => s.barbeiroId === barbeiro) : []), [servicos, barbeiro]);
  const escolhido = equipe.find(e => e.uid === barbeiro);
  const fotos = [...(b?.fotos ?? []), ...servicos.flatMap(s => s.fotos)].slice(0, 24);

  if (b === undefined) return <Carregando />;
  if (b === null && falhou) {
    return <Tela><Voltar /><FalhaAoCarregar onTentar={() => { setB(undefined); setTentativa(n => n + 1); }} /></Tela>;
  }
  if (b === null) {
    return <Tela><Voltar /><Titulo>Barbearia não encontrada</Titulo><Aviso texto="Ela pode ter saído do ar." /></Tela>;
  }

  const rota = linksDeRota(b.geo.lat, b.geo.lng);
  const nota = b.resumo.notaRanking ?? b.resumo.notaApp;
  // Só dígitos e com o 55 do Brasil uma vez só (o dono pode ter digitado +55).
  const digitos = b.telefone?.replace(/\D/g, '');
  const whats = digitos ? (digitos.length >= 12 && digitos.startsWith('55') ? digitos : '55' + digitos) : undefined;

  return (
    <Tela>
      <View style={{ height: 200, marginHorizontal: -space(5), marginTop: -space(5), backgroundColor: colors.surfaceRaised }}>
        {b.capaUrl ? <Image source={{ uri: b.capaUrl }} style={{ width: '100%', height: '100%' }} /> : null}
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}
          style={{ position: 'absolute', top: space(4), left: space(4), width: 40, height: 40, borderRadius: 20, backgroundColor: sobreFoto.veu, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={sobreFoto.texto} />
        </Pressable>
      </View>

      <View style={{ gap: space(1) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          {b.logoUrl ? <Image source={{ uri: b.logoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} accessibilityLabel={`Logo da ${b.nome}`} /> : null}
          <View style={{ flex: 1 }}><Titulo>{b.nome}</Titulo></View>
        </View>
        <Text style={type.caption}>
          <Text style={{ color: colors.accent }}>★ </Text>
          {nota > 0 ? `${nota.toFixed(1).replace('.', ',')} · ` : 'Nova no Navalha · '}
          {b.resumo.precoMin ? `${formatarPreco(b.resumo.precoMin)} a ${formatarPreco(b.resumo.precoMax ?? b.resumo.precoMin)}` : 'Cardápio em montagem'}
        </Text>
        <Text style={type.caption}>{b.endereco} · {b.cidade}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Google Maps" variante="secundario" style={{ flex: 1 }} onPress={() => Linking.openURL(rota.googleMaps)}
          icone={<Ionicons name="navigate-outline" size={16} color={colors.text} />} />
        <Botao titulo="Waze" variante="secundario" style={{ flex: 1 }} onPress={() => Linking.openURL(rota.waze)}
          icone={<Ionicons name="car-outline" size={16} color={colors.text} />} />
        {whats ? (
          <Botao titulo="" variante="secundario" accessibilityLabel="WhatsApp" style={{ width: 56, paddingHorizontal: 0 }}
            onPress={() => Linking.openURL(`https://wa.me/${whats}?text=${encodeURIComponent(`Olá! Vi a ${b.nome} no Navalha.`)}`)}
            icone={<Ionicons name="logo-whatsapp" size={20} color={colors.text} />} />
        ) : null}
      </View>

      <Etapa numero={1} titulo="Escolha o barbeiro" feito={!!escolhido} />
      {equipe.length === 0 ? <Cartao><Text style={type.caption}>Esta barbearia ainda não tem barbeiros na agenda.</Text></Cartao> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }} accessibilityRole="radiogroup">
          {equipe.map(e => {
            const ativo = barbeiro === e.uid;
            const qtd = servicos.filter(s => s.barbeiroId === e.uid).length;
            return (
              <Pressable key={e.uid} onPress={() => setBarbeiro(e.uid)} accessibilityRole="radio" accessibilityState={{ checked: ativo }}
                accessibilityLabel={`Barbeiro ${e.apelido || e.nome}`}
                style={{ width: 112, alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.card, borderWidth: 1,
                  borderColor: ativo ? colors.accent : colors.border, backgroundColor: ativo ? colors.surfaceRaised : colors.surface }}>
                {e.fotoUrl ? <Image source={{ uri: e.fotoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                  : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-outline" size={24} color={colors.textMuted} />
                    </View>}
                <Text style={[type.body, { fontWeight: ativo ? '700' : '400', textAlign: 'center' }]} numberOfLines={1}>{e.apelido || e.nome.split(' ')[0]}</Text>
                <Text style={[type.caption, { textAlign: 'center' }]} numberOfLines={1}>
                  {e.nota.total ? `★ ${e.nota.media.toFixed(1).replace('.', ',')} · ` : ''}{qtd} {qtd === 1 ? 'corte' : 'cortes'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Etapa numero={2} titulo={escolhido ? `Escolha o corte com ${escolhido.apelido || escolhido.nome.split(' ')[0]}` : 'Escolha o corte'} />
      {!escolhido ? <Text style={type.caption}>Escolha o barbeiro primeiro para ver os cortes dele.</Text>
        : cortes.length === 0 ? <Cartao><Text style={type.caption}>Este barbeiro ainda não cadastrou cortes.</Text></Cartao> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {cortes.map(s => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.nome}, ${s.duracaoMin} minutos, ${formatarPreco(s.precoCentavos)}`}
              onPress={() => router.push({ pathname: '/agendar/[id]', params: { id: b.id, barbeiro: s.barbeiroId, servico: s.id } })}
              style={{ width: '47.5%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                {s.fotos[0] ? <Image source={{ uri: s.fotos[0] }} style={{ width: '100%', height: '100%' }} />
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

      <Etapa numero={3} titulo="Escolha o horário" dica="Toque no corte para ver os horários livres." />

      {/* Fotos da casa e dos cortes: referência, fora do fluxo de agendar. */}
      {fotos.length ? (
        <View style={{ gap: space(3), marginTop: space(4) }}>
          <Text accessibilityRole="header" style={type.heading}>Fotos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {fotos.map(f => (
              <Image key={f} source={{ uri: f }} accessibilityLabel="Foto de corte da barbearia" style={{ width: '31.5%', aspectRatio: 4 / 5, borderRadius: radius.input }} />
            ))}
          </View>
        </View>
      ) : null}
    </Tela>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
