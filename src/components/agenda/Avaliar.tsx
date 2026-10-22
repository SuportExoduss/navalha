// Estrelas (mostrar e escolher) e as avaliações de um atendimento:
// - cliente: avalia o barbeiro e, logo depois, a barbearia (se quiser); avaliada a casa, oferece publicar no Google;
// - casa: o barbeiro (ou o dono) avalia o cliente.
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Aviso, Botao, Campo } from '../ui';
import { avaliar } from '../../services/avaliacoes';
import { lerBarbearia } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { MAX_COMENTARIO, jaAvaliado, linkAvaliacaoGoogle, podeAvaliarAlvo, type AlvoAvaliacao } from '../../lib/avaliacoes';
import { colors, space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

const ROTULO = ['', 'Ruim', 'Fraco', 'Bom', 'Muito bom', 'Excelente'];

export function Estrelas({ valor, tamanho = 16, onEscolher }: { valor: number; tamanho?: number; onEscolher?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: onEscolher ? space(1) : 2 }} accessibilityLabel={onEscolher ? undefined : `${valor} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map(n => {
        const icone = <Ionicons name={n <= valor ? 'star' : 'star-outline'} size={tamanho} color={n <= valor ? colors.accent : colors.textMuted} />;
        return onEscolher ? (
          <Pressable key={n} onPress={() => onEscolher(n)} hitSlop={4} accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}, ${ROTULO[n]}`} accessibilityState={{ selected: n === valor }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {icone}
          </Pressable>
        ) : <View key={n}>{icone}</View>;
      })}
    </View>
  );
}

type Textos = { botao: string; pergunta: string; dica: string; jaDada: string };

/** Uma avaliação: já dada (mostra as estrelas), possível (botão que abre o formulário) ou nada. */
function AvaliarAlvo({ a, alvo, textos, abrirJa, onEnviada }: {
  a: Agendamento; alvo: AlvoAvaliacao; textos: Textos; abrirJa?: boolean; onEnviada?: (estrelas: number, comentario: string) => void;
}) {
  const [aberto, setAberto] = useState(!!abrirJa);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // O pedido pode chegar depois da montagem (o card já mudou de status antes de o app marcar "acabou de finalizar").
  useEffect(() => { if (abrirJa) setAberto(true); }, [abrirJa]);

  const dada = a.avaliacoes?.[alvo]?.estrelas ?? (alvo === 'barbeiro' ? a.avaliacao?.estrelas : undefined) ?? enviada;
  if (dada) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Text style={type.caption}>{textos.jaDada}</Text>
        <Estrelas valor={dada} />
      </View>
    );
  }
  if (!podeAvaliarAlvo(a, alvo, Date.now())) return null;
  if (!aberto) return <Botao titulo={textos.botao} variante="secundario" onPress={() => setAberto(true)}
    icone={<Ionicons name="star-outline" size={18} color={colors.text} />} />;

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await avaliar(a, alvo, estrelas, comentario);
      setEnviada(estrelas);
      onEnviada?.(estrelas, comentario.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <View style={{ gap: space(2) }}>
      {/* O rótulo fica na linha da pergunta: ao lado das 5 estrelas (44 px cada) ele quebrava no celular. */}
      <Text style={type.body}>
        {textos.pergunta}
        {estrelas ? <Text style={{ color: colors.accent }}>{`  ${ROTULO[estrelas]}`}</Text> : null}
      </Text>
      <Estrelas valor={estrelas} tamanho={28} onEscolher={setEstrelas} />
      <Campo rotulo="Comentário (opcional)" value={comentario} onChangeText={setComentario} maxLength={MAX_COMENTARIO} multiline
        placeholder="Conte como foi" dica={textos.dica} />
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Agora não" variante="secundario" style={{ flex: 1 }} onPress={() => { setAberto(false); setEstrelas(0); setComentario(''); }} />
        <Botao titulo="Enviar" style={{ flex: 1 }} carregando={enviando} disabled={!estrelas} onPress={enviar} />
      </View>
    </View>
  );
}

/**
 * Lado do cliente: primeiro o barbeiro; com ele resolvido (ou sem como avaliar), a barbearia; avaliada a casa e com
 * o código do Google cadastrado, "Publicar também no Google". `pedido`: a casa pediu, o formulário já vem aberto.
 */
export function AvaliacoesDoCliente({ a, pedido }: { a: Agendamento; pedido?: boolean }) {
  const [barbeiroFeito, setBarbeiroFeito] = useState(false);
  const [paraGoogle, setParaGoogle] = useState<{ comentario: string; placeId?: string } | null>(null);
  const nome = a.barbeiroNome ?? 'o barbeiro';
  const casa = a.barbeariaNome ?? 'a barbearia';
  const barbeiroResolvido = barbeiroFeito || jaAvaliado(a, 'barbeiro') || !podeAvaliarAlvo(a, 'barbeiro', Date.now());

  async function depoisDaCasa(_estrelas: number, comentario: string) {
    const b = await lerBarbearia(db, a.barbeariaId).catch(() => null);
    setParaGoogle({ comentario, placeId: b?.googlePlaceId });
  }

  return (
    <View style={{ gap: space(3) }}>
      <AvaliarAlvo a={a} alvo="barbeiro" abrirJa={pedido} onEnviada={() => setBarbeiroFeito(true)} textos={{
        botao: `Avaliar ${nome}`, pergunta: `Como foi com ${nome}?`, jaDada: `Você avaliou ${nome}`,
        dica: 'Só a barbearia vê esta avaliação.',
      }} />
      {barbeiroResolvido ? (
        <AvaliarAlvo a={a} alvo="barbearia" onEnviada={depoisDaCasa} textos={{
          botao: `Avaliar ${casa}`, pergunta: `E ${casa}, como foi?`, jaDada: `Você avaliou ${casa}`,
          dica: 'Aparece na página da barbearia com o seu primeiro nome.',
        }} />
      ) : null}
      {paraGoogle?.placeId ? <PublicarNoGoogle placeId={paraGoogle.placeId} comentario={paraGoogle.comentario} /> : null}
    </View>
  );
}

/**
 * O Google não deixa o app publicar nem preencher a avaliação: copiamos o comentário e abrimos a janela de
 * avaliação da casa; a pessoa toca nas estrelas, cola e publica. Aparece para qualquer nota (regra do Google).
 */
function PublicarNoGoogle({ placeId, comentario }: { placeId: string; comentario: string }) {
  const [copiado, setCopiado] = useState(false);
  async function abrir() {
    if (comentario) setCopiado(await Clipboard.setStringAsync(comentario).catch(() => false));
    Linking.openURL(linkAvaliacaoGoogle(placeId));
  }
  return (
    <View style={{ gap: space(2) }}>
      <Botao titulo="Publicar também no Google" variante="secundario" onPress={abrir}
        icone={<Ionicons name="logo-google" size={18} color={colors.text} />} />
      <Text style={type.caption}>
        {copiado ? 'Copiamos seu comentário. No Google, toque nas estrelas, cole o texto e publique.'
          : 'Abre a página de avaliação da barbearia no Google: toque nas estrelas e publique.'}
      </Text>
    </View>
  );
}

/** Lado da casa: o barbeiro (ou o dono) avalia o cliente, depois do corte, da falta ou do cancelamento dele. */
export function AvaliarCliente({ a, abrirJa }: { a: Agendamento; abrirJa?: boolean }) {
  const nome = a.clienteNome.split(' ')[0];
  return <AvaliarAlvo a={a} alvo="cliente" abrirJa={abrirJa} textos={{
    botao: `Avaliar ${nome}`, pergunta: `Como foi atender ${nome}?`, jaDada: `Você avaliou ${nome}`,
    dica: `${nome} vê esta avaliação no próprio perfil; outras barbearias veem só a média.`,
  }} />;
}
