package com.adspread.android.service.orchestration.handler

import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.adspread.android.service.orchestration.PlayerController
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 停止播放处理器（`command:stop`）。
 *
 * 调用 [PlayerController.stop] 停止全部 region 播放并释放 ExoPlayer 资源。
 * Service 编程序列不受影响（心跳/进度/看门狗继续运行），播放将在下次 schedule tick
 * 或 resume 指令后恢复。
 */
@Singleton
class StopHandler @Inject constructor(
    private val playerController: PlayerController,
) : CommandHandler {

    override fun execute(payload: CommandPayload): CommandResult {
        playerController.stop()
        return CommandResult.SUCCESS
    }
}
