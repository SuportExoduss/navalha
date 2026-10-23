# Roteiro de incidentes de segurança (LGPD art. 48 + Resolução CD/ANPD nº 15/2024)

Incidente = qualquer acesso, perda, vazamento ou alteração de dado pessoal sem autorização. Exemplos no Navalha:
regra do Firestore aberta por engano, chave da conta de serviço do Worker ou da Cloudflare exposta, conta Google do
dono invadida, barbearia que copiou e espalhou dados de clientes, foto de cliente publicada por engano.

## Na hora (dia 0)
1. **Conter**: trocar a chave exposta (conta de serviço no Google Cloud › IAM; `npx wrangler secret put` no Worker),
   fechar a regra (`firestore.rules` + `npx firebase deploy --only firestore --project prod`), suspender a conta ou
   barbearia envolvida, trocar a senha e sair das outras sessões da conta Google do dono.
2. **Anotar** no registro abaixo: quando começou, quando foi descoberto, como, o que foi contido.
3. **Levantar** quais dados e quantas pessoas: coleções afetadas (`users`, `agendamentos`, `equipePrivado`,
   fotos no R2), logs do Worker (`npx wrangler tail`) e uso do Firestore no Console do Firebase.

## Avaliar o risco (até o dia 1)
Comunicar é obrigatório quando o incidente **pode causar risco ou dano relevante** às pessoas. Pesam a favor de
comunicar: telefone ou foto de rosto expostos, muitas pessoas, dados que permitem golpe (nome + telefone + barbearia).
Pesa contra: dado público de barbearia, dado já anonimizado, acesso que comprovadamente ninguém usou.

## Comunicar (prazo: 3 dias úteis da descoberta; agente de pequeno porte tem prazo em dobro, Res. 2/2022)
- **ANPD**: formulário de comunicação de incidente em https://www.gov.br/anpd (peticionamento eletrônico).
  Informar: descrição, dados e titulares afetados (quantos, se há menores), medidas de segurança que havia, riscos,
  medidas tomadas e as que serão tomadas, data da descoberta e do incidente, contato do encarregado.
- **Pessoas afetadas**: aviso no app (sino/push pelo Worker) e e-mail, em linguagem simples: o que aconteceu, quais
  dados, o que fizemos, o que a pessoa pode fazer (ex.: desconfiar de mensagens pedindo pagamento) e o contato.
- Se faltar informação no prazo, comunica o que já sabe e complementa depois (prazo de 20 dias úteis para complementar).

## Depois
- Corrigir a causa, com teste em `tests/regras.test.ts` quando for regra do Firestore.
- Guardar o registro **por 5 anos**, mesmo quando não precisou comunicar.

## Registro de incidentes
| Data da descoberta | O que aconteceu | Dados e pessoas | Risco relevante? | Comunicado (ANPD / titulares) | Medidas |
|---|---|---|---|---|---|
| — | nenhum até 23/out/2026 | — | — | — | — |
