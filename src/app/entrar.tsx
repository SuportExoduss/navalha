import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Botao, Tela, Titulo } from '../components/ui';
import { entrarComGoogle } from '../services/googleSignIn';
import { useAuth } from '../auth/AuthProvider';
import { colors, space, type } from '../theme';

export default function Entrar() {
  const { user } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (user) return <Redirect href="/" />;

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try { await entrarComGoogle(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível entrar. Tente de novo.'); }
    finally { setCarregando(false); }
  }

  return (
    <Tela rolar={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space(6) }}>
        <View style={{ gap: space(2) }}>
          <Text style={[type.caption, { letterSpacing: 4, color: colors.accent }]}>NAVALHA</Text>
          <Titulo destaque="em 3 toques.">Seu próximo corte, </Titulo>
          <Text style={type.caption}>Barbearias perto de você, corte escolhido pela foto e horário garantido.</Text>
        </View>
        <Botao
          titulo="Continuar com Google"
          onPress={entrar}
          carregando={carregando}
          icone={<Ionicons name="logo-google" size={18} color={colors.accentText} />}
        />
        {erro ? <Text style={[type.caption, { color: colors.danger }]}>{erro}</Text> : null}
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Ao continuar você aceita os Termos de Uso e a Política de Privacidade.
        </Text>
      </View>
    </Tela>
  );
}
