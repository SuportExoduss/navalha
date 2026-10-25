// Agendamentos do cliente: próximos (com cancelamento) e histórico.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Carregando, Cartao, Secao, Tela, Titulo } from '../../components/ui';
import { MotivoCancelamento, textoCancelamento } from '../../components/agenda/MotivoCancelamento';
import { EtiquetaStatus, ATIVOS } from '../../components/agenda/StatusAgendamento';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../services/firebase';
import { cancelar, ouvirMeusAgendamentos, registrarEvento } from '../../services/agendamentos';
import { lerBarbearia } from '../../services/barbearias';
import { cancelamentoGratis, dataLocal, formatarHora, formatarPreco, rotuloDia } from '../../lib/agenda';
import { avisarAgendamento } from '../../services/avisos';
import { PainelNotificacoes, VAZIO_CLIENTE } from '../../components/agenda/PainelNotificacoes';
import { AvaliarBarbearia } from '../../components/agenda/Avaliar';
import { podeAvaliarCasa } from '../../lib/avaliacoes';
import { colors, space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

export default function Agendamentos() {
  const { perfil } = useAuth();
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!perfil) return;
    return ouvirMeusAgendamentos(db, perfil.uid, setLista, () => { setLista([]); setErro('Não foi possível carregar seus agendamentos.'); });
  }, [perfil?.uid]);

  if (!perfil || lista === null) return <Carregando />;
  const agora = Date.now();
  const proximos = lista.filter(a => ATIVOS.includes(a.status) && a.fim > agora).sort((a, b) => a.inicio - b.inicio);
  // A casa pediu avaliação (barbeiro finalizou com "pedir avaliação" ligado): vem em destaque, já aberta.
  // Pede uma vez por casa: quem já avaliou aquela barbearia não vê o pedido de novo (só "Editar" no histórico).
  // Uma avaliação por casa: o "Avaliar"/"Editar" (e o pedido) aparece só no corte concluído mais recente de cada barbearia.
  const ultimoPorCasa = new Map<string, Agendamento>();
  for (const a of lista) {
    const atual = ultimoPorCasa.get(a.barbeariaId);
    if (podeAvaliarCasa(a) && (!atual || a.inicio > atual.inicio)) ultimoPorCasa.set(a.barbeariaId, a);
  }
  const pedidos = lista.filter(a => a.pedidoAvaliacao && ultimoPorCasa.get(a.barbeariaId)?.id === a.id && !perfil.avaliouBarbearias?.[a.barbeariaId]);
  const historico = lista.filter(a => !proximos.includes(a) && !pedidos.includes(a));

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Titulo>Agendamentos</Titulo>
        <PainelNotificacoes uid={perfil.uid} vazio={VAZIO_CLIENTE} />
      </View>
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Secao titulo="Próximos">
        {proximos.length === 0 ? (
          <Cartao style={{ gap: space(3) }}>
            <Text style={type.caption}>Nenhum horário marcado.</Text>
            <Botao titulo="Encontrar barbearia" variante="secundario" onPress={() => router.push('/inicio')} />
          </Cartao>
          // Já na cadeira (começou e não terminou) segue em "Próximos", mas sem cancelar: a regra barra (SEC-004).
        ) : proximos.map(a => <ItemAgendamento key={a.id} a={a} uid={perfil.uid} podeCancelar={a.inicio > agora} />)}
      </Secao>
      {pedidos.length ? (
        <Secao titulo="Como foi o corte?">
          {pedidos.map(a => <ItemAgendamento key={a.id} a={a} uid={perfil.uid} pedido />)}
        </Secao>
      ) : null}
      {historico.length ? (
        <Secao titulo="Histórico">
          {historico.map(a => <ItemAgendamento key={a.id} a={a} uid={perfil.uid} avaliar={ultimoPorCasa.get(a.barbeariaId)?.id === a.id} />)}
        </Secao>
      ) : null}
    </Tela>
  );
}

function ItemAgendamento({ a, uid, podeCancelar, pedido, avaliar }: { a: Agendamento; uid: string; podeCancelar?: boolean; pedido?: boolean; avaliar?: boolean }) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const hoje = dataLocal(Date.now());
  const cancelamento = textoCancelamento(a, 'cliente');

  async function pedirCancelamento() {
    setErro(null);
    const casa = await lerBarbearia(db, a.barbeariaId).catch(() => null);
    const horas = casa?.politica.cancelamentoGratisHoras ?? 0;
    setConfirmando(cancelamentoGratis(a.inicio, Date.now(), horas)
      ? 'Cancelar este horário? Ele volta a ficar livre para outros clientes.'
      : `Falta menos de ${horas} h. A barbearia pede aviso antes disso; se puder, avise também pelo WhatsApp.`);
  }

  async function confirmarCancelamento() {
    setCancelando(true);
    try {
      await cancelar(db, a, { por: 'cliente', motivo });
      registrarEvento(db, { tipo: 'cancelou', uid, barbeariaId: a.barbeariaId, em: Date.now() });
      avisarAgendamento(a.id); // barbeiro e dono ficam sabendo do cancelamento na hora
    } catch { setErro('Não foi possível cancelar. Tente de novo.'); setCancelando(false); }
  }

  return (
    <Cartao style={{ gap: space(2) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space(2) }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, type.number]}>{rotuloDia(a.data, hoje)} · {formatarHora(a.inicio)}</Text>
          <Text style={type.body}>{a.servicoNome}{a.barbeiroNome ? ` com ${a.barbeiroNome}` : ''}</Text>
          <Text style={type.caption}>{a.barbeariaNome ? `${a.barbeariaNome} · ` : ''}{a.duracaoMin} min · {formatarPreco(a.precoCentavos)}</Text>
        </View>
        <EtiquetaStatus status={a.status} />
      </View>
      {cancelamento ? <Aviso texto={cancelamento} /> : null}
      {pedido || avaliar ? <AvaliarBarbearia a={a} pedido={pedido} /> : null}
      {/* Agendar de novo começa na casa, pela etapa 1 (barbeiro): agendar é sempre barbeiro → corte → horário. */}
      <Pressable onPress={() => router.push({ pathname: '/barbearia/[id]', params: { id: a.barbeariaId } })} hitSlop={8}>
        <Text style={[type.caption, { color: colors.accent }]}>{podeCancelar ? 'Ver barbearia' : 'Agendar de novo'}</Text>
      </Pressable>
      {podeCancelar && !confirmando ? <Botao titulo="Cancelar horário" variante="secundario" onPress={pedirCancelamento} /> : null}
      {confirmando ? (
        <View style={{ gap: space(2) }}>
          <Aviso texto={confirmando} />
          <MotivoCancelamento por="cliente" onChange={setMotivo} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Manter" variante="secundario" style={{ flex: 1 }} onPress={() => { setConfirmando(null); setMotivo(''); }} />
            <Botao titulo="Cancelar" style={{ flex: 1 }} carregando={cancelando} disabled={!motivo} onPress={confirmarCancelamento} />
          </View>
        </View>
      ) : null}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Cartao>
  );
}
