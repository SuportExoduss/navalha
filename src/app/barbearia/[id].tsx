// Página pública da barbearia: o que o cliente vê antes de agendar.
// Agendar é sempre em 3 telas, nesta ordem: 1) aqui, o barbeiro; 2) /cortes, os cortes dele; 3) /agendar, o horário,
// com popup de confirmação. Confirmou: volta para cá (etapa 1) com o aviso da reserva.
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Carregando, Cartao, FalhaAoCarregar, Tela, Titulo } from '../../components/ui';
import { Etapa } from '../../components/agenda/Etapa';
import { pegarAvisoReserva } from '../../components/agenda/avisoReserva';
import { dadosDaCasa, linksDeRota } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { registrarEvento } from '../../services/agendamentos';
import { useAuth } from '../../auth/AuthProvider';
import { formatarPreco } from '../../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro, Servico } from '../../types/models';

export default function PaginaBarbearia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useAuth();
  const [b, setB] = useState<Barbearia | null | undefined>(undefined);
  const [equipe, setEquipe] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [reservado, setReservado] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!id) return;
    if (perfil && !tentativa) registrarEvento(db, { tipo: 'viu_barbearia', uid: perfil.uid, barbeariaId: id, em: Date.now() });
    setFalhou(false);
    // Uma leitura guardada por 5 min, reaproveitada pelo agendar (ir e voltar não relê).
    dadosDaCasa(db, id, { forcar: tentativa > 0 })
      .then(d => { setB(d.barbearia); setEquipe(d.equipe); setServicos(d.servicos); })
      .catch(() => { setFalhou(true); setB(null); });
  }, [id, tentativa]);

  // Voltou da confirmação (dismissTo): mostra o aviso da reserva uma vez.
  useFocusEffect(useCallback(() => { const t = pegarAvisoReserva(); if (t) setReservado(t); }, []));
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

      {reservado ? (
        <Cartao style={{ gap: space(2), borderColor: colors.success }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text accessibilityRole="alert" style={[type.body, { flex: 1, fontWeight: '600' }]}>Horário reservado</Text>
          </View>
          <Text style={type.caption}>{reservado}</Text>
          <Pressable onPress={() => router.push('/agendamentos')} hitSlop={8} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
            <Text style={[type.caption, { color: colors.accent }]}>Ver meus agendamentos</Text>
          </Pressable>
        </Cartao>
      ) : null}

      <Etapa numero={1} titulo="Escolha o barbeiro" dica="Depois você escolhe o corte e o horário." />
      {equipe.length === 0 ? <Cartao><Text style={type.caption}>Esta barbearia ainda não tem barbeiros na agenda.</Text></Cartao> : (
        <View style={{ gap: space(2) }}>
          {equipe.map(e => {
            const qtd = servicos.filter(s => s.barbeiroId === e.uid).length;
            return (
              <Pressable key={e.uid} accessibilityRole="button" accessibilityLabel={`Agendar com ${e.apelido || e.nome}`}
                onPress={() => { setReservado(null); router.push({ pathname: '/cortes/[id]', params: { id: b.id, barbeiro: e.uid } }); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), minHeight: 72,
                  borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : colors.surface })}>
                {e.fotoUrl ? <Image source={{ uri: e.fotoUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-outline" size={22} color={colors.textMuted} />
                    </View>}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{e.apelido || e.nome}</Text>
                  <Text style={type.caption}>
                    {e.nota.total ? `★ ${e.nota.media.toFixed(1).replace('.', ',')} · ` : ''}{qtd} {qtd === 1 ? 'corte' : 'cortes'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}

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
