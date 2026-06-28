// ADSpread Android root build script.
// 各插件在 :app 模块按需 apply；此处仅声明版本，不 apply（plan K1）。
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
