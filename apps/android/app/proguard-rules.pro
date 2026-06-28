# ProGuard / R8 规则（占位）
#
# A0 阶段仅创建占位文件；各依赖的 keep 规则在对应 Task 接入时补充：
# - Hilt / Retrofit / Socket.io / Room / kotlinx.serialization 等反射相关 keep
# - ExoPlayer / Coil 自带 consumer rules 通常自动合并
#
# release 构建启用 minify 后再细化。

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Retrofit
-keepattributes Signature, Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
