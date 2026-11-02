// Site: CSV baixa direto; PDF abre a janela de impressão do navegador ("Salvar como PDF").
// O celular usa salvarArquivo.native.ts (arquivo de verdade + compartilhar).

export async function salvarCsv(nome: string, texto: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function salvarPdf(_nome: string, html: string) {
  // iframe escondido em vez de janela nova: não cai no bloqueio de pop-up (o clique já passou por uma leitura).
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0';
  // Sem allow-scripts: nada do relatório executa, mesmo que um nome escape do esc(); a impressão vem daqui de fora.
  f.setAttribute('sandbox', 'allow-same-origin allow-modals');
  document.body.appendChild(f);
  await new Promise<void>(ok => { f.onload = () => ok(); f.srcdoc = html; });
  f.contentWindow!.focus();
  f.contentWindow!.print();
  setTimeout(() => f.remove(), 60_000);
}
