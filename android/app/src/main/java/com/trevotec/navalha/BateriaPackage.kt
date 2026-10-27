package com.trevotec.navalha

import android.content.Context
import android.os.PowerManager
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

// Navalha: diz se o Android já deixa o app sem restrição de bateria (lista de exceções da otimização). Com isso a tela
// "Receba os avisos com o app fechado" nem aparece para quem já liberou. Só consulta: não pede a permissão
// REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, que a Google Play restringe.
class BateriaModule(contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {
  override fun getName() = NOME

  @ReactMethod
  fun liberada(promise: Promise) {
    val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
  }

  companion object { const val NOME = "NavalhaBateria" }
}

class BateriaPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == BateriaModule.NOME) BateriaModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(BateriaModule.NOME to ReactModuleInfo(BateriaModule.NOME, BateriaModule::class.java.name, false, false, false, false))
  }
}
