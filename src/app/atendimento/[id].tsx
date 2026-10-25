// Corte atual (seguir cortes): cliente, corte, tempo correndo e "Finalizar". Finalizar é o mesmo "Concluído" da
// agenda (com ou sem foto). Enquanto este estiver aberto, não dá para iniciar outro.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Cartao, Carregando, Tela, Titulo } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../services/firebase';
import { concluir, ouvirAgendamento, registrarEvento } from '../../services/agendamentos';
import { avisarAgendamento } from '../../services/avisos';
import { escolherEEnviar } from '../../services/fotos';
import { emAtendimento, minutosDecorridos } from '../../lib/atendimento';
import { formatarHora, formatarPreco } from '../../lib/agenda';
import { colors, space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

export default function CorteAtual() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useAuth();
  const [a, setA] = useState<Agendamento | null | undefined>(undefined);
  const [agora, setAgora] = useState(Date.now());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => (id ? ouvirAgendamento(db, id, setA) : undefined), [id]);
  // O relógio do corte anda de 15 em 15 s (o barbeiro olha de relance; não precisa de segundos).
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 15_000); return () => clearInterval(t); }, []);

  if (a === undefined) return <Carregando />;
  if (!a) return <Tela><Voltar /><Titulo>Corte não encontrado</Titulo></Tela>;

  async function finalizar(origem: 'camera' | 'galeria' | null) {
    setErro(null);
    setSalvando(true);
    try {
      const foto = origem ? await escolherEEnviar('corte', a!.id, origem) : null;
      if (origem && !foto) return; // cancelou a câmera: continua no corte
      await concluir(db, a!.id, foto ? [...a!.fotos, foto] : a!.fotos);
      avisarAgendamento(a!.id); // com "pedir avaliação" ligado na casa, o cliente recebe o pedido
      if (perfil) registrarEvento(db, { tipo: 'concluiu', uid: perfil.uid, barbeariaId: a!.barbeariaId, em: Date.now() });
    } catch (e) {
      setErro(e instanceof Error && e.message.startsWith('Permita') ? e.message : 'Não foi possível finalizar. Tente de novo.');
    } finally { setSalvando(false); }
  }

  const aberto = emAtendimento(a);
  const minutos = a.iniciadoEm ? minutosDecorridos(a.iniciadoEm, agora) : 0;
  const passou = minutos > a.duracaoMin;

  return (
    <Tela>
      <Voltar />
      <Titulo>{aberto ? 'Corte em andamento' : a.status === 'concluido' ? 'Corte finalizado' : 'Corte'}</Titulo>
      <Cartao style={{ gap: space(2) }}>
        <Text style={type.heading}>{a.clienteNome}</Text>
        <Text style={type.body}>{a.servicoNome}{a.barbeiroNome ? ` com ${a.barbeiroNome}` : ''}</Text>
        <Text style={[type.caption, type.number]}>Marcado {formatarHora(a.inicio)}–{formatarHora(a.fim)} · {a.duracaoMin} min · {formatarPreco(a.precoCentavos)}</Text>
      </Cartao>

      {aberto ? (
        <>
          {/* O tempo é o centro da tela: o barbeiro olha de relance entre um passe e outro. */}
          <View accessibilityRole="timer" accessibilityLabel={`${minutos} de ${a.duracaoMin} minutos`}
            style={{ alignItems: 'center', gap: space(1), paddingVertical: space(4) }}>
            <Text style={[type.title, type.number, { fontSize: 56, color: passou ? colors.danger : colors.text }]}>{minutos} min</Text>
            <Text style={type.caption}>{passou ? `Passou ${minutos - a.duracaoMin} min do tempo médio` : `de ${a.duracaoMin} min do tempo médio`}</Text>
          </View>
          <Aviso texto="Fotografe ao finalizar: a foto vai para o histórico do cliente." />
          <Botao titulo="Finalizar e fotografar" carregando={salvando} onPress={() => finalizar('camera')}
            icone={<Ionicons name="camera" size={18} color={colors.accentText} />} />
          <Botao titulo="Finalizar sem foto" variante="secundario" disabled={salvando} onPress={() => finalizar(null)} />
          <Pressable onPress={() => finalizar('galeria')} hitSlop={8} disabled={salvando} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <Text style={[type.caption, { color: colors.accent }]}>Escolher foto da galeria</Text>
          </Pressable>
        </>
      ) : a.status === 'concluido' ? (
        <>
          <Botao titulo="Voltar à agenda" variante="secundario" onPress={voltar} />
        </>
      ) : (
        <Aviso texto="Este horário não está em atendimento." />
      )}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Tela>
  );
}

// Volta na pilha (a agenda já está embaixo); "replace" empilharia uma segunda agenda. Link direto: vai para a agenda.
const voltar = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));

function Voltar() {
  return (
    <Pressable onPress={voltar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
