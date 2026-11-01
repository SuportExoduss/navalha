// Resumos dos meses anteriores (o Worker salva no dia 1). Dono: o geral, com filtro por barbeiro. Barbeiro: só o dele.
// Abre no mês do ?mes=AAAA-MM (o toque na notificação) ou no mais recente.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Cartao, Chip, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { useVersao } from '../hooks/useAtualizar';
import { db } from '../services/firebase';
import { carregarResumos } from '../services/resumos';
import { agendamentosDaCasa } from '../services/agendamentos';
import { salvarCsv, salvarPdf } from '../services/salvarArquivo';
import { dataLocal, formatarPreco, somarDias } from '../lib/agenda';
import { csvDoMes, htmlDoMes, intervaloDoMes, nomeDoArquivo } from '../lib/exportar';
import { nomeDoMes, type ResumoSalvo } from '../lib/notificacoes';
import { colors, space, type } from '../theme';

export default function ResumosTela() {
  const { barbearia, carregando, ehDono, uid } = useMinhaBarbearia();
  const { mes: mesInicial } = useLocalSearchParams<{ mes?: string }>();
  const [docs, setDocs] = useState<ResumoSalvo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState('casa');
  const [aberto, setAberto] = useState<string | null>(mesInicial ?? null);
  const [exportando, setExportando] = useState(false);
  const versao = useVersao();
  const barbeiroUid = ehDono ? null : uid ?? null;

  useEffect(() => {
    if (!barbearia || !uid) return;
    setErro(false);
    carregarResumos(db, barbearia.id, uid, barbeiroUid).then(setDocs, () => setErro(true));
  }, [barbearia?.id, uid, barbeiroUid, versao]);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia) return <Tela><Voltar /><Titulo>Resumos anteriores</Titulo><Aviso texto="Entre numa barbearia primeiro, na aba Barbearia." /></Tela>;

  const alvo = barbeiroUid ?? filtro;
  const meses = (docs ?? []).filter(d => d.barbeiroId === alvo).sort((a, b) => b.mes.localeCompare(a.mes));
  const abertoMes = aberto ?? meses[0]?.mes;
  // Chips dos barbeiros: quem tem resumo salvo (inclui quem já saiu da casa).
  const barbeiros = [...new Map((docs ?? []).filter(d => d.barbeiroId !== 'casa').map(d => [d.barbeiroId, d.nome])).entries()];
  // Exporta o mês aberto; sem nenhum aberto, o mais recente; sem resumo salvo, o mês passado.
  const mesExportar = abertoMes || meses[0]?.mes || somarDias(dataLocal(Date.now()).slice(0, 8) + '01', -1).slice(0, 7);

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Voltar />
        <Pressable onPress={() => setExportando(e => !e)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exportar o mês"
          accessibilityState={{ expanded: exportando }}>
          <Ionicons name="save-outline" size={24} color={exportando ? colors.accent : colors.text} />
        </Pressable>
      </View>
      <Titulo destaque="anteriores">{'Resumos\n'}</Titulo>
      <Text style={type.caption}>
        {ehDono ? 'O fechamento de cada mês da casa. Toque num mês para ver os números.' : 'O seu fechamento de cada mês. Toque num mês para ver os números.'}
      </Text>
      {ehDono && barbeiros.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Geral" ativo={filtro === 'casa'} onPress={() => setFiltro('casa')} />
          {barbeiros.map(([id, nome]) => <Chip key={id} rotulo={nome} ativo={filtro === id} onPress={() => setFiltro(id)} />)}
        </ScrollView>
      ) : null}
      {exportando ? (
        <Exportar mes={mesExportar} barbeariaId={barbearia.id} barbeariaNome={barbearia.nome}
          barbeiros={barbeiroUid ? null : barbeiros} inicial={alvo}
          meuNome={barbeiroUid ? (docs ?? []).find(d => d.barbeiroId === barbeiroUid)?.nome || 'Meu resumo' : ''} />
      ) : null}
      {erro ? <Aviso texto="Não foi possível carregar os resumos. Puxe para baixo para tentar de novo." tom="erro" />
        : !docs ? <Text style={type.caption}>Carregando…</Text>
        : !meses.length ? <Aviso texto="Ainda não há resumo salvo. O primeiro chega no dia 1 do mês que vem." />
        : meses.map(r => <Mes key={r.id} r={r} aberto={r.mes === abertoMes} geral={alvo === 'casa'}
            onPress={() => setAberto(r.mes === abertoMes ? '' : r.mes)} />)}
    </Tela>
  );
}

function Mes({ r, aberto, geral, onPress }: { r: ResumoSalvo; aberto: boolean; geral: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: aberto }}>
      <Cartao style={{ gap: space(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.heading}>{nomeDoMes(r.mes)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
            <Text style={[type.body, type.number]}>{formatarPreco(r.faturadoCentavos)}</Text>
            <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </View>
        {aberto ? (
          <>
            <Text style={type.caption}>
              {qtd(r.agendamentos, 'agendamento')} ({r.pelaApp} pelo app), {qtd(r.concluidos, 'concluído')},
              {' '}{qtd(r.faltas, 'falta')} e {qtd(r.cancelados, 'cancelado')}.
            </Text>
            {r.maisPedido ? <Text style={type.caption}>Mais pedido: <Text style={{ color: colors.text }}>{r.maisPedido.nome}</Text> ({r.maisPedido.vezes}×)</Text> : null}
            {geral && r.porBarbeiro.length ? r.porBarbeiro.map(b => (
              <Text key={b.nome} style={type.caption}>
                <Text style={{ color: colors.text }}>{b.nome}</Text>: {formatarPreco(b.faturadoCentavos)} em {qtd(b.concluidos, 'atendimento')}
              </Text>
            )) : null}
          </>
        ) : null}
      </Cartao>
    </Pressable>
  );
}

/** Menu do disquete: o dono escolhe a casa toda ou um barbeiro; o barbeiro exporta só o dele (`barbeiros` null). */
function Exportar({ mes, barbeariaId, barbeariaNome, barbeiros, inicial, meuNome }: {
  mes: string; barbeariaId: string; barbeariaNome: string; barbeiros: [string, string][] | null; inicial: string; meuNome: string;
}) {
  const [alvo, setAlvo] = useState(inicial);
  const [estado, setEstado] = useState<'parado' | 'pdf' | 'csv' | 'pronto' | string>('parado');
  const ocupado = estado === 'pdf' || estado === 'csv';

  async function exportar(formato: 'pdf' | 'csv') {
    if (ocupado) return;
    setEstado(formato);
    try {
      const { de, ate } = intervaloDoMes(mes);
      const ags = await agendamentosDaCasa(db, barbeariaId, de, ate, alvo === 'casa' ? null : alvo);
      const quem = alvo === 'casa' ? barbeariaNome : barbeiros?.find(([id]) => id === alvo)?.[1] || meuNome;
      const nome = nomeDoArquivo(mes, quem);
      if (formato === 'csv') await salvarCsv(nome, csvDoMes(ags));
      else await salvarPdf(nome, htmlDoMes(mes, quem, ags));
      setEstado('pronto');
    } catch {
      setEstado('Não foi possível exportar agora. Verifique a conexão e tente de novo.');
    }
  }

  return (
    <Cartao style={{ gap: space(3) }}>
      <Text style={type.heading}>Exportar {nomeDoMes(mes)}</Text>
      <Text style={type.caption}>Os números do mês e a lista de atendimentos: data, hora, barbeiro, cliente, serviço, valor e status. A planilha é um CSV, que abre no Excel e no Google Planilhas.</Text>
      {barbeiros ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Barbearia toda" ativo={alvo === 'casa'} onPress={() => setAlvo('casa')} />
          {barbeiros.map(([id, nome]) => <Chip key={id} rotulo={nome} ativo={alvo === id} onPress={() => setAlvo(id)} />)}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="PDF" icone={<Ionicons name="document-text-outline" size={18} color={colors.text} />} variante="secundario" style={{ flex: 1 }}
          carregando={estado === 'pdf'} disabled={ocupado} onPress={() => exportar('pdf')} />
        <Botao titulo="Planilha" accessibilityLabel="Planilha (CSV)" icone={<Ionicons name="grid-outline" size={18} color={colors.text} />} variante="secundario" style={{ flex: 1 }}
          carregando={estado === 'csv'} disabled={ocupado} onPress={() => exportar('csv')} />
      </View>
      {estado === 'pronto' ? <Aviso texto="Pronto." tom="ok" /> : null}
      {!ocupado && estado !== 'parado' && estado !== 'pronto' ? <Aviso texto={estado} tom="erro" /> : null}
    </Cartao>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/casa'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const qtd = (n: number, palavra: string) => `${n} ${n === 1 ? palavra : palavra + 's'}`;
