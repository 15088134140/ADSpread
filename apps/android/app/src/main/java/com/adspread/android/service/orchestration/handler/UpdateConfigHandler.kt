package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.local.prefs.SecurePrefs
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 更新设备配置处理器（`command:update_config`）。
 *
 * 将指令携带的 [JsonObject] config 持久化至 [SecurePrefs]（KEY = "rawConfig"），
 * 与 [DeviceConfigStore][com.adspread.android.data.local.prefs.DeviceConfigStore] 管理的
 * 结构化配置（DeviceConfigDto）独立存储，避免绑定时覆盖。
 *
 * 消费侧（如 PlayerService 启动时）可读取此 rawConfig 并与 DeviceConfigDto 合并生效；
 * V1 暂不实现运行时即时生效，下次进程启动或 bind 时从两边读取合并。
 *
 * **配置验证**：V1 不做完整 schema 校验；存储原始 JSON，解析失败降级默认值。
 */
@Singleton
class UpdateConfigHandler @Inject constructor(
    private val securePrefs: SecurePrefs,
    private val json: Json,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        val config = (payload as CommandPayload.UpdateConfig).config
        return try {
            val configStr = json.encodeToString(JsonObject.serializer(), config)
            securePrefs.put(KEY_RAW_CONFIG, configStr)
            CommandResult.SUCCESS
        } catch (e: Exception) {
            CommandResult.FAILED
        }
    }

    private companion object {
        const val KEY_RAW_CONFIG = "rawConfig"
    }
}
