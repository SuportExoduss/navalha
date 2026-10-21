// Estrelas (mostrar e escolher) e o "Avaliar" do atendimento concluído, no histórico do cliente.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo } from '../ui';
import { avaliar } from '../../services/avaliacoes';
import { MAX_COMENTARIO, podeAvaliar } from '../../lib/avaliacoes';
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

/** Já avaliou: mostra as estrelas. Pode avaliar: botão que abre estrelas + comentário. Senão, nada. */
export function AvaliarAtendimento({ a }: { a: Agendamento }) {
  const [aberto, setAberto] = useState(false);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const dada = a.avaliacao?.estrelas ?? enviada;
  if (dada) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Text style={type.caption}>Sua avaliação</Text>
        <Estrelas valor={dada} />
      </View>
    );
  }
  if (!podeAvaliar(a, Date.now())) return null;
  if (!aberto) return <Botao titulo="Avaliar atendimento" variante="secundario" onPress={() => setAberto(true)}
    icone={<Ionicons name="star-outline" size={18} color={colors.text} />} />;

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await avaliar(a, estrelas, comentario);
      setEnviada(estrelas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <View style={{ gap: space(2) }}>
      {/* O rótulo fica na linha da pergunta: ao lado das 5 estrelas (44 px cada) ele quebrava no celular. */}
      <Text style={type.body}>
        Como foi{a.barbeiroNome ? ` com ${a.barbeiroNome}` : ''}?
        {estrelas ? <Text style={{ color: colors.accent }}>{`  ${ROTULO[estrelas]}`}</Text> : null}
      </Text>
      <Estrelas valor={estrelas} tamanho={28} onEscolher={setEstrelas} />
      <Campo rotulo="Comentário (opcional)" value={comentario} onChangeText={setComentario} maxLength={MAX_COMENTARIO} multiline
        placeholder="O que você achou do corte?" dica="Aparece na página da barbearia com o seu primeiro nome." />
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Agora não" variante="secundario" style={{ flex: 1 }} onPress={() => { setAberto(false); setEstrelas(0); setComentario(''); }} />
        <Botao titulo="Enviar" style={{ flex: 1 }} carregando={enviando} disabled={!estrelas} onPress={enviar} />
      </View>
    </View>
  );
}
