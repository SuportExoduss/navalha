// Plano da barbearia (só o dono): situação atual, os 4 planos e a compra pelo Google Play.
// Baixar de plano com mais barbeiros ativos que o novo limite: o dono escolhe aqui mesmo quem sai (cards com "−" e
// confirmação). Sair = desligar: perde a agenda na hora, mas o cadastro fica para religar num plano maior.
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Botao, Carregando, Cartao, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import {
  assinar, assinaturaDisponivel, carregarPlanos, compraAtual, restaurar, type OfertaPlano,
} from '../services/assinatura';
import { PLANOS, bloqueiaEm, excedentesPara, type Plano } from '../lib/planos';
import { dataLocal, formatarData, formatarPreco } from '../lib/agenda';
import { colors, radius, space, sobreFoto, type } from '../theme';
import { definirBarbeiroAtivo } from '../services/barbearias';
import { db } from '../services/firebase';
import type { Barbearia, Barbeiro } from '../types/models';

export default function PlanoTela() {
  const { barbearia, equipe, carregando, ehDono } = useMinhaBarbearia();
  const [ofertas, setOfertas] = useState<OfertaPlano[] | null>(null);
  const [escolhido, setEscolhido] = useState<Plano | null>(null);
  const [comprando, setComprando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; tom: 'erro' | 'ok' | 'neutro' } | null>(null);

  useEffect(() => {
    if (!assinaturaDisponivel) { setOfertas([]); return; }
    carregarPlanos().then(setOfertas).catch(() => setOfertas([]));
  }, []);

  if (carregando) return <Carregando />;
  if (!barbearia || !ehDono) return <Redirect href="/casa" />;
  const b = barbearia;
  const atual = b.assinatura.status === 'ativa' ? b.assinatura.plano : undefined;
  const oferta = escolhido ? ofertas?.find(o => o.plano.id === escolhido.id) : undefined;
  const excedentes = escolhido ? excedentesPara(escolhido, b.barbeirosAtivos ?? 1) : 0;

  async function comprar() {
    if (!oferta) return;
    setMsg(null);
    setComprando(true);
    try {
      const r = await assinar(oferta, b.id, atual ? await compraAtual() : null);
      if (r === 'ok') { setMsg({ texto: `Plano ${oferta.plano.nome} ativo. Sua barbearia está na busca.`, tom: 'ok' }); setEscolhido(null); }
      if (r === 'pendente') setMsg({ texto: `Troca agendada: o plano ${oferta.plano.nome} começa na próxima renovação.`, tom: 'ok' });
    } catch (e) { setMsg({ texto: e instanceof Error ? e.message : 'Não foi possível assinar agora.', tom: 'erro' }); }
    finally { setComprando(false); }
  }

  async function jaPaguei() {
    setMsg(null);
    try {
      setMsg(await restaurar(b.id)
        ? { texto: 'Assinatura encontrada e confirmada.', tom: 'ok' }
        : { texto: 'Nenhuma assinatura do Navalha nesta conta do Google Play.', tom: 'neutro' });
    } catch (e) { setMsg({ texto: e instanceof Error ? e.message : 'Não foi possível conferir agora.', tom: 'erro' }); }
  }

  return (
    <Tela>
      <Voltar />
      <Titulo>Plano</Titulo>
      <Situacao b={b} />

      <Secao titulo="Planos mensais">
        <View accessibilityRole="radiogroup" style={{ gap: space(2) }}>
          {PLANOS.map(p => {
            const sel = escolhido?.id === p.id;
            const seu = atual === p.id;
            const preco = ofertas?.find(o => o.plano.id === p.id)?.preco ?? `${formatarPreco(p.precoCentavos)}`;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: sel, disabled: seu }}
                accessibilityLabel={`Plano ${p.nome}, até ${p.barbeiros} ${p.barbeiros === 1 ? 'barbeiro' : 'barbeiros'}, ${preco} por mês`}
                disabled={seu} onPress={() => { setMsg(null); setEscolhido(sel ? null : p); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 64, paddingHorizontal: space(4), borderRadius: radius.card,
                  borderWidth: 1, borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.surfaceRaised : colors.surface }}>
                <Ionicons name={sel || seu ? 'radio-button-on' : 'radio-button-off'} size={20} color={sel ? colors.accent : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{p.nome}{seu ? ' · seu plano' : ''}</Text>
                  <Text style={type.caption}>{p.barbeiros === 1 ? 'Só você' : `Até ${p.barbeiros} barbeiros (você + ${p.barbeiros - 1})`}</Text>
                </View>
                <Text style={[type.body, type.number, { fontWeight: '600' }]}>{preco}<Text style={type.caption}>/mês</Text></Text>
              </Pressable>
            );
          })}
        </View>
      </Secao>

      {escolhido && excedentes > 0 ? (
        <Cartao style={{ gap: space(3) }}>
          <Aviso texto={`O plano ${escolhido.nome} permite ${escolhido.barbeiros} ${escolhido.barbeiros === 1 ? 'barbeiro' : 'barbeiros'} e hoje ${b.barbeirosAtivos} estão ativos. Toque no − de ${excedentes === 1 ? 'quem sai' : `${excedentes} barbeiros que saem`}.`} />
          <QuemSai equipe={equipe.filter(e => e.ativo && e.uid !== b.donoUid)} barbeariaId={b.id} />
        </Cartao>
      ) : null}

      {msg ? <Aviso texto={msg.texto} tom={msg.tom} /> : null}

      {!assinaturaDisponivel ? (
        <Aviso texto={Platform.OS === 'web' ? 'A assinatura é feita pelo app Android, na Play Store. Aqui você acompanha a situação do plano.' : 'Assinatura indisponível neste aparelho.'} />
      ) : ofertas === null ? <Carregando /> : ofertas.length === 0 ? (
        <Aviso texto="Os planos ainda não estão disponíveis na Play Store. Instale o Navalha pela Play Store para assinar." />
      ) : (
        <>
          <Botao
            titulo={!escolhido ? 'Escolha um plano' : `${atual ? 'Trocar para' : 'Assinar'} ${escolhido.nome} · ${oferta?.preco ?? ''}/mês`}
            disabled={!escolhido || !oferta || excedentes > 0} carregando={comprando} onPress={comprar} />
          <Pressable onPress={jaPaguei} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: space(2) }}>
            <Text style={[type.caption, { color: colors.accent }]}>Já assinei e não apareceu</Text>
          </Pressable>
        </>
      )}

      <Text style={type.caption}>
        Cobrança mensal pelo Google Play, renovada sozinha. Subir de plano vale na hora (paga só a diferença do mês);
        descer vale na próxima renovação. Cancele quando quiser em Play Store › Pagamentos e assinaturas.
      </Text>
    </Tela>
  );
}

/** Barbeiros ativos (menos o dono) com "−"; o popup confirma antes de tirar da equipe ativa. */
function QuemSai({ equipe, barbeariaId }: { equipe: Barbeiro[]; barbeariaId: string }) {
  const [sai, setSai] = useState<Barbeiro | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nome = (m: Barbeiro) => m.apelido || m.nome;

  async function remover() {
    if (!sai) return;
    setErro(null);
    setRemovendo(true);
    try { await definirBarbeiroAtivo(db, barbeariaId, sai.uid, false); setSai(null); }
    catch { setErro('Não foi possível remover. Tente de novo.'); }
    finally { setRemovendo(false); }
  }

  return (
    <View style={{ gap: space(2) }}>
      {equipe.map(m => (
        <View key={m.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.card,
          borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          {m.fotoUrl ? <Image source={{ uri: m.fotoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              </View>}
          <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{nome(m)}</Text>
          <Pressable onPress={() => { setErro(null); setSai(m); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remover ${nome(m)} da equipe`}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="remove-circle" size={28} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      <Modal visible={!!sai} transparent animationType="fade" onRequestClose={() => { if (!removendo) setSai(null); }}>
        <View style={{ flex: 1, backgroundColor: sobreFoto.veu, justifyContent: 'center', padding: space(5) }}>
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space(5), gap: space(4),
            borderWidth: 1, borderColor: colors.border, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
            <Titulo>Remover {sai ? nome(sai) : ''}?</Titulo>
            <Text style={type.body}>
              Ele sai da equipe e perde o acesso à agenda e aos clientes na hora. O cadastro e o cardápio dele ficam
              guardados: se voltar a um plano maior, é só religar na aba Barbearia.
            </Text>
            {erro ? <Aviso texto={erro} tom="erro" /> : null}
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <Botao titulo="Cancelar" variante="secundario" style={{ flex: 1 }} disabled={removendo} onPress={() => setSai(null)} />
              <Botao titulo="Remover" style={{ flex: 1, backgroundColor: colors.danger }} carregando={removendo} onPress={remover} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** A situação em uma frase: o que o dono precisa saber antes de qualquer número. */
function Situacao({ b }: { b: Barbearia }) {
  const a = b.assinatura;
  const ate = a.venceEm ? formatarData(dataLocal(a.venceEm)) : '';
  const plano = PLANOS.find(p => p.id === a.plano);
  const ativos = b.barbeirosAtivos ?? 1;
  const [titulo, detalhe, tom] =
    a.status === 'teste' && b.emDia ? ['Teste grátis', `Até ${ate}, com até ${a.limiteBarbeiros} barbeiros. Depois, você tem 5 dias para assinar; sem plano, a barbearia fica bloqueada.`, 'ok']
    : a.status === 'vencida' && b.emDia ? ['Venceu: regularize', `Tudo funciona até ${formatarData(dataLocal(bloqueiaEm(a.venceEm ?? 0)))}. Depois, a barbearia sai da busca e a agenda fica bloqueada.`, 'erro']
    : a.status === 'ativa' && b.emDia ? [`Plano ${plano?.nome ?? ''}`, a.renovaSozinha === false ? `Renovação desligada: vale até ${ate}.` : `Em dia. Renova sozinho em ${ate}.`, 'ok']
    : a.status === 'inadimplente' && b.emDia ? ['Pagamento pendente', `O Google Play não conseguiu cobrar. Acerte na Play Store até ${formatarData(dataLocal(bloqueiaEm(a.venceEm ?? 0)))} para não bloquear a barbearia.`, 'erro']
    : a.status === 'rascunho' ? ['Sem plano ativo', 'Sua barbearia está fora da busca. Escolha um plano para os clientes encontrarem você.', 'erro']
    : ['Barbearia bloqueada', 'O plano venceu e o prazo para regularizar acabou. Assine um plano para liberar a busca e a agenda na hora.', 'erro'];
  return (
    <Cartao style={{ gap: space(2), borderColor: tom === 'erro' ? colors.danger : colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Ionicons name={tom === 'erro' ? 'alert-circle' : 'checkmark-circle'} size={20} color={tom === 'erro' ? colors.danger : colors.success} />
        <Text style={type.heading}>{titulo}</Text>
      </View>
      <Text accessibilityRole={tom === 'erro' ? 'alert' : undefined} style={type.caption}>{detalhe}</Text>
      <Text style={type.caption}>{ativos} de {a.limiteBarbeiros} {a.limiteBarbeiros === 1 ? 'barbeiro ativo' : 'barbeiros ativos'}.</Text>
    </Cartao>
  );
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
