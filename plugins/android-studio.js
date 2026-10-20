// Plugin do Expo: o botão Run do Android Studio abre o app sozinho, sem precisar subir o Metro antes.
// Por padrão o build de debug do React Native espera o servidor de JS (Metro) no computador;
// aqui o debug também leva o JS empacotado, como o release. Para editar com recarga rápida,
// rode `npx expo start` com o app aberto: o servidor, se estiver no ar, continua tendo prioridade.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = config => withAppBuildGradle(config, cfg => {
  const marca = 'debuggableVariants = []';
  if (!cfg.modResults.contents.includes(marca)) {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^(\s*)\/\/ debuggableVariants = \[.*\]$/m,
      `$1// Navalha (plugins/android-studio.js): debug também empacota o JS; Run no Android Studio funciona sem Metro.\n$1${marca}`,
    );
  }
  return cfg;
});
