package com.adspread.android.domain.sync

import com.adspread.android.domain.model.MaterialRef

/**
 * 素材同步差量结果。
 *
 * @param toDownload 需下载（新增 + 字段变更的更新）
 * @param toDelete 需删除（旧有新无）
 * @param unchanged 无变化（id 与全部字段均一致）
 */
data class SyncDiff(
    val toDownload: List<MaterialRef>,
    val toDelete: List<MaterialRef>,
    val unchanged: List<MaterialRef>,
)

/**
 * 素材同步差量解析器（spec §5.3）。
 *
 * 比对新旧素材清单，输出下载/删除/无变化队列，供 `SyncWorker` 入 `download_queue` 与
 * `MaterialStore` LRU 清理决策。
 *
 * **判定依据**：按 [MaterialRef.id] 配对，整体字段相等性（data class `equals`）判定更新。
 * plan A1 原述"按 id + version/updatedAt"，但 sync DTO（`MaterialDto`）不下发 per-material
 * `updatedAt`/`version`（仅全局 version 作 ETag），故按字段相等性判定——这是与 DTO 契约对齐
 * 的必要偏离：任何字段变化（`fileUrl`/`duration`/`fileSize` 等）均触发重下载，保证素材一致。
 */
class SyncResolver {

    fun resolve(oldMaterials: List<MaterialRef>, newMaterials: List<MaterialRef>): SyncDiff {
        val oldById = oldMaterials.associateBy { it.id }
        val newById = newMaterials.associateBy { it.id }

        val toDownload = mutableListOf<MaterialRef>()
        val unchanged = mutableListOf<MaterialRef>()

        for (newMat in newMaterials) {
            val oldMat = oldById[newMat.id]
            when {
                oldMat == null -> toDownload += newMat       // 新增
                oldMat != newMat -> toDownload += newMat      // 更新（任一字段不同）
                else -> unchanged += newMat                   // 无变化
            }
        }

        val toDelete = oldMaterials.filter { it.id !in newById }

        return SyncDiff(toDownload, toDelete, unchanged)
    }
}
