# 安装 BlackHole + 配置 Multi-Output Device

Labels: wayfinder:task

Status: open
Type: task
Blocked by: 06

## Question

在本机（M2 MacBook Air, macOS 14.4.1）完成 BlackHole 安装并验证 Multi-Output Device 可被会议软件识别为输入设备：

1. **安装方式选择**（最终选一个并执行）：
   - (a) `brew install blackhole-2ch`（推荐路径，需要先确认 brew 仓库是否支持 Apple Silicon）
   - (b) GitHub releases 下载 `.pkg` 安装（官方 README 推荐路径）
   - (c) 源码编译（仅当 (a)(b) 都失败时）
2. **版本选择**：BlackHole 2ch 还是 16ch？2ch 足够本 PoC（单声道输入），16ch 用于多路混音但本 PoC 用不到。
3. **安装后验证**：
   - `system_profiler SPAudioDataType` 能否看到 BlackHole 设备？
   - Audio MIDI Setup (Audio MIDI Setup.app) 能否看到 BlackHole？
   - 是否需要重启？（BlackHole README 说需要，但有时不重启也工作）
4. **Multi-Output Device 创建**：
   - 在 Audio MIDI Setup.app 里建一个 Aggregate / Multi-Output Device
   - 包含：本机内置扬声器/耳机输出 + BlackHole 输入（用于 R3 出方向，"用户麦克风"指向 BlackHole）
   - 测试：把系统声音输出切到这个 Multi-Output Device，确认扬声器 + BlackHole 都能收到声音
5. **权限检查**：macOS 14 对音频设备的权限要求？是否需要在"系统设置 → 隐私与安全性 → 麦克风 / 辅助功能"授权？
6. **已知问题**：M2 + macOS 14.4.1 下是否有已知 bug（如采样率不匹配、设备消失、权限弹窗不出现）？

完成后输出：「BlackHole 安装截图 + `system_profiler` 输出 + Multi-Output Device 配置截图」。

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
