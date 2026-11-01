// Relatório de um mês (aberto em Resumos anteriores): números que abrem as listas, cada barbeiro, serviços e os
// atendimentos dia a dia. Calculado dos agendamentos do mês. Dono: a casa toda, com filtro; barbeiro: só o dele.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Carregando, Cartao, Chip, Tela, Titulo } from '../components/ui';
import { Exportar, ItemAgendamento, Numero, Voltar } from '../components/resumo';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { useVersao } from '../hooks/useAtualizar';
import { db } from '../services/firebase';
import { agendamentosDaCasa } from '../services/agendamentos';
import { dataLocal, formatarData, formatarPreco } from '../lib/agenda';
import { intervaloDoMes } from '../lib/exportar';
import { nomeDoMes } from '../lib/notificacoes';
import { porServico, resumirLista, type Detalhe } from '../lib/painel';
import { colors, space, type } from '../theme';
import type { Agendamento } from '../types/models';

export default function ResumoMesTela() {
  const { barbearia, carregando, ehDono, uid } = useMinhaBarbearia();
  const p = useLocalSearchParams<{ mes: string; barbeiro?: string }>();
  const mes = /^\d{4}-\d{2}$/.test(p.mes ?? '') ? p.mes : dataLocal(Date.now()).slice(0, 7);
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState(p.barbeiro || 'casa');
  const [exportando, setExportando] = useState(false);
  const versao = useVersao();
  const barbeiroUid = ehDono ? null : uid ?? null;

  useEffect(() => {
    if (!barbearia || !uid) return;
    const { de, ate } = intervaloDoMes(mes);
    setErro(false);
    agendamentosDaCasa(db, barbearia.id, de, ate, barbeiroUid).then(setLista, () => setErro(true));
  }, [barbearia?.id, uid, barbeiroUid, mes, versao]);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia) return <Tela><Voltar para="/resumos" /><Aviso texto="Entre numa barbearia primeiro, na aba Barbearia." /></Tela>;

  const hoje = dataLocal(Date.now());
  const alvo = barbeiroUid ?? filtro;
  // Chips: quem atendeu no mês (inclui quem já saiu da equipe).
  const barbeiros = [...new Map((lista ?? []).map(a => [a.barbeiroId, a.barbeiroNome || 'Barbeiro'])).entries()];
  const doAlvo = (lista ?? []).filter(a => alvo === 'casa' || a.barbeiroId === alvo);
  const r = resumirLista(doAlvo);
  const nomeAlvo = alvo === 'casa' ? null : barbeiros.find(([id]) => id === alvo)?.[1];
  const abrir = (tipo: Detalhe) => router.push({ pathname: '/resumo-lista',
    params: { tipo, ...intervaloDoMes(mes), barbeiro: alvo === 'casa' ? '' : alvo, rotulo: nomeDoMes(mes) + (nomeAlvo ? `, ${nomeAlvo}` : '') } });
  // Por barbeiro (só no geral): concluídos e faturado de cada um.
  const porBarbeiro = barbeiros.map(([id, nome]) => {
    const c = doAlvo.filter(a => a.barbeiroId === id && a.status === 'concluido');
    return { id, nome, concluidos: c.length, centavos: c.reduce((s, a) => s + a.precoCentavos, 0) };
  }).sort((x, y) => y.centavos - x.centavos);
  const dias = [...new Set(doAlvo.map(a => a.data))].sort();

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Voltar para="/resumos" />
        <Pressable onPress={() => setExportando(e => !e)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exportar o mês"
          accessibilityState={{ expanded: exportando }}>
          <Ionicons name="save-outline" size={24} color={exportando ? colors.accent : colors.text} />
        </Pressable>
      </View>
      <Titulo>{nomeDoMes(mes)}</Titulo>
      <Text style={type.caption}>{ehDono ? 'O relatório do mês da casa. Toque num número para ver a lista.' : 'O seu relatório do mês. Toque num número para ver a lista.'}</Text>
      {ehDono && barbeiros.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Geral" ativo={filtro === 'casa'} onPress={() => setFiltro('casa')} />
          {barbeiros.map(([id, nome]) => <Chip key={id} rotulo={nome} ativo={filtro === id} onPress={() => setFiltro(id)} />)}
        </ScrollView>
      ) : null}
      {exportando ? (
        <Exportar meses={[mes]} barbeariaId={barbearia.id} barbeariaNome={barbearia.nome}
          barbeiros={barbeiroUid ? null : barbeiros} inicial={alvo}
          meuNome={barbeiroUid ? (lista ?? [])[0]?.barbeiroNome || 'Meu resumo' : ''} />
      ) : null}
      {erro ? <Aviso texto="Não foi possível carregar o mês. Puxe para baixo para tentar de novo." tom="erro" />
        : !lista ? <Text style={type.caption}>Carregando…</Text>
        : (
          <>
            <View style={{ flexDirection: 'row', gap: space(3) }}>
              <Numero rotulo="Agendamentos" valor={String(r.agendamentos)} onPress={() => abrir('agendamentos')} />
              <Numero rotulo="Faturado" valor={formatarPreco(r.faturadoCentavos)} onPress={() => abrir('faturado')} />
            </View>
            <View style={{ flexDirection: 'row', gap: space(3) }}>
              <Numero rotulo="A receber" valor={formatarPreco(r.aReceberCentavos)} onPress={() => abrir('receber')} />
              <Numero rotulo="Faltas" valor={`${r.taxaFaltaPercent}%`} alerta={r.taxaFaltaPercent >= 15} onPress={() => abrir('faltas')} />
            </View>
            <Cartao style={{ gap: space(1) }}>
              <Text style={type.caption}>
                {qtd(r.agendamentos, 'agendamento')} ({r.pelaApp} pelo app), {qtd(r.concluidos, 'concluído')},
                {' '}{qtd(r.faltas, 'falta')} e {qtd(r.cancelados, 'cancelado')}.
              </Text>
            </Cartao>
            {alvo === 'casa' && porBarbeiro.length ? (
              <Bloco titulo="Por barbeiro">
                {porBarbeiro.map(b => (
                  <Text key={b.id} style={type.caption}>
                    <Text style={{ color: colors.text }}>{b.nome}</Text>: {formatarPreco(b.centavos)} em {qtd(b.concluidos, 'atendimento')}
                  </Text>
                ))}
              </Bloco>
            ) : null}
            {porServico(doAlvo).length ? (
              <Bloco titulo="Serviços">
                {porServico(doAlvo).map(s => (
                  <Text key={s.nome} style={type.caption}>
                    <Text style={{ color: colors.text }}>{s.nome}</Text>: {s.vezes}× · {formatarPreco(s.centavos)}
                  </Text>
                ))}
              </Bloco>
            ) : null}
            <Text style={type.heading}>Dia a dia</Text>
            {!dias.length ? <Aviso texto="Nenhum agendamento neste mês." /> : dias.map(d => {
              const doDia = doAlvo.filter(a => a.data === d).sort((a, b) => a.inicio - b.inicio);
              const feito = doDia.filter(a => a.status === 'concluido').reduce((s, a) => s + a.precoCentavos, 0);
              return (
                <View key={d} style={{ gap: space(2) }}>
                  <Text style={[type.body, { fontWeight: '600' }]}>{formatarData(d, hoje)} · {qtd(doDia.length, 'horário')} · {formatarPreco(feito)}</Text>
                  {doDia.map(a => <ItemAgendamento key={a.id} a={a} hoje={hoje} comData={false} comBarbeiro={ehDono} />)}
                </View>
              );
            })}
          </>
        )}
    </Tela>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <Cartao style={{ gap: space(1) }}><Text style={type.heading}>{titulo}</Text>{children}</Cartao>;
}

const qtd = (n: number, palavra: string) => `${n} ${n === 1 ? palavra : palavra + 's'}`;
