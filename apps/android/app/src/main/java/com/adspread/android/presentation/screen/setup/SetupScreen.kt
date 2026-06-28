package com.adspread.android.presentation.screen.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * 首启配置页（spec §9）。
 *
 * 装机人员输入后端服务器地址 + 设备编码 → bind → 导航到 PlayerScreen。
 * 错误提示友好分类（DEVICE_NOT_FOUND / 网络不可达）。
 */
@Composable
fun SetupScreen(
    onBound: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SetupViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    // 绑定成功后导航消费一次
    if (uiState.boundSuccess) {
        viewModel.onNavigatedToPlayer()
        onBound()
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = "设备绑定",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = "请将设备接入网络，并输入以下信息",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Spacer(Modifier.height(32.dp))

                // 服务器地址
                OutlinedTextField(
                    value = uiState.serverUrl,
                    onValueChange = viewModel::onServerUrlChange,
                    label = { Text("服务器地址") },
                    placeholder = { Text("http://192.168.1.100:3000") },
                    singleLine = true,
                    enabled = !uiState.isBinding,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Next,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                Spacer(Modifier.height(16.dp))

                // 设备编码
                OutlinedTextField(
                    value = uiState.deviceCode,
                    onValueChange = viewModel::onDeviceCodeChange,
                    label = { Text("设备编码") },
                    placeholder = { Text("输入后台预建的设备编码") },
                    singleLine = true,
                    enabled = !uiState.isBinding,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = { if (!uiState.isBinding) viewModel.bind() },
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                Spacer(Modifier.height(8.dp))

                // 错误提示
                if (uiState.error != null) {
                    Text(
                        text = uiState.error!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                                shape = RoundedCornerShape(8.dp),
                            )
                            .padding(12.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                }

                Spacer(Modifier.height(16.dp))

                // 绑定按钮
                Button(
                    onClick = { viewModel.bind() },
                    enabled = !uiState.isBinding,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    if (uiState.isBinding) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("绑定设备")
                    }
                }
            }
        }
    }
}
