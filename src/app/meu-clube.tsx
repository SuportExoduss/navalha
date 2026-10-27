// Meu clube (cliente): as assinaturas da pessoa em cada barbearia, até quando estão em dia e sair do clube.
// Pagar é na barbearia; quem marca o pagamento é a casa (docs/clube.md).
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Cartao, Chip, FalhaAoCarregar, Tela, Titulo } from '../components/ui';
import { usosDoPlano } from '../components/clube/ClubeDaCasa';
import { useAuth } from '../auth/AuthProvider';
import { ouvirMeusClubes, planoEUsos, sair, type Membro } from '../services/clube';
import { db } from '../services/firebase';
import { dataLocal, formatarData, minParaHHMM, NOMES_DIAS } from '../lib/agenda';
import { situacao } from '../lib/clube';
import { colors, space, type } from '../theme';
import { useVersao } from '../hooks/useAtualizar';

export default function MeuClube() {
  const { perfil } = useAuth();
  const [lista, setLista] = useState<Membro[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!perfil) return;
    setFalhou(false);
    return ouvirMeusClubes(db, perfil.uid, setLista, () => setFalhou(true));
  }, [perfil?.uid, tentativa]);

  // Quem saiu não aparece; recusado aparece para a pessoa saber o que aconteceu com o pedido.
  const visiveis = lista?.filter(m => m.status !== 'saiu') ?? [];

  return (
    <Tela>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo destaque="clube">{'Meu\n'}</Titulo>
      <Text style={type.caption}>Você paga a mensalidade na barbearia, e ela marca no app. Avisamos antes de vencer.</Text>
      {!perfil ? <Carregando /> : falhou ? <FalhaAoCarregar onTentar={() => setTentativa(t => t + 1)} /> : lista === null ? <Carregando /> : visiveis.length === 0 ? (
        <Cartao><Text style={type.caption}>Você ainda não assina nenhum clube. Os planos aparecem na página de cada barbearia que tiver clube.</Text></Cartao>
      ) : visiveis.map(m => <Assinatura key={m.id} m={m} />)}
    </Tela>
  );
}

function Assinatura({ m }: { m: Membro }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Plano com limite: quantos já foram usados no ciclo (horários pelo clube não cancelados).
  const [usos, setUsos] = useState<number | null>(null);
  const versao = useVersao();
  useEffect(() => {
    if (m.status === 'ativo' && m.cortesPorMes) planoEUsos(db, m).then(r => setUsos(r.usos)).catch(() => undefined);
  }, [m.id, m.status, m.cicloInicio, m.reservadoAte, m.atualizadoEm, versao]);
  const s = situacao(m, Date.now());
  const vence = m.venceEm !== undefined ? formatarData(dataLocal(m.venceEm), dataLocal(Date.now())) : '';
  const texto = m.status === 'recusado' ? 'A barbearia não aceitou o pedido. Fale com eles ou peça de novo na página da casa.'
    : s === 'pedido' ? 'Pedido enviado. A barbearia confirma quando você fizer o primeiro pagamento lá.'
      : s === 'vencido' ? `Venceu em ${vence}. Pague na barbearia para continuar; um dia depois do vencimento o horário fixo fica livre para outros.`
        : `Em dia até ${vence}.`;

  async function confirmarSaida() {
    setErro(null);
    setOcupado(true);
    try { await sair(db, m); } catch { setErro('Não foi possível sair. Tente de novo.'); setOcupado(false); }
  }

  return (
    <Cartao style={{ gap: space(2), borderColor: s === 'vencido' ? colors.danger : s === 'pedido' ? colors.accent : colors.border }}>
      <View style={{ gap: 2 }}>
        <Text style={[type.body, { fontWeight: '600' }]}>{m.barbeariaNome}</Text>
        <Text style={type.caption}>{m.planoNome} · {usos !== null && m.cortesPorMes ? `${usos} de ${m.cortesPorMes} usados neste ciclo` : usosDoPlano(m.cortesPorMes)}</Text>
      </View>
      <Text style={type.body}>{texto}</Text>
      {m.status === 'ativo' && m.horarioFixo ? (
        <Text style={type.caption}>
          Horário fixo: {NOMES_DIAS[m.horarioFixo.diaSemana].toLowerCase()} às {minParaHHMM(m.horarioFixo.minutos)}
          {m.horarioFixo.frequencia === 'semanal' ? ', toda semana' : m.horarioFixo.frequencia === 'quinzenal' ? ', a cada 2 semanas' : ', a cada 4 semanas'}
        </Text>
      ) : null}
      {confirmar ? (
        <View style={{ gap: space(2) }}>
          <Aviso texto={s === 'pedido' ? 'Desistir do pedido?' : 'Sair do clube? O horário fixo deixa de ser reservado. O que você já pagou é combinado com a barbearia.'} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => setConfirmar(false)} />
            <Botao titulo={s === 'pedido' ? 'Desistir' : 'Sair'} style={{ flex: 1 }} carregando={ocupado} onPress={confirmarSaida} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Chip rotulo="Ver barbearia" onPress={() => router.push({ pathname: '/barbearia/[id]', params: { id: m.barbeariaId } })} />
          {m.status === 'ativo' ? <Chip rotulo={m.horarioFixo ? 'Trocar horário fixo' : 'Escolher horário fixo'} onPress={() => router.push({ pathname: '/horario-fixo', params: { casa: m.barbeariaId } })} /> : null}
          {m.status !== 'recusado' ? <Chip rotulo={s === 'pedido' ? 'Desistir do pedido' : 'Sair do clube'} onPress={() => setConfirmar(true)} /> : null}
        </View>
      )}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Cartao>
  );
}
