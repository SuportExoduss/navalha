// Aba "Barbearia": cadastro (dono), entrada por convite (barbeiro) ou painel da casa.
import { useState } from 'react';
import { Aviso, Carregando, Tela } from '../../components/ui';
import { CriarBarbearia } from '../../components/casa/CriarBarbearia';
import { AceitarConvite } from '../../components/casa/AceitarConvite';
import { PainelCasa } from '../../components/casa/PainelCasa';
import { useAuth } from '../../auth/AuthProvider';
import { useMinhaBarbearia } from '../../hooks/useMinhaBarbearia';
import { dataLocal, formatarData } from '../../lib/agenda';

export default function Casa() {
  const { perfil } = useAuth();
  const { barbearia, equipe, carregando, ehDono } = useMinhaBarbearia();
  // Criando: o formulário fica (botão girando) até o servidor confirmar; depois o painel abre com o aviso.
  const [criacao, setCriacao] = useState<'conferindo' | 'criada' | 'falhou' | null>(null);
  if (!perfil || (carregando && criacao !== 'conferindo')) return <Carregando />;
  const formulario = perfil.papelAtivo === 'dono' && (!barbearia || criacao === 'conferindo');
  return (
    <Tela>
      {formulario ? <CriarBarbearia perfil={perfil} aoCriar={setCriacao} />
        : barbearia ? (
          <>
            {criacao === 'criada' ? <Aviso tom="ok" texto={barbearia.assinatura.status === 'teste' && barbearia.assinatura.venceEm
              ? `Barbearia criada. Dados atualizados. Seus 60 dias grátis vão até ${formatarData(dataLocal(barbearia.assinatura.venceEm), dataLocal(Date.now()))}.`
              : 'Barbearia criada. Dados atualizados.'} /> : null}
            <PainelCasa b={barbearia} equipe={equipe} ehDono={ehDono} uid={perfil.uid} />
          </>
        )
        : <AceitarConvite perfil={perfil} />}
    </Tela>
  );
}
