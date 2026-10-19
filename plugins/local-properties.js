// Plugin do Expo: a cada `npx expo prebuild`, recria android/local.properties com o SDK e o CMake mais novo
// instalados. O prebuild apaga esse arquivo, e sem `cmake.dir` o Gradle volta ao CMake 3.22, cujo ninja não aceita
// caminhos longos no Windows (o build do React Native passa de 260 caracteres). Ver README › App Android.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

function sdkAndroid() {
  const candidatos = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk')];
  return candidatos.find(p => p && fs.existsSync(p));
}

/** Maior versão dentro de <sdk>/cmake (ex.: 4.1.2 > 3.22.1). */
function cmakeMaisNovo(sdk) {
  const dir = path.join(sdk, 'cmake');
  if (!fs.existsSync(dir)) return null;
  const num = v => v.split('.').map(Number);
  const [maior] = fs.readdirSync(dir).filter(v => /^\d+(\.\d+)*$/.test(v))
    .sort((a, b) => { const [x, y] = [num(a), num(b)]; for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0); return 0; });
  return maior ? path.join(dir, maior) : null;
}

// local.properties é formato Java: barras invertidas e dois-pontos precisam de escape.
const escapar = p => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

module.exports = config => withDangerousMod(config, ['android', cfg => {
  const sdk = sdkAndroid();
  if (!sdk) return cfg; // sem SDK local (ex.: só web): o Gradle avisa na hora do build
  const linhas = [`sdk.dir=${escapar(sdk)}`];
  const cmake = cmakeMaisNovo(sdk);
  if (cmake) linhas.push(`cmake.dir=${escapar(cmake)}`);
  fs.writeFileSync(path.join(cfg.modRequest.platformProjectRoot, 'local.properties'), linhas.join('\n') + '\n');
  return cfg;
}]);
