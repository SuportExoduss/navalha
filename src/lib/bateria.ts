// Onde cada marca guarda a restrição de bateria que segura o push com o app fechado, e qual tela abrir direto.
// O início automático saiu (27/out): o app confere a bateria sozinho (BateriaPackage.kt) e só pede o que falta.
// Cada marca põe a opção num lugar e muda de versão para versão, então cada lista é uma ordem de tentativas: o app
// abre a primeira que existir no celular e a última é sempre uma tela padrão do Android que existe em todos.
// Base: biblioteca AutoStarter e dontkillmyapp.com; as da Xiaomi e a padrão de bateria foram testadas num
// Redmi Note 13 (HyperOS 2, Android 15) em 25/out/2026.

export const PACOTE = 'com.trevotec.navalha';

/** Uma tela de ajustes: por ação do Android (com `dados`) ou por componente exato de outro app (`pacote` + `classe`). */
export interface TelaAjuste { acao: string; pacote?: string; classe?: string; dados?: string; extras?: Record<string, string> }

const MAIN = 'android.intent.action.MAIN';
const tela = (pacote: string, classe: string, extras?: Record<string, string>): TelaAjuste =>
  ({ acao: MAIN, pacote, classe, ...(extras ? { extras } : {}) });

/** Página "Uso da bateria pelo app" do Android (12+): "Permitir uso em segundo plano" / "Sem restrições". */
const BATERIA_DO_APP: TelaAjuste = { acao: 'android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL', dados: `package:${PACOTE}` };
/** Detalhes do app: existe em todo Android; de lá "Bateria" fica a um toque. */
const DETALHES_DO_APP: TelaAjuste = { acao: 'android.settings.APPLICATION_DETAILS_SETTINGS', dados: `package:${PACOTE}` };

type Marca = 'xiaomi' | 'samsung' | 'oppo' | 'vivo' | 'huawei' | 'asus' | 'outra';

export function marcaDe(fabricante: string | null | undefined): Marca {
  const f = (fabricante ?? '').toLowerCase();
  if (/xiaomi|redmi|poco/.test(f)) return 'xiaomi';
  if (f.includes('samsung')) return 'samsung';
  if (/oppo|realme|oneplus/.test(f)) return 'oppo';
  if (/vivo|iqoo/.test(f)) return 'vivo';
  if (/huawei|honor/.test(f)) return 'huawei';
  if (f.includes('asus')) return 'asus';
  return 'outra';
}

/** Tela da restrição de bateria do Navalha, em ordem de tentativa. */
export function telasBateria(fabricante: string | null | undefined): TelaAjuste[] {
  const especificas: Record<Marca, TelaAjuste[]> = {
    // Abre direto "Economia de bateria" do app (Nenhuma restrição / Economia / Restringir).
    xiaomi: [
      tela('com.miui.securitycenter', 'com.miui.powercenter.legacypowerrank.PowerDetailActivity', { package_name: PACOTE }),
      tela('com.miui.powerkeeper', 'com.miui.powerkeeper.ui.HiddenAppsConfigActivity', { package_name: PACOTE, package_label: 'Navalha' }),
    ],
    samsung: [],
    oppo: [],
    vivo: [],
    huawei: [tela('com.huawei.systemmanager', 'com.huawei.systemmanager.power.ui.HwPowerManagerActivity')],
    asus: [tela('com.asus.mobilemanager', 'com.asus.mobilemanager.powersaver.PowerSaverSettings')],
    outra: [],
  };
  return [...especificas[marcaDe(fabricante)], BATERIA_DO_APP, DETALHES_DO_APP];
}

/** O que a pessoa faz na tela que abrir (o texto acompanha a marca). */
export function passosBateria(fabricante: string | null | undefined): string {
  switch (marcaDe(fabricante)) {
    case 'xiaomi': return 'Escolha “Nenhuma restrição”.';
    case 'samsung': return 'Escolha “Sem restrições” (ou ligue “Permitir uso em segundo plano”).';
    case 'huawei': return 'Deixe o Navalha sem restrição de bateria.';
    default: return 'Ligue “Permitir uso em segundo plano” (ou escolha “Sem restrições”).';
  }
}
