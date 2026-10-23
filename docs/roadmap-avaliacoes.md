# Roteiro: avaliações, perfis com banner, splash e seguir cortes (pedido do dono, 22/out/2026)

**Status (22/out): as 7 etapas estão feitas, testadas, com commit e publicadas (regras, índices, Worker e web).**

> **Substituído em 22/out (decisão do dono):** saíram as avaliações cliente → barbeiro e barbeiro → cliente, a nota do
> cliente e tudo do Google (nota, Place ID, cron). Ficou só a avaliação da barbearia, uma por cliente (editável), nota
> pura 0,0–5,0 e ranking ponderado. Ver `docs/status.md` › Reestruturação das avaliações.

Ordem do mais fácil para o mais difícil. Cada etapa termina com regressão completa (testes, typecheck,
regras, Worker, export web) e conferência no navegador (roteiro do dogfood + expo-design-system). Commit por etapa.

## Decisões do dono (22/out)
- **Google Maps:** nenhum app consegue publicar avaliação no Google em nome do cliente (não há API; o link oficial
  não aceita estrelas nem texto pré-preenchidos). Depois de avaliar a barbearia, o app mostra "Publicar também no
  Google": copia o comentário e abre a janela de avaliação daquela casa. O cliente toca nas estrelas, cola e publica.
  Aparece para qualquer nota (o Google proíbe pedir só para quem deu nota alta). Só aparece se a casa tem o código do Google.
- **Três avaliações, todas opcionais:**
  - cliente → barbeiro: nota interna da casa (média do barbeiro). Não aparece para outros clientes.
  - cliente → barbearia: pública, vai para a página da casa e para o ranking. Botão logo depois do de avaliar o barbeiro.
  - barbeiro → cliente: o cliente vê em Perfil › Minhas avaliações e a média no topo do perfil; a casa vê a média
    do cliente no card do agendamento.
- **Cancelamento também pode ser avaliado:** quem foi cancelado avalia quem cancelou (casa cancelou → cliente pode
  avaliar o barbeiro; cliente cancelou → barbeiro pode avaliar o cliente).
- **Configuração da casa "Pedir avaliação ao cliente":** ligada, o cliente recebe o pedido quando o barbeiro finaliza;
  desligada, nada muda para o cliente (ele ainda pode avaliar pelo histórico).
- **Quem vê o quê:** o dono vê todas as avaliações da casa; o barbeiro só as próprias. Toda avaliação mostra o nome
  do cliente e o dia e horário do corte.

## Etapas

### 1. Contorno de foco em todas as caixas de texto (fácil)
- `Campo` (ui.tsx) ganha o mesmo foco da `CampoBusca`: borda âmbar na caixa, sem o anel do navegador.
  O único `TextInput` solto (PerfilConta) passa a usar o `Campo`.
- Impacto: só visual. Risco: o `Campo` é usado em 10 telas; conferir multiline (comentário) e teclado numérico.

### 2. Sino no Início com bolinha (fácil)
- O `PainelNotificacoes` vai também para o topo do Início do cliente. O número vermelho vira uma bolinha pequena
  (o leitor de tela continua dizendo quantas são novas).
- Impacto: um ouvinte de notificações a mais por aba aberta (até 30 docs). Aceitável no plano grátis.

### 3. Splash (média)
- A splash nativa continua igual (é o que o Android mostra antes do JS). Logo depois, uma cópia exata dela em JS
  (mesmo fundo e logo) assume e faz a transição, sem salto visível.
- **Sem login (primeira vez ou depois de sair):** fica o tempo de hoje e faz a entrada elegante: o logo sobe um pouco
  e some em fade enquanto o login aparece por baixo (cerca de 0,6 s, sem exagero).
- **Com login:** fica no mínimo 1,35 s ou até a tela inicial estar pronta (o que vier por último) e some em fade.
- **Toque em qualquer ponto pula** a splash na hora. Quem liga "reduzir movimento" no aparelho vê só o fade.
- Impacto: layout raiz. Links diretos (/barbearia/x) continuam abrindo a tela certa por baixo. Os testes e2e
  já esperam 3,5 s antes de agir.

### 4. Banner no perfil do barbeiro e do cliente (média)
- Novo tipo de foto `banner` no Worker (R2), campo `bannerUrl` no barbeiro e no perfil do cliente (regras: só URL do nosso R2).
- Na escolha do barbeiro (página da casa), quem tem banner aparece com a foto ao fundo, véu escuro de baixo para
  cima e nome em texto claro (`sobreFoto`): fica legível sobre qualquer imagem ou cor. Sem banner, igual a hoje.
- No perfil do cliente, o banner fica no topo, atrás da foto e do nome.
- Impacto: **precisa publicar o Worker** (tipo novo). Leituras não mudam (campo no mesmo documento).

### 5. Ficha do barbeiro para o dono (média)
- Tocar no barbeiro em Barbearia › Equipe abre a ficha: foto e banner (o dono pode trocar), nome, apelido,
  telefone, nota média e as avaliações dele.
- **Telefone e nota do barbeiro não podem ficar no documento do barbeiro**, que é público. Vão para
  `barbearias/{id}/equipePrivado/{uid}` (lê o dono e o próprio barbeiro). O telefone que o barbeiro salva no perfil é
  copiado para lá.
- Impacto: regras novas com teste; o barbeiro passa a ter o telefone visível ao dono (finalidade: falar sobre a agenda).

### 6. Avaliações em três direções (difícil)
- Worker `POST /avaliacoes` com `alvo`: `barbeiro`, `barbearia` ou `cliente`; confere quem pode avaliar o quê
  (concluído, ou cancelado pelo outro lado), uma vez por direção. Notas só o Worker grava.
- Notas: barbearia (`resumo.notaApp`, ranking) só com as avaliações da casa; barbeiro em `equipePrivado`;
  cliente em `users/{uid}.notaCliente` e cópia em `notasCliente/{uid}` (a casa lê ao ver o agendamento).
- Telas: aba **Avaliações** ao lado de Perfil no modo casa (dono: todas; barbeiro: as dele); Perfil do cliente com
  média no topo e "Minhas avaliações"; página da casa mostra só avaliações da barbearia.
- Fluxo do cliente: avaliar barbeiro → "Avaliar a barbearia" → "Publicar também no Google".
- Configuração "Pedir avaliação ao cliente" (Configurações da casa): ligada, o Worker manda a notificação "Como foi o corte?".
- Impacto: as avaliações antigas (direção cliente → barbeiro, criadas desde 20/out) passam a contar como do barbeiro.
  O piloto ainda não começou, então não há volume real a migrar. **Precisa publicar regras e Worker.**

### 7. Seguir cortes (difícil)
- No card da agenda: "Iniciar corte" → tela do corte atual (cliente, corte, tempo correndo, nota do cliente,
  "Finalizar"). Enquanto um corte está aberto, não dá para iniciar outro.
- Finalizar = concluído (o fluxo de fotos do "Concluído" continua). Logo depois: "Avaliar o cliente?" (opcional).
- Impacto: campo `iniciadoEm` no agendamento (a casa já pode gravar campos de status; teste de regra cobre).

## Fora deste roteiro
- Preencher estrelas/texto no Google automaticamente (impossível, ver acima).
- Responder avaliações (campo `resposta` existe, sem tela por enquanto).
