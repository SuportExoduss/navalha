// Termos de uso (públicos): regras para clientes e, em especial, para as barbearias, que veem dados dos clientes.
// Aceitos ao entrar (entrar.tsx) e ao criar a barbearia (CriarBarbearia.tsx).
import { Documento, Item, Link, Paragrafo, Topico } from '../components/Documento';
import { CONTATO, IDADE_MINIMA, MARCA, RESPONSAVEL, VIGENCIA } from '../lib/legal';

export default function Termos() {
  const email = <Link href={`mailto:${CONTATO}`}>{CONTATO}</Link>;
  return (
    <Documento titulo="Termos de uso" resumo={`Regras para usar o Navalha. Em vigor desde ${VIGENCIA}.`}>
      <Topico titulo="O serviço">
        <Paragrafo>
          O Navalha, mantido sob a marca {MARCA} por {RESPONSAVEL}, liga clientes a barbearias para marcar horário. O corte, o
          preço e o atendimento são de responsabilidade de cada barbearia; o Navalha não presta o serviço de barbearia nem
          recebe o pagamento do corte.
        </Paragrafo>
      </Topico>

      <Topico titulo="Conta">
        <Item>Para usar é preciso ter {IDADE_MINIMA} anos ou mais: o app pede a data de nascimento no primeiro acesso e não libera
          o login de menores. Menores de idade marcam pela conta de um responsável.</Item>
        <Item>A conta é pessoal e entra com o Google. Você responde pelo que é feito nela.</Item>
        <Item>Use dados verdadeiros. Você pode excluir a conta a qualquer momento pelo Perfil.</Item>
      </Topico>

      <Topico titulo="Para clientes">
        <Item>Marque só horários em que você pretende ir e cancele pelo app se não puder; a barbearia vê as faltas.</Item>
        <Item>Avalie só atendimentos reais. Podemos retirar avaliações feitas para inflar ou derrubar a nota de uma barbearia.</Item>
      </Topico>

      <Topico titulo="Para barbearias (donos e barbeiros)">
        <Item>Cadastre só a barbearia de que você é dono ou que tem autorização para representar, com dados verdadeiros.</Item>
        <Item>Fotos, textos e preços publicados devem ser seus ou autorizados. Não publique fotos de clientes sem a autorização deles.</Item>
        <Item forte="WhatsApp dos clientes:">aparece para a barbearia só quando o cliente marca um horário com ela, e só
          para avisar de atraso ou mudança e lembrar do corte. Some do app 24 horas depois do horário. Não é permitido guardar o
          número em outra lista, usar para propaganda ou passar para outra pessoa. As mensagens saem do seu número, e você
          responde por elas.</Item>
        <Item forte="Outros dados dos clientes:">o nome e os horários servem só para atender. É proibido vender, repassar ou
          copiar esses dados para fora do app.</Item>
        <Item>Pedidos de clientes sobre os dados deles (acesso, correção, exclusão) devem ser encaminhados para {email}.</Item>
        <Item>Se perceber acesso indevido à conta da barbearia ou vazamento de dados de clientes, avise na hora pelo e-mail.</Item>
        <Item>A assinatura é cobrada pelo Google Play, nas condições do plano escolhido. Sem assinatura ativa, a barbearia sai
          da busca até regularizar.</Item>
        <Item>O dono responde pela equipe que convida. Barbeiro desligado ou que sai da equipe perde na hora o acesso à agenda
          e aos dados dos clientes da casa.</Item>
      </Topico>

      <Topico titulo="O que não é permitido">
        <Item>Tentar acessar dados de outras pessoas, burlar as regras do app ou sobrecarregar o serviço.</Item>
        <Item>Usar o app para golpe, spam ou conteúdo ilegal.</Item>
        <Paragrafo>Quem quebrar estas regras pode ter a conta ou a barbearia suspensa ou removida.</Paragrafo>
      </Topico>

      <Topico titulo="Limites">
        <Paragrafo>
          Fazemos o possível para o app funcionar sempre, mas ele pode ter falhas ou ficar fora do ar. Confira o horário no
          app e, em caso de dúvida, fale com a barbearia. O Navalha não responde por atendimento, atraso, preço ou resultado do corte.
        </Paragrafo>
      </Topico>

      <Topico titulo="Dados pessoais e mudanças">
        <Paragrafo>
          Como tratamos os dados está na <Link href="/privacidade">Política de privacidade</Link>. Quando estes termos mudarem
          em algo importante, avisaremos no app. Dúvidas: {email}. Vale a lei brasileira.
        </Paragrafo>
      </Topico>
    </Documento>
  );
}
