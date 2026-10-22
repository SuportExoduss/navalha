import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Campo, Tela, Titulo } from '../components/ui';
import { entrarComGoogle } from '../services/googleSignIn';
import { entrarComEmail } from '../services/acessoRevisao';
import { useAuth } from '../auth/AuthProvider';
import { colors, space, type } from '../theme';

export default function Entrar() {
  const { user } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  if (user) return <Redirect href="/" />;

  async function entrar(como: () => Promise<void>) {
    setErro(null);
    setCarregando(true);
    try { await como(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível entrar. Tente de novo.'); }
    finally { setCarregando(false); }
  }

  return (
    <Tela rolar={revisao}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space(6) }}>
        <View style={{ gap: space(2) }}>
          <Text style={[type.caption, { letterSpacing: 4, color: colors.accent }]}>NAVALHA</Text>
          <Titulo destaque="em 3 passos.">Seu próximo corte, </Titulo>
          <Text style={type.caption}>Barbearias perto de você, corte escolhido pela foto e horário garantido.</Text>
        </View>
        <Botao
          titulo="Continuar com Google"
          onPress={() => entrar(entrarComGoogle)}
          carregando={carregando && !revisao}
          icone={<Ionicons name="logo-google" size={18} color={colors.accentText} />}
        />
        {erro ? <Aviso texto={erro} tom="erro" /> : null}
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Ao continuar você aceita a{' '}
          <Text accessibilityRole="link" onPress={() => router.push('/privacidade')} style={{ color: colors.accent, textDecorationLine: 'underline' }}>
            Política de privacidade
          </Text>.
        </Text>

        {/* Para os revisores das lojas: conta de demonstração com e-mail e senha (não há cadastro aqui). */}
        {revisao ? (
          <View style={{ gap: space(3) }}>
            <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="password" />
            <Botao titulo="Entrar" variante="secundario" carregando={carregando} disabled={!email.trim() || !senha}
              onPress={() => entrar(() => entrarComEmail(email, senha))} />
          </View>
        ) : (
          <Pressable onPress={() => { setErro(null); setRevisao(true); }} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <Text style={[type.caption, { color: colors.textMuted }]}>Acesso para revisão</Text>
          </Pressable>
        )}
      </View>
    </Tela>
  );
}
