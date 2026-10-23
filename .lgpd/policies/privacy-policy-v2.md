# Política de privacidade v2 — registro (em vigor desde 23/out/2026)

O texto em vigor é a página do app: `src/app/privacidade.tsx` (https://navalha.web.app/privacidade).
Termos de uso, com as regras para barbearias: `src/app/termos.tsx` (https://navalha.web.app/termos).
Conferidos contra o código em 23/out/2026 (telas, `src/types/models.ts`, `firestore.rules`, `worker/src/`).

## Decisões tomadas (dono, 23/out/2026)
- **Controlador**: o dono, pessoa física, sob a marca TrevoTec (sem CNPJ). Quando houver CNPJ, trocar em `src/lib/legal.ts`.
- **Encarregado**: o próprio dono, pelo e-mail de contato (`CONTATO` em `src/lib/legal.ts`). Como agente de pequeno
  porte, a nomeação pode ser dispensada (Res. CD/ANPD nº 2/2022, art. 11), mas o canal fica publicado.
- **Idade mínima**: 18 anos, declarada no login; menores marcam pela conta do responsável. Sem verificação de idade.
- **Bases legais**: execução do contrato (conta, perfil, agendamentos, foto do corte, barbearia, assinatura);
  consentimento (localização, notificações, avaliação); legítimo interesse (uso e erros); obrigação legal (compras).
- **Avaliações**: só a da barbearia, pública com primeiro nome e dia; sem avaliação de clientes ou barbeiros.
- **Onde ficam os dados**: Firestore em `southamerica-east1` (São Paulo); Cloudflare (rede global), login, push e
  Google Play podem processar fora do Brasil, sob os termos de proteção de dados de cada serviço (art. 33).
- **Incidentes**: roteiro e registro em `.lgpd/incidentes.md`.
- **Barbearias**: aceitam os Termos de uso ao criar a casa (texto junto ao botão "Criar barbearia").

## Revisão jurídica (recomendada, não bloqueia)
- Base legal da foto do corte (execução do contrato) e da avaliação (consentimento).
- Hipótese do art. 33 para Google e Cloudflare.
- Se o app é de "acesso provável" por adolescentes (ECA Digital, Lei 15.211/2025) mesmo com a regra de 18 anos.
- Responsabilidade pessoal do dono como controlador pessoa física.
