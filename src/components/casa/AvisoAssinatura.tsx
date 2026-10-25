// Assinatura na tela da casa: aviso de vencimento próximo e de regularização (só o dono) e a trava de barbearia
// bloqueada (todos da equipe). A regra está em src/lib/planos.ts (situacaoAssinatura); o servidor decide o bloqueio.
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Botao, Cartao, Titulo } from '../ui';
import { dataLocal, formatarData } from '../../lib/agenda';
import type { SituacaoAssinatura } from '../../lib/planos';
import { colors, space, type } from '../../theme';

const quando = (ate: number) => formatarData(dataLocal(ate), dataLocal(Date.now()));
const emDias = (d: number) => (d === 1 ? '1 dia' : `${d} dias`);

/** Faltando 7 dias ou menos (teste ou plano sem renovação), ou já vencida e dentro dos 5 dias. */
export function AvisoAssinatura({ s }: { s: SituacaoAssinatura }) {
  if (s.tipo !== 'vence_logo' && s.tipo !== 'regularizar') return null;
  const urgente = s.tipo === 'regularizar';
  return (
    <Cartao style={{ gap: space(3), borderColor: urgente ? colors.danger : colors.accent }}>
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Ionicons name={urgente ? 'alert-circle' : 'time-outline'} size={20} color={urgente ? colors.danger : colors.accent} />
        <Text accessibilityRole="alert" style={[type.heading, { flex: 1 }]}>
          {urgente ? `Regularize em ${emDias(s.dias)}` : `Seu acesso vence em ${emDias(s.dias)}`}
        </Text>
      </View>
      <Text style={type.caption}>
        {urgente
          ? `O plano venceu. Até ${quando(s.ate)} tudo continua funcionando; depois, a barbearia sai da busca e a agenda fica bloqueada até você assinar.`
          : `Vence em ${quando(s.ate)}. Escolha um plano para não parar: a renovação é automática pelo Google Play.`}
      </Text>
      <Botao titulo="Ver planos" onPress={() => router.push('/plano')} />
    </Cartao>
  );
}

/** Barbearia bloqueada: o dono vai para os planos; o barbeiro fala com o dono. */
export function BarbeariaBloqueada({ ehDono }: { ehDono: boolean }) {
  return (
    <View style={{ gap: space(4) }}>
      <Ionicons name="lock-closed-outline" size={36} color={colors.danger} />
      <Titulo>Barbearia bloqueada</Titulo>
      <Text style={type.body}>
        {ehDono
          ? 'O teste grátis ou o plano venceu e o prazo de 5 dias para regularizar acabou. A barbearia saiu da busca e não recebe novos horários. Assine um plano para liberar tudo na hora.'
          : 'O plano desta barbearia venceu e ela está bloqueada: não aparece na busca nem recebe horários. Fale com o dono para liberar.'}
      </Text>
      {ehDono ? (
        <>
          <Botao titulo="Escolher um plano" onPress={() => router.push('/plano')} />
          <Botao titulo="Configurações da barbearia" variante="secundario" onPress={() => router.push('/configuracoes')} />
        </>
      ) : null}
    </View>
  );
}
