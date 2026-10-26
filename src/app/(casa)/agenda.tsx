// Agenda da barbearia: linha do tempo do dia, ações rápidas (antes do horário só cancelar; depois, concluído,
// faltou ou cancelar) e encaixe manual de cliente de balcão. Escuta só o dia aberto na tela.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Cartao, Chip, Tela, Titulo } from '../../components/ui';
import { SeletorDia } from '../../components/agenda/SeletorDia';
import { EtiquetaStatus, ATIVOS } from '../../components/agenda/StatusAgendamento';
import { MotivoCancelamento, textoCancelamento } from '../../components/agenda/MotivoCancelamento';
import { Encaixe } from '../../components/agenda/Encaixe';
import { PainelNotificacoes } from '../../components/agenda/PainelNotificacoes';
import { avisarAgendamento } from '../../services/avisos';
import { LembrarNoWhatsapp } from '../../components/agenda/LembrarNoWhatsapp';
import { useAuth } from '../../auth/AuthProvider';
import { useMinhaBarbearia } from '../../hooks/useMinhaBarbearia';
import { db } from '../../services/firebase';
import { cancelar, concluir, definirStatus, iniciarCorte, ouvirAgendaDoDia, registrarEvento } from '../../services/agendamentos';
import { corteAberto, emAtendimento, podeIniciar } from '../../lib/atendimento';
import { dataLocal, expedienteEfetivo, diaDaSemana, formatarHora, formatarPreco, proximosDias, somarDias } from '../../lib/agenda';
import { colors, radius, space, type } from '../../theme';
import type { Agendamento, ISODate } from '../../types/models';
import { situacaoAssinatura } from '../../lib/planos';
import { AvisoAssinatura, BarbeariaBloqueada } from '../../components/casa/AvisoAssinatura';

export default function AgendaBarbeiro() {
  const { perfil } = useAuth();
  const { barbearia, equipe, carregando, ehDono, uid } = useMinhaBarbearia();
  const [hoje] = useState(() => dataLocal(Date.now()));
  const [dia, setDia] = useState<ISODate>(hoje);
  const [filtro, setFiltro] = useState<string | null>(null); // null = todos (dono)
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [encaixando, setEncaixando] = useState(false);

  useEffect(() => { if (!ehDono && uid) setFiltro(uid); }, [ehDono, uid]);

  useEffect(() => {
    if (!barbearia || !uid) return;
    setLista(null);
    return ouvirAgendaDoDia(db, barbearia.id, dia, ehDono ? null : uid, setLista, () => { setLista([]); setErro('Não foi possível carregar a agenda.'); });
  }, [barbearia?.id, dia, ehDono, uid]);

  const dias = useMemo(() => [somarDias(hoje, -1), ...proximosDias(Date.now(), 14)], [hoje]);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia) {
    return (
      <Tela>
        <Titulo destaque="hoje">Sua agenda de </Titulo>
        <Aviso texto="Cadastre ou entre numa barbearia primeiro, na aba Barbearia." />
      </Tela>
    );
  }
  // Vencida há mais de 5 dias: a agenda trava (as regras também barram novos horários).
  const assinatura = situacaoAssinatura(barbearia, Date.now());
  if (assinatura.tipo === 'bloqueada') return <Tela><BarbeariaBloqueada ehDono={ehDono} /></Tela>;

  const ativos = equipe.filter(e => e.ativo);
  const eu = equipe.find(e => e.uid === uid);
  // Com "Todos" selecionado, expediente e encaixe são os do próprio usuário.
  const barbeiroDoEncaixe = equipe.find(e => e.uid === (filtro ?? uid)) ?? eu;
  const visiveis = (lista ?? []).filter(a => !filtro || a.barbeiroId === filtro);
  const nomeDe = (id: string) => { const e = equipe.find(x => x.uid === id); return e ? e.apelido || e.nome.split(' ')[0] : ''; };
  const expDia = barbeiroDoEncaixe ? expedienteEfetivo(barbearia.expediente, barbeiroDoEncaixe.expediente)[diaDaSemana(dia)] : undefined;
  // Mesma conta do painel (ativos + concluídos): o total do dia não encolhe à medida que o barbeiro atende.
  const confirmados = visiveis.filter(a => ATIVOS.includes(a.status) || a.status === 'concluido');
  const total = confirmados.reduce((s, a) => s + a.precoCentavos, 0);
  const meuCorte = dia === hoje ? corteAberto(lista ?? [], uid) : undefined;

  if (encaixando && barbeiroDoEncaixe) {
    return <Encaixe barbearia={barbearia} barbeiro={barbeiroDoEncaixe} dia={dia} aoSair={() => setEncaixando(false)} />;
  }

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.caption, { flex: 1 }]}>Modo {perfil?.papelAtivo === 'dono' ? 'dono' : 'barbeiro'} · {barbearia.nome}</Text>
        {/* Marcados, cancelados e o resumo do mês: o sino abre o painel lateral. */}
        <PainelNotificacoes uid={uid} />
      </View>
      {ehDono ? <AvisoAssinatura s={assinatura} /> : null}
      <Titulo destaque={dia === hoje ? 'hoje' : undefined}>{dia === hoje ? 'Sua agenda de ' : 'Sua agenda'}</Titulo>
      <SeletorDia dias={dias} hoje={hoje} valor={dia} onChange={setDia} />

      {ehDono && ativos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip rotulo="Todos" ativo={!filtro} onPress={() => setFiltro(null)} />
          {ativos.map(e => <Chip key={e.uid} rotulo={e.apelido || e.nome.split(' ')[0]} ativo={filtro === e.uid} onPress={() => setFiltro(e.uid)} />)}
        </ScrollView>
      ) : null}

      <Text style={type.caption}>
        {expDia ? `Expediente ${expDia.abre}–${expDia.fecha}` : 'Fechado neste dia'}
        {` · ${confirmados.length} ${confirmados.length === 1 ? 'cliente' : 'clientes'} · ${formatarPreco(total)}`}
      </Text>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Encaixe" style={{ flex: 1 }} onPress={() => setEncaixando(true)}
          icone={<Ionicons name="add" size={20} color={colors.accentText} />} />
        <Botao titulo="Expediente" variante="secundario" style={{ flex: 1 }} onPress={() => router.push('/expediente')}
          icone={<Ionicons name="time-outline" size={18} color={colors.text} />} />
      </View>

      {/* Seguir cortes: o corte aberto do usuário fica no topo; tocar volta para a tela do corte. */}
      {meuCorte ? (
        <Pressable onPress={() => router.push({ pathname: '/atendimento/[id]', params: { id: meuCorte.id } })} accessibilityRole="button"
          accessibilityLabel={`Corte em andamento: ${meuCorte.clienteNome}. Abrir`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.card,
            backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name="cut" size={20} color={colors.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontWeight: '600', color: colors.accentText }]}>Corte em andamento</Text>
            <Text style={[type.caption, { color: colors.accentText }]}>{meuCorte.clienteNome} · {meuCorte.servicoNome}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.accentText} />
        </Pressable>
      ) : null}

      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      {lista === null ? <Carregando /> : visiveis.length === 0 ? (
        <Cartao><Text style={type.caption}>Nenhum cliente marcado {dia === hoje ? 'hoje' : 'neste dia'}.</Text></Cartao>
      ) : visiveis.map(a => (
        <ItemAgenda key={a.id} a={a} barbeiro={!filtro ? nomeDe(a.barbeiroId) : undefined} uid={uid} lista={lista} />
      ))}
    </Tela>
  );
}

function ItemAgenda({ a, barbeiro, uid, lista }: { a: Agendamento; barbeiro?: string; uid: string; lista: Agendamento[] }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [motivo, setMotivo] = useState('');
  const cancelamento = textoCancelamento(a, 'casa');
  const [erro, setErro] = useState<string | null>(null);
  const ativo = ATIVOS.includes(a.status);
  const comecou = Date.now() >= a.inicio;

  async function agir(f: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try { await f(); } catch (e) {
      setErro(e instanceof Error && e.message.startsWith('Permita') ? e.message : 'Não foi possível salvar. Tente de novo.');
    } finally { setOcupado(false); }
  }

  function concluirCorte() {
    return agir(async () => {
      await concluir(db, a.id);
      avisarAgendamento(a.id); // com "pedir avaliação" ligado na casa, o cliente recebe o pedido
      registrarEvento(db, { tipo: 'concluiu', uid, barbeariaId: a.barbeariaId, em: Date.now() });
    });
  }

  return (
    <Cartao style={{ gap: space(2), opacity: ativo ? 1 : 0.6 }}>
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ width: 56 }}>
          <Text style={[type.heading, type.number]}>{formatarHora(a.inicio)}</Text>
          <Text style={[type.caption, type.number]}>{formatarHora(a.fim)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.body}>{a.clienteNome}{a.origem === 'balcao' ? ' · balcão' : ''}</Text>
          <Text style={type.caption}>{a.servicoNome} · {a.origem === 'clube' ? 'Clube' : formatarPreco(a.precoCentavos)}{barbeiro ? ` · ${barbeiro}` : ''}</Text>
        </View>
        <EtiquetaStatus status={a.status} />
      </View>
      {cancelamento ? <Aviso texto={cancelamento} /> : null}
      {ativo && !confirmarCancelamento ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {emAtendimento(a) ? <Chip rotulo="Corte em andamento" ativo onPress={() => router.push({ pathname: '/atendimento/[id]', params: { id: a.id } })} />
            : podeIniciar(a, lista, Date.now()) ? <Chip rotulo="Iniciar corte" ativo onPress={() => agir(async () => {
              await iniciarCorte(db, a.id);
              router.push({ pathname: '/atendimento/[id]', params: { id: a.id } });
            })} /> : null}
          {comecou && !emAtendimento(a) ? <Chip rotulo="Concluído" onPress={concluirCorte} /> : null}
          {comecou ? <Chip rotulo="Faltou" onPress={() => agir(async () => {
            await definirStatus(db, a.id, 'faltou');
            registrarEvento(db, { tipo: 'faltou', uid, barbeariaId: a.barbeariaId, em: Date.now() });
                })} /> : null}
          <Chip rotulo="Cancelar" onPress={() => setConfirmarCancelamento(true)} />
        </View>
      ) : null}
      {confirmarCancelamento ? (
        <View style={{ gap: space(2) }}>
          <Aviso texto={a.clienteUid ? 'O cliente vê o cancelamento e o motivo no app. Se puder, avise também pelo WhatsApp.' : 'O horário volta a ficar livre.'} />
          <MotivoCancelamento por="casa" onChange={setMotivo} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Manter" variante="secundario" style={{ flex: 1 }} onPress={() => { setConfirmarCancelamento(false); setMotivo(''); }} />
            <Botao titulo="Cancelar" style={{ flex: 1 }} carregando={ocupado} disabled={!motivo} onPress={() => agir(async () => {
              await cancelar(db, a, { por: 'casa', motivo });
              avisarAgendamento(a.id); // o cliente (e o barbeiro, se foi o dono) fica sabendo na hora
              registrarEvento(db, { tipo: 'cancelou', uid, barbeariaId: a.barbeariaId, em: Date.now() });
            })} />
          </View>
        </View>
      ) : null}
      {ativo && !confirmarCancelamento ? <LembrarNoWhatsapp a={a} uid={uid} /> : null}
      {ocupado && !confirmarCancelamento ? <Aviso texto="Salvando…" /> : null}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Cartao>
  );
}

