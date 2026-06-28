package com.adspread.android.presentation.screen.diagnostic

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * 诊断页（spec §14 / Task A10）。
 *
 * 一页式设备信息面板：deviceCode/version/IP/磁盘/最近同步/最近错误。
 * 操作：手动同步、服务器切换、恢复出厂（二次确认）。
 *
 * 门店展示端无人值守，诊断页密码保护（由 [MainActivity][com.adspread.android.app.MainActivity]
 * 多点触控入口触发）。
 */
@Composable
fun DiagnosticScreen(
    onNavigateToSetup: () -> Unit,
    onRestartApp: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: DiagnosticViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val factoryResetDone by viewModel.factoryResetDone.collectAsState()

    // 恢复出厂后导航到 SetupScreen
    if (factoryResetDone) {
        viewModel.onNavigatedToSetup()
        onNavigateToSetup()
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // 标题
            Text(
                text = "设备诊断",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Spacer(Modifier.height(16.dp))

            // 信息卡片
            InfoCard(uiState)
            Spacer(Modifier.height(16.dp))

            // 操作按钮组
            ActionButtons(
                isSyncing = uiState.isSyncing,
                syncResult = uiState.syncResult,
                onManualSync = viewModel::manualSync,
                onFactoryReset = viewModel::requestFactoryReset,
            )
        }
    }

    // 恢复出厂二次确认对话框
    if (uiState.showFactoryResetConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::cancelFactoryReset,
            title = { Text("恢复出厂设置") },
            text = {
                Text("此操作将清除设备绑定信息、素材缓存和本地节目数据。\n\n" +
                        "设备将回到首启配置页，需要重新绑定。\n\n" +
                        "确认继续？")
            },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmFactoryReset,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("确认恢复")
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::cancelFactoryReset) {
                    Text("取消")
                }
            },
        )
    }
}

@Composable
private fun InfoCard(state: DiagnosticUiState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            InfoRow("设备编码", state.deviceCode)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("App 版本", state.appVersion)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("服务器地址", state.serverUrl)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("IP 地址", state.ipAddress)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("磁盘空间", formatBytes(state.diskFreeBytes) + " / " + formatBytes(state.diskTotalBytes))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("素材缓存", formatBytes(state.materialCacheSize))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("Socket 连接", state.socketState)
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
            InfoRow("最近同步", state.lastSyncTime)

            if (state.lastError != null) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
                InfoRow("最近错误", state.lastError, isError = true)
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String, isError: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(100.dp),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ActionButtons(
    isSyncing: Boolean,
    syncResult: String?,
    onManualSync: () -> Unit,
    onFactoryReset: () -> Unit,
) {
    // 手动同步
    Button(
        onClick = onManualSync,
        enabled = !isSyncing,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(if (isSyncing) "同步中..." else "手动同步")
    }

    if (syncResult != null) {
        Spacer(Modifier.height(8.dp))
        Text(
            text = syncResult,
            style = MaterialTheme.typography.bodySmall,
            color = if (syncResult.startsWith("同步失败") || syncResult.startsWith("未绑定"))
                MaterialTheme.colorScheme.error
            else
                MaterialTheme.colorScheme.secondary,
        )
    }

    Spacer(Modifier.height(24.dp))
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    Spacer(Modifier.height(16.dp))

    // 恢复出厂
    OutlinedButton(
        onClick = onFactoryReset,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = MaterialTheme.colorScheme.error,
        ),
    ) {
        Text("恢复出厂设置")
    }
}

/** 字节数→人类可读字符串。 */
internal fun formatBytes(bytes: Long): String = when {
    bytes < 0L -> "未知"
    bytes < 1024L -> "$bytes B"
    bytes < 1024L * 1024L -> "${bytes / 1024} KB"
    bytes < 1024L * 1024L * 1024L -> "${bytes / (1024 * 1024)} MB"
    else -> "%.1f GB".format(bytes.toDouble() / (1024 * 1024 * 1024))
}
