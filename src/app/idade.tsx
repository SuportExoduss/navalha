// Idade mínima: antes de usar o app (inclusive quem já tinha conta), a pessoa informa a data de nascimento.
// Maior de idade: grava só que se declarou maior (e quando). Menor: a conta e os dados são apagados e o login sai.
import { useState } from 'react';
import { Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Aviso, Botao, Campo, Tela, Titulo } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../services/firebase';
import { sairDoGoogle } from '../services/googleSignIn';
import { atualizarPerfil, excluirMenor } from '../services/usuarios';
import { idade, lerDataBR, mascaraData } from '../lib/idade';
import { CONTATO, IDADE_MINIMA } from '../lib/legal';
import { type } from '../theme';

export default function Idade() {
  const { user, perfil } = useAuth();
  const [data, setData] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  if (!user && !bloqueado) return <Redirect href="/entrar" />;
  if (perfil?.maiorDeIdadeEm) return <Redirect href="/" />;

  async function confirmar() {
    const agora = Date.now();
    const nascimento = lerDataBR(data, agora);
    if (!nascimento) { setErro('Digite uma data válida, no formato DD/MM/AAAA.'); return; }
    if (!user || !perfil) return;
    setErro(null);
    setSalvando(true);
    try {
      if (idade(nascimento, agora) >= IDADE_MINIMA) {
        await atualizarPerfil(db, user.uid, { maiorDeIdadeEm: agora });
        router.replace('/');
        return;
      }
      // Menor de idade: não fica nada (perfil, horários, avaliação), mesmo se o servidor falhar (excluirMenor).
      setBloqueado(true);
      await excluirMenor(db, user, perfil.barbearias);
      await sairDoGoogle().catch(() => undefined);
    } catch {
      setErro('Não foi possível confirmar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (bloqueado) {
    return (
      <Tela>
        <Titulo>O Navalha é só para maiores de {IDADE_MINIMA} anos</Titulo>
        <Text style={type.body}>
          Os seus dados foram apagados e você saiu da conta. Para marcar o seu corte, peça a um responsável maior de idade.
          Dúvidas: {CONTATO}.
        </Text>
        <Botao titulo="Voltar ao início" variante="secundario" onPress={() => router.replace('/entrar')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo destaque="nascimento">Sua data de </Titulo>
      <Text style={type.body}>
        O Navalha é para maiores de {IDADE_MINIMA} anos. A data serve só para conferir a idade: não guardamos a data, só que
        você é maior de idade.
      </Text>
      <Campo rotulo="Data de nascimento" value={data} onChangeText={t => setData(mascaraData(t))} placeholder="DD/MM/AAAA"
        keyboardType="number-pad" maxLength={10} accessibilityLabel="Data de nascimento, no formato dia, mês e ano" />
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <Botao titulo="Continuar" onPress={confirmar} carregando={salvando} disabled={data.length < 10} />
    </Tela>
  );
}
