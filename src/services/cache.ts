// Cache curto de leituras do Firestore (mesmo padrão do controle de O.S. do MyHub).
// Cota grátis: 50 mil leituras/dia. Sem isto, ir e voltar entre a página da casa e o agendar,
// ou abrir a aba Barbearia de novo, relê tudo do servidor (no celular o Firestore só tem cache em memória).
// • TTL de 5 min: o que é público (casa, cardápio, lista perto) muda pouco.
// • Gravação do próprio aparelho limpa a chave → a próxima leitura vem fresca.
// • `forcar` (puxar para atualizar / tentar de novo) ignora o cache.
// ponytail: só em memória (zera ao fechar o app); levar para AsyncStorage se a reabertura pesar na cota.
// O que precisa ser exato na hora (horários livres, agenda do dia, reserva) continua em tempo real, sem cache.

const TTL_MS = 5 * 60_000;
const guardados = new Map<string, { em: number; valor: Promise<unknown> }>();

/** Devolve a leitura guardada há menos de 5 min ou faz a leitura (e guarda). Falha não fica guardada. */
export function lembrar<T>(chave: string, ler: () => Promise<T>, { forcar = false, agora = Date.now() } = {}): Promise<T> {
  const g = guardados.get(chave);
  if (!forcar && g && agora - g.em < TTL_MS) return g.valor as Promise<T>;
  const valor = ler();
  guardados.set(chave, { em: agora, valor });
  valor.catch(() => { if (guardados.get(chave)?.valor === valor) guardados.delete(chave); });
  return valor;
}

/** Limpa as chaves que começam com o prefixo (ex.: "casa:abc" depois de editar o cardápio). */
export function esquecer(prefixo: string) {
  for (const k of [...guardados.keys()]) if (k.startsWith(prefixo)) guardados.delete(k);
}
