// Perfil compartilhado por cliente e barbearia: foto, nome, apelido, telefone,
// modo ativo, aparência (tema), trocar conta Google e excluir a conta.
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Aviso, Botao, Cartao, Chip, Linha, Secao, Tela, Titulo } from './ui';
import { AceitarConvite } from './casa/AceitarConvite';
import { useAuth } from '../auth/AuthProvider';
import { auth, db } from '../services/firebase';
import { atualizarPerfil, escolherPapel, excluirConta } from '../services/usuarios';
import { reautenticarGoogle, sairDoGoogle } from '../services/googleSignIn';
import { escolherEEnviar } from '../services/fotos';
import { colors, radius, space, type, type PreferenciaTema } from '../theme';
import { useTema } from './TemaProvider';
import { ativarLembretesWeb, estadoLembretesWeb, type EstadoLembretesWeb } from '../services/push';
import type { Role } from '../types/models';

const NOMES: Record<Role, string> = { cliente: 'Cliente', barbeiro: 'Barbeiro', dono: 'Dono' };
const ORDEM_MODOS: Role[] = ['cliente', 'barbeiro', 'dono'];

export function PerfilConta() {
  const { perfil } = useAuth();
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setNome(perfil?.nome ?? ''); setApelido(perfil?.apelido ?? ''); setTelefone(perfil?.telefone ?? '');
  }, [perfil?.nome, perfil?.apelido, perfil?.telefone]);
  if (!perfil) return null;

  async function salvar() {
    setErro(null);
    const tel = telefone.replace(/\D/g, '');
    if (tel && (tel.length < 10 || tel.length > 11)) return setErro('Telefone com DDD, ex.: (15) 99999-0000.');
    setSalvando(true);
    try {
      await atualizarPerfil(db, perfil!.uid, { nome: nome.trim() || perfil!.nome, apelido: apelido.trim(), telefone: tel });
      setSalvo(true); setTimeout(() => setSalvo(false), 2000);
    } catch { setErro('Não foi possível salvar.'); }
    finally { setSalvando(false); }
  }

  async function trocarFoto() {
    setErro(null);
    setEnviandoFoto(true);
    try {
      const url = await escolherEEnviar('perfil', perfil!.uid, 'galeria', [1, 1]);
      if (url) await atualizarPerfil(db, perfil!.uid, { fotoUrl: url });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao enviar a foto.'); }
    finally { setEnviandoFoto(false); }
  }

  async function sair() { await sairDoGoogle(); router.replace('/entrar'); }

  const campo = { minHeight: 48, color: colors.text, fontSize: 15, backgroundColor: colors.surfaceRaised, borderRadius: radius.input, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.border };

  return (
    <Tela>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
        <Pressable onPress={trocarFoto} accessibilityRole="button" accessibilityLabel="Trocar foto de perfil">
          {perfil.fotoUrl
            ? <Image source={{ uri: perfil.fotoUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceRaised }} />}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={enviandoFoto ? 'hourglass-outline' : 'camera'} size={13} color={colors.accentText} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Titulo>{perfil.apelido || perfil.nome}</Titulo>
          <Text style={type.caption}>{perfil.email}</Text>
        </View>
      </View>

      <Cartao style={{ gap: space(3) }}>
        <Text style={type.heading}>Seus dados</Text>
        <Text style={type.caption}>Nome</Text>
        <TextInput value={nome} onChangeText={setNome} style={campo} />
        <Text style={type.caption}>Apelido (como o barbeiro vai te chamar)</Text>
        <TextInput value={apelido} onChangeText={setApelido} style={campo} placeholder="Ex.: Dedé" placeholderTextColor={colors.textMuted} />
        <Text style={type.caption}>WhatsApp (a barbearia usa só para falar sobre seus horários)</Text>
        <TextInput value={telefone} onChangeText={setTelefone} style={campo} keyboardType="phone-pad" placeholder="(15) 99999-0000" placeholderTextColor={colors.textMuted} />
        {erro ? <Aviso texto={erro} tom="erro" /> : null}
        <Botao titulo={salvo ? 'Salvo' : 'Salvar'} onPress={salvar} carregando={salvando} />
      </Cartao>

      <Modo />


      <SeletorTema />
      {Platform.OS === 'web' ? <LembretesWeb uid={perfil.uid} /> : null}

      <Botao titulo="Trocar conta Google" variante="secundario" onPress={sair} />
      <ExcluirConta />
    </Tela>
  );
}

/**
 * Troca de modo e entrada no lado da barbearia. Mostra só os modos que a conta tem de verdade
 * (barbeiro/dono só com barbearia). Sem barbearia: abrir uma ou entrar com o código de convite, aqui mesmo.
 */
function Modo() {
  const { perfil } = useAuth();
  const [codigoAberto, setCodigoAberto] = useState(false);
  const [trocando, setTrocando] = useState<Role | null>(null);
  if (!perfil) return null;
  const temCasa = perfil.barbearias.length > 0;
  // O modo atual sempre aparece: quem está como dono sem casa (ex.: acabou de excluí-la) precisa achar a volta para cliente.
  const modos = ORDEM_MODOS.filter(p => p === 'cliente' || p === perfil.papelAtivo || (temCasa && perfil.papeis.includes(p)));

  async function ir(p: Role, destino: '/inicio' | '/agenda' | '/casa') {
    setTrocando(p);
    try { await escolherPapel(db, perfil!, p); router.replace(destino); }
    finally { setTrocando(null); }
  }

  return (
    <>
      {modos.length > 1 ? (
        <Cartao style={{ gap: space(3) }}>
          <Text style={type.heading}>Modo</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
            {modos.map(p => (
              <Chip key={p} rotulo={trocando === p ? 'Trocando…' : NOMES[p]} ativo={perfil.papelAtivo === p}
                onPress={() => perfil.papelAtivo !== p && ir(p, p === 'cliente' ? '/inicio' : '/agenda')} />
            ))}
          </View>
        </Cartao>
      ) : null}
      {temCasa ? null : (
        <Secao titulo="Barbearia">
          <Linha icone="storefront-outline" titulo="Abrir uma barbearia" dica="Cadastre a casa, o cardápio e receba agendamentos"
            onPress={() => ir('dono', '/casa')} />
          <Linha icone="key-outline" titulo="Tenho um código de convite" dica="Para barbeiro entrar na equipe de uma casa"
            onPress={() => setCodigoAberto(a => !a)} />
          {codigoAberto ? <AceitarConvite perfil={perfil} compacto aoEntrar={() => ir('barbeiro', '/agenda')} /> : null}
        </Secao>
      )}
    </>
  );
}

/** Exclusão de conta dentro do app (LGPD; exigida pelo Google Play e pela App Store). */
function ExcluirConta() {
  const { perfil } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const dono = perfil?.papeis.includes('dono') && (perfil?.barbearias.length ?? 0) > 0;

  async function confirmar() {
    const user = auth.currentUser;
    if (!user) return;
    setErro(null);
    setExcluindo(true);
    try {
      await reautenticarGoogle(); // o Firebase exige login recente para apagar a conta
      await excluirConta(db, user);
      router.replace('/entrar');
    } catch (e) {
      setErro(e instanceof Error && /cancel|popup-closed/i.test(e.message) ? 'Exclusão cancelada.' : 'Não foi possível excluir agora. Tente de novo.');
      setExcluindo(false);
    }
  }

  if (!aberto) {
    return (
      <Pressable onPress={() => setAberto(true)} hitSlop={8} accessibilityRole="button">
        <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>Excluir minha conta</Text>
      </Pressable>
    );
  }
  return (
    <Cartao style={{ gap: space(3), borderColor: colors.danger }}>
      <Text style={type.heading}>Excluir conta</Text>
      <Text style={type.caption}>
        Seus horários futuros serão cancelados, seu nome sai do histórico das barbearias e seus dados de perfil são apagados.
        Isso não pode ser desfeito. Vamos pedir para você confirmar com o Google.
        {dono ? ' Sua barbearia continua no ar; para tirá-la, despublique antes na aba Barbearia.' : ''}
      </Text>
      {erro ? <Aviso texto={erro} tom="erro" /> : null}
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Botao titulo="Voltar" variante="secundario" style={{ flex: 1 }} onPress={() => setAberto(false)} />
        <Botao titulo="Excluir" style={{ flex: 1, backgroundColor: colors.danger }} carregando={excluindo} onPress={confirmar} />
      </View>
    </Cartao>
  );
}

const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { valor: 'sistema', rotulo: 'Seguir o celular', icone: 'phone-portrait-outline' },
  { valor: 'escuro', rotulo: 'Escuro', icone: 'moon-outline' },
  { valor: 'claro', rotulo: 'Claro', icone: 'sunny-outline' },
];

/** Aparência: três botões lado a lado; a escolha fica salva no aparelho. */
function SeletorTema() {
  const { preferencia, escolher } = useTema();
  return (
    <Cartao style={{ gap: space(3) }}>
      <Text style={type.heading}>Aparência</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space(2) }}>
        {OPCOES_TEMA.map(o => {
          const ativo = preferencia === o.valor;
          return (
            <Pressable
              key={o.valor} accessibilityRole="radio" accessibilityState={{ checked: ativo }} accessibilityLabel={`Tema: ${o.rotulo}`}
              onPress={() => !ativo && escolher(o.valor)}
              style={{ flex: 1, minHeight: 72, gap: space(1), alignItems: 'center', justifyContent: 'center', borderRadius: radius.card,
                borderWidth: 1, borderColor: ativo ? colors.accent : colors.border, backgroundColor: ativo ? colors.surfaceRaised : colors.surface }}
            >
              <Ionicons name={o.icone} size={22} color={ativo ? colors.accent : colors.textMuted} />
              <Text style={[type.caption, { textAlign: 'center' }, ativo && { color: colors.text, fontWeight: '600' }]}>{o.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </Cartao>
  );
}

const TEXTO_LEMBRETES: Record<EstadoLembretesWeb, string> = {
  ativo: 'Ativos neste aparelho: você recebe um aviso 24 h e 2 h antes do horário.',
  pedir: 'Receba um aviso 24 h e 2 h antes do seu horário.',
  negado: 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber os avisos.',
  instalar: 'No iPhone, os avisos só chegam com o Navalha na Tela de Início: toque em Compartilhar › Adicionar à Tela de Início e abra por lá.',
  indisponivel: 'Este navegador não recebe notificações. No celular, use o app ou adicione o Navalha à Tela de Início.',
};

/** Só na web: o pedido de permissão precisa de um toque (exigência do iPhone). */
function LembretesWeb({ uid }: { uid: string }) {
  const [estado, setEstado] = useState<EstadoLembretesWeb | null>(null);
  const [ativando, setAtivando] = useState(false);
  useEffect(() => { estadoLembretesWeb().then(setEstado).catch(() => setEstado('indisponivel')); }, []);
  if (!estado) return null;

  async function ativar() {
    setAtivando(true);
    try { const r = await ativarLembretesWeb(uid); setEstado(r === 'ativo' ? 'ativo' : r === 'negado' ? 'negado' : 'indisponivel'); }
    catch { setEstado('indisponivel'); }
    finally { setAtivando(false); }
  }

  return (
    <Cartao style={{ gap: space(3) }}>
      <Text style={type.heading}>Lembretes</Text>
      <Aviso texto={TEXTO_LEMBRETES[estado]} tom={estado === 'ativo' ? 'ok' : 'neutro'} />
      {estado === 'pedir' ? <Botao titulo="Ativar lembretes" carregando={ativando} onPress={ativar} /> : null}
    </Cartao>
  );
}