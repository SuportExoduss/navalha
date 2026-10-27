import { useState } from 'react';
import { Text } from 'react-native';
import { Aviso, Botao, Campo, Cartao, Titulo } from '../ui';
import { aceitarConvite } from '../../services/barbearias';
import { db } from '../../services/firebase';
import { space, type } from '../../theme';
import type { UserProfile } from '../../types/models';

/** `compacto`: dentro do Perfil, sem o título grande; `aoEntrar` roda depois de entrar na casa. */
export function AceitarConvite({ perfil, compacto, aoEntrar }: { perfil: UserProfile; compacto?: boolean; aoEntrar?: () => Promise<void> | void }) {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    setEnviando(true);
    try {
      await aceitarConvite(db, codigo, { uid: perfil.uid, nome: perfil.apelido || perfil.nome, fotoUrl: perfil.fotoUrl, telefone: perfil.telefone });
      await aoEntrar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar na barbearia.');
      setEnviando(false);
    }
  }

  return (
    <>
      {compacto ? null : <Titulo destaque="sua equipe.">{'Entre para\n'}</Titulo>}
      {compacto ? null : <Text style={type.caption}>Peça ao dono da barbearia o código de convite de 6 letras (válido por 7 dias).</Text>}
      <Cartao style={{ gap: space(4) }}>
        <Campo
          rotulo="Código do convite"
          value={codigo}
          onChangeText={t => setCodigo(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Ex.: K7M2QX"
          style={{ fontSize: 22, letterSpacing: 6, fontWeight: '600' }}
        />
        <Botao titulo="Entrar na barbearia" onPress={entrar} carregando={enviando} disabled={codigo.length !== 6} />
        {erro ? <Aviso texto={erro} tom="erro" /> : null}
      </Cartao>
    </>
  );
}
