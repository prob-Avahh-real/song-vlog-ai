# 曲影 AI (SongVlog AI)

喂给它任何一首歌，根据 **lyric · mood · rhythm · vibe · flow · tempo** 等维度理解音乐，自动生成不限时长的 vlog 视频。

## 目标平台

| 平台 | 方式 | 命令 |
|------|------|------|
| 🍎 iOS | Capacitor → Xcode → IPA | `./build.sh` → `open ios/App/App.xcworkspace` |
| 🤖 Android | Capacitor → Gradle → APK | `./build.sh` → `cd android && ./gradlew assembleDebug` |
| ⌚ 手表 | 窄屏自适应 + 触屏 | 同 APK |
| 👓 智能眼镜 | 窄FOV + 语音控制 | 说「生成/导出/暂停/重播」 |
| 💍 智能戒指 | DeviceOrientation 倾角 | 左右倾斜→切换分镜，上下→播放/暂停 |
| 🦯 智能手杖 | DeviceMotion 加速度 | 敲击→播放/暂停，挥动→重新渲染 |
| 🌐 Web | Vite 开发服务器 | `npm run dev` 或 `./serve.sh` |

## 技术栈（v2 重构）

| 层级 | 技术 | 职责 |
|------|------|------|
| 构建 | **Vite + TypeScript** | 模块化、类型安全、Tree-shaking |
| 音频分析 | **Essentia.js** (MTG/UPF WASM) + 本地降级 | BeatTrackerMultiFeature · KeyExtractor · Danceability |
| 情绪理解 | 本地分类器 | mood / flow / vibe 多维标签 |
| 分镜规划 | `story/planner` + 可选 **OpenAI API** | 段落→场景→字幕/主题映射 |
| 视频渲染 | **Canvas 2D** 主题引擎 | 9 种视觉主题，节拍同步 |
| 视频编码 | **FFmpeg.wasm**（Web 离线加速） | 帧离线渲染 + H.264/AAC MP4，速度快于实时 |
| 移动降级 | **MediaRecorder** | Capacitor 移动端自动降级实时录制 |
| 原生包装 | **Capacitor 6** | iOS/Android APK/IPA |

## 架构

```
src/
├── audio/          # Essentia.js WASM 引擎 + Worker + 本地降级
├── story/          # 歌词对齐、分镜规划
├── ai/             # LLM 分镜增强（可选）
├── render/         # Canvas 帧渲染 + 主题
├── export/         # FFmpeg.wasm / MediaRecorder 双通道导出
├── devices/        # 戒指/手杖/眼镜输入
└── ui/             # 应用状态机与界面
```

## 核心流程

1. **输入** — 上传音频（长度不限）+ 可选歌词/LRC
2. **分析**（Worker + Essentia）— RhythmExtractor2013 · KeyExtractor · Danceability → mood/flow/vibe
3. **分镜** — 每段落匹配主题+字幕；可选 AI 增强文案
4. **渲染** — 离线逐帧绘制（Web）或实时录制（移动端）
5. **导出** — MP4（Web）或 WebM（移动端降级）

## 命令

```bash
npm install
npm run dev          # 开发 http://localhost:3000
./serve.sh           # 构建 + 预览 http://localhost:8888
./build.sh           # 构建 + Capacitor sync → iOS/Android
```
