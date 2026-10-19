// Painel simples do dono: hoje e últimos 7 dias, com uma única consulta.
// Fica na aba Barbearia e funciona na web (onde a assinatura será vendida na Fase 3).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Cartao, Secao } from '../ui';
import { db } from '../../services/firebase';
import { agendamentosDaSemana } from '../../services/agendamentos';
import { dataLocal, formatarPreco } from '../../lib/agenda';
import { calcularPainel, type Painel } from '../../lib/painel';
import { colors, space, type } from '../../theme';

export function PainelDono({ barbeariaId }: { barbeariaId: string }) {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const agora = Date.now();
    agendamentosDaSemana(db, barbeariaId, dataLocal(agora))
      .then(l => setP(calcularPainel(l, agora)))
      .catch(() => setErro(true));
  }, [barbeariaId]);

  if (erro) return null;
  return (
    <Secao titulo="Resumo da casa">
      {!p ? <Text style={type.caption}>Calculando…</Text> : (
        <>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Numero rotulo="Clientes hoje" valor={String(p.hoje.clientes)} />
            <Numero rotulo="Previsto hoje" valor={formatarPreco(p.hoje.previstoCentavos)} />
          </View>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Numero rotulo="Faturado em 7 dias" valor={formatarPreco(p.semana.faturadoCentavos)} />
            <Numero rotulo="Faltas em 7 dias" valor={`${p.semana.taxaFaltaPercent}%`} alerta={p.semana.taxaFaltaPercent >= 15} />
          </View>
          <Cartao style={{ gap: space(1) }}>
            <Text style={type.caption}>
              Últimos 7 dias: {qtd(p.semana.agendamentos, 'agendamento')} ({p.semana.pelaApp} pelo app), {qtd(p.semana.concluidos, 'concluído')},
              {' '}{qtd(p.semana.faltas, 'falta')} e {qtd(p.semana.cancelados, 'cancelado')}.
            </Text>
            {p.maisPedido ? <Text style={type.caption}>Mais pedido: <Text style={{ color: colors.text }}>{p.maisPedido.nome}</Text> ({p.maisPedido.vezes}×)</Text> : null}
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
