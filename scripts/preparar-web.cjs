// Roda depois do `expo export --platform web` (npm run export:web), antes do deploy no Firebase Hosting.
// Por quê: o Expo põe fontes e ícones em dist/assets/node_modules/... e o Firebase Hosting não publica pastas
// node_modules. Cada fonte caía na página inicial (HTML), guardada pelo navegador por 1 ano (cache immutable)
// e o site ficava sem a Barlow e sem os ícones. Então: a pasta vira assets/pacotes/ e todo arquivo JS que mudou
// ganha nome novo (sufixo -p), para nenhum navegador reaproveitar a versão antiga guardada.
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(process.argv[2] ?? 'dist');
const JS = path.join(DIST, '_expo/static/js/web');
const TEXTO = /\.(js|html|json|css|webmanifest)$/;

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? arquivos(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const origem = path.join(DIST, 'assets/node_modules');
if (!fs.existsSync(origem)) { console.log('preparar-web: nada a fazer (sem assets/node_modules)'); process.exit(0); }
fs.renameSync(origem, path.join(DIST, 'assets/pacotes'));

let trocas = [['/assets/node_modules/', '/assets/pacotes/']];
const renomeados = new Set();
// Até não mudar mais nada: renomear um JS muda quem o cita (index.html ou outro JS), que também precisa de nome novo.
while (trocas.length) {
  const novas = [];
  for (const f of arquivos(DIST).filter(f => TEXTO.test(f))) {
    const antes = fs.readFileSync(f, 'utf8');
    let depois = antes;
    for (const [de, para] of trocas) depois = depois.split(de).join(para);
    if (depois === antes) continue;
    fs.writeFileSync(f, depois);
    if (path.dirname(f) === JS && !renomeados.has(f)) {
      const nome = path.basename(f), novo = nome.replace(/\.js$/, '-p.js');
      fs.renameSync(f, path.join(JS, novo));
      renomeados.add(path.join(JS, novo));
      novas.push([nome, novo]);
    }
  }
  trocas = novas;
}
const sobrou = arquivos(DIST).filter(f => TEXTO.test(f) && fs.readFileSync(f, 'utf8').includes('assets/node_modules'));
if (sobrou.length) { console.error('preparar-web: ainda cita assets/node_modules:', sobrou); process.exit(1); }
console.log(`preparar-web: fontes em assets/pacotes; ${renomeados.size} arquivos JS com nome novo`);
