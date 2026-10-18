// Cadastro da barbearia pelo dono. A localização vem do GPS do próprio
// celular, de dentro da barbearia — sem mapa nem API paga.
import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Cartao, Titulo } from '../ui';
import { criarBarbearia } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { colors, space, type } from '../../theme';
import type { UserProfile } from '../../types/models';

export function CriarBarbearia({ perfil }: { perfil: UserProfile }) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  async function salvar() {
    if (faltando.length || !coords) { setErro(`Falta preencher: ${faltando.join(', ')}.`); return; }
    setSalvando(true);
    setErro(null);
    try {
      await criarBarbearia(db, { uid: perfil.uid, nome: perfil.nome, fotoUrl: perfil.fotoUrl },
        { nome, endereco, cidade, lat: coords.lat, lng: coords.lng, telefone, instagram });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
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
      <Botao titulo="Criar barbearia" onPress={salvar} carregando={salvando} />
      <Aviso texto="Você entra como o primeiro barbeiro da casa. Horário inicial: terça a sexta 9h–19h (almoço 12h–13h) e sábado 9h–17h." />
    </>
  );
}
