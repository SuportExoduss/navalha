// Configurações da barbearia (só o dono): identidade (foto, capa, nome), publicação, horário da casa, link para o WhatsApp e excluir a casa.
// O que o dono mexe pouco fica aqui; a aba Barbearia mostra o dia a dia (resumo, cardápio, equipe).
// As regras do Firestore já garantem: só o dono altera nome, fotos e expediente da casa.
import { useEffect, useState } from 'react';
import { Image, Pressable, Share, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Campo, Carregando, Cartao, Interruptor, Linha, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { atualizarBarbearia, excluirBarbearia, listarServicos } from '../services/barbearias';
import { escolherEEnviar } from '../services/fotos';
import { auth, db } from '../services/firebase';
import { colors, radius, space, type, sobreFoto } from '../theme';
import { SITE } from '../lib/legal';
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
      <WhatsApp b={b} />
      <PedirAvaliacao b={b} />
      <ExcluirBarbearia b={b} />
    </Tela>
  );
}

/** Ligado: quando o barbeiro finaliza o corte, o cliente recebe "Como foi o corte?". Desligado, nada muda para ele. */
function PedirAvaliacao({ b }: { b: Barbearia }) {
  const [erro, setErro] = useState<string | null>(null);
  async function alternar(v: boolean) {
    setErro(null);
    await atualizarBarbearia(db, b.id, { pedirAvaliacao: v }).catch(() => setErro('Não foi possível salvar. Tente de novo.'));
  }
  return (
    <Secao titulo="Avaliações">
      <Cartao style={{ gap: space(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.body}>Pedir avaliação ao cliente</Text>
            <Text style={type.caption}>Quando o barbeiro finaliza o corte, o cliente recebe "Como foi o corte?" para avaliar a barbearia (só quem ainda não avaliou).</Text>
          </View>
          <Interruptor value={!!b.pedirAvaliacao} onValueChange={alternar} rotulo="Pedir avaliação ao cliente" />
        </View>
        {erro ? <Aviso texto={erro} tom="erro" /> : null}
      </Cartao>
    </Secao>
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

/** Etapa A do WhatsApp: o dono cola o link na saudação do WhatsApp Business e o cliente marca sozinho. */
function WhatsApp({ b }: { b: Barbearia }) {
  const [msg, setMsg] = useState<string | null>(null);
  const link = `${SITE}/barbearia/${b.id}`;
  const texto = `Olá! Para marcar seu horário na ${b.nome}, escolha barbeiro, corte e horário por aqui: ${link}`;
  async function compartilhar() {
    setMsg(null);
    // Na web sem navigator.share o Share falha: o texto fica selecionável para copiar à mão.
    await Share.share({ message: texto }).catch(() => setMsg('Selecione o texto acima e copie.'));
  }
  return (
    <Secao titulo="WhatsApp">
      <Cartao style={{ gap: space(3) }}>
        <Text style={type.caption}>Cole na mensagem de saudação ou de ausência do WhatsApp Business e nas instruções da IA da Meta. O cliente abre o link e marca direto com o barbeiro.</Text>
        <Text selectable style={[type.body, { backgroundColor: colors.surfaceRaised, borderRadius: radius.card, padding: space(3) }]}>{texto}</Text>
        {msg ? <Aviso texto={msg} tom="erro" /> : null}
        <Botao titulo="Compartilhar texto" variante="secundario" onPress={compartilhar} />
      </Cartao>
    </Secao>
  );
}

/** Último item, de propósito: apaga a casa. Pede o nome digitado para não acontecer por engano. */
function ExcluirBarbearia({ b }: { b: Barbearia }) {
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confere = confirmacao.trim().toLowerCase() === b.nome.trim().toLowerCase();

  async function excluir() {
    const user = auth.currentUser;
    if (!user) return;
    setErro(null);
    setExcluindo(true);
    try {
      await excluirBarbearia(db, user, b.id);
      router.replace('/casa');
    } catch {
      setErro('Não foi possível excluir agora. Verifique a conexão e tente de novo.');
      setExcluindo(false);
    }
  }

  if (!aberto) {
    return (
      <Pressable onPress={() => setAberto(true)} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: space(3) }}>
        <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>Excluir barbearia</Text>
      </Pressable>
    );
  }
  return (
    <Cartao style={{ gap: space(3), borderColor: colors.danger }}>
      <Text style={type.heading}>Excluir barbearia</Text>
      <Text style={type.caption}>
        Os horários marcados daqui para frente são cancelados (o cliente vê "Barbearia encerrada"), e o cardápio, as folgas
        e a equipe são apagados. Os cortes já feitos continuam no histórico dos clientes. Isso não pode ser desfeito.
      </Text>
      <Campo rotulo={`Para confirmar, digite: ${b.nome}`} value={confirmacao} onChangeText={setConfirmacao} autoCapitalize="none" />
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => { setAberto(false); setConfirmacao(''); }} />
        <Botao titulo="Excluir" style={{ flex: 1, backgroundColor: colors.danger }} disabled={!confere} carregando={excluindo} onPress={excluir} />
      </View>
    </Cartao>
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
