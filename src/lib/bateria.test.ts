import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACOTE, marcaDe, passosBateria, telasBateria } from './bateria';

test('bateria: cada marca reconhecida pelo nome que o celular informa', () => {
  assert.equal(marcaDe('Xiaomi'), 'xiaomi');
  assert.equal(marcaDe('POCO'), 'xiaomi');
  assert.equal(marcaDe('samsung'), 'samsung');
  assert.equal(marcaDe('OnePlus'), 'oppo');
  assert.equal(marcaDe('HONOR'), 'huawei');
  assert.equal(marcaDe('motorola'), 'outra');
  assert.equal(marcaDe(null), 'outra');
});

test('bateria: a tela da marca vem primeiro e a do Android sempre fecha a lista', () => {
  const xiaomi = telasBateria('Xiaomi');
  assert.equal(xiaomi[0].classe, 'com.miui.powercenter.legacypowerrank.PowerDetailActivity');
  assert.deepEqual(xiaomi[0].extras, { package_name: PACOTE });
  for (const m of ['Xiaomi', 'samsung', 'motorola', 'OPPO', 'HUAWEI', null]) {
    const l = telasBateria(m);
    assert.equal(l.at(-2)!.acao, 'android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL');
    assert.equal(l.at(-1)!.acao, 'android.settings.APPLICATION_DETAILS_SETTINGS'); // existe em todo Android
    assert.equal(l.at(-1)!.dados, `package:${PACOTE}`);
  }
  // Motorola, Samsung e marcas desconhecidas: direto na página padrão de bateria do app.
  assert.equal(telasBateria('motorola')[0].acao, 'android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL');
});

test('bateria: o texto acompanha a marca', () => {
  assert.match(passosBateria('Xiaomi'), /Nenhuma restrição/);
  assert.match(passosBateria('motorola'), /segundo plano/);
});
