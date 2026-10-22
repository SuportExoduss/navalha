// Sino (Agenda da casa, Início e Agendamentos do cliente) com bolinha quando há não lidas; abre um painel lateral (estilo menu hambúrguer)
// com os horários marcados, os cancelados e, no dia 1, o resumo do mês. Abrir o painel marca tudo como lido.
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { marcarLidas, ouvirNotificacoes } from '../../services/notificacoes';
import { quandoChegou, type Notificacao, type TipoNotificacao } from '../../lib/notificacoes';
import { colors, radius, space, type, sobreFoto } from '../../theme';

const ICONE: Record<TipoNotificacao, keyof typeof Ionicons.glyphMap> = {
  agendado: 'calendar-outline', cancelado: 'close-circle-outline', resumo_mes: 'stats-chart-outline',
};

export const VAZIO_CLIENTE = 'Se a barbearia cancelar ou mudar algo no seu horário, avisamos aqui e no celular.';
const VAZIO_CASA = 'Quando um cliente marcar ou cancelar, avisamos aqui e no celular. No dia 1 chega o resumo do mês.';

export function PainelNotificacoes({ uid, vazio = VAZIO_CASA }: { uid: string; vazio?: string }) {
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  // As que estavam não lidas quando o painel abriu continuam destacadas até fechar.
  const [novasAoAbrir, setNovasAoAbrir] = useState<Set<string>>(new Set());

  useEffect(() => ouvirNotificacoes(db, uid, setLista, () => setLista([])), [uid]);
  const naoLidas = lista.filter(n => !n.lida);

  function abrir() {
    setNovasAoAbrir(new Set(naoLidas.map(n => n.id)));
    setAberto(true);
    marcarLidas(db, naoLidas.map(n => n.id)).catch(() => undefined);
  }

  return (
    <>
      <Pressable onPress={abrir} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={naoLidas.length ? `Notificações, ${naoLidas.length} ${naoLidas.length === 1 ? 'nova' : 'novas'}` : 'Notificações'}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={naoLidas.length ? 'notifications' : 'notifications-outline'} size={24} color={naoLidas.length ? colors.accent : colors.text} />
        {/* Bolinha discreta; quantas são novas vai no rótulo de acessibilidade. */}
        {naoLidas.length ? (
          <View style={{ position: 'absolute', top: 9, right: 9, width: 10, height: 10, borderRadius: radius.chip,
            backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.bg }} />
        ) : null}
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1, backgroundColor: sobreFoto.veu }} onPress={() => setAberto(false)} accessibilityLabel="Fechar notificações" />
          <SafeAreaView accessibilityViewIsModal edges={['top', 'bottom', 'right']}
            style={{ width: '88%', maxWidth: 380, backgroundColor: colors.bg, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(4) }}>
              <Text accessibilityRole="header" style={type.title}>Notificações</Text>
              <Pressable onPress={() => setAberto(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar"
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {lista.length === 0 ? (
              <View style={{ padding: space(4), gap: space(2) }}>
                <Text style={type.body}>Nada por aqui ainda.</Text>
                <Text style={type.caption}>{vazio}</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(6), gap: space(2) }}>
                {lista.map(n => {
                  const nova = novasAoAbrir.has(n.id);
                  return (
                    <View key={n.id} style={{ flexDirection: 'row', gap: space(3), padding: space(3), borderRadius: radius.card,
                      backgroundColor: nova ? colors.surfaceRaised : colors.surface, borderWidth: 1, borderColor: nova ? colors.accent : colors.border }}>
                      <Ionicons name={ICONE[n.tipo]} size={20} color={n.tipo === 'cancelado' ? colors.danger : colors.accent} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
                          <Text style={[type.body, { fontWeight: '700', flexShrink: 1 }]}>{n.titulo}</Text>
                          <Text style={type.caption}>{quandoChegou(n.em, Date.now())}</Text>
                        </View>
                        <Text style={[type.caption, { color: colors.text, lineHeight: 20 }]}>{n.corpo}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
