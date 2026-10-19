// Plugin do Expo: modo imersivo no Android, com a mesma lógica do WindowHelper do Cronos e do LystSync.
// Oculta a barra de status e a de navegação; elas só voltam num arrasto da borda, por cima do app, e somem
// sozinhas. É reaplicado sempre que a tela recupera o foco (depois de diálogo, teclado, permissão, outro app).
// A pasta android/ é gerada pelo prebuild, então o código entra no MainActivity.kt por aqui, não à mão.
const { withMainActivity } = require('expo/config-plugins');

const IMPORTS = [
  'import androidx.core.view.WindowCompat',
  'import androidx.core.view.WindowInsetsCompat',
  'import androidx.core.view.WindowInsetsControllerCompat',
];

const METODOS = `
  // Modo imersivo (plugins/modo-imersivo.js): API moderna WindowInsetsController, sem a flag legada windowFullscreen.
  private fun ocultarBarras() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.decorView.post {
      val controller = WindowCompat.getInsetsController(window, window.decorView)
      controller.hide(WindowInsetsCompat.Type.systemBars())
      controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) ocultarBarras()
  }
`;

module.exports = config => withMainActivity(config, cfg => {
  let src = cfg.modResults.contents;
  if (src.includes('fun ocultarBarras()')) return cfg; // já aplicado (prebuild sem --clean)
  for (const imp of IMPORTS) if (!src.includes(imp)) src = src.replace(/^(package .*\n)/m, `$1\n${imp}`);
  // Logo depois do super.onCreate, e os métodos antes do fim da classe.
  src = src.replace(/(super\.onCreate\([^)]*\)\s*\n)/, '$1    ocultarBarras()\n');
  src = src.replace(/\}\s*$/, `${METODOS}}\n`);
  cfg.modResults.contents = src;
  return cfg;
});
