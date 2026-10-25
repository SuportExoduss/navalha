// Idade mínima (18 anos, decisão do dono): a pessoa informa a data de nascimento uma vez; o app guarda só que ela
// se declarou maior de idade (e quando), nunca a data. Hora de Brasília, como no resto do app.
import { dataLocal } from './agenda';
import type { ISODate, Millis } from '../types/models';

/** "25101990" ou "25/10/1990" → "25/10/1990" enquanto a pessoa digita. */
export function mascaraData(texto: string) {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}

/** "25/10/1990" → "1990-10-25"; data que não existe (31/02, ano fora de 1900–hoje) → null. */
export function lerDataBR(texto: string, agora: Millis): ISODate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (ano < 1900 || iso > dataLocal(agora)) return null;
  return iso;
}

/** Anos completos em `agora` (aniversário conta no próprio dia). */
export function idade(nascimento: ISODate, agora: Millis) {
  const hoje = dataLocal(agora);
  const anos = Number(hoje.slice(0, 4)) - Number(nascimento.slice(0, 4));
  return hoje.slice(5) >= nascimento.slice(5) ? anos : anos - 1;
}
