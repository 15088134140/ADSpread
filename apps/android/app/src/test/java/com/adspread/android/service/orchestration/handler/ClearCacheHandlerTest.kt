package com.adspread.android.service.orchestration.handler

import android.content.Context
import com.adspread.android.data.remote.socket.CommandPayload
import com.adspread.android.domain.command.CommandResult
import com.google.common.truth.Truth.assertThat
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.io.File

/** [ClearCacheHandler] 单测：缓存目录清理、不存在时跳过。 */
class ClearCacheHandlerTest {

    private lateinit var context: Context
    private lateinit var handler: ClearCacheHandler
    private lateinit var filesDir: File

    @BeforeEach
    fun setup() {
        filesDir = createTempDir("adspread-cache-test")
        context = mockk()
        every { context.filesDir } returns filesDir
        handler = ClearCacheHandler(context)
    }

    @Test
    fun `returns SUCCESS when cache directory does not exist`() {
        val result = handler.execute(CommandPayload.Empty)

        assertThat(result).isEqualTo(CommandResult.SUCCESS)
    }

    @Test
    fun `clears materials directory and recreates it`() {
        // Create a materials dir with some files
        val materialsDir = File(filesDir, "materials")
        materialsDir.mkdirs()
        File(materialsDir, "test.txt").writeText("hello")
        File(materialsDir, "sub").mkdirs()
        File(materialsDir, "sub/nested.txt").writeText("nested")

        assertThat(materialsDir.exists()).isTrue()
        assertThat(materialsDir.listFiles()?.size ?: 0).isGreaterThan(0)

        val result = handler.execute(CommandPayload.Empty)

        assertThat(result).isEqualTo(CommandResult.SUCCESS)
        assertThat(materialsDir.exists()).isTrue()
        assertThat(materialsDir.listFiles()?.size ?: 0).isEqualTo(0)
    }

    @Test
    fun `returns SUCCESS for empty materials directory`() {
        val materialsDir = File(filesDir, "materials")
        materialsDir.mkdirs()

        val result = handler.execute(CommandPayload.Empty)

        assertThat(result).isEqualTo(CommandResult.SUCCESS)
        assertThat(materialsDir.exists()).isTrue()
    }
}
