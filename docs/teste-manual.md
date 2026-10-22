# Navalha — roteiro de teste manual

Use o APK mais recente no Android. Marque cada item e anote o que der errado (tela, horário, o que esperava).
Itens com ✅ já passaram no teste de 18–19/out/2026 no Redmi Note 13; vale repetir se quiser.
O resultado completo da rodada pelo adb está no fim deste arquivo; o que falta é só o que exige você na frente do celular.

## 1. Entrada e conta
- [ ] ✅ Abrir o app → "Continuar com Google" → escolher a conta → entra sem erro
- [ ] No primeiro login de uma conta nova: aparece o pedido de notificação ao escolher o papel → permitir
- [ ] Fechar o app pela lista de recentes e abrir de novo → continua logado, sem tela de login
- [ ] Perfil → editar nome, apelido e WhatsApp → Salvar → sair e voltar: os dados continuam
- [ ] Perfil → Modo → trocar entre Cliente e Dono → as abas mudam (Cliente: Início/Explorar/Agendamentos/Perfil; Dono: Agenda/Barbearia/Perfil)
- [ ] Sem internet (modo avião) → abrir o app → não trava; ao voltar a internet, carrega

## 2. Dono: montar a barbearia
- [ ] ✅ Barbearia → trocar foto de capa → foto aparece
- [ ] "Conferir no mapa" abre o Google Maps no endereço certo
- [ ] ✅ Meu cardápio → Adicionar corte → nome, categoria, preço, tempo → Salvar
- [ ] Adicionar corte **com foto** (Galeria e Câmera) → a foto aparece no cardápio
- [ ] Editar um corte (mudar preço) → o novo preço aparece na página pública
- [ ] Pausar um corte ("Disponível para agendar" desligado) → ele some para o cliente
- [ ] Expediente → mudar horário de um dia e o almoço → os horários livres do cliente mudam
- [ ] Agenda → Encaixe → cliente de balcão num horário livre → aparece na agenda como Confirmado
- [ ] Tentar encaixar num horário já ocupado → o app não deixa
- [ ] Desligar "Aparecendo na busca" → a barbearia some do Explorar; ligar de novo → volta
- [ ] Código do Google (Place ID) → colar qualquer código → Salvar → não dá erro

## 3. Equipe (precisa de uma 2ª conta Google, pode ser de outra pessoa)
- [ ] Dono → Convidar barbeiro → gera um código de 6 letras
- [ ] Na 2ª conta: "Trabalho numa barbearia" → digitar o código → entra na equipe
- [ ] Usar o mesmo código numa 3ª conta → deve recusar (uso único)
- [ ] O barbeiro cadastra o próprio corte → aparece na página da barbearia com o nome dele
- [ ] O barbeiro cria uma folga de dia inteiro → os horários dele somem naquele dia
- [ ] O dono desativa o barbeiro → ele some para o cliente

## 4. Cliente: achar e reservar
- [ ] Início → permitir localização → a barbearia aparece em "Perto de você"
- [ ] Explorar → filtros de distância, preço, tipo de corte, "aberta agora", "atende hoje" → a lista muda certo
- [ ] ✅ Página da barbearia → barbeiro → corte → horário → Confirmar (3 passos) → "Horário reservado"
- [ ] O horário reservado some da grade para outro cliente (testar com a 2ª conta no mesmo horário)
- [ ] **Dois celulares, mesmo horário, confirmar ao mesmo tempo** → só um consegue; o outro vê "acabou de ser ocupado"
- [ ] Botões Google Maps, Waze e WhatsApp da barbearia abrem os apps certos
- [ ] ✅ Agendamentos → Cancelar horário → vai para o Histórico como Cancelado e o horário volta a ficar livre
- [ ] "Agendar de novo" no Histórico leva ao mesmo corte

## 5. Atendimento (dono/barbeiro)
- [ ] Agenda do dia mostra a reserva do cliente; o total "R$ previsto" bate
- [ ] ✅ Confirmar a reserva → status Confirmado
- [ ] **Depois do horário de início** (hoje: a partir das 21:30) → aparecem "Concluído" e "Faltou"
- [ ] Concluído → tirar a foto do corte (ou concluir sem foto) → status Concluído
- [ ] No modo Cliente → Agendamentos → Histórico → a foto do corte aparece
- [ ] Em outra reserva: marcar "Faltou" → no painel, "Faltas em 7 dias" sobe
- [ ] Painel do dono (aba Barbearia → Resumo): clientes de hoje, previsto, faturado e corte mais pedido batem com o que você fez

## 6. Lembretes (push)
- [ ] ✅ Reservar para daqui a 1–2 h → no minuto 5 da hora seguinte chega "Seu ... é daqui a pouco"
- [ ] Reservar para amanhã no mesmo horário +23 h → chega o lembrete de 24 h
- [ ] Com o app fechado (deslizado dos recentes) o lembrete também chega
- [ ] Reserva cancelada **não** recebe lembrete

## 7. Conta e privacidade (LGPD)
- [ ] Perfil → Excluir minha conta → confirmar → as reservas futuras são canceladas, volta para a tela de login
- [ ] Entrar de novo com a mesma conta → começa do zero (escolher papel)
- [ ] Use uma conta de teste aqui, **não** a sua conta de dono (a barbearia ficaria sem dono)

## 8. Versão web (iPhone)
- [ ] Abrir https://navalha.web.app → entrar com Google
- [ ] Reservar e cancelar pelo navegador
- [ ] No iPhone: Compartilhar → "Adicionar à Tela de Início" → abre como app
- [ ] Aberto pela Tela de Início: Perfil › Lembretes › "Ativar lembretes" → permitir → o cartão diz "Ativos"
- [ ] Reservar para daqui a ~2 h → o lembrete chega no iPhone (Safari normal não recebe; só pela Tela de Início, iOS 16.4+)
- [ ] Tocar no lembrete abre "Meus agendamentos"

## Como anotar um problema
Tela + o que fez + o que esperava + o que aconteceu + horário. Se for no Android, deixe o celular conectado
(depuração por Wi-Fi) que eu leio os logs daquele horário.

## Resultado da rodada no celular (19/out/2026, pelo adb, conta do dono)

**Passou:** login persistente ao reabrir · perfil salvo · troca Cliente/Dono · "Conferir no mapa" · corte com foto da
galeria · editar preço (reflete na página pública e na faixa de preço) · pausar corte (some para o cliente e do filtro) ·
expediente (terça às 10:00 refletiu na grade) · encaixe de balcão e horários ocupados fora da grade · tirar e pôr na
busca · salvar código do Google · busca por perto (24 m) · 10 filtros e buscas do Explorar · botões Maps/Waze/WhatsApp ·
grade sem os horários ocupados e com o almoço · reservar · cancelar (blocos liberados) · "Agendar de novo" ·
Concluído com foto → foto no histórico do cliente · Faltou · painel do dono (previsto, faturado, faltas, mais pedido) ·
lembrete de 2 h (com o app aberto **e fechado**) · reserva cancelada sem lembrete.

**Bugs achados e corrigidos nesta rodada:**
1. Início preso em "Localizando…" quando o GPS não respondia → prazo de 12 s e "Tentar de novo".
2. Permissão de localização pedida a cada abertura (no MIUI mandava o app para trás) → só pede se faltar.
3. Voltar do Android no Encaixe fechava o app → volta para a agenda.
4. "Confirmar" e "Encaixar" sumiam abaixo da grade em dias cheios (quebrava os 3 toques) → fixos no rodapé.
5. Telefone com +55 gerava wa.me/5555… → prefixo uma vez só.
6. "Agendar de novo" abria a página da barbearia → abre direto o mesmo corte.
7. Cabeçalho "Ibiúna, Ibiúna" → sem repetir.
8. Agenda e painel contavam o dia diferente (2 × 3 clientes) → mesma conta.
9. "1 concluídos, 1 faltas" → singular certo.

**Falta, só você consegue:** 1.2 pedido de notificação com conta nova · 1.6 sem internet · foto pela Câmera ·
bloco 3 (equipe, precisa de 2ª conta) · 4.5 dois celulares no mesmo horário · bloco 7 (excluir conta, use conta de teste) ·
bloco 8 (web no iPhone).
