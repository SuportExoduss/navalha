# Política de privacidade v2 — registro (em vigor desde 23/out/2026)

O texto em vigor é a página do app: `src/app/privacidade.tsx` (https://navalha.web.app/privacidade).
Termos de uso, com as regras para barbearias: `src/app/termos.tsx` (https://navalha.web.app/termos).
Conferidos contra o código em 23/out/2026 (telas, `src/types/models.ts`, `firestore.rules`, `worker/src/`).

## Decisões tomadas (dono, 23/out/2026)
- **Controlador**: o dono, pessoa física, sob a marca TrevoTec (sem CNPJ). Quando houver CNPJ, trocar em `src/lib/legal.ts`.
- **Encarregado**: o próprio dono, pelo e-mail de contato (`CONTATO` em `src/lib/legal.ts`). Como agente de pequeno
  porte, a nomeação pode ser dispensada (Res. CD/ANPD nº 2/2022, art. 11), mas o canal fica publicado.
- **Idade mínima** (25/out): 18 anos. A tela `/idade` pede a data de nascimento no 1º acesso (e a quem já tinha conta);
  menor tem conta e dados apagados e o login não é liberado. Guarda só `maiorDeIdadeEm`, nunca a data. É uma autodeclaração:
  a vedação de autodeclaração do ECA Digital (art. 9º, §1º) vale para conteúdo impróprio a menores, que o Navalha não tem.
- **Bases legais**: execução do contrato (conta, perfil, agendamentos, foto do corte, barbearia, assinatura);
  consentimento (localização, notificações, avaliação); legítimo interesse (uso e erros); obrigação legal (compras).
- **Avaliações** (25/out): só a da barbearia, e só as estrelas. A página mostra a média e a quantidade; ninguém vê quem avaliou.
- **WhatsApp do cliente** (25/out): a barbearia vê só nos horários marcados, para atraso, mudança e lembrete; sai 24 h depois
  do horário. Barbeiro desligado perde o acesso na hora. Regra explícita nos Termos de uso.
- **Acesso e portabilidade** (25/out): Perfil › "Baixar meus dados" (JSON com tudo o que o app guarda sobre a pessoa).
- **Onde ficam os dados**: Firestore em `southamerica-east1` (São Paulo); Cloudflare (rede global), login, push e
  Google Play podem processar fora do Brasil, sob os termos de proteção de dados de cada serviço (art. 33).
- **Incidentes**: roteiro e registro em `.lgpd/incidentes.md`.
- **Barbearias**: aceitam os Termos de uso ao criar a casa (texto junto ao botão "Criar barbearia").

## Sem advogado (decisão do dono): como cada ponto ficou
O dono conduz a adequação sozinho. Estas são as posições adotadas, com o motivo, para rever se a situação mudar
(muitos usuários, reclamação na ANPD, CNPJ). Revisão por advogado continua recomendada, mas não é exigida por lei.
- **Avaliação**: consentimento (é opcional e guarda só as estrelas). Retirada pelo e-mail.
- **Transferência internacional (art. 33)**: o banco fica em São Paulo; o resto (Cloudflare, login, push, Google Play) segue
  as cláusulas de proteção de dados dos contratos de cada serviço (art. 33, II). Se a ANPD pedir, mostrar esses termos.
- **ECA Digital**: com idade mínima de 18 anos conferida no 1º acesso e sem conteúdo impróprio, o app não é direcionado a
  menores; o risco residual é de menor que mente a data. Se surgir conta de menor, excluir na hora (canal publicado).
- **Responsabilidade pessoal**: como pessoa física, o dono responde com os próprios bens. Por isso a coleta é mínima e os
  prazos de guarda são curtos; manter o registro de incidentes (`incidentes.md`) em dia.
- **Agente de pequeno porte**: prazos em dobro para responder a titulares e à ANPD (Res. CD/ANPD nº 2/2022), mas a política
  promete 15 dias para titulares, e o roteiro de incidentes usa 3 dias úteis como meta.
