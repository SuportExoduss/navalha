// Lista por trás de um número do resumo (Agendamentos, Faturado, A receber, Faltas), no período e barbeiro do filtro.
// O barbeiro (não dono) só lê os próprios: o filtro vira o uid dele, seja qual for o parâmetro.
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Aviso, Carregando, Cartao, Tela, Titulo } from '../components/ui';
import { ItemAgendamento, Voltar } from '../components/resumo';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { useVersao } from '../hooks/useAtualizar';
import { db } from '../services/firebase';
import { agendamentosDaCasa } from '../services/agendamentos';
import { dataLocal, formatarPreco } from '../lib/agenda';
import { doDetalhe, type Detalhe } from '../lib/painel';
import { space, type } from '../theme';
import type { Agendamento } from '../types/models';

const TITULOS: Record<Detalhe, [string, string]> = {
  agendamentos: ['Agendamentos', 'Todos os horários marcados (sem os cancelados).'],
  faturado: ['Faturado', 'Os cortes concluídos.'],
  receber: ['A receber', 'Os cortes que ainda vão acontecer (reservados ou confirmados).'],
  faltas: ['Faltas e cancelados', 'Quem faltou e quem cancelou, com o motivo.'],
};

export default function ResumoListaTela() {
  const { barbearia, carregando, ehDono, uid } = useMinhaBarbearia();
  const p = useLocalSearchParams<{ tipo: Detalhe; de: string; ate: string; barbeiro?: string; rotulo?: string }>();
  const tipo: Detalhe = p.tipo in TITULOS ? p.tipo : 'agendamentos';
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState(false);
  const versao = useVersao();
  const barbeiro = ehDono ? p.barbeiro || null : uid ?? null;

  useEffect(() => {
    if (!barbearia || !uid || !p.de || !p.ate) return;
    setErro(false);
    agendamentosDaCasa(db, barbearia.id, p.de, p.ate, barbeiro).then(setLista, () => setErro(true));
  }, [barbearia?.id, uid, p.de, p.ate, barbeiro, versao]);

  if (carregando || !uid) return <Carregando />;
  const [titulo, explica] = TITULOS[tipo];
  const itens = lista ? doDetalhe(lista, tipo) : [];
  const hoje = dataLocal(Date.now());
  const faltas = itens.filter(a => a.status === 'faltou');
  const cancelados = itens.filter(a => a.status === 'cancelado');
  const total = itens.filter(a => a.status !== 'cancelado').reduce((s, a) => s + a.precoCentavos, 0);
  const item = (a: Agendamento) => <ItemAgendamento key={a.id} a={a} hoje={hoje} comBarbeiro={ehDono} />;

  return (
    <Tela>
      <Voltar />
      <Titulo>{titulo}</Titulo>
      <Text style={type.caption}>{p.rotulo ? `${p.rotulo}. ` : ''}{explica}</Text>
      {erro ? <Aviso texto="Não foi possível carregar. Puxe para baixo para tentar de novo." tom="erro" />
        : !lista ? <Text style={type.caption}>Carregando…</Text>
        : !itens.length ? <Aviso texto="Nada neste período." />
        : tipo === 'faltas' ? (
          <>
            <Cartao style={{ gap: space(1) }}>
              <Text style={type.body}>{faltas.length} {faltas.length === 1 ? 'falta' : 'faltas'} e {cancelados.length} {cancelados.length === 1 ? 'cancelado' : 'cancelados'}</Text>
            </Cartao>
            {faltas.length ? <Text style={type.heading}>Faltas</Text> : null}
            {faltas.map(item)}
            {cancelados.length ? <Text style={type.heading}>Cancelados</Text> : null}
            {cancelados.map(item)}
          </>
        ) : (
          <>
            <Cartao style={{ gap: space(1) }}>
              <Text style={type.body}>{itens.length} {itens.length === 1 ? 'corte' : 'cortes'} · <Text style={type.number}>{formatarPreco(total)}</Text></Text>
            </Cartao>
            {itens.map(item)}
          </>
        )}
    </Tela>
  );
}
