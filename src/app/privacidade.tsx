// Política de privacidade (pública, exigida pela Google Play e pela LGPD). Descreve só o que o app faz de fato;
// mudou a coleta de dados no código, mude aqui e a VIGENCIA em src/lib/legal.ts.
import { Documento, Item, Link, Paragrafo, Topico } from '../components/Documento';
import { CONTATO, IDADE_MINIMA, MARCA, PRAZO_RESPOSTA_DIAS, RESPONSAVEL, VIGENCIA } from '../lib/legal';

export default function Privacidade() {
  const email = <Link href={`mailto:${CONTATO}`}>{CONTATO}</Link>;
  return (
    <Documento titulo="Política de privacidade" resumo={`Como o Navalha usa os seus dados. Versão 2, em vigor desde ${VIGENCIA}.`}>
      <Topico titulo="Resumo">
        <Item>Usamos os seus dados só para você marcar horário e para a barbearia organizar a agenda.</Item>
        <Item>Não vendemos dados, não mostramos anúncios e não usamos rastreamento de publicidade.</Item>
        <Item>A barbearia vê o seu nome, o horário e, se você informou, o seu WhatsApp. Ninguém mais vê os seus agendamentos.</Item>
        <Item>Nada seu fica público: se você avaliar uma barbearia, só as estrelas entram na média dela, sem o seu nome.</Item>
        <Item>Você exclui a conta pelo Perfil, na hora.</Item>
      </Topico>

      <Topico titulo="Quem somos e como falar com a gente">
        <Paragrafo>
          O Navalha é um app de agendamento para barbearias, mantido sob a marca {MARCA} por {RESPONSAVEL}, pessoa física,
          responsável (controlador) pelos dados descritos aqui. Ele também atende como encarregado pela proteção de dados:
          qualquer pedido ou dúvida sobre os seus dados vai para {email}.
        </Paragrafo>
      </Topico>

      <Topico titulo="Quais dados usamos, para quê e com que base legal">
        <Item forte="Conta Google:">nome, e-mail, foto e um identificador da conta, recebidos quando você entra com o Google.
          Servem para criar a sua conta e entrar no app. Base: execução do contrato (LGPD, art. 7º, V).</Item>
        <Item forte="Perfil:">apelido, capa e WhatsApp, só se você preencher. O WhatsApp serve para a barbearia falar com você
          sobre os seus horários, inclusive pelo botão "Lembrar no WhatsApp", que abre o WhatsApp do barbeiro com uma mensagem
          pronta; quem envia é o barbeiro, e o Navalha não manda mensagens. Base: execução do contrato.</Item>
        <Item forte="Localização:">a posição do celular, só com o app aberto e com a sua permissão, para mostrar barbearias perto
          de você. Não guardamos o seu trajeto nem a sua posição. Quem cadastra uma barbearia grava a localização dela, que
          fica pública. Base: consentimento (art. 7º, I), que você retira nas configurações do celular.</Item>
        <Item forte="Agendamentos:">barbearia, barbeiro, serviço, preço, data e hora, situação (marcado, confirmado, concluído,
          faltou, cancelado) e o motivo do cancelamento escolhido na lista. Servem para marcar, lembrar e cancelar sem que dois
          clientes peguem o mesmo horário, e para a barbearia ver o próprio movimento. Base: execução do contrato.</Item>
        <Item forte="Avaliação da barbearia:">se você quiser avaliar, as estrelas (1 a 5). É uma por barbearia; avaliar de
          novo substitui a anterior. Não é pública: entra só na média de estrelas da barbearia, e ninguém (nem a barbearia) vê
          quem avaliou nem quantas avaliações ela tem. Base: consentimento, porque avaliar é opcional; você pode pedir para
          retirar a avaliação pelo e-mail.</Item>
        <Item forte="Barbearia, para donos e barbeiros:">nome, endereço, localização, WhatsApp, Instagram, horários, equipe,
          cardápio e fotos, públicos para quem procura barbearia. O telefone pessoal do barbeiro fica fora do cartão público:
          só o dono e o próprio barbeiro veem. Base: execução do contrato.</Item>
        <Item forte="Assinatura da barbearia:">plano, situação, vencimento e se a conta já usou o teste grátis. O pagamento é feito
          e processado pelo Google Play; não vemos nem guardamos dados do cartão. Base: execução do contrato e cumprimento de
          obrigação legal (art. 7º, II) para os registros de compra.</Item>
        <Item forte="Notificações:">um identificador do aparelho para enviar lembretes e avisos de horário marcado ou cancelado,
          e os avisos do sino dentro do app. Base: consentimento, que você retira nas configurações do celular.</Item>
        <Item forte="Uso e erros:">registros de ações no app (por exemplo, "agendou" ou "cancelou") e de falhas técnicas
          (mensagem do erro, tela, sistema e versão do app), ligados ao identificador da conta. Servem para corrigir erros,
          entender o uso e evitar abuso. Base: legítimo interesse (art. 7º, IX), sem uso para publicidade.</Item>
        <Paragrafo>
          Não coletamos dados sensíveis (saúde, religião, biometria etc.) e não tomamos decisões automáticas sobre você. Não
          avaliamos clientes.
        </Paragrafo>
      </Topico>

      <Topico titulo="Quem vê os seus dados">
        <Item forte="A barbearia em que você marca:">o seu nome ou apelido, o horário, o serviço
          e, se você preencheu, o WhatsApp. Ela só pode usar esses dados para atender você (regra dos Termos de uso).</Item>
        <Item forte="Qualquer pessoa:">só os dados públicos das barbearias, com a média de estrelas delas. Nenhum dado
          seu é público.</Item>
        <Item forte="Serviços que operam o app para nós:">Google Firebase (login, banco de dados, notificações e site),
          Cloudflare (servidor do app e armazenamento das fotos) e Google Play (pagamento das assinaturas). Eles tratam os
          dados só para prestar esse serviço, sob os termos de proteção de dados de cada um.</Item>
        <Item forte="Autoridades:">quando a lei ou uma ordem judicial exigir.</Item>
      </Topico>

      <Topico titulo="Onde os dados ficam">
        <Paragrafo>
          O banco de dados fica no Brasil (Google Cloud em São Paulo). As fotos e o servidor do app ficam na rede da Cloudflare,
          e o login, as notificações e o Google Play podem processar dados em outros países. Essas transferências seguem as
          garantias contratuais dos termos de proteção de dados de cada serviço (LGPD, art. 33).
        </Paragrafo>
        <Paragrafo>
          No seu aparelho ficam a sessão de login, a preferência de tema e uma cópia temporária das páginas públicas das
          barbearias, para o app abrir mais rápido. Não usamos cookies de rastreamento.
        </Paragrafo>
      </Topico>

      <Topico titulo="Segurança, incidentes e prazo de guarda">
        <Paragrafo>
          Os dados trafegam criptografados (HTTPS), e regras de acesso no servidor garantem que cada pessoa veja só o que é
          dela: o cliente vê os próprios agendamentos; a barbearia vê a própria agenda; o barbeiro vê só os horários dele.
          Se um incidente de segurança puder causar risco ou dano relevante a você, avisamos você e a Autoridade Nacional de
          Proteção de Dados (ANPD) nos prazos da lei.
        </Paragrafo>
        <Paragrafo>
          Guardamos os dados enquanto a conta existir, menos os registros de uso e de erros (apagados após 12 meses) e os
          avisos do sino (apagados após 90 dias). Ao excluir a conta, seguimos o que está descrito em{' '}
          <Link href="/excluir-conta">Excluir conta e dados</Link>. Registros de compra podem ser mantidos pelo prazo que a lei exigir.
        </Paragrafo>
      </Topico>

      <Topico titulo="Seus direitos (LGPD, art. 18)">
        <Item>Confirmar se tratamos os seus dados e acessá-los.</Item>
        <Item>Corrigir dados incompletos ou errados (a maioria direto no Perfil).</Item>
        <Item>Pedir anonimização, bloqueio ou eliminação de dados desnecessários, e a portabilidade dos seus dados.</Item>
        <Item>Excluir a conta e os dados (pelo Perfil, na hora).</Item>
        <Item>Saber com quem compartilhamos e o que acontece se você não consentir: sem localização, notificações ou WhatsApp,
          o app funciona, só deixam de funcionar a busca por perto, os lembretes e o lembrete pelo WhatsApp.</Item>
        <Item>Retirar o consentimento e se opor a um tratamento feito por legítimo interesse.</Item>
        <Paragrafo>
          Peça pelo e-mail {email}; respondemos em até {PRAZO_RESPOSTA_DIAS} dias. Você também pode reclamar à ANPD em{' '}
          <Link href="https://www.gov.br/anpd">gov.br/anpd</Link>.
        </Paragrafo>
      </Topico>

      <Topico titulo="Idade mínima">
        <Paragrafo>
          O Navalha é para maiores de {IDADE_MINIMA} anos. Menores de idade marcam o corte pela conta de um responsável. Se você é
          responsável por um menor que criou conta, escreva para {email} e excluímos a conta.
        </Paragrafo>
      </Topico>

      <Topico titulo="Mudanças nesta política">
        <Paragrafo>
          Quando mudarmos algo importante (dados coletados, finalidades, compartilhamentos ou prazos), avisaremos no app antes
          de a nova versão valer. A data no topo mostra a versão em vigor. Veja também os <Link href="/termos">Termos de uso</Link>.
        </Paragrafo>
      </Topico>
    </Documento>
  );
}
