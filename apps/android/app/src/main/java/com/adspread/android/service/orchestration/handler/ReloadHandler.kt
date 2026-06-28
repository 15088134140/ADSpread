package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.service.orchestration.PlayerController
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 重新加载节目处理器（`command:reload`）。
 *
 * 调用 [PlayerController.rebuild] 重新解析当前节目并重建各 region 播放。
 * 与 [ResumeHandler] 区别：reload 用于强制刷新节目内容（如素材已更新需重新装载），
 * resume 用于从停止状态恢复。
 *
 * V1 两者均调用 rebuild（PlayerController 内部从 schedule 上次解析结果重建 region）；
 * 后续可区分 reload 清除内部播放状态再重建（如重新拉取节目数据）。
 */
@Singleton
class ReloadHandler @Inject constructor(
    private val playerController: PlayerController,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        playerController.rebuild()
        return CommandResult.SUCCESS
    }
}
