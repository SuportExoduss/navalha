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

/** Corpo do FCM HTTP v1: `notification` aparece sozinho com o app fechado; o canal é o que o app cria. */
export function mensagemFcm(m: { token: string; title: string; body: string; agendamentoId: string; link?: string }) {
  return {
    message: {
      token: m.token,
      notification: { title: m.title, body: m.body },
      data: { agendamentoId: m.agendamentoId },
      android: { priority: 'HIGH', notification: { channel_id: 'lembretes' } },
      // Na web (e no iPhone pela Tela de Início) o toque abre os agendamentos.
      webpush: { fcm_options: { link: m.link ?? 'https://navalha.web.app/agendamentos' } },
    },
  };
}

/** Tipo real da imagem pelos primeiros bytes (assinatura do arquivo). O Content-Type que o
 *  cliente manda não vale: o Android troca o cabeçalho e um atacante poderia mentir (SEC-007). */
export function tipoDaImagem(b: Uint8Array): 'image/webp' | 'image/jpeg' | 'image/png' | null {
  const txt = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  if (b.length >= 12 && txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return 'image/webp';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && txt(1, 3) === 'PNG') return 'image/png';
  return null;
}
