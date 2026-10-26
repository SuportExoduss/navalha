// Clube de assinatura: datas do ciclo. Lógica pura (testada em clube.test.ts); as regras do Firestore
// aceitam vencimento de 28 a 31 dias depois do início do ciclo, que é o que estas funções produzem.
import { dataLocal, paraMillis } from './agenda';
import type { Millis } from '../types/models';

const DIA = 86_400_000;

/** Mesmo dia e hora no mês seguinte (Brasília). Dia 31 em mês curto vira o último dia dele. */
export function somarMes(ms: Millis): Millis {
  const [a, m, d] = dataLocal(ms).split('-').map(Number);
  const minutos = Math.round((ms - paraMillis(dataLocal(ms), 0)) / 60_000);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(d, ultimo);
  return paraMillis(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, minutos);
}

/**
 * "Recebi o pagamento": novo ciclo. Em dia (ou no dia de tolerância), conta do vencimento antigo e ninguém perde dias;
 * já vencido, conta de hoje.
 */
export function novoCiclo(venceEm: Millis | undefined, agora: Millis): { cicloInicio: Millis; venceEm: Millis } {
  const inicio = venceEm !== undefined && agora <= venceEm + DIA ? venceEm : agora;
  return { cicloInicio: inicio, venceEm: somarMes(inicio) };
}
