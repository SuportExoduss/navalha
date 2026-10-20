// Plugin do Expo: o botão Run do Android Studio abre o app sozinho, sem precisar subir o Metro antes.
// Por padrão o build de debug do React Native espera o servidor de JS (Metro) no computador;
// aqui o debug também leva o JS empacotado, como o release. Para editar com recarga rápida,
// rode `npx expo start` com o app aberto: o servidor, se estiver no ar, continua tendo prioridade.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const comJsEmbutido = config => withAppBuildGradle(config, cfg => {
  const marca = 'debuggableVariants = []';
  if (!cfg.modResults.contents.includes(marca)) {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^(\s*)\/\/ debuggableVariants = \[.*\]$/m,
      `$1// Navalha (plugins/android-studio.js): debug também empacota o JS; Run no Android Studio funciona sem Metro.\n$1${marca}`,
    );
  }
  return cfg;
});

// A vigilância de arquivos do Gradle falha nesta máquina (Windows, cache em D:gradle): sem isto o Sync
// do Android Studio falha com "Foi especificado um dispositivo inexistente".
const semVigiarArquivos = config => withGradleProperties(config, cfg => {
  if (!cfg.modResults.some(i => i.type === 'property' && i.key === 'org.gradle.vfs.watch')) {
    cfg.modResults.push({ type: 'property', key: 'org.gradle.vfs.watch', value: 'false' });
  }
  return cfg;
});

module.exports = config => semVigiarArquivos(comJsEmbutido(config));
