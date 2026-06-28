package com.adspread.android.domain.playback

import com.adspread.android.domain.model.MaterialRef
import com.adspread.android.domain.model.MaterialType
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test

/** [Playlist] / [PlaylistItem] 单测：时长换算（秒→毫秒、视频自身时长、视频 null 回退）。 */
class PlaylistTest {

    private fun ref(id: Int, type: MaterialType, duration: Int? = null) = MaterialRef(
        id = id, name = "m$id", type = type, fileUrl = "u$id",
        fileSize = 100L,
        fileExtension = if (type == MaterialType.VIDEO) "mp4" else "jpg",
        width = null, height = null, duration = duration, thumbnailUrl = null,
    )

    private fun item(id: Int, durationSec: Int, ref: MaterialRef) = PlaylistItem(id, durationSec, ref)

    @Test
    fun `image duration converts seconds to milliseconds`() {
        val item = item(1, durationSec = 10, ref = ref(1, MaterialType.IMAGE))
        assertThat(item.durationMs()).isEqualTo(10_000L)
    }

    @Test
    fun `image with fractional-like duration still multiplies by 1000`() {
        val item = item(1, durationSec = 5, ref = ref(1, MaterialType.IMAGE))
        assertThat(item.durationMs()).isEqualTo(5_000L)
    }

    @Test
    fun `video uses material duration not item duration`() {
        val item = item(1, durationSec = 10, ref = ref(1, MaterialType.VIDEO, duration = 30))
        // 配置 10s，但视频按自身 30s 播放
        assertThat(item.durationMs()).isEqualTo(30_000L)
    }

    @Test
    fun `video with null material duration falls back to item duration`() {
        val item = item(1, durationSec = 15, ref = ref(1, MaterialType.VIDEO, duration = null))
        assertThat(item.durationMs()).isEqualTo(15_000L)
    }

    @Test
    fun `playlist durationsMs matches items order`() {
        val image = item(1, 5, ref(1, MaterialType.IMAGE))                          // 5000
        val video = item(2, 10, ref(2, MaterialType.VIDEO, duration = 20))           // 20000
        val playlist = Playlist(listOf(image, video))
        assertThat(playlist.durationsMs()).containsExactly(5_000L, 20_000L).inOrder()
    }

    @Test
    fun `playlist totalDurationMs sums all items`() {
        val image = item(1, 5, ref(1, MaterialType.IMAGE))                          // 5000
        val video = item(2, 10, ref(2, MaterialType.VIDEO, duration = 20))           // 20000
        val playlist = Playlist(listOf(image, video))
        assertThat(playlist.totalDurationMs()).isEqualTo(25_000L)
    }

    @Test
    fun `empty playlist has zero total duration`() {
        val playlist = Playlist(emptyList())
        assertThat(playlist.durationsMs()).isEmpty()
        assertThat(playlist.totalDurationMs()).isEqualTo(0L)
    }

    @Test
    fun `default mode is LOOP`() {
        val playlist = Playlist(emptyList())
        assertThat(playlist.mode).isEqualTo(PlaylistMode.LOOP)
    }

    @Test
    fun `explicit SEQUENTIAL mode is respected`() {
        val playlist = Playlist(emptyList(), PlaylistMode.SEQUENTIAL)
        assertThat(playlist.mode).isEqualTo(PlaylistMode.SEQUENTIAL)
    }
}
