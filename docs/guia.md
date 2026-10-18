# Navalha: onde estamos e como seguir

Atualizado em 18/out/2026.

## Onde fica cada coisa
- **Roadmap (o plano das 6 fases):** `knowledge/Navalha — Roadmap de execução.md` neste projeto, com uma cópia em `docs/roadmap.md` dentro do código.
- **Andamento (o que está concluído):** `knowledge/claude/status-fase-1.md`, com uma cópia em `docs/status.md` no código.
- **Código:** `C:\Users\andre\Documents\MeusProjetos\navalha` no seu computador.
- **Guia para o Claude Code:** `CLAUDE.md` na raiz do código. O Claude Code lê esse arquivo sozinho ao abrir a pasta.

## O roadmap em uma tabela
| Fase | Período | Objetivo | Situação |
| --- | --- | --- | --- |
| 0 · Fundação | 19/out – 1/nov 2026 | Entrevistas, nome, contas, termos, protótipo | Só o modelo de dados está feito; o resto depende de você |
| **1 · MVP** | 2/nov – 27/dez 2026 | App funcionando | **Código dos 4 sprints concluído.** Falta ligar os serviços e testar no celular |
| 2 · Piloto fechado | 4/jan – 7/fev 2027 | 10 barbearias reais usando de graça | Próxima fase |
| 3 · Lançamento | fev – abr 2027 | Pagamentos, assinatura, iOS, avaliações | Próximo bloco grande de código |
| 4 · Crescimento | mai – jul 2027 | Clube, fidelidade, indicação | — |
| 5 · Escala | ago – out 2027 | Outras cidades | — |

## O que já está feito (Fase 1)
- **Sprint 1 · Base:** login Google, escolha de papel, tema, regras de segurança, Worker de fotos e lembretes.
- **Sprint 2 · Barbearia:** cadastro com GPS, foto de capa, convite de barbeiros, cardápio com fotos, página pública.
- **Sprint 3 · Agenda:** expediente e folgas, horários livres, reservar com trava contra horário duplo, cancelar, agenda do barbeiro, encaixe.
- **Sprint 4 · Cliente:** busca com filtros, perfil com exclusão de conta, histórico com fotos, push de lembrete, foto no "Concluído", painel do dono.
- **Testes:** 26 de lógica, 22 de regras de segurança, 5 do Worker e 2 roteiros completos no navegador. Todos passam.

## O caminho a seguir, nesta ordem

### Agora (fecha a Fase 1, depende de você + Claude Code)
1. **Criar o projeto Firebase real** (plano Spark, sem cartão), ativar o login Google e o Firestore e copiar as chaves para `.env.local`. O passo a passo está no README, em "Ligar os serviços reais".
2. **Cloudflare:** criar o bucket R2 `navalha-fotos` e publicar o Worker com a conta de serviço do Google.
3. **Celular:** rodar `npx eas-cli@latest init` e depois `npx eas-cli@latest build --profile development --platform android`. Instalar no seu Android e testar login, reserva, cancelamento, lembrete push e foto.
4. **Versão web** publicada na Cloudflare, para clientes de iPhone.
5. **Portão da Fase 2:** 3 barbearias amigas usando de 28/dez a 3/jan sem erro grave e sem horário duplicado.

### Em paralelo (Fase 0, só você)
- Entrevistar 10 barbeiros e 15 clientes, e listar 30 barbearias com a meta de 10 "sim".
- Confirmar o nome no INPI, no Registro.br e nas lojas, e criar o Gmail e o Instagram.
- Termos de Uso e Política de Privacidade (LGPD). O app já tem exclusão de conta, que a loja exige.
- Conversar com um contador sobre o CNPJ (necessário na Fase 3).

### Depois: Fase 2 (piloto) e Fase 3 (lançamento)
- **Fase 2:** conta Google Play (US$ 25), teste fechado com 12 ou mais testadores, onboarding presencial e correções por EAS Update.
- **Fase 3:** integrar o Asaas (Pix e cartão), vender a assinatura no painel web, avaliações dupla-cega, nota do Google, App Store com "Entrar com Apple". O banco de dados já está pronto para isso.

## Como pedir ao Claude Code para continuar
Abra a pasta do projeto no Claude Code e use frases como estas:
- "Leia o CLAUDE.md e o docs/status.md e me diga o próximo item pendente do roadmap."
- "Me guie passo a passo para criar o projeto Firebase real e ligar o app nele."
- "Rode todos os testes (npm test, typecheck, test:regras, worker) e me diga se está tudo verde."
- "Comece a Fase 3: integração com o Asaas em modo sandbox, seguindo o roadmap e o modelo de dados."

Regra combinada: seguir o roadmap em ordem, testar cada item e só então marcar como finalizado no `docs/status.md`.

## Atenção
- **Nunca envie para o Git** o `.env.local` nem a chave da conta de serviço do Google.
- O código ainda **não está num repositório no GitHub**. Vale criar um (privado) para ter backup e histórico.
- Antes do lançamento aberto, ativar o plano Blaze com alerta de orçamento (risco de passar das 50 mil leituras por dia).
