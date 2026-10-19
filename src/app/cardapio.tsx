// Cardápio do barbeiro: cada corte com preço, tempo médio (gera os horários
// da agenda) e até 6 fotos (o cliente escolhe pela foto).
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Carregando, Cartao, Chip, Interruptor, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import {
  atualizarResumoCardapio, novoIdServico, ouvirServicosDoBarbeiro, precoParaCentavos, removerServico, salvarServico,
} from '../services/barbearias';
import { escolherEEnviar } from '../services/fotos';
import { db } from '../services/firebase';
import { formatarPreco } from '../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../theme';
import type { Servico } from '../types/models';

const CATEGORIAS: { id: Servico['categoria']; nome: string }[] = [
  { id: 'cabelo', nome: 'Cabelo' }, { id: 'barba', nome: 'Barba' }, { id: 'combo', nome: 'Combo' }, { id: 'outro', nome: 'Outro' },
];
const DURACOES = [15, 20, 30, 40, 45, 60, 90];
const MAX_FOTOS = 6;

export default function Cardapio() {
  const { barbearia, carregando, uid } = useMinhaBarbearia();
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [editando, setEditando] = useState<Servico | null>(null);

  useEffect(() => {
    if (!barbearia || !uid) return;
    return ouvirServicosDoBarbeiro(db, barbearia.id, uid, setServicos);
  }, [barbearia?.id, uid]);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia) {
    return <Tela><Titulo>Cardápio</Titulo><Aviso texto="Cadastre ou entre numa barbearia primeiro, na aba Barbearia." /></Tela>;
  }

  if (editando) {
    return <Editor servico={editando} aoSair={() => setEditando(null)} />;
  }

  function novo() {
    setEditando({
      id: novoIdServico(db, barbearia!.id), barbeariaId: barbearia!.id, barbeiroId: uid!,
      nome: '', categoria: 'cabelo', precoCentavos: 0, duracaoMin: 30, fotos: [], ativo: true,
    });
  }

  return (
    <Tela>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo destaque="cortes">{'Meu cardápio de\n'}</Titulo>
      <Text style={type.caption}>O tempo médio de cada corte define os horários que o cliente vê na sua agenda.</Text>
      <Botao titulo="Adicionar corte" onPress={novo} icone={<Ionicons name="add" size={20} color={colors.accentText} />} />

      {servicos === null ? <Carregando /> : servicos.length === 0 ? (
        <Cartao><Text style={type.caption}>Nenhum corte ainda. Comece pelo que você mais faz — com foto, ele vende sozinho.</Text></Cartao>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {servicos.map(s => (
            <Pressable key={s.id} onPress={() => setEditando(s)} accessibilityRole="button"
              style={{ width: '47.5%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: s.ativo ? 1 : 0.5 }}>
              <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                {s.fotos[0] ? <Image source={{ uri: s.fotos[0] }} style={{ width: '100%', height: '100%' }} />
                  : <Ionicons name="image-outline" size={28} color={colors.textMuted} />}
              </View>
              <View style={{ padding: space(3), gap: 2 }}>
                <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{s.nome}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={type.caption}>{s.duracaoMin} min</Text>
                  <Text style={[type.caption, { color: colors.accent, fontWeight: '600' }]}>{formatarPreco(s.precoCentavos)}</Text>
                </View>
                {!s.ativo ? <Text style={type.caption}>Pausado</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Tela>
  );
}

function Editor({ servico, aoSair }: { servico: Servico; aoSair: () => void }) {
  const [s, setS] = useState<Servico>(servico);
  const [preco, setPreco] = useState(servico.precoCentavos ? (servico.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  const [duracaoLivre, setDuracaoLivre] = useState(DURACOES.includes(servico.duracaoMin) ? '' : String(servico.duracaoMin));
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const existente = servico.nome !== '';

  async function addFoto(origem: 'galeria' | 'camera') {
    if (s.fotos.length >= MAX_FOTOS) return;
    setErro(null);
    setEnviando(true);
    try {
      const url = await escolherEEnviar('servico', s.id, origem);
      if (url) setS(x => ({ ...x, fotos: [...x.fotos, url].slice(0, MAX_FOTOS) }));
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.'); }
    finally { setEnviando(false); }
  }

  async function salvar() {
    const centavos = precoParaCentavos(preco);
    const duracao = duracaoLivre ? Number(duracaoLivre) : s.duracaoMin;
    if (!s.nome.trim()) return setErro('Dê um nome ao corte.');
    if (centavos === null || centavos === 0) return setErro('Informe um preço válido, ex.: 45 ou 45,90.');
    if (!Number.isInteger(duracao) || duracao < 5 || duracao > 300) return setErro('Tempo médio entre 5 e 300 minutos.');
    setSalvando(true);
    try {
      await salvarServico(db, { ...s, nome: s.nome.trim(), precoCentavos: centavos, duracaoMin: duracao });
      await atualizarResumoCardapio(db, s.barbeariaId);
      aoSair();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); setSalvando(false); }
  }

  async function excluir() {
    setSalvando(true);
    await removerServico(db, s.barbeariaId, s.id);
    await atualizarResumoCardapio(db, s.barbeariaId).catch(() => undefined);
    aoSair();
  }

  return (
    <Tela>
      <Pressable onPress={aoSair} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo>{existente ? 'Editar corte' : 'Novo corte'}</Titulo>

      <Secao titulo={`Fotos (${s.fotos.length}/${MAX_FOTOS})`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {s.fotos.map(f => (
            <View key={f} style={{ width: 96, aspectRatio: 4 / 5, borderRadius: radius.input, overflow: 'hidden' }}>
              <Image source={{ uri: f }} accessibilityLabel="Foto do corte" style={{ width: '100%', height: '100%' }} />
              <Pressable accessibilityLabel="Remover foto" hitSlop={8} onPress={() => setS(x => ({ ...x, fotos: x.fotos.filter(y => y !== f) }))}
                style={{ position: 'absolute', top: 4, right: 4, backgroundColor: sobreFoto.veu, borderRadius: 12, padding: 2 }}>
                <Ionicons name="close" size={16} color={sobreFoto.texto} />
              </Pressable>
            </View>
          ))}
          {s.fotos.length < MAX_FOTOS ? (
            <>
              <BotaoFoto icone="images-outline" rotulo="Galeria" onPress={() => addFoto('galeria')} />
              <BotaoFoto icone="camera-outline" rotulo="Câmera" onPress={() => addFoto('camera')} />
            </>
          ) : null}
        </ScrollView>
        {enviando ? <Aviso texto="Enviando foto…" /> : <Aviso texto="Fotos reais dos seus cortes, de frente, lado ou nuca. A primeira é a capa." />}
      </Secao>

      <Cartao style={{ gap: space(4) }}>
        <Campo rotulo="Nome do corte" value={s.nome} onChangeText={nome => setS({ ...s, nome })} placeholder="Ex.: Degradê + barba" />
        <View style={{ gap: space(2) }}>
          <Text style={type.caption}>Categoria</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {CATEGORIAS.map(c => <Chip key={c.id} rotulo={c.nome} ativo={s.categoria === c.id} onPress={() => setS({ ...s, categoria: c.id })} />)}
          </View>
        </View>
        <Campo rotulo="Preço (R$)" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholder="45,00" />
        <View style={{ gap: space(2) }}>
          <Text style={type.caption}>Tempo médio</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {DURACOES.map(d => (
              <Chip key={d} rotulo={`${d} min`} ativo={!duracaoLivre && s.duracaoMin === d} onPress={() => { setDuracaoLivre(''); setS({ ...s, duracaoMin: d }); }} />
            ))}
          </View>
          <Campo rotulo="Outro tempo (min)" value={duracaoLivre} onChangeText={t => setDuracaoLivre(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Disponível para agendar</Text>
            <Text style={type.caption}>Pause sem apagar, ex.: química só às sextas.</Text>
          </View>
          <Interruptor value={s.ativo} onValueChange={ativo => setS({ ...s, ativo })} rotulo="Disponível para agendar" />
        </View>
      </Cartao>

      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao titulo="Salvar corte" onPress={salvar} carregando={salvando} disabled={enviando} />
      {existente ? <Botao titulo="Excluir corte" variante="secundario" onPress={excluir} disabled={salvando} /> : null}
    </Tela>
  );
}

function BotaoFoto({ icone, rotulo, onPress }: { icone: keyof typeof Ionicons.glyphMap; rotulo: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ width: 96, aspectRatio: 4 / 5, borderRadius: radius.input, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: space(1) }}>
      <Ionicons name={icone} size={22} color={colors.accent} />
      <Text style={type.caption}>{rotulo}</Text>
    </Pressable>
  );
}
