// Clube de assinatura, lado da casa (docs/clube.md): pedidos, vencimentos, "Recebi o pagamento" e planos.
// O app não cobra nada: a equipe marca o que recebeu na casa. Dono e barbeiros ativos cuidam dos assinantes;
// os planos, só o dono cria e edita.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Campo, Carregando, Cartao, Chip, FalhaAoCarregar, Interruptor, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { listarServicos, precoParaCentavos } from '../services/barbearias';
import {
  encerrar, novoIdPlano, ouvirMembrosDaCasa, ouvirPlanos, recusar, registrarPagamento, removerPlano, salvarPlano, type Membro,
} from '../services/clube';
import { db } from '../services/firebase';
import { dataLocal, formatarData, formatarPreco } from '../lib/agenda';
import { novoCiclo, separarMembros } from '../lib/clube';
import { colors, space, type } from '../theme';
import type { Barbeiro, PlanoClube, Servico } from '../types/models';
import { SEM_CONEXAO, noServidor } from '../lib/noServidor';

const LIMITES = [1, 2, 4, 8];

export default function Clube() {
  const { barbearia, equipe, carregando, ehDono, uid } = useMinhaBarbearia();
  const [planos, setPlanos] = useState<PlanoClube[] | null>(null);
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [editando, setEditando] = useState<PlanoClube | null>(null);

  useEffect(() => {
    if (!barbearia) return;
    setFalhou(false);
    const a = ouvirPlanos(db, barbearia.id, setPlanos);
    const b = ouvirMembrosDaCasa(db, barbearia.id, setMembros, () => setFalhou(true));
    return () => { a(); b(); };
  }, [barbearia?.id, tentativa]);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia) {
    return <Tela><Titulo>Clube</Titulo><Aviso texto="Cadastre ou entre numa barbearia primeiro, na aba Barbearia." /></Tela>;
  }
  if (editando) return <EditorPlano plano={editando} barbeariaId={barbearia.id} equipe={equipe} aoSair={() => setEditando(null)} />;

  function novoPlano() {
    const agora = Date.now();
    setEditando({ id: novoIdPlano(db, barbearia!.id), nome: '', precoCentavos: 0, servicoIds: [], cortesPorMes: 4, ativo: true, criadoEm: agora, atualizadoEm: agora });
  }

  const agora = Date.now();
  const grupos = membros ? separarMembros(membros, agora) : null;
  const precoDe = (planoId: string) => planos?.find(p => p.id === planoId)?.precoCentavos ?? 0;
  const item = (m: Membro) => <ItemMembro key={m.id} m={m} uid={uid} valorCentavos={precoDe(m.planoId)} />;

  return (
    <Tela>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo destaque="assinatura">{'Clube de\n'}</Titulo>
      <Text style={type.caption}>
        O cliente pede pelo app e paga aqui na casa. Ao receber, toque em "Recebi o pagamento": o app conta o mês e avisa
        o cliente antes de vencer. Um dia depois do vencimento sem pagamento, o horário fixo dele fica livre para outros.
      </Text>

      {falhou ? <FalhaAoCarregar onTentar={() => setTentativa(t => t + 1)} /> : !grupos || !planos ? <Carregando /> : (
        <>
          {grupos.pedido.length ? <Secao titulo={`Pedidos (${grupos.pedido.length})`}>{grupos.pedido.map(item)}</Secao> : null}
          {grupos.vencido.length ? <Secao titulo={`Vencidos (${grupos.vencido.length})`}>{grupos.vencido.map(item)}</Secao> : null}
          {grupos.vence_logo.length ? <Secao titulo="Vencem em até 7 dias">{grupos.vence_logo.map(item)}</Secao> : null}
          <Secao titulo={`Em dia (${grupos.em_dia.length})`}>
            {grupos.em_dia.length ? grupos.em_dia.map(item) : (
              <Cartao><Text style={type.caption}>Ninguém em dia ainda. Os pedidos aparecem aqui assim que um cliente pedir pelo app.</Text></Cartao>
            )}
          </Secao>

          <Secao titulo="Planos" acao={ehDono ? 'Novo plano' : undefined} onAcao={novoPlano}>
            {planos.length === 0 ? (
              <Cartao><Text style={type.caption}>
                {ehDono ? 'Crie o primeiro plano, ex.: "4 cortes por mês". Ele aparece na página da barbearia para o cliente pedir.'
                  : 'Nenhum plano ainda. Quem cria os planos é o dono da barbearia.'}
              </Text></Cartao>
            ) : planos.map(p => (
              <Pressable key={p.id} disabled={!ehDono} onPress={() => setEditando(p)} accessibilityRole={ehDono ? 'button' : undefined}
                accessibilityLabel={ehDono ? `Editar ${p.nome}` : undefined}>
                <Cartao style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), opacity: p.ativo ? 1 : 0.6 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.body, { fontWeight: '600' }]}>{p.nome}</Text>
                    <Text style={type.caption}>
                      {p.cortesPorMes ? `${p.cortesPorMes} ${p.cortesPorMes === 1 ? 'uso' : 'usos'} por mês` : 'Ilimitado'}
                      {' · '}{p.servicoIds.length} {p.servicoIds.length === 1 ? 'serviço' : 'serviços'}{p.ativo ? '' : ' · pausado'}
                    </Text>
                  </View>
                  <Text style={[type.body, type.number, { color: colors.accent, fontWeight: '600' }]}>{formatarPreco(p.precoCentavos)}/mês</Text>
                  {ehDono ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
                </Cartao>
              </Pressable>
            ))}
          </Secao>
        </>
      )}
    </Tela>
  );
}

function ItemMembro({ m, uid, valorCentavos }: { m: Membro; uid: string; valorCentavos: number }) {
  const [confirmar, setConfirmar] = useState<'pagamento' | 'encerrar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = m.status === 'solicitado';
  const hoje = dataLocal(Date.now());
  const vence = m.venceEm !== undefined ? formatarData(dataLocal(m.venceEm), hoje) : null;
  // Mostra antes de confirmar até quando o pagamento vale: é o que o cliente vai ver no app dele.
  const proximo = formatarData(dataLocal(novoCiclo(pedido ? undefined : m.venceEm, Date.now()).venceEm), hoje);

  async function agir(f: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try { await f(); setConfirmar(null); } catch { setErro('Não foi possível salvar. Tente de novo.'); } finally { setOcupado(false); }
  }

  return (
    <Cartao style={{ gap: space(2) }}>
      <View style={{ gap: 2 }}>
        <Text style={[type.body, { fontWeight: '600' }]}>{m.clienteNome}</Text>
        <Text style={type.caption}>
          {m.planoNome}{pedido ? ' · pediu para entrar' : vence ? ` · ${m.status === 'vencido' || (m.venceEm ?? 0) < Date.now() ? 'venceu' : 'vence'} ${vence}` : ''}
        </Text>
      </View>

      {confirmar === 'pagamento' ? (
        <View style={{ gap: space(2) }}>
          <Aviso texto={`${pedido ? 'Aceitar e marcar o 1º pagamento' : 'Marcar o pagamento'} de ${formatarPreco(valorCentavos)}? O clube fica em dia até ${proximo}.`} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => setConfirmar(null)} />
            <Botao titulo="Confirmar" style={{ flex: 1 }} carregando={ocupado} onPress={() => agir(() => registrarPagamento(db, m, uid, valorCentavos))} />
          </View>
        </View>
      ) : confirmar === 'encerrar' ? (
        <View style={{ gap: space(2) }}>
          <Aviso texto="Encerrar a assinatura? O cliente sai do clube e o horário fixo dele deixa de ser reservado." />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => setConfirmar(null)} />
            <Botao titulo="Encerrar" style={{ flex: 1 }} carregando={ocupado} onPress={() => agir(() => encerrar(db, m))} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Chip rotulo={pedido ? 'Aceitar (recebi o 1º pagamento)' : 'Recebi o pagamento'} ativo onPress={() => setConfirmar('pagamento')} />
          {pedido ? <Chip rotulo="Recusar" onPress={() => agir(() => recusar(db, m))} />
            : <Chip rotulo="Encerrar" onPress={() => setConfirmar('encerrar')} />}
        </View>
      )}
      {ocupado && !confirmar ? <Aviso texto="Salvando…" /> : null}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </Cartao>
  );
}

function EditorPlano({ plano, barbeariaId, equipe, aoSair }: { plano: PlanoClube; barbeariaId: string; equipe: Barbeiro[]; aoSair: () => void }) {
  const [p, setP] = useState<PlanoClube>(plano);
  const [preco, setPreco] = useState(plano.precoCentavos ? (plano.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  const [limiteLivre, setLimiteLivre] = useState(plano.cortesPorMes && !LIMITES.includes(plano.cortesPorMes) ? String(plano.cortesPorMes) : '');
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const existente = plano.nome !== '';

  useEffect(() => { listarServicos(db, barbeariaId).then(setServicos, () => setServicos([])); }, [barbeariaId]);
  const nomeDe = (uid: string) => equipe.find(b => b.uid === uid)?.nome?.split(' ')[0];
  const alternar = (id: string) => setP(x => ({ ...x, servicoIds: x.servicoIds.includes(id) ? x.servicoIds.filter(s => s !== id) : [...x.servicoIds, id] }));

  async function salvar() {
    const centavos = precoParaCentavos(preco);
    const limite = limiteLivre ? Number(limiteLivre) : p.cortesPorMes;
    if (!p.nome.trim()) return setErro('Dê um nome ao plano, ex.: "4 cortes por mês".');
    if (centavos === null || centavos === 0) return setErro('Informe a mensalidade, ex.: 120 ou 119,90.');
    if (limite !== undefined && (!Number.isInteger(limite) || limite < 1 || limite > 60)) return setErro('Usos por mês entre 1 e 60, ou Ilimitado.');
    if (!p.servicoIds.length) return setErro('Escolha ao menos um serviço que o plano cobre.');
    setSalvando(true);
    try {
      await noServidor(salvarPlano(db, barbeariaId, { ...p, nome: p.nome.trim().slice(0, 60), precoCentavos: centavos, cortesPorMes: limite }));
      aoSair();
    } catch (e) { setErro(e instanceof Error && e.message === SEM_CONEXAO ? SEM_CONEXAO : 'Não foi possível salvar. Tente de novo.'); setSalvando(false); }
  }

  async function excluir() {
    setSalvando(true);
    try { await removerPlano(db, barbeariaId, p.id); aoSair(); } catch { setErro('Não foi possível excluir.'); setSalvando(false); }
  }

  return (
    <Tela>
      <Pressable onPress={aoSair} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo>{existente ? 'Editar plano' : 'Novo plano'}</Titulo>

      <Cartao style={{ gap: space(4) }}>
        <Campo rotulo="Nome do plano" value={p.nome} onChangeText={nome => setP({ ...p, nome })} placeholder="Ex.: 4 cortes por mês" maxLength={60} />
        <Campo rotulo="Mensalidade (R$)" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholder="120,00"
          dica="Só para mostrar ao cliente: o pagamento é feito na barbearia." />
        <View style={{ gap: space(2) }}>
          <Text style={type.caption}>Usos por mês</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {LIMITES.map(n => (
              <Chip key={n} rotulo={String(n)} ativo={!limiteLivre && p.cortesPorMes === n} onPress={() => { setLimiteLivre(''); setP({ ...p, cortesPorMes: n }); }} />
            ))}
            <Chip rotulo="Ilimitado" ativo={!limiteLivre && p.cortesPorMes === undefined} onPress={() => { setLimiteLivre(''); setP({ ...p, cortesPorMes: undefined }); }} />
          </View>
          <Campo rotulo="Outro número" value={limiteLivre} onChangeText={t => setLimiteLivre(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
        </View>
      </Cartao>

      <Secao titulo="Serviços que o plano cobre">
        {servicos === null ? <Carregando /> : servicos.length === 0 ? (
          <Aviso texto="Nenhum serviço ativo no cardápio. Cadastre os cortes primeiro." />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {servicos.map(s => {
              const quem = nomeDe(s.barbeiroId);
              return <Chip key={s.id} rotulo={quem && equipe.length > 1 ? `${s.nome} · ${quem}` : s.nome} ativo={p.servicoIds.includes(s.id)} onPress={() => alternar(s.id)} />;
            })}
          </View>
        )}
      </Secao>

      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Aberto para novos pedidos</Text>
            <Text style={type.caption}>Pausado, some da página da barbearia; quem já assina continua.</Text>
          </View>
          <Interruptor value={p.ativo} onValueChange={ativo => setP({ ...p, ativo })} rotulo="Aberto para novos pedidos" />
        </View>
      </Cartao>

      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao titulo="Salvar plano" onPress={salvar} carregando={salvando} />
      {existente ? <Botao titulo="Excluir plano" variante="secundario" onPress={excluir} disabled={salvando} /> : null}
    </Tela>
  );
}
