#!/usr/bin/env bash
# 分层守卫：domain 包必须保持纯 Kotlin，禁止引用 android.* / Hilt / Room / Retrofit / OkHttp / Media3 / Socket.io
# 依据：spec §2 依赖方向、plan §K2。
#
# 用法：bash .ai/scripts/check-domain-purity.sh
# 命中禁止 import 即以非零码退出（供 CI / 本地校验使用）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOMAIN_DIR="$ROOT_DIR/apps/android/app/src/main/java/com/adspread/android/domain"

if [ ! -d "$DOMAIN_DIR" ]; then
  echo "[check-domain-purity] SKIP: domain 目录尚不存在 ($DOMAIN_DIR)"
  exit 0
fi

# 禁止的 import 前缀：Android 平台 + 所有运行时框架（domain 仅依赖纯 Kotlin / kotlinx）
PATTERN='^import (android\.|androidx\.|dagger\.|retrofit2\.|okhttp3\.|com\.squareup\.|androidx\.room\.|androidx\.media3\.|io\.socket\.)'

matches=$(grep -rnE "$PATTERN" "$DOMAIN_DIR" 2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "[check-domain-purity] FAIL: domain 层发现禁止的 import：" >&2
  echo "$matches" >&2
  echo "" >&2
  echo "domain 必须为纯 Kotlin，不得引用 android.* / Hilt / Room / Retrofit / OkHttp / Media3 / Socket.io（spec §2 / plan K2）。" >&2
  exit 1
fi

echo "[check-domain-purity] OK: domain 层无 android / 框架 import"
