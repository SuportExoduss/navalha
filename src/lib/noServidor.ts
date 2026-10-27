// Salvar só termina quando o servidor confirma: a promessa de gravação do Firestore resolve com o aceite dele.
// Sem internet ela fica pendente (e sobe sozinha quando a conexão volta); o botão para de girar em 20 s com um
// aviso, em vez de girar sem fim.
export const DADOS_ATUALIZADOS = 'Dados atualizados.';
export const SEM_CONEXAO = 'Sem conexão. Os dados sobem quando a internet voltar; confira depois.';

export function noServidor<T>(gravacao: Promise<T>, ms = 20_000): Promise<T> {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(SEM_CONEXAO)), ms);
    gravacao.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); falha(e); });
  });
}
