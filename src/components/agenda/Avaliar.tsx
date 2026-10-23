// Estrelas (mostrar e escolher) e a avaliação da barbearia no histórico do cliente: uma por casa. Já avaliou: mostra
// a nota e "Editar" (salvar nova avaliação ou cancelar a edição). A casa pediu: o formulário já vem aberto.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo } from '../ui';
import { useAuth } from '../../auth/AuthProvider';
import { avaliarBarbearia } from '../../services/avaliacoes';
import { MAX_COMENTARIO, podeAvaliarCasa } from '../../lib/avaliacoes';
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

export function AvaliarBarbearia({ a, pedido }: { a: Agendamento; pedido?: boolean }) {
  const { perfil } = useAuth();
  // A avaliação que a pessoa já deu a esta casa (o Worker grava no perfil dela junto com a nota).
  const dada = perfil?.avaliouBarbearias?.[a.barbeariaId];
  const [aberto, setAberto] = useState(!!pedido && !dada);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const casa = a.barbeariaNome ?? 'a barbearia';
  useEffect(() => { if (pedido && !dada) setAberto(true); }, [pedido, !!dada]);

  if (!podeAvaliarCasa(a)) return null;

  function abrir() {
    setErro(null);
    // Editar começa da avaliação atual; avaliar pela primeira vez, do zero.
    setEstrelas(dada?.estrelas ?? 0);
    setComentario(dada?.comentario ?? '');
    setAberto(true);
  }

  if (!aberto) {
    if (dada) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' }}>
          <Text style={type.caption}>Sua avaliação de {casa}</Text>
          <Estrelas valor={dada.estrelas} />
          <Pressable onPress={abrir} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Editar sua avaliação de ${casa}`}>
            <Text style={[type.caption, { color: colors.accent }]}>Editar</Text>
          </Pressable>
        </View>
      );
    }
    return <Botao titulo={`Avaliar ${casa}`} variante="secundario" onPress={abrir}
      icone={<Ionicons name="star-outline" size={18} color={colors.text} />} />;
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await avaliarBarbearia(a, estrelas, comentario);
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.');
    } finally { setEnviando(false); }
  }

  return (
    <View style={{ gap: space(2) }}>
      {/* O rótulo fica na linha da pergunta: ao lado das 5 estrelas (44 px cada) ele quebrava no celular. */}
      <Text style={type.body}>
        {dada ? `Editar sua avaliação de ${casa}` : `Como foi na ${casa}?`}
        {estrelas ? <Text style={{ color: colors.accent }}>{`  ${ROTULO[estrelas]}`}</Text> : null}
      </Text>
      <Estrelas valor={estrelas} tamanho={28} onEscolher={setEstrelas} />
      <Campo rotulo="Comentário (opcional)" value={comentario} onChangeText={setComentario} maxLength={MAX_COMENTARIO} multiline
        placeholder="Conte como foi" dica="Aparece na página da barbearia com o seu primeiro nome." />
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo={dada ? 'Cancelar edição' : 'Agora não'} variante="secundario" style={{ flex: 1 }} onPress={() => setAberto(false)} />
        <Botao titulo={dada ? 'Salvar nova avaliação' : 'Enviar'} style={{ flex: 1 }} carregando={enviando} disabled={!estrelas} onPress={enviar} />
      </View>
    </View>
  );
}
