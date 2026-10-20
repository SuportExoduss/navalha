# Agendar pelo WhatsApp (plano A, custo zero)

O WhatsApp Business da barbearia é a porta de entrada; o agendamento acontece no Navalha.
Nada de API paga da Meta nem robô próprio: só o link da casa e um texto pronto. Feito em 20/out/2026.

## Como funciona

**Configuração (uma vez, pelo dono)**
1. No Navalha: Barbearia › engrenagem › **Configurações › WhatsApp**.
2. Copia o texto pronto (botão **Compartilhar**):
   "Olá! Para marcar seu horário na {nome}, escolha barbeiro, corte e horário por aqui: {link}".
3. Cola no WhatsApp Business, em Ferramentas comerciais:
   - **Mensagem de saudação**: o primeiro contato já recebe o link.
   - **Mensagem de ausência**: fora do expediente, o link responde pelo dono.
   - **Resposta rápida** (ex.: `/agenda`): manda o link em qualquer conversa.
   - **IA da Meta** (se ligada): nas instruções, "para agendar, envie este link".

**Para o cliente**
1. Escreve no WhatsApp e recebe o link.
2. O link abre a barbearia no Navalha (site ou app), já na escolha do barbeiro.
3. Barbeiro → corte → horário → confirma. Entra com a conta Google se ainda não entrou.
4. O barbeiro recebe o push na hora; a trava contra horário duplo vale como em qualquer reserva.

## No código
- Link da casa: `navalha.web.app/barbearia/{id}` (rota que já existia, etapa 1 do agendamento).
- Seção WhatsApp em `src/app/configuracoes.tsx` (só o dono), com `Share` do React Native.

## Limites
- Quem marca é o cliente, no Navalha. A IA da Meta só manda o link: não grava na agenda do Navalha.
- O link usa o id da casa (não é um nome curto). Nome curto (`/b/navalha-de-ouro`) só se os donos pedirem:
  precisa de um apelido único por casa.

## No piloto
Perguntar aos donos quantos clientes chegam pelo link do WhatsApp e se o texto pronto ficou bom.
