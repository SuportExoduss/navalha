// Configurações da barbearia (só o dono): identidade (foto, capa, nome), publicação, horário da casa e código do Google.
// O que o dono mexe pouco fica aqui; a aba Barbearia mostra o dia a dia (resumo, cardápio, equipe).
// As regras do Firestore já garantem: só o dono altera nome, fotos e expediente da casa.
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Carregando, Cartao, Interruptor, Linha, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { atualizarBarbearia, listarServicos } from '../services/barbearias';
import { escolherEEnviar } from '../services/fotos';
import { db } from '../services/firebase';
import { colors, radius, space, type, sobreFoto } from '../theme';
import type { Barbearia } from '../types/models';

export default function Configuracoes() {
  const { barbearia, carregando, ehDono } = useMinhaBarbearia();
  if (carregando) return <Carregando />;
  if (!barbearia || !ehDono) return <Redirect href="/casa" />;
  const b = barbearia;
  return (
    <Tela>
      <Voltar />
      <Titulo>Configurações</Titulo>
      <Identidade b={b} />
      <Publicacao b={b} />
      <Secao titulo="Funcionamento">
        <Linha icone="time-outline" titulo="Horário da casa" dica="Quando a barbearia abre. Nenhum barbeiro atende fora dele."
          onPress={() => router.push({ pathname: '/expediente', params: { alvo: 'casa' } })} />
      </Secao>
      <PlaceIdGoogle b={b} />
    </Tela>
  );
}

function Identidade({ b }: { b: Barbearia }) {
  const [nome, setNome] = useState(b.nome);
  const [enviando, setEnviando] = useState<'logo' | 'capa' | null>(null);
  const [msg, setMsg] = useState<{ texto: string; tom: 'erro' | 'ok' } | null>(null);

  async function trocar(qual: 'logo' | 'capa') {
    setMsg(null);
    setEnviando(qual);
    try {
      const url = await escolherEEnviar('barbearia', b.id, 'galeria', qual === 'logo' ? [1, 1] : [16, 9]);
      if (!url) return;
      await atualizarBarbearia(db, b.id, qual === 'logo' ? { logoUrl: url } : { capaUrl: url, fotos: [url, ...b.fotos].slice(0, 12) });
    } catch (e) { setMsg({ texto: e instanceof Error ? e.message : 'Falha ao enviar a foto.', tom: 'erro' }); }
    finally { setEnviando(null); }
  }

  async function salvarNome() {
    const n = nome.trim();
    if (n.length < 2) return setMsg({ texto: 'Digite o nome da barbearia.', tom: 'erro' });
    try { await atualizarBarbearia(db, b.id, { nome: n }); setMsg({ texto: 'Nome salvo.', tom: 'ok' }); }
    catch { setMsg({ texto: 'Não foi possível salvar.', tom: 'erro' }); }
  }

  return (
    <Secao titulo="Identidade">
      <Pressable onPress={() => trocar('capa')} accessibilityRole="button" accessibilityLabel="Trocar foto de capa"
        style={{ height: 150, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
        {b.capaUrl ? <Image source={{ uri: b.capaUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : null}
        <Selo texto={enviando === 'capa' ? 'Enviando…' : b.capaUrl ? 'Trocar capa' : 'Adicionar capa'} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
        <Pressable onPress={() => trocar('logo')} accessibilityRole="button" accessibilityLabel="Trocar foto de perfil da barbearia">
          {b.logoUrl
            ? <Image source={{ uri: b.logoUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} />
            : <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceRaised }} />}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={enviando === 'logo' ? 'hourglass-outline' : 'camera'} size={14} color={colors.accentText} />
          </View>
        </Pressable>
        <Text style={[type.caption, { flex: 1 }]}>Foto de perfil: aparece ao lado do nome. Use o logo ou a fachada.</Text>
      </View>
      <Campo rotulo="Nome da barbearia" value={nome} onChangeText={t => { setMsg(null); setNome(t); }} />
      {msg ? <Aviso texto={msg.texto} tom={msg.tom} /> : null}
      {nome.trim() !== b.nome ? <Botao titulo="Salvar nome" onPress={salvarNome} /> : null}
    </Secao>
  );
}

function Publicacao({ b }: { b: Barbearia }) {
  const [totalServicos, setTotalServicos] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { listarServicos(db, b.id).then(l => setTotalServicos(l.length)).catch(() => setTotalServicos(0)); }, [b.id]);

  const checklist = [
    { ok: true, texto: 'Localização marcada' },
    { ok: !!b.capaUrl, texto: 'Foto de capa' },
    { ok: (totalServicos ?? 0) > 0, texto: 'Pelo menos 1 serviço no cardápio' },
  ];

  async function alternar(v: boolean) {
    if (v && !checklist.every(c => c.ok)) return setErro('Complete a lista abaixo antes de aparecer na busca.');
    setErro(null);
    await atualizarBarbearia(db, b.id, { publicada: v });
  }

  return (
    <Cartao style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{b.publicada ? 'Aparecendo na busca' : 'Rascunho'}</Text>
          <Text style={type.caption}>{b.publicada ? 'Clientes por perto já encontram sua barbearia.' : 'Só você e sua equipe veem por enquanto.'}</Text>
        </View>
        <Interruptor value={b.publicada} onValueChange={alternar} rotulo="Publicar barbearia" />
      </View>
      {checklist.map(c => (
        <View key={c.texto} style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
          <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={c.ok ? colors.success : colors.textMuted} />
          <Text style={[type.body, !c.ok && { color: colors.textMuted }]}>{c.texto}</Text>
        </View>
      ))}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Cartao>
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
    <Secao titulo="Google">
      <Cartao style={{ gap: space(3) }}>
        <Campo rotulo="Código da barbearia no Google (opcional)" value={valor} onChangeText={t => { setMsg(null); setValor(t); }}
          placeholder="ChIJ…" autoCapitalize="none"
          dica="Em breve a nota do Google aparece no seu card. Ache o código pesquisando sua barbearia em developers.google.com/maps/documentation/places/web-service/place-id." />
        {msg ? <Aviso texto={msg} tom={msg === 'Salvo.' ? 'ok' : 'erro'} /> : null}
        <Botao titulo="Salvar código" variante="secundario" onPress={salvar} />
      </Cartao>
    </Secao>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center', backgroundColor: sobreFoto.veu, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.chip }}>
      <Ionicons name="camera-outline" size={16} color={sobreFoto.texto} />
      <Text style={[type.caption, { color: sobreFoto.texto }]}>{texto}</Text>
    </View>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
