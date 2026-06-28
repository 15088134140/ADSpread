package com.adspread.android.domain.sync

import com.adspread.android.domain.model.MaterialRef
import com.adspread.android.domain.model.MaterialType
import com.google.common.truth.Truth.assertThat
import org.junit.jupiter.api.Test

/** [SyncResolver] 单测：diff 新增/更新/删除/无变化。 */
class SyncResolverTest {

    private val resolver = SyncResolver()

    private fun mat(id: Int, name: String = "m$id", url: String = "u$id", size: Long = 100L) = MaterialRef(
        id = id, name = name, type = MaterialType.IMAGE, fileUrl = url,
        fileSize = size, fileExtension = "jpg", width = null, height = null,
        duration = null, thumbnailUrl = null,
    )

    @Test
    fun `empty old and new yields empty diff`() {
        val diff = resolver.resolve(emptyList(), emptyList())
        assertThat(diff.toDownload).isEmpty()
        assertThat(diff.toDelete).isEmpty()
        assertThat(diff.unchanged).isEmpty()
    }

    @Test
    fun `new material not in old goes to toDownload`() {
        val diff = resolver.resolve(emptyList(), listOf(mat(1)))
        assertThat(diff.toDownload).containsExactly(mat(1))
        assertThat(diff.toDelete).isEmpty()
        assertThat(diff.unchanged).isEmpty()
    }

    @Test
    fun `old material not in new goes to toDelete`() {
        val diff = resolver.resolve(listOf(mat(1)), emptyList())
        assertThat(diff.toDelete).containsExactly(mat(1))
        assertThat(diff.toDownload).isEmpty()
        assertThat(diff.unchanged).isEmpty()
    }

    @Test
    fun `identical material goes to unchanged`() {
        val m = mat(1)
        val diff = resolver.resolve(listOf(m), listOf(m))
        assertThat(diff.unchanged).containsExactly(m)
        assertThat(diff.toDownload).isEmpty()
        assertThat(diff.toDelete).isEmpty()
    }

    @Test
    fun `updated material with changed url goes to toDownload`() {
        val old = mat(1, url = "old")
        val new = mat(1, url = "new")
        val diff = resolver.resolve(listOf(old), listOf(new))
        assertThat(diff.toDownload).containsExactly(new)
        assertThat(diff.unchanged).isEmpty()
        assertThat(diff.toDelete).isEmpty()
    }

    @Test
    fun `fileSize change triggers redownload`() {
        val old = mat(1, size = 100L)
        val new = mat(1, size = 200L)
        val diff = resolver.resolve(listOf(old), listOf(new))
        assertThat(diff.toDownload).containsExactly(new)
        assertThat(diff.unchanged).isEmpty()
    }

    @Test
    fun `mixed diff partitions correctly`() {
        val oldOnly = mat(1)                    // 删除
        val unchanged = mat(2)                  // 无变化
        val updatedOld = mat(3, url = "old3")   // 更新
        val updatedNew = mat(3, url = "new3")
        val newOnly = mat(4)                    // 新增

        val diff = resolver.resolve(
            oldMaterials = listOf(oldOnly, unchanged, updatedOld),
            newMaterials = listOf(unchanged, updatedNew, newOnly),
        )
        assertThat(diff.toDownload).containsExactly(updatedNew, newOnly)
        assertThat(diff.toDelete).containsExactly(oldOnly)
        assertThat(diff.unchanged).containsExactly(unchanged)
    }

    @Test
    fun `toDownload and toDelete are disjoint by id`() {
        val diff = resolver.resolve(
            oldMaterials = listOf(mat(1), mat(2)),
            newMaterials = listOf(mat(2), mat(3)),
        )
        val downloadIds = diff.toDownload.map { it.id }
        val deleteIds = diff.toDelete.map { it.id }
        assertThat(downloadIds.intersect(deleteIds.toSet())).isEmpty()
    }
}
