package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.service.orchestration.PlayerController
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 恢复播放处理器（`command:resume`）。
 *
 * 调用 [PlayerController.rebuild] 触发编排重解析并重建各 region 播放。
 * rebuild 保留 sessionPlayer + scope，仅释放 region 级资源后重新 resolve 节目。
 */
@Singleton
class ResumeHandler @Inject constructor(
    private val playerController: PlayerController,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        playerController.rebuild()
        return CommandResult.SUCCESS
    }
}
