// Celular: grava o arquivo no cache do app e abre o compartilhar (WhatsApp, Drive, e-mail, salvar em arquivos).
import { File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';

export async function salvarCsv(nome: string, texto: string) {
  const f = new File(Paths.cache, `${nome}.csv`);
  f.create({ overwrite: true });
  f.writeSync(texto);
  await shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar planilha' });
}

export async function salvarPdf(nome: string, html: string) {
  const { uri } = await printToFileAsync({ html });
  // O PDF sai com nome aleatório: renomeia para o compartilhar mostrar um nome que se entende.
  const f = new File(Paths.cache, `${nome}.pdf`);
  new File(uri).moveSync(f, { overwrite: true });
  await shareAsync(f.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Exportar PDF' });
}
