// Aba "Barbearia": cadastro (dono), entrada por convite (barbeiro) ou painel da casa.
import { Carregando, Tela } from '../../components/ui';
import { CriarBarbearia } from '../../components/casa/CriarBarbearia';
import { AceitarConvite } from '../../components/casa/AceitarConvite';
import { PainelCasa } from '../../components/casa/PainelCasa';
import { useAuth } from '../../auth/AuthProvider';
import { useMinhaBarbearia } from '../../hooks/useMinhaBarbearia';

export default function Casa() {
  const { perfil } = useAuth();
  const { barbearia, equipe, carregando, ehDono } = useMinhaBarbearia();
  if (!perfil || carregando) return <Carregando />;
  return (
    <Tela>
      {barbearia
        ? <PainelCasa b={barbearia} equipe={equipe} ehDono={ehDono} uid={perfil.uid} />
        : perfil.papelAtivo === 'dono'
          ? <CriarBarbearia perfil={perfil} />
          : <AceitarConvite perfil={perfil} />}
    </Tela>
  );
}
