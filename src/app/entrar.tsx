// Entrar: foto da barbearia de fundo (vertical no celular, horizontal em tela larga, como a web no computador),
// com o "N" no alto da foto e o texto num véu escuro embaixo, legível nos dois temas.
import { useState } from 'react';
import { Image, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { IDADE_MINIMA } from '../lib/legal';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Cartao, Tela } from '../components/ui';
import { entrarComGoogle } from '../services/googleSignIn';
import { entrarComEmail } from '../services/acessoRevisao';
import { useAuth } from '../auth/AuthProvider';
import { colors, radius, space, sobreFoto, type } from '../theme';

const FOTO_VERTICAL = require('../../assets/login-vertical.jpg');
const FOTO_HORIZONTAL = require('../../assets/login-horizontal.jpg');

export default function Entrar() {
  const { user } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { width, height } = useWindowDimensions();
  if (user) return <Redirect href="/" />;
  const link = { color: sobreFoto.texto, fontWeight: '600' as const, textDecorationLine: 'underline' as const };

  async function entrar(como: () => Promise<void>) {
    setErro(null);
    setCarregando(true);
    try { await como(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível entrar. Tente de novo.'); }
    finally { setCarregando(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Imagem solta atrás (e não ImageBackground): na web ele deixa a foto impor a própria largura à página. */}
      <Image source={width > height ? FOTO_HORIZONTAL : FOTO_VERTICAL} resizeMode="cover" accessibilityIgnoresInvertColors
        style={{ position: 'absolute', top: 0, left: 0, width, height }} />
      {/* Sem rolagem: o cartão fica embaixo e o KeyboardAvoidingView da Tela o sobe quando o teclado abre (revisão). */}
      <Tela rolar={false} transparente>
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 440, gap: space(5), padding: space(5), borderRadius: radius.card, backgroundColor: sobreFoto.veu }}>
            <View style={{ gap: space(2) }}>
              <Text style={[type.caption, { letterSpacing: 4, color: sobreFoto.texto }]}>NAVALHA</Text>
              <Text accessibilityRole="header" style={[type.title, { color: sobreFoto.texto }]}>
                Seu próximo corte, <Text style={{ color: sobreFoto.destaque }}>em 3 passos.</Text>
              </Text>
              <Text style={[type.caption, { color: sobreFoto.texto }]}>Barbearias perto de você, corte escolhido pela foto e horário garantido.</Text>
            </View>
            <Botao
              titulo="Continuar com Google"
              onPress={() => entrar(entrarComGoogle)}
              carregando={carregando && !revisao}
              icone={<Ionicons name="logo-google" size={18} color={colors.accentText} />}
            />
            {erro ? <Aviso texto={erro} tom="erro" /> : null}
            <Text style={[type.caption, { textAlign: 'center', color: sobreFoto.texto }]}>
              Ao continuar você confirma ter {IDADE_MINIMA} anos ou mais e aceita os{' '}
              <Text accessibilityRole="link" onPress={() => router.push('/termos')} style={link}>Termos de uso</Text> e a{' '}
              <Text accessibilityRole="link" onPress={() => router.push('/privacidade')} style={link}>Política de privacidade</Text>.
            </Text>

            {/* Para os revisores das lojas: conta de demonstração com e-mail e senha (não há cadastro aqui). */}
            {revisao ? (
              <Cartao style={{ gap: space(3) }}>
                <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="password" />
                <Botao titulo="Entrar" variante="secundario" carregando={carregando} disabled={!email.trim() || !senha}
                  onPress={() => entrar(() => entrarComEmail(email, senha))} />
              </Cartao>
            ) : (
              <Pressable onPress={() => { setErro(null); setRevisao(true); }} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
                <Text style={[type.caption, { color: sobreFoto.texto, opacity: 0.8 }]}>Acesso para revisão</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Tela>
    </View>
  );
}
