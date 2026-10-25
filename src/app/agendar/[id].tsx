// Etapa 3 de 3: dia e horário. Tocar no horário abre o popup de confirmação; confirmou, a reserva é feita e o app
// volta até a página da casa (etapa 1), que mostra o aviso. Só se chega aqui pelas etapas 1 (casa) e 2 (/cortes).
// A grade escuta a ocupação em tempo real; a trava contra horário duplo continua em reservar()
// (se dois confirmarem no mesmo instante, só um passa e o outro vê o aviso).
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Aviso, Botao, Carregando, Cartao, FalhaAoCarregar, Secao, Tela, Titulo } from '../../components/ui';
import { SeletorDia } from '../../components/agenda/SeletorDia';
import { Etapa } from '../../components/agenda/Etapa';
import { avisarReserva } from '../../components/agenda/avisoReserva';
import { avisarAgendamento } from '../../services/avisos';
import { GradeHorarios } from '../../components/agenda/GradeHorarios';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../services/firebase';
import { dadosDaCasa } from '../../services/barbearias';
import { esquecer } from '../../services/cache';
import { HorarioOcupadoError, ouvirHorariosLivres, registrarEvento, reservar } from '../../services/agendamentos';
import { dataLocal, formatarHora, formatarPreco, proximosDias, rotuloDia } from '../../lib/agenda';
import { colors, radius, space, type, sobreFoto } from '../../theme';
import type { Barbearia, Barbeiro, ISODate, Millis, Servico } from '../../types/models';

const DIAS_VISIVEIS = 14;

export default function Agendar() {
  const { id, barbeiro: barbeiroId, servico: servicoId } = useLocalSearchParams<{ id: string; barbeiro?: string; servico: string }>();
  const { carregando: carregandoAuth, user, perfil } = useAuth();
  const [b, setB] = useState<Barbearia | null | undefined>(undefined);
  const [barbeiro, setBarbeiro] = useState<Barbeiro | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [hoje] = useState(() => dataLocal(Date.now()));
  const [dia, setDia] = useState<ISODate>(hoje);
  const [horarios, setHorarios] = useState<Millis[] | null>(null);
  const [escolhido, setEscolhido] = useState<Millis | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const abriuEm = useRef(Date.now());

  useEffect(() => {
    if (!id) return;
    setFalhou(false);
    (async () => {
      // Mesmos dados da página da casa, já guardados: abrir o agendar não custa leitura nova.
      const { barbearia: casa, equipe, servicos: cardapio } = await dadosDaCasa(db, id, { forcar: tentativa > 0 });
      const s = cardapio.find(x => x.id === servicoId) ?? null;
      setB(casa);
      setServico(s);
      setBarbeiro(equipe.find(e => e.uid === s?.barbeiroId) ?? null);
      if (perfil && !tentativa) registrarEvento(db, { tipo: 'iniciou_agendamento', uid: perfil.uid, barbeariaId: id, em: Date.now() });
    })().catch(() => { setFalhou(true); setB(null); });
  }, [id, servicoId, tentativa]);

  useEffect(() => {
    if (!b || !barbeiro || !servico) return;
    setHorarios(null);
    setEscolhido(null);
    // Em tempo real: se outra pessoa reservar enquanto esta tela está aberta, o horário some na hora.
    return ouvirHorariosLivres(db, { barbearia: b, barbeiro, duracaoMin: servico.duracaoMin, data: dia },
      setHorarios,
      () => { setHorarios([]); setErro('Não foi possível carregar os horários. Verifique a conexão.'); });
  }, [b?.id, barbeiro?.uid, servico?.id, dia, recarregar]);

  // O horário escolhido foi pego por outra pessoa antes do confirmar: desmarca e avisa.
  useEffect(() => {
    if (escolhido && horarios && !horarios.includes(escolhido)) {
      setErro(`O horário das ${formatarHora(escolhido)} acabou de ser reservado por outra pessoa. Escolha outro.`);
      setEscolhido(null);
    }
  }, [horarios]);

  if (!carregandoAuth && !user) return <Redirect href="/entrar" />;
  // Pulou etapa: sem barbeiro volta para a casa (etapa 1); corte de outro barbeiro volta para os cortes (etapa 2).
  if (id && !barbeiroId) return <Redirect href={{ pathname: '/barbearia/[id]', params: { id } }} />;
  if (id && barbeiroId && servico && servico.barbeiroId !== barbeiroId) {
    return <Redirect href={{ pathname: '/cortes/[id]', params: { id, barbeiro: barbeiroId } }} />;
  }
  if (b === undefined || !perfil) return <Carregando />;
  if (falhou) return <Tela><Voltar /><FalhaAoCarregar onTentar={() => { setB(undefined); setTentativa(n => n + 1); }} /></Tela>;
  if (!b || !servico || !barbeiro) {
    return (
      <Tela>
        <Voltar />
        <Titulo>Corte indisponível</Titulo>
        <Aviso texto="Esse corte saiu do cardápio ou o barbeiro está fora da equipe. Escolha outro na página da barbearia." />
      </Tela>
    );
  }

  const nomeBarbeiro = barbeiro.apelido || barbeiro.nome.split(' ')[0];
  const dias = proximosDias(Date.now(), Math.min(b.janelaDias, DIAS_VISIVEIS));

  async function confirmar() {
    if (!escolhido || !b || !servico || !perfil) return;
    setErro(null);
    setSalvando(true);
    try {
      const agendamentoId = await reservar(db, {
        barbeariaId: b.id, barbeariaNome: b.nome, barbeiroId: barbeiro!.uid, barbeiroNome: nomeBarbeiro,
        servico, cliente: { uid: perfil.uid, nome: perfil.apelido || perfil.nome, ...(perfil.telefone ? { telefone: perfil.telefone } : {}) },
        inicio: escolhido, passoMin: b.passoMin, origem: 'app',
      });
      registrarEvento(db, { tipo: 'agendou', uid: perfil.uid, barbeariaId: b.id, duracaoMs: Date.now() - abriuEm.current, em: Date.now() });
      avisarAgendamento(agendamentoId); // barbeiro e dono recebem o aviso na hora
      // Vibração curta de sucesso: o momento de valor do app (na web não faz nada).
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      avisarReserva(`${servico.nome} com ${nomeBarbeiro}, ${rotuloDia(dataLocal(escolhido), hoje).toLowerCase()} às ${formatarHora(escolhido)}. `
        + `Cancelamento grátis até ${b.politica.cancelamentoGratisHoras} h antes; você recebe um lembrete.`);
      setEscolhido(null);
      // Volta até a casa (fecha cortes e horário): pronto para outro agendamento, começando pelo barbeiro.
      router.dismissTo({ pathname: '/barbearia/[id]', params: { id: b.id } });
    } catch (e) {
      if (e instanceof HorarioOcupadoError) {
        setErro(e.message);
        setEscolhido(null);
        setRecarregar(n => n + 1);
      } else if ((e as { code?: string })?.code === 'permission-denied') {
        // Recusado pelas regras: limite de 20 s entre reservas OU o cardápio mudou (preço/duração) depois
        // da leitura guardada. Relê a casa do servidor e pede para tentar de novo.
        esquecer(`casa:${b.id}`);
        setTentativa(n => n + 1);
        setErro('Não deu para reservar agora. Espere alguns segundos e tente de novo.');
      } else {
        setErro('Não foi possível reservar. Verifique a conexão e tente de novo.');
      }
    } finally { setSalvando(false); }
  }

  return (
    <Tela>
      <Voltar />
      <Etapa numero={1} titulo={`Barbeiro: ${nomeBarbeiro}`} feito />
      {/* Duração e preço na própria etapa: o cartão de resumo repetia barbeiro e corte e empurrava os horários para baixo. */}
      <Etapa numero={2} titulo={`Corte: ${servico.nome}`} dica={`${servico.duracaoMin} min · ${formatarPreco(servico.precoCentavos)} · ${b.nome}`} feito />
      <Etapa numero={3} titulo="Escolha o dia e o horário" dica="Toque no horário para confirmar." />

      <Secao titulo="Dia">
        <SeletorDia dias={dias} hoje={hoje} valor={dia} onChange={setDia} />
      </Secao>

      <Secao titulo="Horário">
        {horarios === null ? <Carregando />
          : horarios.length === 0 ? <Cartao><Text style={type.caption}>Sem horários livres neste dia. Tente outro dia.</Text></Cartao>
          : <GradeHorarios horarios={horarios} valor={escolhido} onChange={h => { setErro(null); setEscolhido(h); }} />}
      </Secao>

      {erro && !escolhido ? <Aviso texto={erro} tom="erro" /> : null}
      <Aviso texto="Pagamento no balcão, direto com a barbearia." />

      {/* Popup de confirmação: decisão que precisa interromper (reserva de verdade). */}
      <Modal visible={!!escolhido} transparent animationType="fade" onRequestClose={() => { if (!salvando) setEscolhido(null); }}>
        <View style={{ flex: 1, backgroundColor: sobreFoto.veu, justifyContent: 'center', padding: space(5) }}>
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space(5), gap: space(4),
            borderWidth: 1, borderColor: colors.border, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <Titulo>Confirmar horário?</Titulo>
            {escolhido ? (
              <View style={{ gap: space(2) }}>
                <Linha rotulo="Barbeiro" valor={nomeBarbeiro} />
                <Linha rotulo="Corte" valor={`${servico.nome} · ${servico.duracaoMin} min`} />
                <Linha rotulo="Quando" valor={`${rotuloDia(dia, hoje)} às ${formatarHora(escolhido)}`} />
                <Linha rotulo="Valor" valor={formatarPreco(servico.precoCentavos)} destaque />
              </View>
            ) : null}
            <Text style={type.caption}>Pagamento no balcão. Cancelamento grátis até {b.politica.cancelamentoGratisHoras} h antes.</Text>
            {erro ? <Aviso texto={erro} tom="erro" /> : null}
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} disabled={salvando} onPress={() => { setErro(null); setEscolhido(null); }} />
              <Botao titulo="Confirmar" style={{ flex: 1 }} carregando={salvando} onPress={confirmar} />
            </View>
          </View>
        </View>
      </Modal>
    </Tela>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(3) }}>
      <Text style={type.caption}>{rotulo}</Text>
      <Text style={[type.body, { flexShrink: 1, textAlign: 'right' }, destaque && { color: colors.accent, fontWeight: '700' }]}>{valor}</Text>
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
