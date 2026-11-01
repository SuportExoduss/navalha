// Peças do resumo usadas no painel da casa, na lista de um número e no relatório do mês.
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Aviso, Botao, Cartao, Chip } from './ui';
import { db } from '../services/firebase';
import { agendamentosDaCasa } from '../services/agendamentos';
import { salvarCsv, salvarPdf } from '../services/salvarArquivo';
import { formatarData, formatarHora, formatarPreco } from '../lib/agenda';
import { ORIGEM, STATUS, csvDoMes, htmlDosMeses, intervaloDoMes, nomeDoArquivo, textoDoCancelamento } from '../lib/exportar';
import { nomeDoMes } from '../lib/notificacoes';
import { colors, space, type } from '../theme';
import type { Agendamento, ISODate } from '../types/models';

/** Voltar da subtela; aberta por link direto (sem histórico), vai para `para`. */
export function Voltar({ para = '/casa' }: { para?: Href }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(para))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}

/** Um número do resumo; com `onPress`, abre a lista do que ele soma. */
export function Numero({ rotulo, valor, alerta, onPress }: { rotulo: string; valor: string; alerta?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${rotulo}: ${valor}. Ver a lista`}>
      <Cartao style={{ gap: space(1) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.caption}>{rotulo}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
        </View>
        <Text style={[type.heading, type.number, alerta && { color: colors.danger }]}>{valor}</Text>
      </Cartao>
    </Pressable>
  );
}

/** Um atendimento com tudo: dia, hora, cliente, serviço, valor, barbeiro, status e o motivo do cancelamento. */
export function ItemAgendamento({ a, hoje, comData = true, comBarbeiro = true }: { a: Agendamento; hoje: ISODate; comData?: boolean; comBarbeiro?: boolean }) {
  const ruim = a.status === 'faltou' || a.status === 'cancelado';
  return (
    <Cartao style={{ gap: space(1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
        <Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]}>
          {comData ? `${formatarData(a.data, hoje)} · ` : ''}{formatarHora(a.inicio)} · {a.clienteNome}
        </Text>
        <Text style={[type.body, type.number]}>{formatarPreco(a.precoCentavos)}</Text>
      </View>
      <Text style={type.caption}>{a.servicoNome}{comBarbeiro ? ` · ${a.barbeiroNome || 'Barbeiro'}` : ''}</Text>
      <Text style={type.caption}>
        <Text style={{ color: ruim ? colors.danger : colors.text }}>{STATUS[a.status]}</Text> · {ORIGEM[a.origem]}
      </Text>
      {a.status === 'cancelado' ? <Text style={type.caption}>{textoDoCancelamento(a.cancelamento) || 'Sem motivo informado'}</Text> : null}
    </Cartao>
  );
}

/**
 * Exportar em PDF ou planilha. O dono escolhe a casa toda ou um barbeiro; o barbeiro exporta só o dele (`barbeiros` null).
 * Com `selecionados`, escolhe entre todos os meses e só os selecionados.
 */
export function Exportar({ meses, selecionados = [], barbeariaId, barbeariaNome, barbeiros, inicial, meuNome }: {
  meses: string[]; selecionados?: string[]; barbeariaId: string; barbeariaNome: string;
  barbeiros: [string, string][] | null; inicial: string; meuNome: string;
}) {
  const [alvo, setAlvo] = useState(inicial);
  const [soSelecionados, setSoSelecionados] = useState(selecionados.length > 0);
  const [estado, setEstado] = useState<'parado' | 'pdf' | 'csv' | 'pronto' | string>('parado');
  const ocupado = estado === 'pdf' || estado === 'csv';
  const escolhidos = (soSelecionados && selecionados.length ? selecionados : meses).slice().sort();

  async function exportar(formato: 'pdf' | 'csv') {
    if (ocupado || !escolhidos.length) return;
    setEstado(formato);
    try {
      // Uma leitura do mais antigo ao mais novo; meses no meio que não foram escolhidos ficam de fora.
      const de = intervaloDoMes(escolhidos[0]).de, ate = intervaloDoMes(escolhidos[escolhidos.length - 1]).ate;
      const ags = (await agendamentosDaCasa(db, barbeariaId, de, ate, alvo === 'casa' ? null : alvo))
        .filter(a => escolhidos.includes(a.data.slice(0, 7)));
      const quem = alvo === 'casa' ? barbeariaNome : barbeiros?.find(([id]) => id === alvo)?.[1] || meuNome;
      const nome = nomeDoArquivo(escolhidos, quem);
      if (formato === 'csv') await salvarCsv(nome, csvDoMes(ags));
      else await salvarPdf(nome, htmlDosMeses(escolhidos, quem, ags));
      setEstado('pronto');
    } catch {
      setEstado('Não foi possível exportar agora. Verifique a conexão e tente de novo.');
    }
  }

  const titulo = escolhidos.length === 1 ? `Exportar ${nomeDoMes(escolhidos[0])}`
    : escolhidos.length ? `Exportar ${escolhidos.length} meses` : 'Nenhum mês para exportar';
  return (
    <Cartao style={{ gap: space(3) }}>
      <Text style={type.heading}>{titulo}</Text>
      <Text style={type.caption}>Os números de cada mês e a lista de atendimentos: data, hora, barbeiro, cliente, serviço, valor, status e motivo do cancelamento. A planilha é um CSV, que abre no Excel e no Google Planilhas.</Text>
      {selecionados.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Chip rotulo={`Todos os meses (${meses.length})`} ativo={!soSelecionados} onPress={() => setSoSelecionados(false)} />
          <Chip rotulo={`Selecionados (${selecionados.length})`} ativo={soSelecionados} onPress={() => setSoSelecionados(true)} />
        </View>
      ) : null}
      {barbeiros ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Barbearia toda" ativo={alvo === 'casa'} onPress={() => setAlvo('casa')} />
          {barbeiros.map(([id, nome]) => <Chip key={id} rotulo={nome} ativo={alvo === id} onPress={() => setAlvo(id)} />)}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="PDF" icone={<Ionicons name="document-text-outline" size={18} color={colors.text} />} variante="secundario" style={{ flex: 1 }}
          carregando={estado === 'pdf'} disabled={ocupado || !escolhidos.length} onPress={() => exportar('pdf')} />
        <Botao titulo="Planilha" accessibilityLabel="Planilha (CSV)" icone={<Ionicons name="grid-outline" size={18} color={colors.text} />} variante="secundario" style={{ flex: 1 }}
          carregando={estado === 'csv'} disabled={ocupado || !escolhidos.length} onPress={() => exportar('csv')} />
      </View>
      {estado === 'pronto' ? <Aviso texto="Pronto." tom="ok" /> : null}
      {!ocupado && estado !== 'parado' && estado !== 'pronto' ? <Aviso texto={estado} tom="erro" /> : null}
    </Cartao>
  );
}
