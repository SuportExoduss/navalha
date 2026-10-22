// "Lembrar no WhatsApp": só o barbeiro do horário, para horário futuro e cliente com WhatsApp no perfil. Abre o
// WhatsApp do próprio barbeiro com a mensagem pronta (saudação, dia e horário, link do Navalha). Sem API paga.
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { lerAgendamento } from '../../services/agendamentos';
import { linkWhatsapp, mensagemLembreteCliente } from '../../lib/lembreteWhatsapp';
import { colors, radius, space, type } from '../../theme';
import type { Agendamento } from '../../types/models';

const DE_PE = ['reservado', 'confirmado'];

export function podeLembrar(a: Pick<Agendamento, 'status' | 'barbeiroId' | 'inicio' | 'clienteTelefone'>, uid: string, agora = Date.now()) {
  return DE_PE.includes(a.status) && a.barbeiroId === uid && a.inicio > agora && !!a.clienteTelefone;
}

function abrir(a: Agendamento) {
  Linking.openURL(linkWhatsapp(a.clienteTelefone!, mensagemLembreteCliente(a, Date.now())));
}

/** No card da agenda: o agendamento já está na tela. */
export function LembrarNoWhatsapp({ a, uid }: { a: Agendamento; uid: string }) {
  if (!podeLembrar(a, uid)) return null;
  return <BotaoLembrar onPress={() => abrir(a)} />;
}

/** Na notificação "Novo horário marcado": lê o agendamento só ao tocar (1 leitura). */
export function LembrarPelaNotificacao({ agendamentoId, uid }: { agendamentoId: string; uid: string }) {
  const [aviso, setAviso] = useState<string | null>(null);
  async function tocar() {
    setAviso(null);
    const a = await lerAgendamento(db, agendamentoId).catch(() => null);
    if (a && podeLembrar(a, uid)) return abrir(a);
    setAviso(!a || !DE_PE.includes(a.status) ? 'Este horário não está mais marcado.'
      : a.inicio <= Date.now() ? 'Este horário já passou.' : 'O cliente não informou o WhatsApp no perfil.');
  }
  return (
    <View style={{ gap: space(1) }}>
      <BotaoLembrar onPress={tocar} />
      {aviso ? <Text style={type.caption}>{aviso}</Text> : null}
    </View>
  );
}

function BotaoLembrar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Lembrar o cliente no WhatsApp"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(2), alignSelf: 'flex-start', minHeight: 44,
        paddingHorizontal: space(4), borderRadius: radius.chip, borderWidth: 1, borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface })}>
      <Ionicons name="logo-whatsapp" size={18} color={colors.text} />
      <Text style={type.body}>Lembrar no WhatsApp</Text>
    </Pressable>
  );
}
