#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎬 曲影 AI · Native App Builder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[[ ! -d node_modules ]] && npm install
npm run build

if [[ ! -d ios ]]; then
  echo "🍎 初始化 iOS 平台..."
  npx cap add ios
fi
if [[ ! -d android ]]; then
  echo "🤖 初始化 Android 平台..."
  npx cap add android
fi

npx cap sync

echo ""
echo "✅ 构建完成！"
echo "  🍎 iOS:  open ios/App/App.xcworkspace"
echo "  🤖 APK:  cd android && ./gradlew assembleDebug"
