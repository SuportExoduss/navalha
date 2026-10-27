// Horário fixo do clube (cliente): barbeiro, corte do plano, dia da semana, hora e frequência. O Worker reserva as
// datas do ciclo pago com a trava contra horário duplo e diz o que não coube (folga, ocupado, limite do plano).
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Chip, FalhaAoCarregar, Secao, Tela, Titulo } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../services/firebase';
import { dadosDaCasa } from '../services/barbearias';
import { meuClubeNaCasa, salvarHorarioFixo } from '../services/clube';
import { ancoraDoDia } from '../lib/clube';
import { dataLocal, expedienteEfetivo, formatarData, formatarHora, gerarHorarios, hhmmParaMin, minParaHHMM, NOMES_DIAS } from '../lib/agenda';
import { colors, space, type } from '../theme';
import type { FrequenciaClube } from '../types/models';

const FREQUENCIAS: { id: FrequenciaClube; rotulo: string }[] = [
  { id: 'semanal', rotulo: 'Toda semana' }, { id: 'quinzenal', rotulo: 'A cada 2 semanas' }, { id: 'mensal', rotulo: 'A cada 4 semanas' },
];

export default function HorarioFixoTela() {
  const { casa: bid } = useLocalSearchParams<{ casa: string }>();
  const { perfil } = useAuth();
  const [dados, setDados] = useState<{ clube: Awaited<ReturnType<typeof meuClubeNaCasa>>; casa: Awaited<ReturnType<typeof dadosDaCasa>> } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [diaSemana, setDiaSemana] = useState<number | null>(null);
  const [minutos, setMinutos] = useState<number | null>(null);
  const [frequencia, setFrequencia] = useState<FrequenciaClube>('semanal');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ reservados: string[]; naoCouberam: string[] } | null>(null);

  useEffect(() => {
    if (!bid || !perfil) return;
    setFalhou(false);
    Promise.all([meuClubeNaCasa(db, bid, perfil.uid), dadosDaCasa(db, bid)]).then(([clube, casa]) => {
      setDados({ clube, casa });
      const h = clube?.membro.horarioFixo;
      if (h) { setBarbeiroId(h.barbeiroId); setServicoId(h.servicoId); setDiaSemana(h.diaSemana); setMinutos(h.minutos); setFrequencia(h.frequencia); }
    }).catch(() => setFalhou(true));
  }, [bid, perfil?.uid, tentativa]);

  const voltar = (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
  if (falhou) return <Tela>{voltar}<FalhaAoCarregar onTentar={() => setTentativa(t => t + 1)} /></Tela>;
  if (!dados || !perfil) return <Carregando />;
  const { clube, casa: { barbearia: b, equipe, servicos } } = dados;
  if (!b || !clube || clube.membro.status !== 'ativo' || !clube.plano) {
    return <Tela>{voltar}<Titulo>Horário fixo</Titulo><Aviso texto="O horário fixo é para quem tem o clube em dia nesta barbearia." /></Tela>;
  }

  // Só o que o plano cobre: cortes do plano e os barbeiros que fazem algum deles.
  const doPlano = servicos.filter(s => s.ativo !== false && clube.plano!.servicoIds.includes(s.id));
  const barbeiros = equipe.filter(e => e.ativo !== false && doPlano.some(s => s.barbeiroId === e.uid));
  const barbeiro = barbeiros.find(e => e.uid === barbeiroId);
  const servico = doPlano.find(s => s.id === servicoId && s.barbeiroId === barbeiroId);
  const expediente = barbeiro ? expedienteEfetivo(b.expediente, barbeiro.expediente) : {};
  const hoje = dataLocal(Date.now());
  // Horas possíveis no dia da semana: a grade da casa num dia desses, sem olhar ocupação (o Worker confere cada data).
  const horas = servico && diaSemana !== null
    ? gerarHorarios({ data: ancoraDoDia(hoje, diaSemana), expediente, duracaoMin: servico.duracaoMin, passoMin: b.passoMin, ocupados: [], agora: 0, antecedenciaMin: 0 })
      .map(ms => hhmmParaMin(formatarHora(ms)))
    : [];
  const pronto = barbeiro && servico && diaSemana !== null && minutos !== null && horas.includes(minutos);

  async function salvar(tirar = false) {
    if (!clube || (!tirar && !pronto)) return;
    setErro(null); setSalvando(true);
    try {
      setFeito(await salvarHorarioFixo(db, clube.membro, tirar ? null : {
        barbeiroId: barbeiro!.uid, servicoId: servico!.id, diaSemana: diaSemana!, minutos: minutos!, frequencia, ancora: ancoraDoDia(hoje, diaSemana!),
      }));
      if (tirar) router.back();
    } catch (e) {
      setErro((e as { code?: string })?.code === 'permission-denied'
        ? 'Não deu para salvar. Confira se o corte e o barbeiro ainda estão no plano.'
        : 'Horário salvo, mas não deu para reservar agora. As datas entram em até 1 hora.');
    } finally { setSalvando(false); }
  }

  if (feito) {
    return (
      <Tela>
        {voltar}
        <Titulo>Horário fixo salvo</Titulo>
        {feito.reservados.length ? <Aviso tom="ok" texto={`Reservado: ${feito.reservados.map(d => formatarData(d, hoje)).join(', ')}.`} /> : null}
        {feito.naoCouberam.length
          ? <Aviso texto={`Não coube em ${feito.naoCouberam.map(d => formatarData(d, hoje)).join(', ')} (folga, horário ocupado ou limite do plano). Marque outro dia pela página da barbearia.`} />
          : null}
        <Text style={type.caption}>As próximas datas são reservadas quando a barbearia registrar o pagamento do mês seguinte.</Text>
        <Botao titulo="Pronto" onPress={() => router.back()} />
      </Tela>
    );
  }

  return (
    <Tela>
      {voltar}
      <Titulo>Horário fixo</Titulo>
      <Text style={type.caption}>Reservamos para você as datas do mês pago, sempre no mesmo dia e hora. Cancelar uma data não tira o horário fixo.</Text>
      <Secao titulo="Barbeiro">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {barbeiros.map(e => <Chip key={e.uid} rotulo={e.apelido || e.nome.split(' ')[0]} ativo={e.uid === barbeiroId} onPress={() => { setBarbeiroId(e.uid); setServicoId(null); setMinutos(null); }} />)}
        </View>
      </Secao>
      {barbeiro ? (
        <Secao titulo="Corte">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {doPlano.filter(s => s.barbeiroId === barbeiro.uid).map(s => <Chip key={s.id} rotulo={`${s.nome} · ${s.duracaoMin} min`} ativo={s.id === servicoId} onPress={() => { setServicoId(s.id); setMinutos(null); }} />)}
          </View>
        </Secao>
      ) : null}
      {servico ? (
        <Secao titulo="Dia da semana">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {NOMES_DIAS.map((n, d) => expediente[d] ? <Chip key={n} rotulo={n} ativo={d === diaSemana} onPress={() => { setDiaSemana(d); setMinutos(null); }} /> : null)}
          </View>
        </Secao>
      ) : null}
      {servico && diaSemana !== null ? (
        <Secao titulo="Hora">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {horas.map(m => <Chip key={m} rotulo={minParaHHMM(m)} ativo={m === minutos} onPress={() => setMinutos(m)} />)}
          </View>
        </Secao>
      ) : null}
      <Secao titulo="Frequência">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {FREQUENCIAS.map(f => <Chip key={f.id} rotulo={f.rotulo} ativo={f.id === frequencia} onPress={() => setFrequencia(f.id)} />)}
        </View>
      </Secao>
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao titulo="Salvar horário fixo" disabled={!pronto} carregando={salvando} onPress={() => salvar()} />
      {clube.membro.horarioFixo ? <Botao titulo="Tirar o horário fixo" variante="secundario" disabled={salvando} onPress={() => salvar(true)} /> : null}
    </Tela>
  );
}
