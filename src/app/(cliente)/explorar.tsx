// Explorar: busca por perto com todos os filtros (raio, preço, tipo de corte, horário).
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Cartao, Chip, Interruptor, Secao, Tela, Titulo } from '../../components/ui';
import { CardBarbearia } from '../../components/CardBarbearia';
import { useBarbeariasPerto } from '../../hooks/useBarbeariasPerto';
import { FILTROS_PADRAO, RAIOS, contarFiltros, filtrarBarbearias, type FaixaPreco, type Filtros } from '../../lib/busca';
import { colors, radius, space, type } from '../../theme';
import type { Servico } from '../../types/models';

const PRECOS: { id: FaixaPreco; rotulo: string }[] = [
  { id: 'ate40', rotulo: 'Até R$ 40' }, { id: '40a70', rotulo: 'R$ 40 a 70' }, { id: '70mais', rotulo: 'R$ 70 ou mais' },
];
const CATEGORIAS: { id: Servico['categoria']; rotulo: string }[] = [
  { id: 'cabelo', rotulo: 'Cabelo' }, { id: 'barba', rotulo: 'Barba' }, { id: 'combo', rotulo: 'Combo' }, { id: 'outro', rotulo: 'Outros' },
];

export default function Explorar() {
  const { negada, lista, erro } = useBarbeariasPerto();
  const [f, setF] = useState<Filtros>(FILTROS_PADRAO);
  const mudar = (p: Partial<Filtros>) => setF(x => ({ ...x, ...p }));
  const resultado = filtrarBarbearias(lista ?? [], f, Date.now());
  const ativos = contarFiltros(f);

  return (
    <Tela>
      <Titulo>Explorar</Titulo>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.surface, borderRadius: radius.input, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput value={f.texto} onChangeText={texto => mudar({ texto })} placeholder="Nome, rua ou bairro…"
          placeholderTextColor={colors.textMuted} style={{ flex: 1, minHeight: 48, color: colors.text, fontSize: 15 }} />
      </View>

      <Secao titulo="Distância">
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          {RAIOS.map(r => <Chip key={r} rotulo={`${r} km`} ativo={f.raioKm === r} onPress={() => mudar({ raioKm: r })} />)}
        </View>
      </Secao>
      <Secao titulo="Preço">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {PRECOS.map(p => <Chip key={p.id} rotulo={p.rotulo} ativo={f.preco === p.id} onPress={() => mudar({ preco: f.preco === p.id ? null : p.id })} />)}
        </View>
      </Secao>
      <Secao titulo="Tipo de corte">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {CATEGORIAS.map(c => <Chip key={c.id} rotulo={c.rotulo} ativo={f.categoria === c.id} onPress={() => mudar({ categoria: f.categoria === c.id ? null : c.id })} />)}
        </View>
      </Secao>
      <Cartao style={{ gap: space(3) }}>
        <Linha rotulo="Aberta agora" valor={f.abertoAgora} onChange={abertoAgora => mudar({ abertoAgora })} />
        <Linha rotulo="Atende ainda hoje" valor={f.aindaHoje} onChange={aindaHoje => mudar({ aindaHoje })} />
      </Cartao>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={type.heading}>{lista ? `${resultado.length} ${resultado.length === 1 ? 'barbearia' : 'barbearias'}` : 'Buscando…'}</Text>
        {ativos ? <Text onPress={() => setF({ ...FILTROS_PADRAO, texto: f.texto })} style={[type.caption, { color: colors.accent }]}>Limpar filtros ({ativos})</Text> : null}
      </View>

      {negada ? <Cartao><Text style={type.caption}>Permita a localização para buscar barbearias por perto.</Text></Cartao>
        : erro ? <Cartao><Text style={[type.caption, { color: colors.danger }]}>{erro}</Text></Cartao>
        : lista === null ? <ActivityIndicator color={colors.accent} />
        : resultado.length === 0 ? <Cartao><Text style={type.caption}>Nenhuma barbearia com esses filtros. Tente aumentar a distância.</Text></Cartao>
        : resultado.map(b => <CardBarbearia key={b.id} b={b} />)}
    </Tela>
  );
}

function Linha({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={type.body}>{rotulo}</Text>
      <Interruptor value={valor} onValueChange={onChange} rotulo={rotulo} />
    </View>
  );
}
