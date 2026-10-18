// Expediente semanal (do barbeiro e, para o dono, o da casa) e folgas.
// O que o cliente vê é o expediente do barbeiro recortado pelo horário da casa.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Carregando, Cartao, Chip, Interruptor, Secao, Tela, Titulo } from '../components/ui';
import { useMinhaBarbearia } from '../hooks/useMinhaBarbearia';
import { db } from '../services/firebase';
import { salvarExpedienteBarbeiro, salvarExpedienteCasa } from '../services/barbearias';
import { criarFolga, ouvirFolgas, removerFolga } from '../services/agendamentos';
import {
  NOMES_DIAS, dataLocal, formatarData, formatarHora, intervaloFolga, normalizarData, normalizarHora,
  paraMillis, hhmmParaMin, validarExpediente,
} from '../lib/agenda';
import { colors, space, type } from '../theme';
import type { Bloqueio, Expediente } from '../types/models';

// Segunda primeiro, como o barbeiro pensa a semana.
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

interface DiaForm { aberto: boolean; abre: string; fecha: string; pausaIni: string; pausaFim: string }

function paraForm(e: Expediente): DiaForm[] {
  return Array.from({ length: 7 }, (_, d) => {
    const dia = e[d];
    const p = dia?.pausas?.[0];
    return { aberto: !!dia, abre: dia?.abre ?? '09:00', fecha: dia?.fecha ?? '19:00', pausaIni: p?.inicio ?? '', pausaFim: p?.fim ?? '' };
  });
}

/** Converte o formulário; devolve a mensagem de erro em vez do expediente se algo estiver inválido. */
function deForm(f: DiaForm[], original: Expediente): Expediente | string {
  const e: Expediente = {};
  for (let d = 0; d < 7; d++) {
    const x = f[d];
    if (!x.aberto) continue;
    const abre = normalizarHora(x.abre), fecha = normalizarHora(x.fecha);
    if (!abre || !fecha) return `${NOMES_DIAS[d]}: hora inválida.`;
    const temPausa = x.pausaIni.trim() || x.pausaFim.trim();
    const pi = normalizarHora(x.pausaIni), pf = normalizarHora(x.pausaFim);
    if (temPausa && (!pi || !pf)) return `${NOMES_DIAS[d]}: preencha início e fim da pausa, ou deixe os dois vazios.`;
    // Pausas extras (além da primeira) que vieram de outro lugar são mantidas.
    const extras = original[d]?.pausas?.slice(1) ?? [];
    const pausas = [...(pi && pf ? [{ inicio: pi, fim: pf }] : []), ...extras];
    e[d] = { abre, fecha, ...(pausas.length ? { pausas } : {}) };
  }
  return validarExpediente(e) ?? e;
}

export default function ExpedienteTela() {
  const { barbearia, equipe, carregando, ehDono, uid } = useMinhaBarbearia();
  const [alvo, setAlvo] = useState<'meu' | 'casa'>('meu');
  const eu = equipe.find(e => e.uid === uid);

  if (carregando || !uid) return <Carregando />;
  if (!barbearia || !eu) {
    return <Tela><Voltar /><Titulo>Expediente</Titulo><Aviso texto="Cadastre ou entre numa barbearia primeiro, na aba Barbearia." /></Tela>;
  }

  return (
    <Tela>
      <Voltar />
      <Titulo destaque="folgas">{'Expediente e\n'}</Titulo>
      {ehDono ? (
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <Chip rotulo="Meu horário" ativo={alvo === 'meu'} onPress={() => setAlvo('meu')} />
          <Chip rotulo="Horário da casa" ativo={alvo === 'casa'} onPress={() => setAlvo('casa')} />
        </View>
      ) : null}
      <Text style={type.caption}>
        {alvo === 'casa'
          ? 'Quando a barbearia abre. Nenhum barbeiro atende fora deste horário.'
          : 'Seus dias e horários de trabalho. O cliente só vê horários dentro do expediente da casa.'}
      </Text>
      {alvo === 'casa'
        ? <EditorSemana key="casa" inicial={barbearia.expediente} salvar={e => salvarExpedienteCasa(db, barbearia.id, e)} />
        : <EditorSemana key="meu" inicial={eu.expediente} salvar={e => salvarExpedienteBarbeiro(db, barbearia.id, uid, e)} />}
      <Folgas barbeariaId={barbearia.id} barbeiroId={uid} />
    </Tela>
  );
}

function EditorSemana({ inicial, salvar }: { inicial: Expediente; salvar: (e: Expediente) => Promise<void> }) {
  const [form, setForm] = useState(() => paraForm(inicial));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; tom: 'erro' | 'ok' } | null>(null);
  const mudar = (d: number, p: Partial<DiaForm>) => { setMsg(null); setForm(f => f.map((x, i) => (i === d ? { ...x, ...p } : x))); };

  async function onSalvar() {
    const r = deForm(form, inicial);
    if (typeof r === 'string') return setMsg({ texto: r, tom: 'erro' });
    setSalvando(true);
    try { await salvar(r); setMsg({ texto: 'Expediente salvo.', tom: 'ok' }); }
    catch { setMsg({ texto: 'Não foi possível salvar. Tente de novo.', tom: 'erro' }); }
    finally { setSalvando(false); }
  }

  return (
    <View style={{ gap: space(3) }}>
      {ORDEM.map(d => {
        const x = form[d];
        return (
          <Cartao key={d} style={{ gap: space(3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={type.heading}>{NOMES_DIAS[d]}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                <Text style={type.caption}>{x.aberto ? 'Trabalho' : 'Folga'}</Text>
                <Interruptor value={x.aberto} onValueChange={aberto => mudar(d, { aberto })} rotulo={`${NOMES_DIAS[d]} aberto`} />
              </View>
            </View>
            {x.aberto ? (
              <>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Campo rotulo="Abre" value={x.abre} onChangeText={abre => mudar(d, { abre })} keyboardType="numbers-and-punctuation" placeholder="09:00" /></View>
                  <View style={{ flex: 1 }}><Campo rotulo="Fecha" value={x.fecha} onChangeText={fecha => mudar(d, { fecha })} keyboardType="numbers-and-punctuation" placeholder="19:00" /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: space(2) }}>
                  <View style={{ flex: 1 }}><Campo rotulo="Pausa de" value={x.pausaIni} onChangeText={pausaIni => mudar(d, { pausaIni })} keyboardType="numbers-and-punctuation" placeholder="12:00" /></View>
                  <View style={{ flex: 1 }}><Campo rotulo="até" value={x.pausaFim} onChangeText={pausaFim => mudar(d, { pausaFim })} keyboardType="numbers-and-punctuation" placeholder="13:00" /></View>
                </View>
              </>
            ) : null}
          </Cartao>
        );
      })}
      {msg ? <Aviso texto={msg.texto} tom={msg.tom} /> : null}
      <Botao titulo="Salvar expediente" onPress={onSalvar} carregando={salvando} />
    </View>
  );
}

function Folgas({ barbeariaId, barbeiroId }: { barbeariaId: string; barbeiroId: string }) {
  const [folgas, setFolgas] = useState<Bloqueio[] | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaIni, setHoraIni] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => ouvirFolgas(db, barbeariaId, barbeiroId, setFolgas), [barbeariaId, barbeiroId]);

  async function adicionar() {
    setErro(null);
    const hoje = dataLocal(Date.now());
    const dIni = normalizarData(de, hoje);
    if (!dIni) return setErro('Data inválida. Use dia/mês, ex.: 24/12.');
    let intervalo: { inicio: number; fim: number };
    if (diaInteiro) {
      const dFim = ate.trim() ? normalizarData(ate, dIni) : dIni;
      if (!dFim) return setErro('Data final inválida. Use dia/mês, ex.: 02/01.');
      intervalo = intervaloFolga(dIni, dFim);
    } else {
      const hi = normalizarHora(horaIni), hf = normalizarHora(horaFim);
      if (!hi || !hf || hhmmParaMin(hf) <= hhmmParaMin(hi)) return setErro('Informe o horário de início e fim, ex.: 14:00 e 16:00.');
      intervalo = { inicio: paraMillis(dIni, hhmmParaMin(hi)), fim: paraMillis(dIni, hhmmParaMin(hf)) };
    }
    setSalvando(true);
    try {
      await criarFolga(db, barbeariaId, { barbeiroId, ...intervalo, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
      setDe(''); setAte(''); setHoraIni(''); setHoraFim(''); setMotivo('');
    } catch { setErro('Não foi possível salvar a folga.'); }
    finally { setSalvando(false); }
  }

  return (
    <Secao titulo="Folgas e ausências">
      <Text style={type.caption}>Clientes que já marcaram nesse período continuam na agenda; avise ou cancele por lá.</Text>
      {folgas === null ? <Carregando /> : folgas.map(f => (
        <Cartao key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Ionicons name="airplane-outline" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={type.body}>{descreverFolga(f)}</Text>
            {f.motivo ? <Text style={type.caption}>{f.motivo}</Text> : null}
          </View>
          <Pressable onPress={() => removerFolga(db, barbeariaId, f.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remover folga">
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </Cartao>
      ))}
      <Cartao style={{ gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={type.body}>Dia inteiro</Text>
          <Interruptor value={diaInteiro} onValueChange={setDiaInteiro} rotulo="Folga de dia inteiro" />
        </View>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}><Campo rotulo={diaInteiro ? 'De (dia/mês)' : 'Dia (dia/mês)'} value={de} onChangeText={setDe} placeholder="24/12" keyboardType="numbers-and-punctuation" /></View>
          {diaInteiro ? <View style={{ flex: 1 }}><Campo rotulo="Até (opcional)" value={ate} onChangeText={setAte} placeholder="26/12" keyboardType="numbers-and-punctuation" /></View> : null}
        </View>
        {!diaInteiro ? (
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <View style={{ flex: 1 }}><Campo rotulo="Das" value={horaIni} onChangeText={setHoraIni} placeholder="14:00" keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 1 }}><Campo rotulo="Até" value={horaFim} onChangeText={setHoraFim} placeholder="16:00" keyboardType="numbers-and-punctuation" /></View>
          </View>
        ) : null}
        <Campo rotulo="Motivo (só a equipe vê)" value={motivo} onChangeText={setMotivo} placeholder="Ex.: férias, médico" />
        {erro ? <Aviso texto={erro} tom="erro" /> : null}
        <Botao titulo="Adicionar folga" variante="secundario" onPress={adicionar} carregando={salvando} />
      </Cartao>
    </Secao>
  );
}

function descreverFolga(f: Bloqueio): string {
  const dIni = dataLocal(f.inicio);
  const dFim = dataLocal(f.fim - 1);
  const inteiro = formatarHora(f.inicio) === '00:00' && formatarHora(f.fim) === '00:00';
  if (inteiro) return dIni === dFim ? `${formatarData(dIni)} · dia inteiro` : `${formatarData(dIni)} a ${formatarData(dFim)}`;
  return `${formatarData(dIni)} · ${formatarHora(f.inicio)}–${formatarHora(f.fim)}`;
}

function Voltar() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
