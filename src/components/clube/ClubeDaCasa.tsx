// Página da barbearia: os planos do clube e, para quem já pediu ou assina, a situação dele nesta casa.
// O app não cobra: o cliente pede aqui e paga na barbearia; a casa confirma.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Aviso, Botao, Cartao } from '../ui';
import { useAuth } from '../../auth/AuthProvider';
import { ouvirMeusClubes, planosAbertos, sair, solicitar, type Membro } from '../../services/clube';
import { db } from '../../services/firebase';
import { dataLocal, formatarData, formatarPreco } from '../../lib/agenda';
import { situacao } from '../../lib/clube';
import { colors, space, type } from '../../theme';
import type { PlanoClube, Servico } from '../../types/models';
import { useVersao } from '../../hooks/useAtualizar';

export const usosDoPlano = (n?: number) => (n ? `${n} ${n === 1 ? 'uso' : 'usos'} por mês` : 'Uso ilimitado');

export function ClubeDaCasa({ casa, servicos }: { casa: { id: string; nome: string }; servicos: Servico[] }) {
  const { perfil } = useAuth();
  const [planos, setPlanos] = useState<PlanoClube[]>([]);
  const [meu, setMeu] = useState<Membro | null>(null);
  const [pedindo, setPedindo] = useState<PlanoClube | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sem plano aberto, a seção não aparece: falha ao ler os planos também só esconde.
  const versao = useVersao();
  useEffect(() => { planosAbertos(db, casa.id).then(setPlanos, () => setPlanos([])); }, [casa.id, versao]);
  useEffect(() => {
    if (!perfil) return;
    return ouvirMeusClubes(db, perfil.uid, l => setMeu(l.find(m => m.barbeariaId === casa.id) ?? null));
  }, [perfil?.uid, casa.id]);

  const s = meu ? situacao(meu, Date.now()) : null;
  if (!planos.length && !s) return null;

  async function pedir(p: PlanoClube) {
    if (!perfil) return router.push('/entrar');
    setErro(null);
    setOcupado(true);
    try {
      await solicitar(db, casa, p, { uid: perfil.uid, nome: perfil.apelido || perfil.nome }, meu ?? undefined);
      setPedindo(null);
    } catch { setErro('Não foi possível enviar o pedido. Tente de novo.'); } finally { setOcupado(false); }
  }

  async function desistir() {
    if (!meu) return;
    setOcupado(true);
    try { await sair(db, meu); } catch { setErro('Não foi possível cancelar o pedido.'); } finally { setOcupado(false); }
  }

  const vence = meu?.venceEm !== undefined ? formatarData(dataLocal(meu.venceEm), dataLocal(Date.now())) : '';
  const nomesCobertos = (p: PlanoClube) => servicos.filter(x => p.servicoIds.includes(x.id)).map(x => x.nome);

  return (
    <View style={{ gap: space(3), marginTop: space(4) }}>
      <Text accessibilityRole="header" style={type.heading}>Clube de assinatura</Text>

      {s === 'pedido' ? (
        <Cartao style={{ gap: space(2), borderColor: colors.accent }}>
          <Text style={[type.body, { fontWeight: '600' }]}>Pedido enviado: {meu!.planoNome}</Text>
          <Text style={type.caption}>A barbearia confirma quando você fizer o primeiro pagamento aqui na casa.</Text>
          <Pressable onPress={desistir} disabled={ocupado} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
            <Text style={[type.caption, { color: colors.accent }]}>{ocupado ? 'Cancelando…' : 'Desistir do pedido'}</Text>
          </Pressable>
        </Cartao>
      ) : s === 'vencido' ? (
        <Cartao style={{ gap: space(2), borderColor: colors.danger }}>
          <Text style={[type.body, { fontWeight: '600' }]}>Seu clube venceu em {vence}</Text>
          <Text style={type.caption}>Pague na barbearia para continuar no {meu!.planoNome}. Um dia depois do vencimento, o horário fixo fica livre para outros clientes.</Text>
          <LinkMeuClube />
        </Cartao>
      ) : s ? (
        <Cartao style={{ gap: space(2), borderColor: colors.success }}>
          <Text style={[type.body, { fontWeight: '600' }]}>Você é assinante: {meu!.planoNome}</Text>
          <Text style={type.caption}>Em dia até {vence} · {usosDoPlano(meu!.cortesPorMes)}</Text>
          <LinkMeuClube />
        </Cartao>
      ) : (
        <>
          <Text style={type.caption}>Pague por mês aqui na barbearia e use dentro do limite do plano. Você pede pelo app e a casa confirma.</Text>
          {meu?.status === 'recusado' ? <Aviso texto="A barbearia não aceitou seu último pedido. Fale com eles ou peça de novo." /> : null}
          {planos.map(p => (
            <Cartao key={p.id} style={{ gap: space(2) }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(2) }}>
                <Text style={[type.body, { flex: 1, fontWeight: '600' }]}>{p.nome}</Text>
                <Text style={[type.body, type.number, { color: colors.accent, fontWeight: '600' }]}>{formatarPreco(p.precoCentavos)}/mês</Text>
              </View>
              <Text style={type.caption}>{usosDoPlano(p.cortesPorMes)}{nomesCobertos(p).length ? ` · ${nomesCobertos(p).join(', ')}` : ''}</Text>
              {pedindo?.id === p.id ? (
                <View style={{ gap: space(2) }}>
                  <Aviso texto={`Pedir para entrar? Você paga ${formatarPreco(p.precoCentavos)} por mês na barbearia, e ela confirma o pedido.`} />
                  <View style={{ flexDirection: 'row', gap: space(2) }}>
                    <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => setPedindo(null)} />
                    <Botao titulo="Pedir" style={{ flex: 1 }} carregando={ocupado} onPress={() => pedir(p)} />
                  </View>
                </View>
              ) : <Botao titulo="Quero assinar" variante="secundario" onPress={() => (perfil ? setPedindo(p) : router.push('/entrar'))} />}
            </Cartao>
          ))}
        </>
      )}
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
    </View>
  );
}

function LinkMeuClube() {
  return (
    <Pressable onPress={() => router.push('/meu-clube')} hitSlop={8} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
      <Text style={[type.caption, { color: colors.accent }]}>Ver meu clube</Text>
    </Pressable>
  );
}
