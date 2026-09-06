# macOS 音频路由选项对比

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

在 macOS 14.4.1（M2 MacBook Air）上实现"系统音频回采（R4）+ 虚拟麦克风输出（R3）+ 防反馈环"三种能力，各方案对比：

| 维度 | BlackHole + Multi-Output Device | Process Tap (macOS 14+) | ScreenCaptureKit (TransEcho 思路) |
|---|---|---|---|
| 系统音频回采 |  |  |  |
| 虚拟麦克风输出 |  |  |  |
| 防反馈隔离 |  |  |  |
| 安装复杂度 |  |  |  |
| 延迟 |  |  |  |
| CPU 占用 |  |  |  |
| 系统权限要求 |  |  |  |
| Apple Silicon 兼容性 |  |  |  |
| 与会议软件兼容性（Zoom / Teams / 腾讯会议） |  |  |  |
| 多应用同时回采 |  |  |  |
| 文档 / 社区支持成熟度 |  |  |  |
| 已知 bug / 限制 |  |  |  |

具体要回答的问题：

1. **BlackHole**：当前最新版本（2.x？）是否原生支持 Apple Silicon？是否需要重启？Multi-Output Device 创建后能否被 Zoom / Teams 直接选为"输入设备"？免费 vs 付费（BlackHole 是免费开源，但有人提到有"BlackHole 16ch 付费版"）？
2. **Process Tap**（macOS 14 Sonoma 引入的 `Audio Hardware APIs`）：能否在 R3 出方向（输出虚拟麦克风）也用？还是只能做回采？Zoom / Teams 是否兼容作为输入源？
3. **ScreenCaptureKit**：TransEcho 用了，但 ScreenCaptureKit 主要设计为视频捕获，音频捕获能力是否够用（采样率、声道数、延迟）？权限弹窗是否对用户友好？
4. **混合方案**：是否可以 BlackHole 做 R3 + ScreenCaptureKit 做 R4（绕开 BlackHole 回采）？这种组合的复杂度是否反而更高？
5. **Apple Silicon（M2）实测**：三个方案在 M2 上 vs Intel Mac 上是否有性能差异（已知 M2 的音频子系统有硬件加速差异）？

最终交付：填满上面的对比表 + 推荐组合（带 reasoning）。**注意**：这一票只产出选项与对比，**不决策**——决策是 T10 (音色克隆) + T12 (总线隔离 prototype) 票的事。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/06-macos-audio-routing-options.md`

BlackHole 2ch (R3, v0.7.1 GPL-3.0, 原生 AS, 唯一能做 R3 虚拟 mic 的方案) 是唯一成熟路径; Process Tap (macOS 14.2+, R4) 与 ScreenCaptureKit (macOS 13+, R4) 都不是输出设备, 故 R3 维度 N/A; ScreenCaptureKit 采样率仅 8000/16000/24000/48000 Hz (对齐火山 16k, 但不支持 44.1/96k).

推荐组合 (候选, 非决策): **BlackHole 2ch (R3 输出 + Multi-Output Device) + ScreenCaptureKit `excludesCurrentProcessAudio=true` (R4 回采)** — BlackHole 装在系统层做虚拟 mic (会议软件直接选), SCC 在 app 层抓进程音频并排除自家防止反馈, 系统音频总线不动 → 避免 Multi-Output drift bug (#824). 风险点: BlackHole #793 (M3 + Sonoma 14.5 偶发 "不出现") 需 PoC 复测; SCC 屏幕录制权限弹窗需 onboarding 文案. 决策权归 T10 + T12.

## Comments

<!-- conversation history -->
