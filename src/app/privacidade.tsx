// Política de privacidade (pública, exigida pela Google Play e pela LGPD). Descreve só o que o app faz de fato;
// mudou a coleta de dados no código, mude aqui e a VIGENCIA em src/lib/legal.ts.
import { Documento, Item, Link, Paragrafo, Topico } from '../components/Documento';
import { CONTATO, PRAZO_RESPOSTA_DIAS, RESPONSAVEL, VIGENCIA } from '../lib/legal';

export default function Privacidade() {
  return (
    <Documento titulo="Política de privacidade" resumo={`Como o Navalha usa os seus dados. Em vigor desde ${VIGENCIA}.`}>
      <Topico titulo="Quem somos">
        <Paragrafo>
          O Navalha é um app de agendamento para barbearias, mantido pela {RESPONSAVEL}, responsável (controladora)
          pelos dados descritos aqui. Fale com a gente pelo e-mail <Link href={`mailto:${CONTATO}`}>{CONTATO}</Link>.
        </Paragrafo>
      </Topico>

      <Topico titulo="O que coletamos">
        <Item forte="Conta Google:">nome, e-mail, foto e um identificador da conta, recebidos quando você entra com o Google.</Item>
        <Item forte="Perfil:">apelido e WhatsApp, se você preencher.</Item>
        <Item forte="Localização:">a posição do celular, só com o app aberto e com a sua permissão, para mostrar barbearias perto
          de você. Não guardamos o seu trajeto. Quem cadastra uma barbearia grava a localização dela, que fica pública.</Item>
        <Item forte="Fotos:">as que você envia (perfil, capa e fotos da barbearia, cardápio) e a foto do corte que o barbeiro tira
          ao concluir o atendimento, que vai para o seu histórico.</Item>
        <Item forte="Agendamentos:">barbearia, barbeiro, serviço, preço, data, situação (marcado, concluído, faltou, cancelado) e o
          motivo do cancelamento escolhido na lista.</Item>
        <Item forte="Barbearia (para donos e barbeiros):">nome, endereço, telefone, Instagram, horários, equipe e cardápio.</Item>
        <Item forte="Assinatura da barbearia:">plano, situação e vencimento. O pagamento é feito e processado pelo Google Play;
          não vemos nem guardamos dados do seu cartão.</Item>
        <Item forte="Notificações:">um identificador do seu aparelho para enviar os lembretes do horário.</Item>
        <Item forte="Uso e erros:">registros de ações no app (por exemplo, "agendou" ou "cancelou") e de falhas técnicas,
          ligados ao identificador da sua conta, para melhorar o app e corrigir erros.</Item>
      </Topico>

      <Topico titulo="Para que usamos">
        <Item>Criar e manter a sua conta e entrar no app.</Item>
        <Item>Mostrar barbearias perto de você, marcar, lembrar e cancelar horários sem que dois clientes peguem o mesmo horário.</Item>
        <Item>Permitir que a barbearia organize a agenda, a equipe e o cardápio, e veja o resumo do próprio movimento.</Item>
        <Item>Cobrar e controlar a assinatura das barbearias.</Item>
        <Item>Garantir a segurança, evitar abuso e corrigir falhas.</Item>
        <Paragrafo>Não vendemos seus dados e não mostramos anúncios.</Paragrafo>
      </Topico>

      <Topico titulo="Quem vê os seus dados">
        <Item forte="A barbearia em que você marca:">o seu nome ou apelido, o horário, o serviço e, se você preencheu, o WhatsApp.</Item>
        <Item forte="Os clientes:">os dados públicos da barbearia (nome, endereço, horários, cardápio, fotos e equipe).</Item>
        <Item forte="Serviços que operam o app para nós:">Google Firebase (login, banco de dados, notificações e site),
          Cloudflare (armazenamento das fotos e servidor) e Google Play (pagamento das assinaturas). Eles tratam os dados
          só para prestar esse serviço.</Item>
        <Item forte="Autoridades:">quando a lei exigir.</Item>
      </Topico>

      <Topico titulo="Segurança e prazo de guarda">
        <Paragrafo>
          Os dados trafegam criptografados (HTTPS) e regras de acesso no servidor garantem que cada pessoa veja só o que
          é dela: o cliente vê os próprios agendamentos; a barbearia vê a própria agenda.
        </Paragrafo>
        <Paragrafo>
          Guardamos os dados enquanto a conta existir. Ao excluir a conta, seguimos o que está descrito em{' '}
          <Link href="/excluir-conta">Excluir conta e dados</Link>. Registros de compra podem ser mantidos pelo prazo que a lei exigir.
        </Paragrafo>
      </Topico>

      <Topico titulo="Seus direitos (LGPD)">
        <Paragrafo>
          Você pode confirmar se tratamos os seus dados, acessá-los, corrigi-los (a maioria direto no Perfil), pedir a
          exclusão, a portabilidade e informações sobre com quem compartilhamos, e retirar o consentimento da localização
          e das notificações nas configurações do celular. Peça pelo e-mail{' '}
          <Link href={`mailto:${CONTATO}`}>{CONTATO}</Link>; respondemos em até {PRAZO_RESPOSTA_DIAS} dias.
        </Paragrafo>
      </Topico>

      <Topico titulo="Idade mínima">
        <Paragrafo>O Navalha não é destinado a menores de 13 anos.</Paragrafo>
      </Topico>

      <Topico titulo="Mudanças nesta política">
        <Paragrafo>
          Quando mudarmos algo importante, avisaremos no app. A data no topo desta página mostra a versão em vigor.
        </Paragrafo>
      </Topico>
    </Documento>
  );
}
