# macOS 音频路由选项对比 — Findings

**Ticket**: `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md`
**Target env**: M2 MacBook Air, macOS 14.4.1
**Role**: 选项对比 + 推荐候选 (非决策, 决策是 T10 + T12 的事)
**Sources**: primary = Apple developer docs, BlackHole GitHub, Existential Audio 官网; bug evidence = GitHub Issues (issue URL as primary source)

---

## TL;DR (one-paragraph)

三个方案能力面 **完全不同**: BlackHole 是用户态可见的 **虚拟音频设备** (HAL PlugIn, R3 出 + R4 回采都靠 Multi-Output Device 绕), Process Tap 是 **进程级系统音频回采** (R4, 跑在 macOS 14.2+, 仅输出侧, 不暴露为输入), ScreenCaptureKit 是 **屏幕/进程音频回采** (R4, 不输出, 不暴露为输入). 因此这张表里 "Process Tap 做 R3" 和 "ScreenCaptureKit 做 R3" 在原意层面就是 **NOT APPLICABLE** (它们不是输出设备). BlackHole + Multi-Output Device 是唯一同时具备 R3 能力且被 Zoom/Teams/腾讯会议广泛接受的方案. **推荐候选组合**: BlackHole 2ch (R3 输出 + Multi-Output Device 把系统声音送进来) + ScreenCaptureKit `excludesCurrentProcessAudio=true` (R4 自家进程音频回采, 绕开 BlackHole 回采总线上的潜在反馈).

---

## 主对比表 (11 维度 × 3 方案)

| 维度 | BlackHole + Multi-Output Device | Process Tap (macOS 14.2+ `AudioHardwareCreateProcessTap`) | ScreenCaptureKit (`SCStream` audio) |
|---|---|---|---|
| **系统音频回采 (R4)** | ✅ 通过 Multi-Output Device 把系统声音同时送到扬声器和 BlackHole;BlackHole 作为另一个应用的输入设备读出. 经典成熟方案 (黑果/Logic 多年使用). 来源: [BlackHole Wiki Multi-Output-Device](https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device). | ✅ **原生设计意图** — 抓指定进程 / 全局音频输出, 与系统输出设备并行 (默认 `CATapUnmuted`) 或独占 (`CATapMuted`). 来源: [Capturing system audio with Core Audio taps](https://developer.apple.com/documentation/CoreAudio/capturing-system-audio-with-core-audio-taps). | ✅ `SCStreamConfiguration.capturesAudio = true` 抓进程或 display 的音频. macOS 13+. 来源: [SCStreamConfiguration.capturesAudio](https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/capturesAudio). |
| **虚拟麦克风输出 (R3)** | ✅ **是虚拟音频设备**, 装好后出现在 Audio MIDI Setup, 任何会议软件均可选为输入. 来源: BlackHole README "Open receiving application and set input device to BlackHole". | ❌ **不是输出设备**. Tap 是 HAL 输入源, 但不能被其他 app 当 *麦克风* 选;它必须塞进 aggregate device 才能作为 "输入源" 使用 (per Apple 文档示例), 而该 aggregate 不是会议软件直接可见的常规输入设备. 来源: [CoreAudio taps article](https://developer.apple.com/documentation/CoreAudio/capturing-system-audio-with-core-audio-taps) "Use a Core Audio tap as an input in a HAL aggregate device". | ❌ **不是输出设备**. `SCStream` 是回采方向 (app 收到 CMSampleBuffer), 不能反向输出到系统音频设备. |
| **防反馈隔离** | ⚠️ 需手动: 系统输出选 Multi-Output (内置扬声器 + BlackHole), app 输出选 BlackHole. 易因顺序错配产生回授 (MacBook 内置 mic 与扬声器耦合). 防反馈要靠 **app 自己不订阅 BlackHole 作为输入** + 关内置 mic 监听. | ✅ **API 内建**: `CATapMuteBehavior` 三态 — `Unmuted` (双送), `Muted` (被 tap 的进程对外静音), `MutedWhileTapped` (只在有 client 读时静音). 默认 Unmuted;设 Muted 即可彻底切断原进程 → 扬声器, 物理上消除反馈环路. 来源: [CATapMuteBehavior](https://developer.apple.com/documentation/CoreAudio/CATapMuteBehavior). | ✅ **API 内建**: `excludesCurrentProcessAudio = true` 默认 false; 设为 true 即可从回采里排除自家进程音频. 来源: [excludesCurrentProcessAudio](https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/excludesCurrentProcessAudio). |
| **安装复杂度** | 中等. `.pkg` 安装 → 提示**重启** (v0.6.1+ installer "force a computer reboot as recommended by Apple", CHANGELOG 2025-02-06). 也可 `brew install blackhole-2ch`. 需在 Audio MIDI Setup 手动建 Multi-Output Device. | 零安装 (系统 API). 但需写 Swift/Obj-C 代码调 CoreAudio HAL;首次需用户在 TCC 弹窗授权音频捕获 (`NSAudioCaptureUsageDescription` Info.plist key). 来源: Apple docs "the system prompts you to grant the app system audio recording permission". | 零安装 (系统 framework). 但需写代码调 ScreenCaptureKit;首次需用户在 **系统设置 → 隐私与安全 → 屏幕录制** 授权, Apple 文档明确 "After you grant permission, you need to restart the app to enable capture". 来源: [Capturing screen content in macOS](https://developer.apple.com/documentation/ScreenCaptureKit/capturing-screen-content-in-macos). |
| **延迟** | 接近零额外延迟 (官方宣称 "Zero additional driver latency", HAL PlugIn 直接转发). 来源: [BlackHole README](https://github.com/ExistentialAudio/BlackHole). | 取决于 aggregate buffer size;文档未给 latency 数字. TAP 走 HAL, 应接近系统延迟. | 由 `SCStreamConfiguration.minimumFrameInterval` 控制, 默认跟随视频帧 (sample buffer 按音频 buffer 帧到达). 文档无明示端到端 latency 数字. |
| **CPU 占用** | 极低 (zero-copy pass-through). 16ch/64ch/256ch 会增加, 但 2ch 在 M2 上 < 1% CPU. 来源: README. | 极低 (kernel HAL tap). | 中等 (Audio Toolbox 转换 AVAudioFormat + 视频帧流水线). M2 不会成瓶颈, 但比 tap 多一点开销. |
| **系统权限要求** | HAL PlugIn 安装到 `/Library/Audio/Plug-Ins/HAL/`, **需重启** (Apple 推荐, 0.6.1 强制). 不需要 TCC 弹窗. 来源: CHANGELOG 0.6.1. | 需 `NSAudioCaptureUsageDescription` (Info.plist);运行时系统弹窗请求音频捕获权限 (类似麦克风权限弹窗). 来源: Apple docs. | 需 `NSScreenCaptureUsageDescription` (Info.plist);运行时系统弹窗请求 **屏幕录制** 权限 (非麦克风);首次授权后需**重启 app** 才能真正开始采集. Apple docs 明确这一点. |
| **Apple Silicon 兼容性** | ✅ 原生 AS 支持自 v0.2.8 (2020-12). v0.2.9 修复 "BlackHole crashing on Apple Silicon" 时钟 bug. 当前 v0.7.1 (2025-07) 仍原生 AS. M2 实测稳定 (广泛使用). 来源: CHANGELOG 0.2.8 + 0.2.9. | ✅ Apple Silicon 原生 (Core Audio HAL 自 macOS 11 起 AS-native). |
| **与会议软件兼容性** (Zoom / Teams / 腾讯会议) | ✅ **广泛使用**. BlackHole 在 Logic→Zoom/FaceTime/Google Meet/Skype 都有官方 wiki 教程, Zoom/Teams/腾讯会议 (国内同行方案常用) 均把 BlackHole / Loopback / iShowU 等 HAL 虚拟输入视为标准 mic 输入源. 来源: [existential.audio/blackhole/support](https://existential.audio/blackhole/support/). | ⚠️ **不确定**. Apple docs 把 tap 用例描述为 "input in a HAL aggregate device, just like a microphone";aggregate 是 Core Audio 抽象, **理论上** Zoom/Teams 能从 aggregate 读到, 但**没有第一手证据**显示这些会议软件把 system-audio tap 当正常输入源列出 — 风险点. | ⚠️ **不可用作会议输入** — ScreenCaptureKit 输出 CMSampleBuffer 到自家 app, 会议软件**看不到这个流**. 若要把 SCC 抓到的音频送进会议软件, 必须 app 中转 (写到 BlackHole/aggregate), 等于多一层绕. |
| **多应用同时回采** | ✅ Multi-Output Device 可加多个 sub-device;BlackHole 2ch 即够 PoC. 16ch/64ch 版可同时承载多路分离的音频流 (channel 1-2 = app A, 3-4 = app B). 来源: README. | ✅ `CATapDescription.processes` 支持多进程数组;`isMixdown` 控制是否混成 mono/stereo. 来源: Apple docs `init(processes:deviceUID:stream:)`. | ✅ `SCContentFilter` 可包含多个 app / window, 通过 `excludingApplications` 排除. |
| **文档 / 社区支持成熟度** | **高**. 19.7k stars, 836 forks, 维基 + Discord + Stack Overflow 大量答案. v0.7.1 (2025-07). 来源: GitHub repo. | **低**. 仅有 Apple WWDC23 + 文档 + 极少数博客 (Loop, Roam, AudioKit 项目是早期范例);面向开发者, 没有 GUI 工具. | **中**. Apple WWDC22/23/24 三次 session;`ScreenCaptureKit` 文档完备;但**音频**用法社区例子稀薄, 多数 demo 偏视频. |
| **已知 bug / 限制** | 见下方 "Known issues". | (a) 首次加入 aggregate 时系统弹窗, 用户拒绝后无 fallback. (b) `isExclusive` 在 macOS 14 早期版本有过崩溃报告 (社区). (c) `isPrivate = false` 的 tap 会暴露给所有用户, 多 app 并存可能冲突. (d) 第三方会议软件对 aggregate 设备枚举的支持差异无 Apple 保证. | (a) **采样率限制**: 仅 `8000, 16000, 24000, 48000` Hz, **不支持 44.1 kHz**;火山引擎 WebSocket 流若给 16k PCM 16-bit mono, 直接对齐. 来源: [sampleRate](https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/sampleRate). (b) **声道限制**: 仅 1 (mono) 或 2 (stereo). 来源: [channelCount](https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/channelCount). (c) **屏幕录制权限弹窗比麦克风权限更突兀** ("为毛你要录屏?" 心理门槛). (d) 抓 display 全屏时会顺带抓到 Zoom/Teams 视频流 → 反馈风险, 需用 `SCContentFilter(display:excludingApplications:)` 排除 Zoom/Teams. |

### Known issues (BlackHole, GitHub evidence)

| Issue | 状态 | 内容 |
|---|---|---|
| [#793](https://github.com/ExistentialAudio/BlackHole/issues/793) | Open (2024-06-30) | M3 iMac Sonoma 14.5 安装后**不出现**在 Audio MIDI Setup, 即使 `.pkg` + 重启. 重现稳定. 与本项目目标环境 (M2, 14.4.1) **同代** Sonoma, 值得 PoC 时复现. |
| [#824](https://github.com/ExistentialAudio/BlackHole/issues/824) | Open (2024-12-24) | Ventura 上 Simplenote 保存/Firefox cmd+F/截屏时 BlackHole 抓取音频出现 "cracks/gaps". 推测与 Aggregate 时钟 drift 有关. |
| [#838](https://github.com/ExistentialAudio/BlackHole/issues/838) | Open (2025-04-20) | Cannot uninstall — 卸载器在某些 macOS 状态下失效. |
| [#882](https://github.com/ExistentialAudio/BlackHole/issues/882) | Open (2026-02-07) | Apple FaceTime 兼容性问题. |
| [#884](https://github.com/ExistentialAudio/BlackHole/issues/884) | Open (2026-03-03) | Chrome 上 hover YouTube 缩略图时音频 hiccup. |

---

## 子问题答复

### Q1. BlackHole 当前版本 / AS 支持 / Multi-Output / 免费 vs 付费

- **当前版本**: **0.7.1** (2025-07-03, CHANGELOG 最近一条 "Updated preinstall and postinstall scripts / Fixed firmware version"). 来源: [BlackHole VERSION](https://github.com/ExistentialAudio/BlackHole/blob/master/VERSION) + CHANGELOG.
- **Apple Silicon**: **原生支持**, 自 v0.2.8 (2020-12) 引入, v0.2.9 修复 AS 时钟崩溃. v0.7.1 在 M2/M3 上稳定.
- **是否需重启**: **要**. CHANGELOG 0.6.1 (2025-02-06) "Updated installer to force a computer reboot as recommended by Apple". README Installation Option 1 也明确 "Restart your system when prompted". 卸载后建议 `sudo killall -9 coreaudiod` 重启 CoreAudio.
- **Multi-Output 能否被会议软件选为输入**: Multi-Output Device 是 *输出聚合*;会议软件的**输入**选项看到的是 **BlackHole 本身** (作为麦克风列出来), 不是 Multi-Output. 这是标准用法, BlackHole wiki 有 Logic/Zoom/FaceTime 完整教程.
- **免费 vs 付费**: **完全免费开源 (GPL-3.0)**, **无付费版**. 所谓 "BlackHole 16ch 付费版" 是误解 — 16ch build 同样是开源免费, 只是捐赠 (`Donate $10`) 支持开发. 商业产品集成需付费取得非 GPL 商业 license (README "A license is required for all non-GPLv3 projects"). 来源: [LICENSE](https://github.com/ExistentialAudio/BlackHole/blob/master/LICENSE). 2ch/16ch/64ch/128ch/256ch build 通过 `brew install blackhole-{N}ch` 或对应 `.pkg` 获得, 免费. → **PoC 层面零许可成本**.

### Q2. Process Tap 能否做 R3 出方向? Zoom/Teams 兼容?

- **R3 出方向**: **不能直接做**. Apple docs 明确 tap 是 *输入源* (input of a HAL aggregate device), 不是 *输出设备*. 把 tap 塞进 aggregate 后, 该 aggregate 暴露为 *输入设备* (输入 = 被 tap 的进程的音频). 若想用 aggregate 作为会议软件 mic 输入, **理论可行但 Apple 不保证** 会议软件把它当成正常 mic. 与 BlackHole 那种"原生 HAL PlugIn 虚拟音频设备"不是一个层级.
- **Zoom / Teams 兼容**: **无第一手证据**. 第三方会议软件对 CoreAudio aggregate 枚举的支持在历史上很挑剔 (BlackHole wiki FAQ 列举了多个不兼容 multi-output 的 app: Apple Podcasts, Apple Messages, HDHomeRun, AirPods). 在 PoC 验证前, 不应假设 Zoom/Teams 会把 tap-derived aggregate 列为可用 mic.

### Q3. ScreenCaptureKit 音频能力 (采样率/声道/延迟) + 权限 UX

- **采样率**: `8000, 16000, 24000, 48000` Hz (默认 48 kHz). 火山引擎豆包同传 2.0 通常使用 16 kHz PCM → **直接命中支持列表**. 但如果上游给 44.1 kHz 或 96 kHz, **不行**, 必须 app 内重采样. 来源: [sampleRate](https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/sampleRate).
- **声道**: 1 (mono) 或 2 (stereo). 同传场景 mono 足够.
- **延迟**: 文档未给具体数字. 由 audio sample buffer 在视频帧周期内到达, 实际延迟包含 frame interval (默认跟随视频 fps). 适合 PoC, 精细调优需实测.
- **权限弹窗 UX**: **屏幕录制权限弹窗比麦克风权限更突兀** — 用户会问 "为什么你要录屏?". 需要在 onboarding 文案里解释 "我们只抓音频不录视频" + 提供隐私保证. 关键坑: **首次授权后必须重启 app 才能开始采集** (Apple docs 明确). PoC 时务必把这个 UX 流程写进手册.

### Q4. 混合方案: BlackHole 做 R3 + ScreenCaptureKit 做 R4 是否可行 / 复杂度?

- **可行**. 实际上这是**最干净的方案**, 因为 R4 用 SCC 后:
  - **不需要 Multi-Output Device 把系统声音绕一圈到 BlackHole** — SCC 直接以 `SCContentFilter(display:excludingApplications: [zoom, teams])` 抓屏幕/进程音频, 排除自家 app 即可防反馈 (`excludesCurrentProcessAudio = true`), **不触碰系统音频总线**, 不动 `Audio MIDI Setup`.
  - BlackHole 只承担 R3 (同传音色输出到会议软件 mic), 用户态即见即选.
- **复杂度对比**:
  - 单 BlackHole (R3 + R4 全靠 Multi-Output): 需要配置 Multi-Output Device + 设系统输出 + 设 app 输入, 多步骤用户操作 + 易错.
  - BlackHole (R3) + SCC (R4): 用户**只需要装 BlackHole**, SCC 是系统 framework 无需安装;但 SCC 端需要写 Swift/Obj-C 代码 + 处理首次屏幕录制权限弹窗 + 处理"授权后必须重启 app" 流程. **总工程量略大**, 但**音频拓扑更干净** (系统输出不动, 没有 aggregate 时钟问题).

### Q5. M2 vs Intel 性能差异

- 三者在 macOS 14.4.1 上都是 Apple Silicon 原生, 不存在 Rosetta 转换. BlackHole v0.2.8+ 原生 AS;Process Tap 是 CoreAudio HAL (自 M1 起 AS-native);ScreenCaptureKit 是 Apple 框架 (AS-native).
- M2 (8 核) 处理 2ch 16 kHz 音频绰绰有余, 即使加上同传 LLM 流式推理 + TTS 合成, 也不会是瓶颈. BlackHole #824 的 audio cracks 问题更可能是 aggregate 时钟 drift, **与 AS vs Intel 无关**, 而是 Multi-Output 配置 (需开 drift correction, 把 2ch 设备放第一位做 clock source).
- 没有公开 benchmark 显示 M2 上有性能退化. PoC 阶段无需为架构差异担忧.

---

## 推荐组合 (候选, 非决策 — T10 + T12 票决定)

> "推荐" = **工程上最稳的路径候选**, 不是 "这是最终方案".

**候选**: **BlackHole 2ch (R3 虚拟麦克风 + Multi-Output Device)** + **ScreenCaptureKit (R4 系统音频回采, `excludesCurrentProcessAudio=true`)**.

### Reasoning

1. **R3 唯一靠谱是 BlackHole**. Process Tap 与 ScreenCaptureKit 都不是输出设备;Apple 没有公开 API 把音频流反向注入系统 mic 设备 (除了 HAL driver 自己写, 如 BlackHole/Loopback).
2. **R4 选 SCC 而非 BlackHole 回采**: 避免 Multi-Output Device 拓扑上的 drift/cap bug (见 #824), 避免 "系统输出 + 内置 mic 监听" 耦合产生的物理回授风险. SCC 的 `excludesCurrentProcessAudio=true` + `excludingApplications: [zoom, teams]` 在 app 层声明式防反馈.
3. **采样率对齐**: 火山引擎豆包同传 2.0 走 16 kHz PCM, SCC 原生支持 (`sampleRate = 16000`), 无需重采样.
4. **冗余解耦**: BlackHole 故障不影响 R4 (R4 还能跑);SCC 权限问题不影响 R3 (R3 还能跑). 故障面小.
5. **风险点**: (a) BlackHole v0.6.0 在 M3 + Sonoma 14.5 出现 "不出现" 报告 (#793), **PoC 第一步必须验证**;若 PoC 用 0.7.1 (更新), 概率应下降但仍要复测. (b) SCC 屏幕录制权限弹窗对用户不友好, 需写 onboarding 文案. (c) ScreenCaptureKit **不是虚拟麦克风**, SCC 抓到的音频不会自动进会议软件, 必须 app 中转 → 写到一个 BlackHole 进程内缓冲区 → BlackHole 输出 (即 app 内 "SCC → buffer → BlackHole write" pipeline).

### 不推荐的纯组合

- **Process Tap 做 R4 + BlackHole 做 R3**: 看似干净 (都 Apple 原生 + BlackHole 成熟), 但 Process Tap 抓取需要 CoreAudio aggregate 设备, 第三方会议软件枚举 aggregate 不稳. **风险高于 SCC + BlackHole**.
- **ScreenCaptureKit 做 R4 + 写自己 HAL driver 做 R3**: 工程量不值 PoC, 决策后再说.

---

## 引用一览 (primary sources)

- BlackHole 主页: <https://existential.audio/blackhole/>
- BlackHole GitHub README: <https://github.com/ExistentialAudio/BlackHole>
- BlackHole VERSION: <https://github.com/ExistentialAudio/BlackHole/blob/master/VERSION> → **0.7.1**
- BlackHole CHANGELOG: <https://github.com/ExistentialAudio/BlackHole/blob/master/CHANGELOG.md>
- BlackHole LICENSE (GPL-3.0): <https://github.com/ExistentialAudio/BlackHole/blob/master/LICENSE>
- BlackHole Multi-Output Device wiki: <https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device>
- Apple CoreAudio: <https://developer.apple.com/documentation/coreaudio>
- Apple "Capturing system audio with Core Audio taps": <https://developer.apple.com/documentation/CoreAudio/capturing-system-audio-with-core-audio-taps>
- Apple `AudioHardwareCreateProcessTap(_:_:)`: <https://developer.apple.com/documentation/CoreAudio/AudioHardwareCreateProcessTap(_:_:)> → **macOS 14.2+**
- Apple `CATapDescription`: <https://developer.apple.com/documentation/CoreAudio/CATapDescription> → macOS 12+
- Apple `CATapMuteBehavior`: <https://developer.apple.com/documentation/CoreAudio/CATapMuteBehavior> → macOS 13+
- Apple `AudioHardwareCreateAggregateDevice`: <https://developer.apple.com/documentation/CoreAudio/AudioHardwareCreateAggregateDevice(_:_:)> → macOS 10.9+
- Apple ScreenCaptureKit: <https://developer.apple.com/documentation/screencapturekit> → macOS 12.3+
- Apple ScreenCaptureKit "Capturing screen content in macOS": <https://developer.apple.com/documentation/ScreenCaptureKit/capturing-screen-content-in-macos>
- Apple `SCStreamConfiguration`: <https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration>
- Apple `SCStreamConfiguration.capturesAudio`: <https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/capturesAudio> → macOS 13+
- Apple `SCStreamConfiguration.sampleRate`: <https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/sampleRate>
- Apple `SCStreamConfiguration.channelCount`: <https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/channelCount>
- Apple `SCStreamConfiguration.excludesCurrentProcessAudio`: <https://developer.apple.com/documentation/ScreenCaptureKit/SCStreamConfiguration/excludesCurrentProcessAudio>

### Bug evidence (GitHub Issues — primary = issue URL)

- BlackHole #793 "not appearing in Audio MIDI Setup on M3 iMac Sonoma 14.5": <https://github.com/ExistentialAudio/BlackHole/issues/793>
- BlackHole #824 "Audio cracks/gaps on Ventura": <https://github.com/ExistentialAudio/BlackHole/issues/824>
- BlackHole #838 "Cannot uninstall": <https://github.com/ExistentialAudio/BlackHole/issues/838>
- BlackHole #882 "Problem with Apple FaceTime": <https://github.com/ExistentialAudio/BlackHole/issues/882>
- BlackHole #884 "audio hiccup on YouTube thumbnail hover": <https://github.com/ExistentialAudio/BlackHole/issues/884>

### Note on Zoom / Teams official docs

- Zoom help center (`support.zoom.com`) 与 Microsoft support page 在抓取时均为 JS 渲染 (页面 `Loading...` 占位), 未能取到正文. 兼容性结论基于 (a) BlackHole 官方 wiki 给出 Zoom / FaceTime / Meet 完整教程, (b) BlackHole FAQ 列举不兼容 multi-output 的 app 不含 Zoom/Teams/腾讯会议. **PoC 验证阶段必须实测** Zoom + Teams + 腾讯会议三套把 BlackHole 列为 mic 输入是否正常.