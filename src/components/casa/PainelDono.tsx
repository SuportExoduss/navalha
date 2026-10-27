// Resumo da casa para o dono: Hoje, Semana (segunda a domingo) e Mês (dia 1 até hoje), com uma escuta só,
// em tempo real (reserva nova ou corte concluído mudam os números na hora). Fica na aba Barbearia.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Cartao, Chip, Secao } from '../ui';
import { db } from '../../services/firebase';
import { ouvirAgendamentosDaCasa } from '../../services/agendamentos';
import { dataLocal, formatarPreco } from '../../lib/agenda';
import { intervaloDoPainel, resumir, type Periodo } from '../../lib/painel';
import { colors, space, type } from '../../theme';
import { useVersao } from '../../hooks/useAtualizar';
import type { Agendamento } from '../../types/models';

const PERIODOS: { id: Periodo; rotulo: string; texto: string }[] = [
  { id: 'dia', rotulo: 'Hoje', texto: 'Hoje' },
  { id: 'semana', rotulo: 'Semana', texto: 'Nesta semana (segunda a domingo)' },
  { id: 'mes', rotulo: 'Mês', texto: 'Neste mês, do dia 1 até hoje' },
];

export function PainelDono({ barbeariaId }: { barbeariaId: string }) {
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const versao = useVersao();
  const hoje = dataLocal(Date.now());

  useEffect(() => {
    const { de, ate } = intervaloDoPainel(hoje);
    setErro(false);
    return ouvirAgendamentosDaCasa(db, barbeariaId, de, ate, setLista, () => setErro(true));
  }, [barbeariaId, hoje, versao]);

  if (erro) return null;
  const r = lista ? resumir(lista, periodo, hoje) : null;
  const texto = PERIODOS.find(p => p.id === periodo)!.texto;
  return (
    <Secao titulo="Resumo da casa">
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {PERIODOS.map(p => <Chip key={p.id} rotulo={p.rotulo} ativo={periodo === p.id} onPress={() => setPeriodo(p.id)} />)}
      </View>
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
