// Reserva do cliente: escolhe o dia, vê só os horários em que o corte inteiro cabe e confirma.
// A grade escuta a ocupação em tempo real; a trava contra horário duplo continua em reservar()
// (se dois confirmarem no mesmo instante, só um passa e o outro vê o aviso).
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Aviso, Botao, Carregando, Cartao, Secao, Tela, Titulo } from '../../components/ui';
import { SeletorDia } from '../../components/agenda/SeletorDia';
import { GradeHorarios } from '../../components/agenda/GradeHorarios';
import { useAuth } from '../../auth/AuthProvider';
import { db } from '../../services/firebase';
import { lerBarbearia, listarBarbeiros, listarServicos } from '../../services/barbearias';
import { HorarioOcupadoError, ouvirHorariosLivres, registrarEvento, reservar } from '../../services/agendamentos';
import { dataLocal, formatarHora, formatarPreco, proximosDias, rotuloDia } from '../../lib/agenda';
import { colors, radius, space, type } from '../../theme';
import type { Barbearia, Barbeiro, ISODate, Millis, Servico } from '../../types/models';

const DIAS_VISIVEIS = 14;

export default function Agendar() {
  const { id, servico: servicoId } = useLocalSearchParams<{ id: string; servico: string }>();
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
  const [feito, setFeito] = useState<Millis | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const abriuEm = useRef(Date.now());

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [casa, equipe, cardapio] = await Promise.all([lerBarbearia(db, id), listarBarbeiros(db, id), listarServicos(db, id)]);
      const s = cardapio.find(x => x.id === servicoId) ?? null;
      setB(casa);
      setServico(s);
      setBarbeiro(equipe.find(e => e.uid === s?.barbeiroId) ?? null);
      if (perfil) registrarEvento(db, { tipo: 'iniciou_agendamento', uid: perfil.uid, barbeariaId: id, em: Date.now() });
    })().catch(() => setB(null));
  }, [id, servicoId]);

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
  if (b === undefined || !perfil) return <Carregando />;
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
      await reservar(db, {
        barbeariaId: b.id, barbeariaNome: b.nome, barbeiroId: barbeiro!.uid, barbeiroNome: nomeBarbeiro,
        servico, cliente: { uid: perfil.uid, nome: perfil.apelido || perfil.nome },
        inicio: escolhido, passoMin: b.passoMin, origem: 'app',
      });
      registrarEvento(db, { tipo: 'agendou', uid: perfil.uid, barbeariaId: b.id, duracaoMs: Date.now() - abriuEm.current, em: Date.now() });
      // Vibração curta de sucesso: o momento de valor do app (na web não faz nada).
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setFeito(escolhido);
    } catch (e) {
      if (e instanceof HorarioOcupadoError) {
        setErro(e.message);
        setRecarregar(n => n + 1);
      } else if ((e as { code?: string })?.code === 'permission-denied') {
        // Regra de limite de uso: 20 s entre reservas da mesma conta.
        setErro('Você acabou de reservar. Espere alguns segundos e tente de novo.');
      } else {
        setErro('Não foi possível reservar. Verifique a conexão e tente de novo.');
      }
    } finally { setSalvando(false); }
  }

  if (feito) {
    return (
      <Tela>
        <View style={{ alignItems: 'center', gap: space(3), paddingTop: space(10) }}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Titulo>Horário reservado</Titulo>
          <Text style={[type.body, { textAlign: 'center' }]}>
            {servico.nome} com {nomeBarbeiro}{'\n'}{rotuloDia(dataLocal(feito), hoje)} às {formatarHora(feito)} · {b.nome}
          </Text>
          <Aviso texto={`Cancelamento grátis até ${b.politica.cancelamentoGratisHoras} h antes. Você recebe um lembrete antes do horário.`} />
        </View>
        <Botao titulo="Ver meus agendamentos" onPress={() => router.replace('/agendamentos')} />
        <Botao titulo="Voltar para a barbearia" variante="secundario" onPress={() => router.back()} />
      </Tela>
    );
  }

  // Confirmar fica fixo no rodapé: com o dia cheio de horários ele sumia abaixo da grade (quebrava os 3 toques).
  const rodape = (
    <>
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao
        titulo={escolhido ? `Confirmar · ${rotuloDia(dia, hoje)} às ${formatarHora(escolhido)}` : 'Escolha um horário'}
        onPress={confirmar} carregando={salvando} disabled={!escolhido}
      />
    </>
  );

  return (
    <Tela rodape={rodape}>
      <Voltar />
      <Cartao style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
        {servico.fotos[0]
          ? <Image source={{ uri: servico.fotos[0] }} style={{ width: 64, height: 80, borderRadius: radius.input }} />
          : <View style={{ width: 64, height: 80, borderRadius: radius.input, backgroundColor: colors.surfaceRaised }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.heading}>{servico.nome}</Text>
          <Text style={type.caption}>com {nomeBarbeiro} · {b.nome}</Text>
          <Text style={type.caption}>{servico.duracaoMin} min · <Text style={{ color: colors.accent, fontWeight: '600' }}>{formatarPreco(servico.precoCentavos)}</Text></Text>
        </View>
      </Cartao>

      <Secao titulo="Dia">
        <SeletorDia dias={dias} hoje={hoje} valor={dia} onChange={setDia} />
      </Secao>

      <Secao titulo="Horário">
        {horarios === null ? <Carregando />
          : horarios.length === 0 ? <Cartao><Text style={type.caption}>Sem horários livres neste dia. Tente outro dia.</Text></Cartao>
          : <GradeHorarios horarios={horarios} valor={escolhido} onChange={h => { setErro(null); setEscolhido(h); }} />}
      </Secao>

      <Aviso texto="Pagamento no balcão, direto com a barbearia." />
    </Tela>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
