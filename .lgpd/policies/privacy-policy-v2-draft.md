# Política de Privacidade — Navalha

> **RASCUNHO v2 — NÃO PUBLICAR.** Gerado em 22/out/2026 a partir da auditoria `/codelgpd` e do código em
> `ef15130`, para revisão do dono e de advogado de proteção de dados.
> - `[PENDENTE: …]` = informação que só o dono tem.
> - `[JURÍDICO: …]` = escolha que depende do advogado. As bases legais abaixo são **propostas**, não conclusões.
> - As notas para o advogado e o que mudou desde a v1 estão no fim do arquivo.
> - Depois de aprovado, o texto vai para `src/app/privacidade.tsx` e a data para `VIGENCIA` em `src/lib/legal.ts`.

**Versão**: 2.0 | **Em vigor desde**: [PENDENTE: data] | **Versão anterior**: 1.0 (20 de outubro de 2026)

## Resumo

- Usamos seus dados para você marcar horário em barbearias, para a barbearia organizar a agenda dela e para o app
  funcionar com segurança.
- A barbearia em que você marca vê seu nome (ou apelido), o horário, o serviço, o WhatsApp (se você preencheu) e a
  nota que as barbearias deram a você.
- Não vendemos seus dados e não mostramos anúncios.
- Usamos serviços do Google e da Cloudflare, que podem guardar dados fora do Brasil.
- Você pode ver, corrigir e apagar seus dados. A exclusão da conta é feita na hora, pelo próprio app.

---

## 1. Quem somos

O Navalha é um app de agendamento para barbearias, mantido sob a marca TrevoTec por:

- **Responsável (controlador)**: Andre Luiz R.P de Barros, pessoa física
- **Site**: https://navalha.web.app
- **Contato**: trevotecsuport@gmail.com

[JURÍDICO: a TrevoTec ainda não existe como empresa (sem CNPJ), então o controlador é o dono como pessoa física.
Conferir o que precisa ser publicado para identificá-lo (Art. 9º, III e IV): se o nome abreviado basta ou se deve ir
por extenso, e se é preciso endereço. O CPF não vai na política (não é exigido e expõe o dono a fraude). Quando houver CNPJ, trocar por razão social e CNPJ e avisar os usuários (mudança importante).]

[JURÍDICO: papel de cada um. A v1 diz que a TrevoTec é a controladora de todos os dados. Nas atividades das seções
3.4, 3.5, 3.7 e 3.8 quem decide é a barbearia (encaixe de balcão, avaliar o cliente, fotografar o corte, mandar
WhatsApp). Definir se ali a barbearia é controladora e a TrevoTec operadora, ou se as duas dividem a controladoria,
e reescrever esta seção e a seção 6.]

## 2. Encarregado pela proteção de dados

- **Nome**: [PENDENTE: pessoa ou empresa designada]
- **E-mail**: [PENDENTE: e-mail dedicado, ou manter trevotecsuport@gmail.com]

[JURÍDICO: se a TrevoTec for agente de tratamento de pequeno porte (Res. CD/ANPD nº 2/2022), a nomeação pode ser
dispensada, desde que exista um canal de contato. A recomendação é nomear mesmo assim (LGPD, Art. 41, §1º).]

## 3. Quais dados usamos, para quê e com que base

### 3.1 Conta e login
- **Dados**: nome, e-mail, foto e identificador da sua conta Google.
- **Para quê**: criar a sua conta, entrar no app e identificar você nas suas reservas.
- **Base legal proposta**: execução de contrato (Art. 7º, V).
- **Por quanto tempo**: enquanto a conta existir.

### 3.2 Perfil
- **Dados**: apelido, WhatsApp, foto e capa do perfil, se você preencher.
- **Para quê**: mostrar seu perfil e permitir que a barbearia fale com você sobre o horário marcado.
- **Base legal proposta**: execução de contrato (Art. 7º, V). Os campos são opcionais.
- **Por quanto tempo**: enquanto a conta existir ou até você apagar o campo.

### 3.3 Localização
- **Dados**: a posição do celular, só com o app aberto e só com a sua permissão.
- **Para quê**: mostrar barbearias perto de você. **Não guardamos a sua posição nem o seu trajeto.** O endereço
  aproximado é obtido pelo serviço de mapas do próprio celular.
- **Barbearias**: quem cadastra uma barbearia grava a localização dela, que fica pública.
- **Base legal proposta**: consentimento, pela permissão do celular (Art. 7º, I). Você retira a permissão quando
  quiser nas configurações do celular.

### 3.4 Agendamentos
- **Dados**: barbearia, barbeiro, serviço, preço, data e horário, situação (marcado, confirmado, concluído, faltou,
  cancelado), motivo do cancelamento e uma cópia do seu nome (ou apelido) e do seu WhatsApp no momento da reserva.
- **Para quê**: marcar, lembrar e cancelar horários sem que duas pessoas peguem o mesmo horário; dar à barbearia a
  agenda e o histórico de atendimentos dela.
- **Encaixe de balcão**: a barbearia pode anotar na agenda o nome de alguém que não usa o app.
- **Base legal proposta**: execução de contrato (Art. 7º, V).
- **Por quanto tempo**: [PENDENTE: prazo do histórico de atendimentos. Hoje não há prazo.] Se você excluir a conta,
  os atendimentos que já aconteceram ficam no histórico da barbearia com o nome trocado por "Cliente removido" e
  sem WhatsApp nem fotos.

### 3.5 Foto do corte
- **Dados**: a foto que o barbeiro tira ao concluir o atendimento.
- **Para quê**: guardar o resultado no seu histórico e no da barbearia.
- **Quem vê**: você e a barbearia. A foto não vai para nenhuma página pública.
- **Base legal proposta**: [JURÍDICO: execução de contrato ou consentimento. A foto pode mostrar o rosto.]
- **Por quanto tempo**: enquanto a conta existir. Ao excluir a conta, as fotos são apagadas.

### 3.6 Avaliações
São três tipos, um para cada direção:
- **Você avalia a barbearia**: estrelas e comentário. **É pública**: aparece na página da barbearia com o seu
  primeiro nome e o nome do barbeiro, e entra na nota e no ranking da barbearia.
- **Você avalia o barbeiro**: estrelas e comentário. Só a barbearia vê, além de você.
- **O barbeiro ou o dono avalia você**: estrelas e comentário. Você vê no Perfil (Minhas avaliações). A média das
  notas que você recebeu aparece para as barbearias quando você marca um horário, para ajudar a casa a se organizar
  (por exemplo, sabendo de faltas anteriores).
- **Base legal proposta**: legítimo interesse (Art. 7º, IX, e Art. 10) para a nota do cliente; execução de contrato
  para as avaliações que você faz. [JURÍDICO: avaliação de legítimo interesse (LIA) da nota do cliente; o direito
  de contestar uma avaliação recebida.]
- **Por quanto tempo**: [PENDENTE]. Ao excluir a conta, a sua nota é apagada e as avaliações ficam sem o seu nome
  e sem a sua foto (as estrelas continuam contando na nota da barbearia e do barbeiro).

### 3.7 Lembrete por WhatsApp
- **O que acontece**: o barbeiro do seu horário pode tocar em "Lembrar no WhatsApp", que abre o WhatsApp **dele**
  com uma mensagem pronta (seu primeiro nome, o dia e o horário). O envio é feito pelo barbeiro, pelo WhatsApp
  dele. O Navalha não manda mensagens nem usa a API do WhatsApp.
- **Só funciona** se você informou o WhatsApp no Perfil.
- [JURÍDICO: confirmar quem responde por essa mensagem (seção 1) e a base legal.]

### 3.8 Barbearias, donos e barbeiros
- **Dados da barbearia (públicos)**: nome, endereço e localização, telefone, Instagram, horários, cardápio, fotos,
  equipe e notas.
- **Barbeiro**: o cartão público mostra nome, apelido, foto, capa, especialidades e nota. O telefone do barbeiro e
  o motivo das folgas ficam visíveis só para o dono e para o próprio barbeiro.
- **Para quê**: mostrar a barbearia aos clientes e organizar a equipe.
- **Base legal proposta**: execução de contrato (Art. 7º, V).

### 3.9 Assinatura da barbearia
- **Dados**: plano, situação, vencimento e o código da compra no Google Play.
- **Pagamento**: feito e processado pelo Google Play. Não vemos nem guardamos dados do seu cartão.
- **Teste grátis**: guardamos uma marca de que a conta já usou os 60 dias grátis, para que o teste seja usado uma
  vez só.
- **Base legal proposta**: execução de contrato (Art. 7º, V); legítimo interesse para a marca do teste grátis
  (prevenção de fraude). [PENDENTE/JURÍDICO: prazo de guarda dos registros de compra (obrigação fiscal?).]

### 3.10 Notificações
- **Dados**: um identificador do aparelho para receber avisos e o texto dos avisos (por exemplo, "Ana: Degradê,
  amanhã às 15:00").
- **Para quê**: lembrar você do horário e avisar quando alguém marca ou cancela.
- **Base legal proposta**: execução de contrato (Art. 7º, V). Você desliga nas configurações do celular.
- **Por quanto tempo**: os avisos do sino são apagados depois de **90 dias**.

### 3.11 Uso e erros
- **Dados**: ações no app (por exemplo, "agendou", "cancelou", "viu a barbearia") e falhas técnicas, ligadas ao
  identificador da sua conta.
- **Para quê**: medir se o app funciona para clientes e barbearias e corrigir erros.
- **Base legal proposta**: legítimo interesse (Art. 7º, IX).
- **Por quanto tempo**: apagados depois de **12 meses**. Se você excluir a conta antes disso, ficam ligados só a um
  identificador que não leva mais a você.

### 3.12 Segurança e prevenção de abuso
- **Dados**: horário da sua última reserva, usado para impedir reservas falsas em série.
- **Base legal proposta**: legítimo interesse (Art. 7º, IX).

## 4. Como tratamos os dados

- Os dados ficam nos serviços da seção 5 e trafegam sempre criptografados (HTTPS).
- Regras de acesso no servidor garantem que cada pessoa veja só o que é dela: você vê os seus agendamentos; a
  barbearia vê a agenda dela; o barbeiro vê só os horários dele.
- No seu aparelho ficam a sua sessão de login, a preferência de tema e uma cópia temporária das páginas públicas
  das barbearias (para o app abrir mais rápido). Não usamos cookies de rastreamento nem ferramentas de anúncios.

## 5. Com quem compartilhamos

| Quem | Para quê | Onde |
|---|---|---|
| A barbearia em que você marca | sua agenda, histórico e avaliações (seções 3.4 a 3.7) | Brasil |
| Google Firebase (Google LLC) | login, banco de dados, notificações e site | [PENDENTE: região do Firestore] e outros países |
| Cloudflare | servidor do app e armazenamento das fotos | rede global |
| Google Play | cobrança das assinaturas das barbearias | outros países |
| Autoridades | quando a lei exigir | — |

O Google Places é consultado só para a nota pública da barbearia no Google; nenhum dado seu é enviado a ele.

Os serviços acima tratam os dados só para prestar o serviço ao Navalha. [PENDENTE: confirmar o aceite dos termos
de tratamento de dados do Firebase e da Cloudflare.]

## 6. Transferência internacional

Alguns dados são guardados ou processados fora do Brasil, nos servidores dos serviços da seção 5.
[JURÍDICO: hipótese do Art. 33 que cobre cada serviço (por exemplo, cláusulas-padrão da Res. CD/ANPD nº 19/2024)
e o texto final deste item.]

## 7. Seus direitos (LGPD, Art. 18)

Você pode:
- **confirmar** se tratamos seus dados e **acessá-los**;
- **corrigir** dados incompletos ou errados (a maioria direto no Perfil);
- pedir **anonimização, bloqueio ou eliminação** de dados desnecessários ou tratados fora da lei;
- pedir a **portabilidade** dos seus dados;
- **excluir** seus dados (veja [Excluir conta e dados](https://navalha.web.app/excluir-conta); pelo app é na hora);
- saber **com quem compartilhamos** (seção 5);
- saber o que acontece se você **não consentir** (os campos opcionais e as permissões do celular podem ficar
  desligados; sem eles, só deixam de funcionar a busca por perto, os lembretes e o lembrete por WhatsApp);
- **retirar o consentimento** da localização e das notificações nas configurações do celular;
- [JURÍDICO: direito de **se opor** a tratamentos por legítimo interesse (Art. 18, §2º), por exemplo a nota do cliente.]

Peça pelo e-mail [PENDENTE: e-mail do encarregado]. Respondemos em até 15 dias (Art. 19, II).
Você também pode reclamar à Autoridade Nacional de Proteção de Dados: https://www.gov.br/anpd.

## 8. Crianças e adolescentes

[JURÍDICO + PENDENTE: decisão do dono. A v1 diz "não é destinado a menores de 13 anos", mas o app não verifica a
idade. Duas saídas:]
- **Opção A — só maiores de 18**: "O Navalha é destinado a maiores de 18 anos. Se você é responsável por um menor que
  criou conta, escreva para [e-mail] e excluímos a conta." Exige aviso claro no cadastro.
- **Opção B — aceitar adolescentes**: se o app for considerado de "acesso provável" por adolescentes (Lei 15.211/2025,
  Art. 1º, parágrafo único), contas de até 16 anos precisam ficar vinculadas à de um responsável (Art. 24), e o
  tratamento de dados de crianças exige consentimento dos pais (LGPD, Art. 14, §1º). Exige mudanças no app.

## 9. Segurança e incidentes

Usamos criptografia em trânsito, regras de acesso no servidor, conferência do login nas gravações feitas pelo nosso
servidor e limites contra abuso. Se um incidente de segurança puder causar risco ou dano relevante a você, avisaremos você e a
ANPD no prazo da Resolução CD/ANPD nº 15/2024. [JURÍDICO: confirmar o prazo (3 dias úteis, ou o dobro para agente de
pequeno porte).]

## 10. Mudanças nesta política

Quando mudarmos algo importante (dados coletados, finalidades, compartilhamentos, prazos), avisaremos no app antes
de a nova versão valer. A data no topo mostra a versão em vigor. [PENDENTE: onde ficam as versões antigas, por
exemplo `navalha.web.app/privacidade/v1`.]

---

## Para o advogado e o dono (não vai para o app)

### O que mudou da v1 para a v2
1. **Novos:** avaliações em três direções e nota do cliente (3.6), lembrete por WhatsApp (3.7), foto do corte com
   quem vê (3.5), encaixe de balcão (3.4), marca do teste grátis e controle de abuso (3.9 e 3.12), armazenamento
   no aparelho (4), transferência internacional (6), prazos de guarda (3.10 e 3.11).
2. **Agora explícito:** base legal proposta por atividade, direitos com a ANPD, o que acontece ao não consentir.
3. **Corrigido:** "A barbearia vê seu nome e WhatsApp" agora também diz que ela vê a sua nota.
4. **Em aberto:** a idade mínima (seção 8).

### Decisões que dependem do advogado
- Papel da TrevoTec e das barbearias em cada atividade (seção 1). Isso muda o termo que as barbearias assinam.
- Base legal e avaliação de legítimo interesse (LIA) da nota do cliente e do direito de oposição (3.6 e 7).
- Base legal da foto do corte (3.5).
- Transferência internacional: hipótese do Art. 33 para Google e Cloudflare (6).
- ECA Digital: o app é de "acesso provável" por adolescentes? (8)
- Controlador pessoa física: confirmar o enquadramento como agente de pequeno porte (Res. CD/ANPD nº 2/2022), que
  muda prazos e o encarregado (2, 7, 9), e se vale abrir CNPJ antes do piloto (quem responde por multa ou
  indenização hoje é o dono, com os bens pessoais).

### O que o dono precisa responder
- E-mail do encarregado (o responsável já está na seção 1: o dono, pessoa física, porque a TrevoTec ainda não tem CNPJ).
- Região do Firestore (Console do Firebase › Configurações do projeto) e aceite dos termos de tratamento de dados
  do Firebase e da Cloudflare.
- Prazo de guarda do histórico de atendimentos, das avaliações e dos registros de compra.
- Idade mínima: opção A ou B.

### Ajuste de código sugerido antes de publicar
A página da barbearia mostra só o primeiro nome, mas o documento público da avaliação (`avaliacoes`, direção
`cliente_para_barbearia`) também guarda a foto, a capa e o uid do cliente, e qualquer pessoa consegue lê-lo direto
pela API. **Corrigido em 22/out** (Worker: a pública guarda só o primeiro nome; a exclusão de conta a acha pelo id).
As avaliações públicas gravadas antes da correção ainda têm esses campos até serem limpas.

### Conferência com o código (em `ef15130`)
Cada seção foi checada contra `src/types/models.ts`, `firestore.rules`, `worker/src/` e as telas. Se o código mudar
antes da publicação, refazer a conferência (`/codelgpd politica`).
