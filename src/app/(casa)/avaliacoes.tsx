// Aba Avaliações (modo casa): o dono vê todas as da casa (da barbearia, dos barbeiros e as que a casa deu aos
// clientes); o barbeiro vê só as que os clientes deram a ele. Cada uma com o nome do cliente, o dia e o horário.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Aviso, Carregando, Cartao, Chip, FalhaAoCarregar, Tela, Titulo } from '../../components/ui';
import { ItemAvaliacao, MediaAvaliacoes } from '../../components/agenda/ListaAvaliacoes';
import { useMinhaBarbearia } from '../../hooks/useMinhaBarbearia';
import { db } from '../../services/firebase';
import { avaliacoesDaCasa, avaliacoesDoBarbeiro } from '../../services/avaliacoes';
import { ouvirEquipePrivado, type EquipePrivado } from '../../services/barbearias';
import { space, type } from '../../theme';
import type { Avaliacao } from '../../types/models';

const FILTROS = [
  { id: 'todas', rotulo: 'Todas', direcao: null },
  { id: 'casa', rotulo: 'Barbearia', direcao: 'cliente_para_barbearia' },
  { id: 'barbeiros', rotulo: 'Barbeiros', direcao: 'cliente_para_barbeiro' },
  { id: 'clientes', rotulo: 'Clientes', direcao: 'barbeiro_para_cliente' },
] as const;

export default function AvaliacoesDaCasa() {
  const { barbearia, carregando, ehDono, uid } = useMinhaBarbearia();
  const [lista, setLista] = useState<Avaliacao[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todas');
  const [privado, setPrivado] = useState<EquipePrivado>({});

  const carregar = useCallback(() => {
    if (!barbearia || !uid) return;
    setFalhou(false);
    (ehDono ? avaliacoesDaCasa(db, barbearia.id) : avaliacoesDoBarbeiro(db, uid)).then(setLista).catch(() => { setFalhou(true); setLista([]); });
  }, [barbearia?.id, uid, ehDono]);
  useEffect(carregar, [carregar]);
  useEffect(() => (barbearia && uid && !ehDono ? ouvirEquipePrivado(db, barbearia.id, uid, setPrivado) : undefined), [barbearia?.id, uid, ehDono]);

  if (carregando) return <Carregando />;
  if (!barbearia) return <Tela><Titulo>Avaliações</Titulo><Aviso texto="Cadastre ou entre numa barbearia primeiro, na aba Barbearia." /></Tela>;

  const direcao = FILTROS.find(f => f.id === filtro)!.direcao;
  const visiveis = (lista ?? []).filter(a => !direcao || a.direcao === direcao);
  const notaCasa = { media: barbearia.resumo.notaApp ?? 0, total: barbearia.resumo.totalAvaliacoesApp ?? 0 };

  return (
    <Tela>
      <Titulo>Avaliações</Titulo>
      {ehDono ? <MediaAvaliacoes nota={notaCasa} rotulo="Nota da barbearia no app" />
        : <MediaAvaliacoes nota={privado.nota} rotulo="Sua nota com os clientes" />}
      {ehDono ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {FILTROS.map(f => <Chip key={f.id} rotulo={f.rotulo} ativo={f.id === filtro} onPress={() => setFiltro(f.id)} />)}
        </ScrollView>
      ) : null}
      {falhou ? <FalhaAoCarregar onTentar={() => { setLista(null); carregar(); }} />
        : lista === null ? <Carregando />
        : visiveis.length === 0 ? (
          <Cartao><Text style={type.caption}>
            {ehDono ? 'Nenhuma avaliação aqui ainda. Ligue "Pedir avaliação ao cliente" em Configurações para o app pedir depois de cada corte.'
              : 'Quando um cliente avaliar seu atendimento, aparece aqui.'}
          </Text></Cartao>
        ) : (
          <View style={{ gap: space(3) }}>{visiveis.map(a => <ItemAvaliacao key={a.id} a={a} />)}</View>
        )}
    </Tela>
  );
}
