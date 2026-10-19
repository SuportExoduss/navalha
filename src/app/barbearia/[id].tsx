// Página pública da barbearia: o que o cliente vê antes de agendar.
import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Carregando, Cartao, Chip, Tela, Titulo } from '../../components/ui';
import { linksDeRota, listarBarbeiros, listarServicos, lerBarbearia } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { registrarEvento } from '../../services/agendamentos';
import { useAuth } from '../../auth/AuthProvider';
import { formatarPreco } from '../../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro, Servico } from '../../types/models';

const ABAS = ['Cortes', 'Barbeiros', 'Fotos'] as const;

export default function PaginaBarbearia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useAuth();
  const [b, setB] = useState<Barbearia | null | undefined>(undefined);
  const [equipe, setEquipe] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Cortes');
  const [barbeiro, setBarbeiro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (perfil) registrarEvento(db, { tipo: 'viu_barbearia', uid: perfil.uid, barbeariaId: id, em: Date.now() });
    lerBarbearia(db, id).then(setB).catch(() => setB(null));
    listarBarbeiros(db, id).then(setEquipe).catch(() => undefined);
    listarServicos(db, id).then(setServicos).catch(() => undefined);
  }, [id]);

  const visiveis = useMemo(() => servicos.filter(s => !barbeiro || s.barbeiroId === barbeiro), [servicos, barbeiro]);
  const nomeDe = (uid: string) => equipe.find(e => e.uid === uid)?.apelido || equipe.find(e => e.uid === uid)?.nome || '';

  if (b === undefined) return <Carregando />;
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

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {ABAS.map(a => <Chip key={a} rotulo={a} ativo={a === aba} onPress={() => setAba(a)} />)}
      </View>

      {aba === 'Cortes' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
            <Chip rotulo="Todos" ativo={!barbeiro} onPress={() => setBarbeiro(null)} />
            {equipe.map(e => <Chip key={e.uid} rotulo={e.apelido || e.nome.split(' ')[0]} ativo={barbeiro === e.uid} onPress={() => setBarbeiro(e.uid)} />)}
          </ScrollView>
          {visiveis.length === 0 ? <Cartao><Text style={type.caption}>Nenhum corte cadastrado ainda.</Text></Cartao> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
              {visiveis.map(s => (
                <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/agendar/[id]', params: { id: b.id, servico: s.id } })}
                  style={{ width: '47.5%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                    {s.fotos[0] ? <Image source={{ uri: s.fotos[0] }} style={{ width: '100%', height: '100%' }} />
                      : <Ionicons name="cut-outline" size={28} color={colors.textMuted} />}
                  </View>
                  <View style={{ padding: space(3), gap: 2 }}>
                    <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{s.nome}</Text>
                    <Text style={type.caption} numberOfLines={1}>com {nomeDe(s.barbeiroId)}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={type.caption}>{s.duracaoMin} min</Text>
                      <Text style={[type.caption, { color: colors.accent, fontWeight: '600' }]}>{formatarPreco(s.precoCentavos)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : aba === 'Barbeiros' ? (
        equipe.map(e => (
          <Pressable key={e.uid} onPress={() => { setBarbeiro(e.uid); setAba('Cortes'); }} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            {e.fotoUrl ? <Image source={{ uri: e.fotoUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
              : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised }} />}
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{e.apelido || e.nome}</Text>
              <Text style={type.caption}>
                {e.nota.total ? `★ ${e.nota.media.toFixed(1).replace('.', ',')} · ` : ''}{servicos.filter(s => s.barbeiroId === e.uid).length} cortes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {[...b.fotos, ...servicos.flatMap(s => s.fotos)].slice(0, 24).map(f => (
            <Image key={f} source={{ uri: f }} accessibilityLabel="Foto de corte da barbearia" style={{ width: '31.5%', aspectRatio: 4 / 5, borderRadius: radius.input }} />
          ))}
        </View>
      )}
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
