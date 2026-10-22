// Endereço que não existe (link velho, digitado errado): página nossa, em português, no lugar da padrão do
// Expo Router (em inglês e com link para a lista de todas as telas).
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Botao, Tela, Titulo } from '../components/ui';
import { space, type } from '../theme';

export default function NaoEncontrada() {
  return (
    <Tela rolar={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space(4) }}>
        <Titulo destaque="não existe.">{'Esta página\n'}</Titulo>
        <Text style={type.caption}>O link pode estar errado ou ser antigo.</Text>
        <Botao titulo="Ir para o início" onPress={() => router.replace('/')} />
      </View>
    </Tela>
  );
}
