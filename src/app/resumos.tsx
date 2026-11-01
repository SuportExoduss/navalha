// Resumos dos meses anteriores (o Worker salva no dia 1). Dono: o geral, com filtro por barbeiro. Barbeiro: só o dele.
// Tocar num mês abre o relatório (resumo-mes); segurar seleciona para exportar vários de uma vez.
// O ?mes=AAAA-MM (toque na notificação, inclusive de versões antigas) vai direto para o relatório do mês.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Cartao, Chip, Tela, Titulo } from '../components/ui';
import { Exportar, Voltar } from '../components/resumo';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { useVersao } from '../hooks/useAtualizar';
import { db } from '../services/firebase';
import { carregarResumos } from '../services/resumos';
import { formatarPreco } from '../lib/agenda';
import { nomeDoMes, type ResumoSalvo } from '../lib/notificacoes';
import { colors, space, type } from '../theme';

export default function ResumosTela() {
  const { barbearia, carregando, ehDono, uid } = useMinhaBarbearia();
  const { mes: mesInicial } = useLocalSearchParams<{ mes?: string }>();
  const [docs, setDocs] = useState<ResumoSalvo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState('casa');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);
  const versao = useVersao();
  const barbeiroUid = ehDono ? null : uid ?? null;

  useEffect(() => {
    if (!barbearia || !uid) return;
    setErro(false);
    carregarResumos(db, barbearia.id, uid, barbeiroUid).then(setDocs, () => setErro(true));
  }, [barbearia?.id, uid, barbeiroUid, versao]);

  if (mesInicial) return <Redirect href={{ pathname: '/resumo-mes', params: { mes: mesInicial } }} />;
  if (carregando || !uid) return <Carregando />;
  if (!barbearia) return <Tela><Voltar /><Titulo>Resumos anteriores</Titulo><Aviso texto="Entre numa barbearia primeiro, na aba Barbearia." /></Tela>;

  const alvo = barbeiroUid ?? filtro;
  const meses = (docs ?? []).filter(d => d.barbeiroId === alvo).sort((a, b) => b.mes.localeCompare(a.mes));
  // Chips dos barbeiros: quem tem resumo salvo (inclui quem já saiu da casa).
  const barbeiros = [...new Map((docs ?? []).filter(d => d.barbeiroId !== 'casa').map(d => [d.barbeiroId, d.nome])).entries()];
  const selecionando = selecionados.length > 0;
  const alternar = (mes: string) => setSelecionados(s => (s.includes(mes) ? s.filter(m => m !== mes) : [...s, mes]));
  const abrir = (mes: string) => router.push({ pathname: '/resumo-mes', params: { mes, barbeiro: alvo === 'casa' ? '' : alvo } });

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Voltar />
        <Pressable onPress={() => setExportando(e => !e)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exportar meses"
          accessibilityState={{ expanded: exportando }}>
          <Ionicons name="save-outline" size={24} color={exportando ? colors.accent : colors.text} />
        </Pressable>
      </View>
      <Titulo destaque="anteriores">{'Resumos\n'}</Titulo>
      <Text style={type.caption}>
        {ehDono ? 'O fechamento de cada mês da casa.' : 'O seu fechamento de cada mês.'} Toque num mês para ver o relatório; segure para selecionar e exportar vários.
      </Text>
      {ehDono && barbeiros.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Geral" ativo={filtro === 'casa'} onPress={() => setFiltro('casa')} />
          {barbeiros.map(([id, nome]) => <Chip key={id} rotulo={nome} ativo={filtro === id} onPress={() => setFiltro(id)} />)}
        </ScrollView>
      ) : null}
      {selecionando ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
          <Text style={type.body}>{selecionados.length} {selecionados.length === 1 ? 'mês selecionado' : 'meses selecionados'}</Text>
          <Botao titulo="Limpar" variante="secundario" onPress={() => setSelecionados([])} />
        </View>
      ) : null}
      {exportando ? (
        // A chave refaz o menu quando a seleção começa ou acaba: ele abre já em "Selecionados".
        <Exportar key={selecionando ? 'sel' : 'todos'} meses={meses.map(m => m.mes)} selecionados={selecionados}
          barbeariaId={barbearia.id} barbeariaNome={barbearia.nome} barbeiros={barbeiroUid ? null : barbeiros} inicial={alvo}
          meuNome={barbeiroUid ? (docs ?? []).find(d => d.barbeiroId === barbeiroUid)?.nome || 'Meu resumo' : ''} />
      ) : null}
      {erro ? <Aviso texto="Não foi possível carregar os resumos. Puxe para baixo para tentar de novo." tom="erro" />
        : !docs ? <Text style={type.caption}>Carregando…</Text>
        : !meses.length ? <Aviso texto="Ainda não há resumo salvo. O primeiro chega no dia 1 do mês que vem." />
        : meses.map(r => (
            <Mes key={r.id} r={r} selecionando={selecionando} marcado={selecionados.includes(r.mes)}
              onPress={() => (selecionando ? alternar(r.mes) : abrir(r.mes))} onLongPress={() => alternar(r.mes)} />
          ))}
    </Tela>
  );
}

function Mes({ r, selecionando, marcado, onPress, onLongPress }: {
  r: ResumoSalvo; selecionando: boolean; marcado: boolean; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button"
      accessibilityLabel={nomeDoMes(r.mes)} accessibilityHint="Segure para selecionar" accessibilityState={{ selected: marcado }}>
      <Cartao style={[{ gap: space(1) }, marcado && { borderColor: colors.accent, borderWidth: 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 }}>
            {selecionando ? <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={20} color={marcado ? colors.accent : colors.textMuted} /> : null}
            <Text style={type.heading}>{nomeDoMes(r.mes)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Text style={[type.body, type.number]}>{formatarPreco(r.faturadoCentavos)}</Text>
            {selecionando ? null : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          </View>
        </View>
        <Text style={type.caption}>{qtd(r.agendamentos, 'agendamento')}, {qtd(r.concluidos, 'concluído')}, {qtd(r.faltas, 'falta')}</Text>
      </Cartao>
    </Pressable>
  );
}

const qtd = (n: number, palavra: string) => `${n} ${n === 1 ? palavra : palavra + 's'}`;
