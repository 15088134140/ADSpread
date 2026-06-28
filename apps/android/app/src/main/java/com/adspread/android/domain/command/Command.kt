package com.adspread.android.domain.command

/**
 * 远程指令类型（对齐 spec §6.2 设备端权威事件集 +
 * `packages/api-contracts/device/types.ts` 的 `DEVICE_COMMAND_EVENTS` / `REJECTED_COMMAND_EVENTS`）。
 *
 * - [supported]=true 的指令由 A8 `CommandRouter` 实现 handler
 * - [supported]=false 的指令（[RESTART_DEVICE]/[POWER_SCHEDULE]）回 `UNSUPPORTED` ack
 *   （D1：普通盒子无系统签名不可行）
 *
 * 事件名沿用后端文档 `a:b` 命名风格（统一 B3）。
 */
enum class Command(val event: String, val supported: Boolean) {
    SCREENSHOT("command:screenshot", true),
    VOLUME("command:volume", true),
    BRIGHTNESS("command:brightness", true),
    STOP("command:stop", true),
    RESUME("command:resume", true),
    RELOAD("command:reload", true),
    CLEAR_CACHE("command:clear_cache", true),
    FETCH_LOGS("command:fetch_logs", true),
    RESTART_APP("command:restart_app", true),
    UPDATE_CONFIG("command:update_config", true),
    SWITCH_PROGRAM("command:switch_program", true),
    RESTART_DEVICE("command:restart_device", false),
    POWER_SCHEDULE("command:power_schedule", false);

    companion object {
        /** 按 Socket.io 事件名解析指令；未知事件返回 null。 */
        fun fromEvent(event: String): Command? = entries.firstOrNull { it.event == event }
    }
}

/** 指令执行结果（供 ack 回传 `device:ack { result }`）。 */
enum class CommandResult {
    SUCCESS,
    UNSUPPORTED,
    FAILED,
}

/**
 * 指令路由器端口（spec §6.2/§7.1，A8 实现）。
 *
 * 消费 WS/轮询指令，分发到各 handler 并回 ack。
 * `supported=false` 的指令直接返回 [CommandResult.UNSUPPORTED]。
 */
interface CommandRouter {
    /** 路由并执行指令，返回执行结果。 */
    fun dispatch(command: Command): CommandResult
}
