// Resumo na aba Barbearia, em tempo real (reserva nova ou corte concluído mudam os números na hora).
// Dono: a casa toda, com filtro por barbeiro. Barbeiro: só os próprios agendamentos (as regras só deixam ler esses).
// Filtros: Calendário (um dia escolhido), Hoje, Semana (segunda a domingo) e Mês (dia 1 até hoje).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Cartao, Chip, Secao } from '../ui';
import { db } from '../../services/firebase';
import { ouvirAgendamentosDaCasa } from '../../services/agendamentos';
import { NOMES_DIAS, dataLocal, formatarData, formatarPreco } from '../../lib/agenda';
import { intervaloDoPainel, intervaloDoPeriodo, resumir, semanasDoMes, type Periodo } from '../../lib/painel';
import { colors, minTouch, radius, space, type } from '../../theme';
import { useVersao } from '../../hooks/useAtualizar';
import type { Agendamento, Barbeiro, ISODate } from '../../types/models';

const PERIODOS: { id: Exclude<Periodo, 'calendario'>; rotulo: string; texto: string }[] = [
  { id: 'dia', rotulo: 'Hoje', texto: 'Hoje' },
  { id: 'semana', rotulo: 'Semana', texto: 'Nesta semana (segunda a domingo)' },
  { id: 'mes', rotulo: 'Mês', texto: 'Neste mês, do dia 1 até hoje' },
];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** `barbeiroUid` null = dono (casa toda); com uid = barbeiro vendo só o próprio resumo. */
export function PainelDono({ barbeariaId, equipe, barbeiroUid }: { barbeariaId: string; equipe: Barbeiro[]; barbeiroUid: string | null }) {
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const hoje = dataLocal(Date.now());
  const [escolhido, setEscolhido] = useState<ISODate>(hoje);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [doBarbeiro, setDoBarbeiro] = useState<string | null>(null);
  const versao = useVersao();
  // Dia escolhido no calendário: escuta só ele; os outros filtros dividem uma escuta da semana + mês.
  const dia = periodo === 'calendario' ? escolhido : null;

  useEffect(() => {
    const { de, ate } = dia ? intervaloDoPeriodo('calendario', hoje, dia) : intervaloDoPainel(hoje);
    setErro(false);
    setLista(null);
    return ouvirAgendamentosDaCasa(db, barbeariaId, de, ate, setLista, () => setErro(true), barbeiroUid);
  }, [barbeariaId, barbeiroUid, hoje, dia, versao]);

  if (erro) return null;
  const ativos = equipe.filter(m => m.ativo);
  const filtro = barbeiroUid ? null : doBarbeiro;
  const r = lista ? resumir(filtro ? lista.filter(a => a.barbeiroId === filtro) : lista, periodo, hoje, escolhido) : null;
  const nomeFiltro = filtro ? (ativos.find(m => m.uid === filtro)?.apelido || ativos.find(m => m.uid === filtro)?.nome) : null;
  const texto = (periodo === 'calendario' ? `Em ${formatarData(escolhido, hoje)}` : PERIODOS.find(p => p.id === periodo)!.texto)
    + (nomeFiltro ? `, ${nomeFiltro}` : '');
  return (
    <Secao titulo={barbeiroUid ? 'Seu resumo' : 'Resumo da casa'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        <Chip rotulo={periodo === 'calendario' ? formatarData(escolhido, hoje) : 'Calendário'} ativo={periodo === 'calendario'}
          onPress={() => { setPeriodo('calendario'); setCalendarioAberto(a => periodo !== 'calendario' || !a); }} />
        {PERIODOS.map(p => <Chip key={p.id} rotulo={p.rotulo} ativo={periodo === p.id}
          onPress={() => { setPeriodo(p.id); setCalendarioAberto(false); }} />)}
      </View>
      {periodo === 'calendario' && calendarioAberto ? (
        <Calendario escolhido={escolhido} hoje={hoje} aoEscolher={d => { setEscolhido(d); setCalendarioAberto(false); }} />
      ) : null}
      {!barbeiroUid && ativos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Todos" ativo={!doBarbeiro} onPress={() => setDoBarbeiro(null)} />
          {ativos.map(m => <Chip key={m.uid} rotulo={m.apelido || m.nome} ativo={doBarbeiro === m.uid} onPress={() => setDoBarbeiro(m.uid)} />)}
        </ScrollView>
      ) : null}
      {!r ? <Text style={type.caption}>Calculando…</Text> : (
        <>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Numero rotulo="Agendamentos" valor={String(r.agendamentos)} />
            <Numero rotulo="Faturado" valor={formatarPreco(r.faturadoCentavos)} />
          </View>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Numero rotulo="A receber" valor={formatarPreco(r.aReceberCentavos)} />
            <Numero rotulo="Faltas" valor={`${r.taxaFaltaPercent}%`} alerta={r.taxaFaltaPercent >= 15} />
          </View>
          <Cartao style={{ gap: space(1) }}>
            <Text style={type.caption}>
              {texto}: {qtd(r.agendamentos, 'agendamento')} ({r.pelaApp} pelo app), {qtd(r.concluidos, 'concluído')},
              {' '}{qtd(r.faltas, 'falta')} e {qtd(r.cancelados, 'cancelado')}.
            </Text>
            {r.maisPedido ? <Text style={type.caption}>Mais pedido: <Text style={{ color: colors.text }}>{r.maisPedido.nome}</Text> ({r.maisPedido.vezes}×)</Text> : null}
          </Cartao>
        </>
      )}
    </Secao>
  );
}

/** Calendário pequeno de um mês, com setas para trocar de mês. */
function Calendario({ escolhido, hoje, aoEscolher }: { escolhido: ISODate; hoje: ISODate; aoEscolher: (d: ISODate) => void }) {
  const [mes, setMes] = useState(`${escolhido.slice(0, 8)}01`);
  const trocar = (n: number) => {
    const [y, m] = mes.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
    setMes(t);
  };
  const celula = { flex: 1, minHeight: minTouch - 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.chip } as const;
  return (
    <Cartao style={{ gap: space(1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => trocar(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mês anterior" style={celula}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={[type.body, { flex: 5, textAlign: 'center', fontWeight: '600' }]}>
          {MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}
        </Text>
        <Pressable onPress={() => trocar(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Próximo mês" style={celula}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {NOMES_DIAS.map(n => <Text key={n} style={[type.caption, { flex: 1, textAlign: 'center' }]}>{n[0]}</Text>)}
      </View>
      {semanasDoMes(mes).map((semana, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {semana.map((d, j) => d ? (
            <Pressable key={d} onPress={() => aoEscolher(d)} accessibilityRole="button" accessibilityLabel={formatarData(d, hoje)}
              accessibilityState={{ selected: d === escolhido }}
              style={[celula, d === escolhido && { backgroundColor: colors.accent }, d === hoje && d !== escolhido && { borderWidth: 1, borderColor: colors.accent }]}>
              <Text style={[type.caption, { color: d === escolhido ? colors.accentText : colors.text }]}>{Number(d.slice(8))}</Text>
            </Pressable>
          ) : <View key={j} style={celula} />)}
        </View>
      ))}
    </Cartao>
  );
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Cartao style={{ flex: 1, gap: space(1) }}>
      <Text style={type.caption}>{rotulo}</Text>
      <Text style={[type.heading, type.number, alerta && { color: colors.danger }]}>{valor}</Text>
    </Cartao>
  );
}

/** "1 falta", "2 faltas": o plural regular basta para as palavras do painel. */
const qtd = (n: number, palavra: string) => `${n} ${n === 1 ? palavra : palavra + 's'}`;
