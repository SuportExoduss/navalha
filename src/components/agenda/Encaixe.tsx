// Encaixe manual: cliente que chegou no balcão ou marcou por telefone.
// Usa a mesma trava do app, então nunca encaixa por cima de outro cliente.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Carregando, Cartao, Chip, Secao, Tela, Titulo } from '../ui';
import { GradeHorarios } from './GradeHorarios';
import { db } from '../../services/firebase';
import { listarServicos } from '../../services/barbearias';
import { HorarioOcupadoError, horariosLivres, reservar } from '../../services/agendamentos';
import { formatarHora, formatarPreco, rotuloDia, dataLocal } from '../../lib/agenda';
import { colors, space, type } from '../../theme';
import type { Barbearia, Barbeiro, ISODate, Millis, Servico } from '../../types/models';

export function Encaixe({ barbearia, barbeiro, dia, aoSair }: { barbearia: Barbearia; barbeiro: Barbeiro; dia: ISODate; aoSair: () => void }) {
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [nome, setNome] = useState('');
  const [horarios, setHorarios] = useState<Millis[] | null>(null);
  const [inicio, setInicio] = useState<Millis | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    listarServicos(db, barbearia.id)
      .then(l => { const meus = l.filter(s => s.barbeiroId === barbeiro.uid); setServicos(meus); setServico(meus[0] ?? null); })
      .catch(() => setServicos([]));
  }, [barbearia.id, barbeiro.uid]);

  useEffect(() => {
    if (!servico) return;
    setHorarios(null);
    setInicio(null);
    // No balcão vale encaixar para já: sem antecedência mínima, e o horário que começou há pouco ainda conta.
    horariosLivres(db, { barbearia, barbeiro, duracaoMin: servico.duracaoMin, data: dia, agora: Date.now() - barbearia.passoMin * 60_000, antecedenciaMin: 0 })
      .then(setHorarios)
      .catch(() => { setHorarios([]); setErro('Não foi possível carregar os horários.'); });
  }, [servico?.id, dia, recarregar]);

  async function salvar() {
    if (!servico || !inicio) return;
    if (!nome.trim()) return setErro('Digite o nome do cliente.');
    setErro(null);
    setSalvando(true);
    try {
      await reservar(db, {
        barbeariaId: barbearia.id, barbeariaNome: barbearia.nome, barbeiroId: barbeiro.uid,
        barbeiroNome: barbeiro.apelido || barbeiro.nome.split(' ')[0],
        servico, cliente: { uid: null, nome: nome.trim() }, inicio, passoMin: barbearia.passoMin, origem: 'balcao',
      });
      aoSair();
    } catch (e) {
      setErro(e instanceof HorarioOcupadoError ? e.message : 'Não foi possível salvar. Tente de novo.');
      if (e instanceof HorarioOcupadoError) setRecarregar(n => n + 1);
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Pressable onPress={aoSair} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <Titulo>Encaixe</Titulo>
      <Text style={type.caption}>{barbeiro.apelido || barbeiro.nome} · {rotuloDia(dia, dataLocal(Date.now()))}</Text>

      <Campo rotulo="Nome do cliente" value={nome} onChangeText={setNome} placeholder="Ex.: João do 302" autoCapitalize="words" />

      <Secao titulo="Corte">
        {servicos === null ? <Carregando /> : servicos.length === 0 ? (
          <Aviso texto="Cadastre pelo menos um corte no seu cardápio para encaixar clientes." />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {servicos.map(s => <Chip key={s.id} rotulo={`${s.nome} · ${s.duracaoMin} min`} ativo={servico?.id === s.id} onPress={() => setServico(s)} />)}
          </View>
        )}
      </Secao>

      {servico ? (
        <Secao titulo="Horário">
          {horarios === null ? <Carregando /> : horarios.length === 0
            ? <Cartao><Text style={type.caption}>Nenhum espaço livre para {servico.duracaoMin} min neste dia.</Text></Cartao>
            : <GradeHorarios horarios={horarios} valor={inicio} onChange={setInicio} />}
        </Secao>
      ) : null}

      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao
        titulo={inicio && servico ? `Encaixar às ${formatarHora(inicio)} · ${formatarPreco(servico.precoCentavos)}` : 'Escolha corte e horário'}
        onPress={salvar} carregando={salvando} disabled={!inicio || !servico}
      />
    </Tela>
  );
}
