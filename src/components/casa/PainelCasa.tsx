// Aba Barbearia, na ordem do dia a dia: quem é a casa → números de hoje (dono) → cardápio → equipe.
// Nome, fotos, publicação, horário da casa e Google ficam em Configurações (engrenagem, só o dono).
import { useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Cartao, Interruptor, Linha, Secao } from '../ui';
import { criarConvite, definirBarbeiroAtivo, linksDeRota } from '../../services/barbearias';
import { PainelDono } from './PainelDono';
import { db } from '../../services/firebase';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro } from '../../types/models';

export function PainelCasa({ b, equipe, ehDono, uid }: { b: Barbearia; equipe: Barbeiro[]; ehDono: boolean; uid: string }) {
  const [convite, setConvite] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function convidar() {
    setGerando(true);
    try {
      const c = await criarConvite(db, b.id, uid);
      setConvite(c);
      await Share.share({ message: `Entre na equipe da ${b.nome} no Navalha. Baixe o app, escolha "Trabalho numa barbearia" e use o código ${c} (vale 7 dias).` }).catch(() => undefined);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível gerar o convite.'); }
    finally { setGerando(false); }
  }

  return (
    <>
      <View style={{ height: 150, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceRaised }}>
        {b.capaUrl ? <Image source={{ uri: b.capaUrl }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Capa da ${b.nome}`} /> : null}
        {ehDono ? (
          <Pressable onPress={() => router.push('/configuracoes')} accessibilityRole="button" accessibilityLabel="Configurações da barbearia" hitSlop={8}
            style={{ position: 'absolute', top: space(3), right: space(3), width: 44, height: 44, borderRadius: 22, backgroundColor: sobreFoto.veu, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="settings-outline" size={22} color={sobreFoto.texto} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        {b.logoUrl
          ? <Image source={{ uri: b.logoUrl }} style={{ width: 56, height: 56, borderRadius: 28 }} />
          : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="storefront-outline" size={24} color={colors.textMuted} />
            </View>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.title} numberOfLines={2}>{b.nome}</Text>
          <Text style={type.caption} numberOfLines={1}>{b.endereco} · {b.cidade}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space(4) }}>
        <Pressable onPress={() => router.push({ pathname: '/barbearia/[id]', params: { id: b.id } })} hitSlop={8} accessibilityRole="link">
          <Text style={[type.caption, { color: colors.accent }]}>Ver como cliente</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(linksDeRota(b.geo.lat, b.geo.lng).googleMaps)} hitSlop={8} accessibilityRole="link">
          <Text style={[type.caption, { color: colors.accent }]}>Conferir no mapa</Text>
        </Pressable>
      </View>

      {/* Rascunho é o que mais trava o dono: avisa no topo e leva direto para publicar. */}
      {ehDono && !b.publicada ? (
        <Linha icone="eye-off-outline" titulo="Rascunho: ainda fora da busca" dica="Toque para completar e publicar" onPress={() => router.push('/configuracoes')} />
      ) : null}

      {erro ? <Aviso texto={erro} tom="erro" /> : null}

      {ehDono ? <PainelDono barbeariaId={b.id} /> : null}

      <Linha icone="cut-outline" titulo="Cardápio de cortes" dica="Seus cortes, preços e fotos" onPress={() => router.push('/cardapio')} />

      <Secao titulo={`Equipe (${equipe.filter(e => e.ativo).length})`} acao={ehDono ? (gerando ? 'Gerando…' : 'Convidar barbeiro') : undefined} onAcao={convidar}>
        {convite ? (
          <Cartao style={{ gap: space(2), borderColor: colors.accent }}>
            <Text style={type.caption}>Código de convite (vale 7 dias, uso único)</Text>
            <Text selectable style={{ color: colors.accent, fontSize: 28, fontWeight: '700', letterSpacing: 8 }}>{convite}</Text>
          </Cartao>
        ) : null}
        {equipe.map(m => (
          <View key={m.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), opacity: m.ativo ? 1 : 0.5 }}>
            {m.fotoUrl
              ? <Image source={{ uri: m.fotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised }} />}
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{m.apelido || m.nome}{m.uid === b.donoUid ? ' · dono' : ''}</Text>
              <Text style={type.caption}>{m.nota.total ? `★ ${m.nota.media.toFixed(1).replace('.', ',')}` : 'Sem avaliações ainda'}</Text>
            </View>
            {ehDono && m.uid !== b.donoUid ? (
              <Interruptor value={m.ativo} onValueChange={v => definirBarbeiroAtivo(db, b.id, m.uid, v)} rotulo={`Barbeiro ${m.nome} ativo`} />
            ) : null}
          </View>
        ))}
      </Secao>
    </>
  );
}
