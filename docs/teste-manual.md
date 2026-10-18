# Navalha — roteiro de teste manual

Use o APK mais recente no Android. Marque cada item e anote o que der errado (tela, horário, o que esperava).
Itens com ✅ já passaram no teste de 18/out/2026 no Redmi Note 13; vale repetir se quiser.

**Atenção no estado atual:** o domingo da "The lord barber" está aberto até 23h só para teste, e existe uma
reserva sua hoje às 21:30 (confirmada). Avise quando terminar para eu fechar o domingo de novo.

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
- [ ] ✅ Página da barbearia → corte → horário → Confirmar = 3 toques → "Horário reservado"
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
- [ ] Abrir https://navalha-web.navalha-worker.workers.dev → entrar com Google
- [ ] Reservar e cancelar pelo navegador
- [ ] No iPhone: Compartilhar → "Adicionar à Tela de Início" → abre como app
- [ ] Sabido: na web não chega lembrete (push na web ainda não existe)

## Como anotar um problema
Tela + o que fez + o que esperava + o que aconteceu + horário. Se for no Android, deixe o celular conectado
(depuração por Wi-Fi) que eu leio os logs daquele horário.
