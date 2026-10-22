// Exclusão de conta e dados (pública): a Google Play exige um caminho fora do app, para quem já desinstalou.
// O que está escrito aqui tem que bater com excluirConta (src/services/usuarios.ts e worker/src/conta.ts).
import { Documento, Item, Link, Paragrafo, Topico } from '../components/Documento';
import { CONTATO, PRAZO_RESPOSTA_DIAS, RESPONSAVEL, SITE } from '../lib/legal';

export default function ExcluirConta() {
  const assunto = encodeURIComponent('Excluir minha conta do Navalha');
  return (
    <Documento titulo="Excluir conta e dados"
      resumo={`Como apagar a sua conta do Navalha (app da ${RESPONSAVEL}) e o que acontece com os seus dados.`}>
      <Topico titulo="Pelo app (na hora)">
        <Item>Abra o Navalha e vá em Perfil.</Item>
        <Item>Toque em "Excluir minha conta" e confirme com o Google.</Item>
      </Topico>

      <Topico titulo="Sem o app instalado">
        <Item>Pelo navegador: entre em <Link href={`${SITE}/entrar`}>{SITE.replace('https://', '')}</Link> com a mesma conta Google,
          vá em Perfil e toque em "Excluir minha conta".</Item>
        <Item>Ou por e-mail: escreva para <Link href={`mailto:${CONTATO}?subject=${assunto}`}>{CONTATO}</Link> a partir do e-mail
          da sua conta, com o assunto "Excluir minha conta do Navalha". Excluímos em até {PRAZO_RESPOSTA_DIAS} dias e avisamos por e-mail.</Item>
      </Topico>

      <Topico titulo="O que é apagado">
        <Item>Seu perfil: nome, apelido, e-mail, foto, capa, WhatsApp e o identificador de notificações.</Item>
        <Item>As fotos: do perfil, da capa e dos seus cortes.</Item>
        <Item>A nota que as barbearias deram a você e os avisos ligados aos seus horários.</Item>
        <Item>Seu acesso: a conta de login deixa de existir.</Item>
        <Item>Seus horários futuros são cancelados e liberados para outras pessoas.</Item>
        <Item>Se você atende numa barbearia (sem ser o dono): você sai da equipe, e o seu nome, foto e telefone somem do cartão.</Item>
      </Topico>

      <Topico titulo="O que fica, e por quê">
        <Item forte="Atendimentos que já aconteceram:">continuam no histórico da barbearia (data, serviço e preço), com o
          seu nome trocado por "Cliente removido".</Item>
        <Item forte="Avaliações:">as estrelas e os comentários continuam valendo na nota da barbearia e do barbeiro, mas sem o
          seu nome e sem a sua foto.</Item>
        <Item forte="Registros técnicos de uso e de erros:">ficam ligados só a um identificador que não leva mais a você.</Item>
        <Item forte="Dados de compra de assinatura:">pelo prazo que a lei exigir.</Item>
        <Item forte="Barbearia:">se você é dono, a barbearia não some junto com a conta. Exclua antes em Barbearia ›
          Configurações › Excluir barbearia, ou peça pelo e-mail.</Item>
        <Paragrafo>Quer apagar algum dado específico sem excluir a conta? Peça pelo mesmo e-mail.</Paragrafo>
      </Topico>

      <Paragrafo>Veja também a <Link href="/privacidade">Política de privacidade</Link>.</Paragrafo>
    </Documento>
  );
}
