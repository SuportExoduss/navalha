// Ficha do barbeiro (Barbearia › Equipe): foto e capa (o dono pode trocar), nome, apelido e telefone.
// O dono abre a de qualquer um; o barbeiro, só a própria. O telefone vem da parte privada (equipePrivado).
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Cartao, Carregando, Tela, Titulo } from '../../components/ui';
import { Capa } from '../../components/Capa';
import { useMinhaBarbearia } from '../../hooks/useMinhaBarbearia';
import { db } from '../../services/firebase';
import { atualizarCartaoBarbeiro, ouvirEquipePrivado, type EquipePrivado } from '../../services/barbearias';
import { escolherEEnviar } from '../../services/fotos';
import { colors, radius, space, type } from '../../theme';

export default function FichaBarbeiro() {
  const { uid: alvo } = useLocalSearchParams<{ uid: string }>();
  const { barbearia, equipe, carregando, ehDono, uid } = useMinhaBarbearia();
  const [privado, setPrivado] = useState<EquipePrivado | null>(null);
  const [enviando, setEnviando] = useState<'foto' | 'capa' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pode = ehDono || alvo === uid;

  useEffect(() => {
    if (!barbearia || !alvo || !pode) return;
    return ouvirEquipePrivado(db, barbearia.id, alvo, setPrivado);
  }, [barbearia?.id, alvo, pode]);

  if (carregando) return <Carregando />;
  const m = equipe.find(e => e.uid === alvo);
  if (!barbearia || !m || !pode) {
    return <Tela><Voltar /><Titulo>Barbeiro não encontrado</Titulo><Aviso texto="Ele pode ter saído da equipe." /></Tela>;
  }

  async function trocar(qual: 'foto' | 'capa') {
    setErro(null);
    setEnviando(qual);
    try {
      const url = await escolherEEnviar(qual === 'foto' ? 'perfil' : 'banner', m!.uid, 'galeria', qual === 'foto' ? [1, 1] : [3, 1]);
      if (url) await atualizarCartaoBarbeiro(db, barbearia!.id, m!.uid, qual === 'foto' ? { fotoUrl: url } : { bannerUrl: url });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.'); }
    finally { setEnviando(null); }
  }

  const tel = privado?.telefone;

  return (
    <Tela>
      <Voltar />
      <Capa url={m.bannerUrl} onTrocar={() => trocar('capa')} enviando={enviando === 'capa'} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space(4), marginTop: -space(10), paddingHorizontal: space(3) }}>
        <Pressable onPress={() => trocar('foto')} disabled={!!enviando} accessibilityRole="button" accessibilityLabel={`Trocar foto de ${m.nome}`}>
          {m.fotoUrl
            ? <Image source={{ uri: m.fotoUrl }} style={{ width: 72, height: 72, borderRadius: radius.chip, borderWidth: 3, borderColor: colors.bg }} />
            : <View style={{ width: 72, height: 72, borderRadius: radius.chip, borderWidth: 3, borderColor: colors.bg, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-outline" size={28} color={colors.textMuted} />
              </View>}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: radius.chip, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={enviando === 'foto' ? 'hourglass-outline' : 'camera'} size={13} color={colors.accentText} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Titulo>{m.apelido || m.nome.split(' ')[0]}</Titulo>
        </View>
      </View>
      {erro ? <Aviso texto={erro} tom="erro" /> : null}

      <Cartao style={{ gap: space(3) }}>
        <Linha rotulo="Nome" valor={m.nome} />
        <Linha rotulo="Apelido" valor={m.apelido || '—'} />
        <Linha rotulo="Telefone" valor={tel ? formatarTelefone(tel) : 'Não informado'} />
        {!m.ativo ? <Text style={type.caption}>Desligado da agenda: não recebe novos horários.</Text> : null}
      </Cartao>
      {tel ? <Botao titulo="Chamar no WhatsApp" variante="secundario" onPress={() => Linking.openURL(`https://wa.me/55${tel}`)}
        icone={<Ionicons name="logo-whatsapp" size={18} color={colors.text} />} /> : null}
      {!tel && alvo === uid ? <Aviso texto="Seu telefone ainda não está aqui: salve o WhatsApp em Perfil para o dono poder falar com você." /> : null}

    </Tela>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(3) }}>
      <Text style={type.caption}>{rotulo}</Text>
      <Text style={[type.body, { flexShrink: 1, textAlign: 'right' }]}>{valor}</Text>
    </View>
  );
}

/** "15999990000" → "(15) 99999-0000". */
function formatarTelefone(t: string) {
  const d = t.replace(/\D/g, '');
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : t;
}

function Voltar() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/casa'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}
