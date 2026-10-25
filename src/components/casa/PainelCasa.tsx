// Aba Barbearia, na ordem do dia a dia: quem é a casa → números de hoje (dono) → cardápio → equipe.
// Nome, fotos, publicação, horário da casa e Google ficam em Configurações (engrenagem, só o dono).
import { useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Cartao, Interruptor, Linha, Secao } from '../ui';
import { criarConvite, definirBarbeiroAtivo, linksDeRota } from '../../services/barbearias';
import { LIMITE_TESTE, cabeMaisUm } from '../../lib/planos';
import { PainelDono } from './PainelDono';
import { db } from '../../services/firebase';
import { colors, minTouch, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro } from '../../types/models';
import { seloAssinatura, situacaoAssinatura, tituloDoPlano } from '../../lib/planos';
import { dataLocal, formatarData } from '../../lib/agenda';
import { AvisoAssinatura, BarbeariaBloqueada } from './AvisoAssinatura';

export function PainelCasa({ b, equipe, ehDono, uid }: { b: Barbearia; equipe: Barbeiro[]; ehDono: boolean; uid: string }) {
  const [convite, setConvite] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativos = b.barbeirosAtivos ?? equipe.filter(e => e.ativo).length;
  const limite = b.assinatura.limiteBarbeiros ?? LIMITE_TESTE; // casa antiga, antes da migração
  const cheia = !cabeMaisUm(ativos, limite);

  async function convidar() {
    if (cheia) { setErro(`Seu plano permite ${limite} ${limite === 1 ? 'barbeiro' : 'barbeiros'} ativos. Mude de plano para chamar mais gente.`); return; }
    setGerando(true);
    try {
      const c = await criarConvite(db, b.id, uid);
      setConvite(c);
      await Share.share({ message: `Entre na equipe da ${b.nome} no Navalha. Baixe o app, escolha "Trabalho numa barbearia" e use o código ${c} (vale 7 dias).` }).catch(() => undefined);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível gerar o convite.'); }
    finally { setGerando(false); }
  }

  const assinatura = situacaoAssinatura(b, Date.now());
  if (assinatura.tipo === 'bloqueada') return <BarbeariaBloqueada ehDono={ehDono} />;

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
        <Pressable onPress={() => Linking.openURL(linksDeRota(b.geo.lat, b.geo.lng, b.nome)[0].url)} hitSlop={8} accessibilityRole="link">
          <Text style={[type.caption, { color: colors.accent }]}>Conferir no mapa</Text>
        </Pressable>
      </View>

      {/* O que tira a casa da busca vem primeiro: plano vencido, depois rascunho. */}
      {ehDono ? <AvisoAssinatura s={assinatura} /> : null}
      {ehDono && b.emDia && !b.publicada ? (
        <Linha icone="eye-off-outline" titulo="Rascunho: ainda fora da busca" dica="Toque para completar e publicar" onPress={() => router.push('/configuracoes')} />
      ) : null}

      {erro ? <Aviso texto={erro} tom="erro" /> : null}

      {ehDono ? <PainelDono barbeariaId={b.id} /> : null}

      <Linha icone="cut-outline" titulo="Cardápio de cortes" dica="Seus cortes, preços e fotos" onPress={() => router.push('/cardapio')} />
      {ehDono ? <LinhaPlano b={b} /> : null}

      <Secao titulo={`Equipe (${ativos} de ${limite})`} acao={ehDono ? (gerando ? 'Gerando…' : 'Convidar barbeiro') : undefined} onAcao={convidar}>
        {convite ? (
          <Cartao style={{ gap: space(2), borderColor: colors.accent }}>
            <Text style={type.caption}>Código de convite (vale 7 dias, uso único)</Text>
            <Text selectable style={{ color: colors.accent, fontSize: 28, fontWeight: '700', letterSpacing: 8 }}>{convite}</Text>
          </Cartao>
        ) : null}
        {equipe.map(m => (
          <View key={m.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), opacity: m.ativo ? 1 : 0.5 }}>
            {/* Ficha do barbeiro: o dono abre a de todos; o barbeiro, só a própria. */}
            <Pressable disabled={!ehDono && m.uid !== uid} onPress={() => router.push({ pathname: '/equipe/[uid]', params: { uid: m.uid } })}
              accessibilityRole="button" accessibilityLabel={`Ficha de ${m.apelido || m.nome}`}
              style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: minTouch, opacity: pressed ? 0.7 : 1 })}>
              {m.fotoUrl
                ? <Image source={{ uri: m.fotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised }} />}
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{m.apelido || m.nome}{m.uid === b.donoUid ? ' · dono' : ''}</Text>
                <Text style={type.caption}>{ehDono || m.uid === uid ? 'Ver ficha e avaliações' : m.ativo ? 'Na agenda' : 'Fora da agenda'}</Text>
              </View>
            </Pressable>
            {ehDono && m.uid !== b.donoUid ? (
              <Interruptor value={m.ativo} rotulo={`Barbeiro ${m.nome} ativo`} onValueChange={v => {
                if (v && cheia) { setErro('A equipe está completa no seu plano. Desligue alguém ou mude de plano.'); return; }
                setErro(null);
                definirBarbeiroAtivo(db, b.id, m.uid, v).catch(() => setErro('Não foi possível salvar. Tente de novo.'));
              }} />
            ) : null}
          </View>
        ))}
      </Secao>
    </>
  );
}

/** Plano da casa com o selo ao lado: verde em dia, amarelo perto de vencer, vermelho vencido/bloqueado/sem plano. */
function LinhaPlano({ b }: { b: Barbearia }) {
  const s = situacaoAssinatura(b, Date.now());
  const selo = seloAssinatura(s);
  const cor = selo === 'ok' ? colors.success : selo === 'alerta' ? colors.alerta : colors.danger;
  const dica = s.tipo === 'vence_logo' ? `Vence em ${s.dias === 1 ? '1 dia' : `${s.dias} dias`} (${formatarData(dataLocal(s.ate), dataLocal(Date.now()))})`
    : s.tipo === 'regularizar' ? `Venceu: assine até ${formatarData(dataLocal(s.ate), dataLocal(Date.now()))}`
    : s.tipo === 'bloqueada' ? 'Assine um plano para liberar'
    : s.tipo === 'rascunho' ? 'Escolha um plano para aparecer na busca'
    : b.assinatura.venceEm ? `${b.assinatura.status === 'ativa' && b.assinatura.renovaSozinha !== false ? 'Renova' : 'Até'} ${formatarData(dataLocal(b.assinatura.venceEm), dataLocal(Date.now()))} · cupom e troca de plano`
    : 'Mensalidade, cupom e troca de plano';
  const rotulo = selo === 'ok' ? 'em dia' : selo === 'alerta' ? 'perto de vencer' : 'vencido';
  return (
    <Pressable onPress={() => router.push('/plano')} accessibilityRole="button" accessibilityLabel={`${tituloDoPlano(b)}, ${rotulo}. ${dica}`}>
      <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, borderColor: selo === 'ok' ? colors.border : cor }}>
        <Ionicons name="card-outline" size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={type.body}>{tituloDoPlano(b)}</Text>
          <Text style={type.caption}>{dica}</Text>
        </View>
        <Ionicons name={selo === 'ok' ? 'checkmark-circle' : selo === 'alerta' ? 'warning' : 'alert-circle'} size={24} color={cor} />
      </Cartao>
    </Pressable>
  );
}
