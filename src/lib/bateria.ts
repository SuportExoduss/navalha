// Passos para o Android não segurar os avisos de horário com o app fechado. Cada marca esconde a opção num lugar:
// a Xiaomi bloqueia o "Início automático" por padrão e, depois de reiniciar, descarta o push até o app ser aberto.
// O app não consegue mudar isso sozinho; o botão da tela abre os ajustes do Navalha e a pessoa liga.

export function passosBateria(fabricante: string | null | undefined): string[] {
  const f = (fabricante ?? '').toLowerCase();
  const notificacoes = 'Em “Notificações”, deixe tudo permitido (inclusive na tela de bloqueio).';
  if (/xiaomi|redmi|poco/.test(f)) {
    return ['Ligue “Início automático”.', 'Em “Economia de bateria”, escolha “Sem restrições”.', notificacoes];
  }
  if (f.includes('samsung')) {
    return ['Toque em “Bateria” e escolha “Sem restrições”.', notificacoes];
  }
  if (/oppo|realme|oneplus|vivo|iqoo/.test(f)) {
    return ['Ligue “Início automático” (ou “Permitir atividade em segundo plano”).', 'Em “Bateria”, escolha “Sem restrições”.', notificacoes];
  }
  if (/huawei|honor/.test(f)) {
    return ['Em “Bateria” › “Inicialização de apps”, deixe o Navalha gerenciado manualmente, com tudo ligado.', notificacoes];
  }
  return ['Toque em “Bateria” (ou “Uso da bateria”) e escolha “Sem restrições”.', notificacoes];
}
