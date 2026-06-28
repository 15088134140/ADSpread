package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.service.orchestration.PlayerController
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 强制切换节目处理器（`command:switch_program`）。
 *
 * V1 调用 [PlayerController.rebuild] 触发编排重解析。实际节目切换依赖于 [LocalScheduleEngine]
 * 当前调度结果 —— 若后端已将目标节目推入 PublishPlan 则立即生效，否则维持当前节目。
 * 后续版本会为 PlayerController 补充 overrideProgramId 标记以支持绕过调度强制切换。
 */
@Singleton
class SwitchProgramHandler @Inject constructor(
    private val playerController: PlayerController,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        // V1: rebuild 触发 PlayerController 重解析；override 标记待后续实现
        playerController.rebuild()
        return CommandResult.SUCCESS
    }
}
