export const TIPOS = ['perfil', 'barbearia', 'servico', 'corte'] as const;

/** Monta a chave do arquivo no R2; recusa entrada que tente escapar da pasta. */
export function chaveFoto(tipo: string, uid: string, refId: string, id: string): string | null {
  if (!(TIPOS as readonly string[]).includes(tipo)) return null;
  const seguro = /^[A-Za-z0-9_-]{1,128}$/;
  if (!seguro.test(uid) || !seguro.test(refId) || !seguro.test(id)) return null;
  return `${tipo}/${refId}/${uid}-${id}.webp`;
}

const H = 3_600_000;

/** Janelas do cron de hora em hora: quem começa daqui a 23–24 h e daqui a 1–2 h. */
export function janelasLembrete(agora: number) {
  return [
    { chave: 'h24' as const, de: agora + 23 * H, ate: agora + 24 * H, quando: 'amanhã' },
    { chave: 'h2' as const, de: agora + 1 * H, ate: agora + 2 * H, quando: 'daqui a pouco' },
  ];
}

/** Texto do push, com a hora no fuso de Brasília (UTC−3, sem horário de verão). */
export function mensagemLembrete(a: { servicoNome: string; inicio: number; barbeariaNome?: string }, quando: string) {
  const hora = new Date(a.inicio - 3 * H).toISOString().slice(11, 16);
  return { title: 'Lembrete de horário', body: `Seu ${a.servicoNome} é ${quando}, às ${hora}${a.barbeariaNome ? ` na ${a.barbeariaNome}` : ''}.` };
}
