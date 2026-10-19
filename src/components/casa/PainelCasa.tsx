// Painel da barbearia: capa, status de publicação com checklist, equipe e convites.
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Cartao, Interruptor, Secao, Titulo } from '../ui';
import {
  atualizarBarbearia, criarConvite, definirBarbeiroAtivo, linksDeRota, listarServicos,
} from '../../services/barbearias';
import { escolherEEnviar } from '../../services/fotos';
import { PainelDono } from './PainelDono';
import { db } from '../../services/firebase';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro } from '../../types/models';

export function PainelCasa({ b, equipe, ehDono, uid }: { b: Barbearia; equipe: Barbeiro[]; ehDono: boolean; uid: string }) {
  const [convite, setConvite] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [enviandoCapa, setEnviandoCapa] = useState(false);
  const [totalServicos, setTotalServicos] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { listarServicos(db, b.id).then(l => setTotalServicos(l.length)).catch(() => setTotalServicos(0)); }, [b.id, b.resumo.precoMin]);

  const checklist = [
    { ok: true, texto: 'Localização marcada' },
    { ok: !!b.capaUrl, texto: 'Foto de capa' },
    { ok: (totalServicos ?? 0) > 0, texto: 'Pelo menos 1 serviço no cardápio' },
  ];
  const prontaParaPublicar = checklist.every(c => c.ok);

  async function trocarCapa() {
    setErro(null);
    setEnviandoCapa(true);
    try {
      const url = await escolherEEnviar('barbearia', b.id, 'galeria', [16, 9]);
      if (url) await atualizarBarbearia(db, b.id, { capaUrl: url, fotos: [url, ...b.fotos].slice(0, 12) });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.'); }
    finally { setEnviandoCapa(false); }
  }

  async function alternarPublicacao(v: boolean) {
    if (v && !prontaParaPublicar) { setErro('Complete a lista abaixo antes de aparecer na busca.'); return; }
    setErro(null);
    await atualizarBarbearia(db, b.id, { publicada: v });
  }

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
      <Pressable accessibilityRole="button" accessibilityLabel="Trocar foto de capa" onPress={ehDono ? trocarCapa : undefined}
        style={{ height: 170, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
        {b.capaUrl ? <Image source={{ uri: b.capaUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : null}
        {ehDono ? (
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', backgroundColor: sobreFoto.veu, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.chip }}>
            <Ionicons name="camera-outline" size={16} color={sobreFoto.texto} />
            <Text style={[type.caption, { color: sobreFoto.texto }]}>{enviandoCapa ? 'Enviando…' : b.capaUrl ? 'Trocar capa' : 'Adicionar foto de capa'}</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={{ gap: space(1) }}>
        <Titulo>{b.nome}</Titulo>
        <Text style={type.caption}>{b.endereco} · {b.cidade}</Text>
        <View style={{ flexDirection: 'row', gap: space(4), marginTop: space(1) }}>
          <Pressable onPress={() => Linking.openURL(linksDeRota(b.geo.lat, b.geo.lng).googleMaps)} hitSlop={8}>
            <Text style={[type.caption, { color: colors.accent }]}>Conferir no mapa</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/barbearia/[id]', params: { id: b.id } })} hitSlop={8}>
            <Text style={[type.caption, { color: colors.accent }]}>Ver como cliente</Text>
          </Pressable>
        </View>
      </View>

      {erro ? <Aviso texto={erro} tom="erro" /> : null}

      {ehDono ? (
        <Cartao style={{ gap: space(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{b.publicada ? 'Aparecendo na busca' : 'Rascunho'}</Text>
              <Text style={type.caption}>{b.publicada ? 'Clientes por perto já encontram sua barbearia.' : 'Só você e sua equipe veem por enquanto.'}</Text>
            </View>
            <Interruptor value={b.publicada} onValueChange={alternarPublicacao} rotulo="Publicar barbearia" />
          </View>
          {checklist.map(c => (
            <View key={c.texto} style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
              <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={c.ok ? colors.success : colors.textMuted} />
              <Text style={[type.body, !c.ok && { color: colors.textMuted }]}>{c.texto}</Text>
            </View>
          ))}
        </Cartao>
      ) : null}

      {ehDono ? <PainelDono barbeariaId={b.id} /> : null}
      {ehDono ? <PlaceIdGoogle b={b} /> : null}

      <Botao
        titulo="Meu cardápio de cortes"
        variante="secundario"
        onPress={() => router.push('/cardapio')}
        icone={<Ionicons name="cut-outline" size={18} color={colors.text} />}
      />

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

/** Place ID do Google: preenchido já no MVP, usado na Fase 3 para mostrar a nota do Google. */
function PlaceIdGoogle({ b }: { b: Barbearia }) {
  const [valor, setValor] = useState(b.googlePlaceId ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  async function salvar() {
    const id = valor.trim();
    if (id && !/^[A-Za-z0-9_-]{10,}$/.test(id)) return setMsg('Cole só o código, ex.: ChIJN1t_tDeuEmsRUsoyG83frY4.');
    await atualizarBarbearia(db, b.id, { googlePlaceId: id });
    setMsg('Salvo.');
  }
  return (
    <Cartao style={{ gap: space(3) }}>
      <Campo rotulo="Código da barbearia no Google (opcional)" value={valor} onChangeText={t => { setMsg(null); setValor(t); }}
        placeholder="ChIJ…" autoCapitalize="none"
        dica="Na Fase 3 a nota do Google aparece no seu card. Ache o código pesquisando sua barbearia em developers.google.com/maps/documentation/places/web-service/place-id." />
      {msg ? <Aviso texto={msg} tom={msg === 'Salvo.' ? 'ok' : 'erro'} /> : null}
      <Botao titulo="Salvar código" variante="secundario" onPress={salvar} />
    </Cartao>
  );
}
