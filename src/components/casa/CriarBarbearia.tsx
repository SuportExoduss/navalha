// Cadastro da barbearia pelo dono. A localização vem do GPS do próprio
// celular, de dentro da barbearia — sem mapa nem API paga.
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Aviso, Botao, Campo, Cartao, Titulo } from '../ui';
import { conferirBarbeariaCriada, criarBarbearia, jaUsouTeste } from '../../services/barbearias';
import { SEM_CONEXAO, noServidor } from '../../lib/noServidor';
import { db } from '../../services/firebase';
import { DIAS_AVISO, DIAS_REGULARIZAR, DIAS_TESTE, LIMITE_TESTE, PLANOS } from '../../lib/planos';
import { dataLocal, formatarData, formatarPreco, somarDias } from '../../lib/agenda';
import { colors, radius, sobreFoto, space, type } from '../../theme';
import type { UserProfile } from '../../types/models';

/**
 * `aoCriar(ativo)`: a aba Barbearia segura este formulário na tela enquanto a criação é conferida no servidor
 * (senão a casa aparece pelo cache do aparelho antes da confirmação) e depois mostra o aviso de criada.
 */
export function CriarBarbearia({ perfil, aoCriar }: { perfil: UserProfile; aoCriar: (fase: 'conferindo' | 'criada' | 'falhou') => void }) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [testeUsado, setTesteUsado] = useState<boolean | null>(null);
  useEffect(() => { jaUsouTeste(db, perfil.uid).then(setTesteUsado).catch(() => setTesteUsado(null)); }, [perfil.uid]);

  async function usarLocalizacao() {
    setErro(null);
    setLocalizando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Permita a localização para marcar onde fica a barbearia.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const [e] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => []);
      if (e) {
        const rua = [e.street, e.streetNumber].filter(Boolean).join(', ');
        if (!endereco) setEndereco([rua, e.district].filter(Boolean).join(' – '));
        if (!cidade && (e.city || e.subregion)) setCidade(e.city ?? e.subregion ?? '');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível pegar a localização.');
    } finally {
      setLocalizando(false);
    }
  }

  const faltando = [
    !nome.trim() && 'nome',
    !endereco.trim() && 'endereço',
    !cidade.trim() && 'cidade',
    !coords && 'localização',
  ].filter(Boolean) as string[];

  // Antes de criar, o popup explica em poucas linhas o teste grátis e o que acontece depois.
  const [explicar, setExplicar] = useState(false);
  function pedirConfirmacao() {
    if (faltando.length || !coords) { setErro(`Falta preencher: ${faltando.join(', ')}.`); return; }
    setErro(null);
    setExplicar(true);
  }

  async function salvar() {
    if (!coords) return;
    setExplicar(false);
    setSalvando(true);
    setErro(null);
    aoCriar('conferindo');
    try {
      await noServidor((async () => {
        const id = await criarBarbearia(db, { uid: perfil.uid, nome: perfil.nome, fotoUrl: perfil.fotoUrl },
          { nome, endereco, cidade, lat: coords.lat, lng: coords.lng, telefone, instagram });
        if (!(await conferirBarbeariaCriada(db, id, perfil.uid))) throw new Error('A barbearia não apareceu no servidor. Tente de novo.');
      })(), 30_000);
      aoCriar('criada');
    } catch (e) {
      aoCriar('falhou');
      setErro(e instanceof Error && e.message === SEM_CONEXAO
        ? 'Sem conexão. Se a barbearia aparecer depois, ela foi criada; não crie de novo.'
        : e instanceof Error ? e.message : 'Não foi possível criar. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <>
      <Titulo destaque="barbearia.">{'Cadastre sua\n'}</Titulo>
      <Text style={type.caption}>Leva menos de 10 minutos. Faça de dentro da barbearia para o GPS marcar o lugar certo.</Text>

      <Cartao style={{ gap: space(4) }}>
        <Campo rotulo="Nome da barbearia" value={nome} onChangeText={setNome} placeholder="Ex.: The Lord Barbearia" />
        <View style={{ gap: space(2) }}>
          <Text style={type.caption}>Localização</Text>
          <Botao
            titulo={coords ? 'Localização marcada · marcar de novo' : 'Usar minha localização atual'}
            variante={coords ? 'secundario' : 'primario'}
            carregando={localizando}
            onPress={usarLocalizacao}
            icone={<Ionicons name={coords ? 'checkmark-circle' : 'locate'} size={18} color={coords ? colors.success : colors.accentText} />}
          />
        </View>
        <Campo rotulo="Endereço" value={endereco} onChangeText={setEndereco} placeholder="Rua, número – bairro" />
        <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} />
        <Campo rotulo="WhatsApp (opcional)" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="(15) 99999-9999" />
        <Campo rotulo="Instagram (opcional)" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="@suabarbearia" />
      </Cartao>

      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao titulo="Criar barbearia" onPress={pedirConfirmacao} carregando={salvando} />
      {/* Aceite das regras para barbearias, principalmente o uso dos dados dos clientes. */}
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Ao criar, você aceita os{' '}
        <Text accessibilityRole="link" onPress={() => router.push('/termos')} style={{ color: colors.accent, textDecorationLine: 'underline' }}>
          Termos de uso
        </Text>, incluindo as regras para barbearias sobre os dados dos clientes.
      </Text>
      {testeUsado === null ? null : <Aviso texto={testeUsado
        ? 'Sua conta já usou os 60 dias grátis: a barbearia entra na busca depois de escolher um plano em Barbearia › Plano.'
        : `Você ganha ${DIAS_TESTE} dias grátis, contados a partir de hoje.`} />}
      <Aviso texto="Você entra como o primeiro barbeiro da casa. Horário inicial: terça a sexta 9h–19h (almoço 12h–13h) e sábado 9h–17h." />
      <ComoFuncionaOTeste visivel={explicar} testeUsado={!!testeUsado} aoVoltar={() => setExplicar(false)} aoCriar={salvar} />
    </>
  );
}

/** Popup antes de criar: o teste grátis (até quando, o que inclui) e o que acontece depois, em linguagem simples. */
function ComoFuncionaOTeste({ visivel, testeUsado, aoVoltar, aoCriar }: {
  visivel: boolean; testeUsado: boolean; aoVoltar: () => void; aoCriar: () => void;
}) {
  const hoje = dataLocal(Date.now());
  const ate = formatarData(somarDias(hoje, DIAS_TESTE), hoje);
  const maisBarato = formatarPreco(Math.min(...PLANOS.map(p => p.precoCentavos)));
  const itens: [keyof typeof Ionicons.glyphMap, string][] = testeUsado ? [
    ['information-circle-outline', `Esta conta já usou os ${DIAS_TESTE} dias grátis, então a sua barbearia começa como rascunho. Você monta tudo com calma, e os clientes passam a te encontrar assim que você escolher um plano.`],
    ['card-outline', `Os planos começam em ${maisBarato} por mês e ficam em Barbearia › Plano.`],
  ] : [
    ['gift-outline', `Você usa o Navalha à vontade até ${ate}, sem cartão e sem pagar nada.`],
    ['people-outline', `Está tudo liberado: agenda, clube de assinatura, avisos e até ${LIMITE_TESTE} barbeiros na sua equipe.`],
    ['search-outline', 'Seus clientes te acham na busca assim que você publicar a barbearia. Para isso, só falta uma foto de capa e pelo menos um corte no cardápio.'],
    ['notifications-outline', `Faltando ${DIAS_AVISO} dias para acabar, a gente te avisa aqui no app.`],
    ['card-outline', `Gostou? É só escolher um plano em Barbearia › Plano, a partir de ${maisBarato} por mês. Nada é cobrado sem você escolher.`],
    ['time-outline', `Se precisar de mais um tempinho, você ainda tem ${DIAS_REGULARIZAR} dias depois do fim. Passou disso, a barbearia sai da busca até você assinar, mas nada do que você cadastrou se perde.`],
  ];
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoVoltar}>
      {/* Rola em celular pequeno: o texto não pode cortar os botões. */}
      <ScrollView style={{ backgroundColor: sobreFoto.veu }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space(5) }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space(5), gap: space(4),
          borderWidth: 1, borderColor: colors.border, width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Titulo>{testeUsado ? 'Antes de criar' : `Seus ${DIAS_TESTE} dias grátis começam agora`}</Titulo>
          {itens.map(([icone, texto]) => (
            <View key={texto} style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
              <Ionicons name={icone} size={20} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>{texto}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={aoVoltar} />
            <Botao titulo={testeUsado ? 'Criar' : 'Começar grátis'} style={{ flex: 1 }} onPress={aoCriar} />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
