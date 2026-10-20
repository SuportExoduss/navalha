# NAVALHA — Página 404 em 2D

Protótipo independente em um único arquivo HTML. Não precisa instalar dependências nem baixar imagens.

## Como testar

1. Extraia o ZIP.
2. Abra `index.html` no Chrome, Edge ou Firefox.
3. A tesoura passa voando da esquerda para a direita, abre e fecha as lâminas, bate no fio, dá um choque, cai e desliza para fora da tela.
4. Clique no interruptor vermelho desenhado na parede ou em **TENTAR DE NOVO** para acender o poste listrado e reiniciar a sequência.
5. O botão **VOLTAR AO INÍCIO** leva para `/`. Para testar localmente, essa rota pode não ser servida; no site publicado, ajuste o `href` para a rota inicial real.

## Personalização

- Cores: no início do `<style>`, altere `--bg`, `--red`, `--amber` e `--cream`.
- Velocidade da cena: ajuste `cycleMs = 7200` no JavaScript. Um valor menor repete mais rápido.
- Texto: altere o conteúdo do `<main>`.
- Destino do botão inicial: altere `href="/"`.

## Como publicar

Copie o `index.html` para o sistema de hospedagem do site. Para funcionar como uma página 404 real, configure a hospedagem/servidor para entregar esta página com status HTTP `404`, em vez de retornar status `200` para todas as URLs desconhecidas.

### Next.js

Se o projeto usa Next.js App Router, crie `app/not-found.tsx` e adapte o HTML para JSX/componentes React. Os estilos podem ficar em CSS module ou stylesheet global; a animação JS precisa ficar em um componente client-side (`'use client'`). Não basta renomear `index.html` para `not-found.tsx`.

## Acessibilidade

- O interruptor pode ser ativado por clique, Enter ou Espaço.
- A preferência de movimento reduzido do sistema é respeitada.
- Há status acessível para anunciar o reinício da animação.
