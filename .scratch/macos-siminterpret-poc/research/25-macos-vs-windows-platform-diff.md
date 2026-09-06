# macOS vs Windows 平台差异深调研 — Findings（虚拟声卡 / Loopback / 本地加速 / 分发签名 / 会议软件）

**Ticket**: `.scratch/macos-siminterpret-poc/issues/25-macos-vs-windows-platform-diff.md`
**Sources**: primary only — Microsoft Learn (WASAPI/SmartScreen/driver signing)、Apple Developer Docs (notarization/CoreAudio)、VB-Audio 官网+官方用户手册 PDF、Muzychenko VAC 官网、Rogue Amoeba 官网、OBS 官方 KB、whisper.cpp / CosyVoice / Soundflower GitHub 仓库与 issue（issue URL 即 primary source）
**互锁（不重复）**: T06 `research/06-macos-audio-routing-options.md`（mac 侧路由三方案细节）、T22 `research/22-jinxi-customer-tutorial-product-map.md`（金喜 mac 安装链与本地版仅 Win 事实）

---

## TL;DR

1. **最大平台不对称不在音频路由，而在本地加速生态**：ASR 层（whisper.cpp 类）mac 与 win 接近对等（同一 75 分钟转写任务，RTX 4070M CUDA ≈ 1.28× 快于 M4 Mini CoreML，encoder-only 差距更大 ~3.7×）；但**音色克隆 TTS 层（CosyVoice 类）上游完全没有 MPS 支持**（[CosyVoice#134](https://github.com/FunAudioLLM/CosyVoice/issues/134) 自 2024-07 open 至今），整个部署栈是 NVIDIA-only（Docker `--runtime=nvidia`、TensorRT-LLM 4×、vLLM）。**这就是金喜「轻量本地版仅 Windows+NVIDIA」的根因，也是我们 mac 本地模式的硬天花板**。
2. **Loopback 不对称**：Windows 有原生 [WASAPI loopback](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)（一个 flag、零安装、零权限弹窗）；macOS **没有原生回采**，必须装 BlackHole（+Multi-Output Device）或用 Process Tap(14.2+)/ScreenCaptureKit(13+) 并吃 TCC 权限弹窗（T06）。
3. **驱动模型相反**：mac 虚拟声卡 = **用户态 HAL PlugIn**（CFBundle，无 kext、不受内核签名管制，但安装要重启、分发建议 notarize）；win 虚拟声卡 = **内核态 WDM/KS 驱动**（[强制内核签名](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/kernel-mode-code-signing-policy--windows-vista-and-later-)，Win10 1607+ 必须走 Microsoft Dev Portal 签名）。**自研虚拟声卡在 win 侧成本远高于 mac 侧** → 两平台都应依赖第三方（BlackHole / VB-CABLE）。
4. **分发信任模型相反**：mac notarization = **确定性**（公证过即干净启动，流程自动化 <1h）；win SmartScreen = **概率性**（即使 OV/EV 签名，新二进制前几周仍会弹 "Windows protected your PC"，信誉需数百次干净安装累积；[EV 已不再豁免](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)）。
5. **音频 API 缓冲模型实际对等**：两平台默认都是 ~10ms quantum；Win10+ 可用 `IAudioClient3` 把共享模式 buffer 压到 2.66ms（128 samples@48kHz，需驱动支持）；CoreAudio 用 AUHAL pull/render-callback 模型，buffer frame size 可协商。**缓冲层差异（±10ms 量级）远小于 ASR 窗口/网络对首音延迟的影响**，不构成产品级不对称。
6. **会议软件**：两平台都把虚拟设备当普通 endpoint 枚举，Zoom/Teams/Discord 均可选；差异在**配置坑位**：win 有 Windows Communications 自动降音、WDM/MME 模式选择；mac 有 Multi-Output 时钟 drift、SCC 屏幕录制权限 UX。

---

## 1. 虚拟声卡生态对比

| 维度 | macOS | Windows |
|---|---|---|
| **免费基础虚拟线缆** | **BlackHole**：GPL-3.0（闭源集成需商业 license），2/16/64/128/256ch，v0.7.1，HAL PlugIn，`brew install blackhole-2ch` 或 `.pkg`，**安装需重启**（来源：T06；[BlackHole repo](https://github.com/ExistentialAudio/BlackHole)） | **VB-CABLE**：donationware（**个人使用免费**，专业/商业使用应购买 license），`VBCABLE_Driver_Pack45.zip`（2024-10，XP→Win11，32/64/**Arm64**），multi-format engine "ready to work with all Audio Application using MME, KS, DX or WASAPI interfaces"，**安装需管理员+重启**（来源：[vb-audio.com/Cable](https://vb-audio.com/Cable/)） |
| **商业 GUI 路由/混音** | **Loopback 2.5.0**（2026-08-31，Rogue Amoeba，**$99 USD**，macOS 14.5+）：GUI 拉线式路由，虚拟设备全系统可见（官方明列 FaceTime/Zoom），最高 64ch，试用有限制；**Audio Hijack** 同厂（捕获向）。来源：[rogueamoeba.com/loopback](https://rogueamoeba.com/loopback/)、[buy.php](https://rogueamoeba.com/loopback/buy.php) | **VoiceMeeter Banana**：donationware v2.1.2.2（2025-12），3 物理 I/O + 2 虚拟 I/O，MME/DX/KS/WDM/WASAPI/ASIO，虚拟 I/O = "WDM, KS, MME, DirectX, WaveRT"；Potato 为激活码版、**禁止捆绑分发**。来源：[vb-audio.com/Voicemeeter/banana.htm](https://vb-audio.com/Voicemeeter/banana.htm)、[licensing](https://vb-audio.com/Services/licensing.htm) |
| **商业纯线缆** | （无对应；Loopback 兼做） | **VAC 4.71**（Muzychenko，1998 至今）：商业授权，**可购买源码/定制版**，bit-perfect，无网络访问；多客户端共享同一 cable（播放侧混音、录制侧复制）。来源：[vac.muzychenko.net](https://vac.muzychenko.net/en/) |
| **上一代/废弃** | **Soundflower**：最后一个 release 2.0b2（2014-12），README 自称 "works on macOS Catalina"；Rogue Amoeba 用户证言 "replacing SoundFlower"（Loopback 页面）。事实上的继任者 = BlackHole + Loopback。来源：[Soundflower repo/releases](https://github.com/mattingalls/Soundflower/releases) | HiFi Cable & ASIO Bridge（2014，VB-Audio，audiophile 向） |
| **直播生态** | （OBS 同样无虚拟声卡） | **OBS 官方无虚拟音频线缆**，只有 Virtual Camera（视频；官方明言用途是 "share your OBS Studio scene with any applications… such as Zoom, Skype, Discord"）。win 侧音频等价物仍是 VB-CABLE/VoiceMeeter。来源：[OBS Virtual Camera Guide](https://obsproject.com/kb/virtual-camera-guide) |
| **技术层级** | 用户态 HAL PlugIn（`/Library/Audio/Plug-Ins/HAL/`）；Apple 现代路线 = DriverKit "Audio Server Driver Plug-in"（"Build a virtual audio device by creating a custom driver plug-in"）。**无 kext、无内核签名**。来源：[CoreAudio docs](https://developer.apple.com/documentation/coreaudio)、[Creating an Audio Server Driver Plug-in](https://developer.apple.com/documentation/coreaudio/creating-an-audio-server-driver-plug-in) | 内核态 WDM/KS/WaveRT 驱动。VB 官方手册："Voicemeeter is a simple Application endowed with an audio device driver"、"REBOOT AFTER EACH OPERATION (IMPORTANT) (Virtual Audio Device Driver needs this reboot to finalize installation)"。受[内核签名强制管制](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/kernel-mode-code-signing-policy--windows-vista-and-later-)。来源：[VoiceMeeter Banana User Manual (PDF)](https://vb-audio.com/Voicemeeter/VoicemeeterBanana_UserManual.pdf) |
| **捆绑分发许可** | BlackHole GPLv3：开源产品可直接依赖；闭源需商业 license（README，T06） | VB-CABLE **允许随产品分发/嵌入安装包**，条件：保留 VB-Audio 归属标识 + 告知用户 donationware；企业/专业场景须购买 volume license（VB-CABLE 100 席 3.61 → 10000 席 2.50 EUR/席）；**VB-CABLE A+B/C+D 与 Voicemeeter Potato 不可捆绑**。来源：[VB-Audio Licensing](https://vb-audio.com/Services/licensing.htm) |
| **跨平台彩蛋** | VB-CABLE **也有 mac 版**（`VBCable_MACDriver_Pack108.zip`，2021-05，Intel/Apple Silicon，macOS 10.10+）→ 这正是金喜 mac 教程「BlackHole + VB-CABLE 双装」的原因（T22）。来源：[vb-audio.com/Cable](https://vb-audio.com/Cable/) | — |

---

## 2. 系统音频回采（loopback）对比

| 维度 | Windows | macOS |
|---|---|---|
| **原生 API** | ✅ **WASAPI loopback**：`IAudioClient::Initialize(..., AUDCLNT_STREAMFLAGS_LOOPBACK)`，把 render endpoint 的播放流作为捕获流读出。来源：[MS Loopback Recording](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording) | ❌ **无原生回采**。选项：BlackHole+Multi-Output Device / Process Tap（14.2+）/ ScreenCaptureKit（13+）。详见 T06 |
| **权限** | **零权限弹窗**（无 TCC 等价物；唯一限制：受保护 DRM 内容不可被回采，同源文档） | Process Tap 需 `NSAudioCaptureUsageDescription` 音频捕获授权；SCC 需**屏幕录制**授权且首次授权后**必须重启 app**。来源：T06（Apple docs） |
| **捕获范围** | 默认 = **所有会话的系统混音**（"contains the mix of all audio being played, regardless of the Terminal Services session"）。⚠️ 未能在 primary docs 中找到公开的 per-app loopback API（不作为能力宣称） | BlackHole+MOD = 全局混音；Process Tap 可按**进程数组**选择性捕获；SCC 可按 app/window 过滤（`SCContentFilter`）。来源：T06 |
| **实现机制** | 硬件有 loopback pin 用 pin；否则 audio engine **拷贝输出流**进捕获缓冲 → "WASAPI supports loopback recording regardless of whether the audio hardware contains a loopback device"（同源 MS 文档） | 走 HAL 转发（BlackHole 宣称 zero additional driver latency，T06）或内核 tap |
| **缓冲模式** | **仅 shared mode**（exclusive 不可 loopback）；**Win10 1703+ 支持 event-driven loopback**（之前需 render-stream workaround）（同源 MS 文档） | 由所选方案的 buffer size 决定（T06） |
| **产品含义** | R4（听对方）在 win = **一个 flag，零安装、零引导** | R4 在 mac = 要么装设备（BlackHole + Audio MIDI Setup 配置），要么写 SCC 代码 + 处理屏幕录制权限 UX |

---

## 3. 本地模型加速对比（含量化数据）

### 3.1 加速栈对等表

| 维度 | macOS | Windows |
|---|---|---|
| ASR（whisper.cpp） | **Metal**（"Apple Silicon first-class citizen — optimized via ARM NEON, Accelerate, Metal and Core ML"）；**CoreML/ANE** 可把 encoder 卸载到神经引擎（"more than x3 faster compared with CPU-only"；建议 macOS 14+）。来源：[whisper.cpp README](https://github.com/ggml-org/whisper.cpp) | **CUDA**（`GGML_CUDA=1`）；另有 Vulkan / OpenVINO / AMD ROCm / Ryzen AI NPU 路径（同 README） |
| TTS（CosyVoice） | ❌ **上游无 MPS**：[issue #134 "Support GPU accelerated inference for MacOS"](https://github.com/FunAudioLLM/CosyVoice/issues/134) 2024-07-14 提出，截至 2025-11-11 仍 open；"only CPU is used for inference on Mac… I've tried my Mac M3 Pro"；仅社区 fork（lonelygo/CosyVoice）提供 mac 支持 | ✅ **全 NVIDIA 栈**：部署文档 = `docker run --runtime=nvidia`；"Using TensorRT-LLM … could give **4x acceleration**"；vLLM 0.9/0.11+ 支持。来源：[CosyVoice README](https://github.com/FunAudioLLM/CosyVoice/blob/main/README.md) |
| DirectML/ONNX | — | whisper.cpp 本身不支持（走 CUDA/Vulkan/OpenVINO）；ONNX Runtime GPU 是 win 上 PyTorch 之外的通用替代（生态事实，本票未深挖） |

### 3.2 实测基准（全部来自 whisper.cpp [issue #89](https://github.com/ggml-org/whisper.cpp/issues/89) 社区提交与 PR #566，commit 见原评论）

**Encoder-only（whisper-bench，30s 音频，越低越好）：**

| 硬件 | 加速 | 模型 | Encoder | 来源 |
|---|---|---|---|---|
| RTX 4090（Linux, CUDA 12.2） | CUDA | medium | **41.8ms**（tiny 2.67 / base 5.36 / small 16.15） | [aleksas 2024-10-01](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2386681899) |
| RTX 4070 Mobile（Win11） | CUDA | large-v3 | **261.8ms**（large-v2 281.5 / medium 153.8 / turbo 249.1）；同机 Vulkan 略慢（347.4） | [peardox 2025-03-23](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2746144586) |
| MacBook M3 Pro（Sonoma 14.5） | Metal | large-v3 | **969.3ms**（large-v2 962.3 / medium 534.5） | [obeone 2024-04-24](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2076059931) |
| M1 Pro（CPU-only，NEON BLAS） | — | large | 3350ms（issue #89 正文表） | [#89 body](https://github.com/ggml-org/whisper.cpp/issues/89) |

→ 同档对比：**RTX 4070M CUDA 的 large-v3 encoder ≈ 3.7× 快于 M3 Pro Metal**；但注意 M3 Pro 是笔记本中端 GPU，M1 Ultra/Max 会缩小差距（[henry2man M1 Ultra 数据](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1742441700)，该评论列格式较旧，仅作参考）。

**CoreML(ANE) 对 CPU 的同机加速（M 系）：**

| 硬件 | 模型 | CPU enc | CoreML enc | 来源 |
|---|---|---|---|---|
| M1 Pro 13.4.1 | base | 333ms | **68ms**（~4.9×） | [vadi2](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1626895189) |
| M1 Pro 13.4.1 | small | 1183ms | **234ms**（~5×） | 同上 |
| M2 13.3.1 | large | 5466ms | **1439ms**（~3.8×） | [Tetsuya81](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1535843651) |

**CoreML/ANE 并不必然快于 Metal**（[PR #566 评论, dreampuf 2023-09-19](https://github.com/ggml-org/whisper.cpp/pull/566#issuecomment-1725106230)，M 系，同一测试集）：CPU+GPU(Metal) total **66.3s** vs CPU+ANE(CoreML) **73.5s**（encode 157 vs 213ms/run）。→ mac 上 Metal 已是强默认，CoreML 是 encoder 特化加成而非全面碾压。

**端到端真实任务（75 分钟有声书转写，medium.en，越低越好）** — 单源同任务跨平台对比（[peardox 2025-03-23](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2746144586)）：

| 设备 | 总耗时 |
|---|---|
| PC CUDA（RTX 4070M） | **295.6s** |
| PC Vulkan (NVIDIA) | 308.7s |
| **Mac Mini M4（CoreML 路径）** | **377.9s** |
| Mac Mini M4（CPU 路径） | 437.2s |
| PC CPU 4P/16T | 1667s |

→ **CUDA vs mac-CoreML 端到端 ≈ 1.28×**；encoder-only 差距（3.7×）大于端到端差距，因为 decode/采样是 CPU 侧。作者注：Mac Mini £599 vs 笔记本 £1874（~3× 价差）。

### 3.3 金喜「本地版仅 Win+NVIDIA」根因拆解（结合 T22）

金喜轻量本地版 = 本地 ASR + 本地**参考音频实时克隆 TTS**（T22 第 1/5 节）。拆成两层：

- **ASR 层**：mac 完全可行（上表），**不是**限制因素。
- **音色克隆 TTS 层**：CosyVoice 上游无 MPS（#134 open）、部署栈全 NVIDIA（TRT-LLM 4×、vLLM）、0.5B LLM+flow-matching+vocoder 级联即使强行 MPS 移植也无加速路径可吃。**这是唯一且充分的根因**。

### 3.4 mac 本地模式天花板量化

| 能力 | mac 天花板 | 依据 |
|---|---|---|
| 本地 ASR（whisper large 级） | **高**：M3 Pro Metal large-v3 encoder ~970ms/30s（RTF≈0.03），M4 CoreML 75min 转写 6.3min | §3.2 |
| 本地零样本音色克隆 TTS（CosyVoice 级） | **不可达（上游路径缺失）** | [CosyVoice#134](https://github.com/FunAudioLLM/CosyVoice/issues/134) + README 全 NVIDIA 部署栈 |
| 本地小模型非克隆 TTS | 可行但超出本票范围（见 T10 音色选型） | — |

---

## 4. 音频 API 层：缓冲模型与首音延迟

| 维度 | CoreAudio (macOS) | WASAPI (Windows) |
|---|---|---|
| 架构 | 三层：I/O Kit → audio HAL → 应用；"Mac apps can be written to use these technologies directly when they require the highest possible, real-time performance"。来源：[Core Audio Overview (archive)](https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/CoreAudioEssentials/CoreAudioEssentials.html) | App ↔ audio engine（shared mode）↔ driver；exclusive mode 绕过 engine 直达驱动缓冲。来源：[Low Latency Audio](https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/low-latency-audio) |
| 数据流模型 | **Pull / render callback**："Each audio unit in a graph registers a rendering callback with its successor… its render method calls back to the preceding audio unit to ask for data"；AUHAL 负责设备 I/O（同源 Core Audio Overview） | **Event-driven**（`AUDCLNT_STREAMFLAGS_EVENTCALLBACK`）+ 共享引擎周期；官方推荐用 RT Work Queue/MMCSS 标记 "Audio/ProAudio" 线程（同源 Low Latency Audio） |
| 默认 quantum | 由设备/驱动协商的 buffer frame size（kAudioDevicePropertyBufferFrameSize 语义；Core Audio Overview 给出 packet→buffer 换算范式） | **默认 10ms**；Win10+ `IAudioClient3::GetSharedModeEnginePeriod/InitializeSharedAudioStream` 可请求更小周期；inbox HDAudio 驱动支持 **128 samples = 2.66ms@48kHz ~ 480 samples = 10ms**（同源） |
| 引擎自身延迟 | 未公开单一数字（HAL 转发模型，BlackHole 宣称 zero additional driver latency — T06） | Win10+ 引擎延迟降至 **1.3ms**（此前 ~12ms float / 6ms int）（同源） |
| 小缓冲系统行为 | — | 应用请求小缓冲时 Windows 进入特殊资源隔离模式（保护音频线程/中断）（同源） |
| 遗留 API | — | WinMM（waveInXxx）仍可读取硬件 loopback 设备，但属遗留路径（[MS Loopback Recording](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)） |

**对首音延迟的影响结论**：两平台默认都是 ~10ms 量级量子，且都可协商更小缓冲（win 2.66ms 有文档数字；mac 靠 AUHAL buffer 协商）。**音频 API 层贡献 <20ms，而首音延迟的大头是 ASR 分块窗口（≥500ms）+ 网络 RTT + TTS 首包**（参考金喜 1.3s 口径，T22）。→ 移植时音频层不是延迟瓶颈，无需为平台差异做特殊延迟优化。

---

## 5. 分发 / 签名对比

| 维度 | macOS | Windows |
|---|---|---|
| 主程序签名 | Developer ID + Hardened Runtime + secure timestamp + macOS 10.9+ SDK。来源：[Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution) | OV/EV 代码签名；或 Microsoft Store（微软代签、**永不触发 SmartScreen**）；或 Artifact Signing（$9.99/月，微软托管签名）。来源：[SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) |
| 信任关卡 | **Gatekeeper**：notary service 自动扫描（通常 <1h）→ ticket staple → 首次启动显示 "Apple notarized" 提示；**确定性**：公证即过 | **SmartScreen 信誉**：publisher + file-hash 双信号；**新签名二进制仍会警告**直到信誉累积（"can take several weeks and hundreds of clean installs"）；**概率性** |
| 关键事实 | 公证 ≠ App Review；插件（被隔离下载的）10.15+ 也须公证，否则用户要手动到系统设置放行（同源） | **EV 证书已不再豁免 SmartScreen**（"Paying a premium for EV solely to avoid SmartScreen warnings is no longer justified"）；未签名 = "Windows protected your PC" + 企业策略可直接禁止运行（同源） |
| 虚拟声卡组件签名 | BlackHole = 用户态 HAL PlugIn，**不属内核签名体系**；分发建议公证以获得干净 Gatekeeper 体验 | VB-CABLE/VoiceMeeter = 内核态驱动，受强制管制：x64 Vista+ 内核代码必须签名；**Win10 1607+ 新内核驱动必须经 Dev Portal 签名**（建立 dashboard 账户本身需要 EV 证书；客户端可用 attestation signing 免 HLK）。来源：[Driver Signing Policy](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/kernel-mode-code-signing-policy--windows-vista-and-later-)、[Driver Signing Tutorial](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/windows-driver-signing-tutorial) |
| 自研虚拟声卡成本 | 低：HAL PlugIn 或 DriverKit Audio Server Plugin，普通 Developer ID + 公证即可 | 高：EV 证书 + Dev Portal 账户 + attestation/WHQL 流程 |
| 痛点对照 | 金喜现状：用户需终端执行「允许安装未授权 DMG」（T22 §7）→ **我们做 notarization 就是开箱即用的差异化** | 我们若不做签名/信誉运营，新用户 100% 撞 SmartScreen 墙；建议：Store 分发或 Artifact Signing + 早期用户文案 |

---

## 6. 会议软件虚拟设备兼容对比

| 维度 | macOS | Windows |
|---|---|---|
| 基本行为 | 虚拟设备（BlackHole/Loopback）作为普通输入/输出端点被枚举；Loopback 官方页面明列 **FaceTime/Zoom** 场景（"select your Loopback device as your source in Zoom"）；BlackHole wiki 有 Zoom/FaceTime/Meet 教程（T06） | 虚拟设备（VB-CABLE/VoiceMeeter VAIO）作为普通端点；**VoiceMeeter 官方安装指南第 6 步**即 "Check softphone parameters (for example **Skype/Zoom/Discord** audio device selection)"（[Banana User Manual](https://vb-audio.com/Voicemeeter/VoicemeeterBanana_UserManual.pdf)） |
| 已知坑（官方证据） | Multi-Output Device：内置输出必须放首位做时钟源，否则音视频不播（[BlackHole wiki Multi-Output-Device](https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device)）；聚合时钟 drift → 爆音（[#824](https://github.com/ExistentialAudio/BlackHole/issues/824)）；FaceTime 兼容问题（[#882](https://github.com/ExistentialAudio/BlackHole/issues/882)）；SCC 流会议软件**不可见**（T06） | VoiceMeeter 手册：**WDM 接口走 WASAPI（延迟 <30ms）**；KS 并非所有设备可用；与 VoIP 并用时必须把 Windows 声音设置里 Communications 选项设为 **"Do Nothing"**（否则系统自动降音）；安装/卸载必须重启（同源手册） |
| 国内软件（腾讯会议/飞书/微信） | 无官方公开文档可引（帮助中心 JS 渲染抓取失败，同 T06）；金喜教程实证 mac 上 BlackHole+VB-CABLE 可用于腾讯会议/微信场景（T22 §8） | 同左（金喜主平台即 win，间接实证）→ **PoC 必须实测** |

---

## 7. 对产品的结论

### 7.1 v0 (mac-only) 功能边界

**能做（与 win 无差距或差距可接受）：**
- R3 虚拟麦克风输出（BlackHole 2ch，与 win 的 VB-CABLE 完全对等）
- R4 系统回采（SCC/Process Tap，甚至比 win 的全局混音多了 per-app 能力，代价是权限弹窗）
- 云端同传全链路（金喜标准版能力面，mac/win 对等 — T22）
- 本地 ASR（whisper.cpp Metal/CoreML，RTF 远 <1）

**做不到（win 有 / mac 没有）：**
- ❌ 零安装零权限的原生回采（win WASAPI loopback）
- ❌ 本地音色克隆 TTS 与金喜本地版对等（CUDA 生态独占 — §3.3）
- ❌ 企业部署的静默免交互安装（win 可用 GPO/MSI 分发 VB-CABLE；mac 的 BlackHole pkg 需重启，Munki/Jamf 可做但非本票深挖）

### 7.2 v1 加 Windows 的移植清单（音频层抽象 seam）

1. **`CaptureBackend` 抽象**：`MacCapture(SCC|ProcessTap|BlackHole)` ↔ `WinCapture(WASAPI loopback, shared+event-driven)`。win 实现零第三方依赖。
2. **`VirtualMicSink` 抽象**：`BlackHole write` ↔ `WASAPI render → VB-CABLE Input endpoint`。两平台都是"向虚拟设备的播放端写"，语义一致。
3. **缓冲协商**：win 用 `IAudioClient3::InitializeSharedAudioStream`（请求 ≤10ms 周期）；mac 用 AUHAL buffer frame size。封装为一个 `SetTargetLatency(ms)`。
4. **安装链**：win = 管理员权限 + 重启（继承 VB-CABLE 预签名驱动，无需我们做内核签名）；按 [VB-Audio Licensing](https://vb-audio.com/Services/licensing.htm) 条款可捆绑（保留归属 + donationware 声明；企业客户场景购 volume license）。
5. **分发**：OV 签名 + SmartScreen 信誉运营（首批用户文案："发布者已验证，首次运行可能提示"）或 Microsoft Store / Artifact Signing。
6. **权限**：win 侧**无**音频捕获权限弹窗（比 mac 省事）；但要处理 Windows Communications 自动降音（引导用户设 "Do Nothing"，VoiceMeeter 手册同款建议）。
7. **加速**：win 构建 `GGML_CUDA=1`（NVIDIA）+ CPU/Vulkan fallback；CosyVoice 级 TTS 只在 CUDA 机器上启用本地模式（与金喜对齐）。
8. **平台代码量估算**（定性）：音频层两平台各一个后端实现（各 ~1–2k 行级别）；模型推理层共用（whisper.cpp 跨平台）；签名/安装器完全分叉。**音频抽象是唯一必须提前设计的 seam，其余是分叉不是抽象。**

### 7.3 mac 本地模式是否值得投入（结论）

- **值得**：本地 ASR（隐私/离线卖点），whisper.cpp Metal 已成熟。
- **不值得（v0）**：对齐金喜的本地零样本克隆 — MPS 生态缺失是上游问题，不是工程量问题。
- **观察项**：CosyVoice #134 若上游落地 MPS，或出现 MPS 原生的开源克隆 TTS（T10 音色票跟进），再评估。

---

## 引用一览（primary sources）

**Microsoft Learn**
- Loopback Recording: <https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording>
- Low Latency Audio（10ms 默认 / 2.66ms 最小 / 1.3ms 引擎 / IAudioClient3 / MMCSS）: <https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/low-latency-audio>
- SmartScreen reputation（OV/EV 行为表 / EV 不豁免 / 信誉累积周期 / Artifact Signing）: <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation>
- Driver Signing Policy（Vista+ 强制 / Win10 1607+ Dev Portal）: <https://learn.microsoft.com/en-us/windows-hardware/drivers/install/kernel-mode-code-signing-policy--windows-vista-and-later->
- Windows Driver Signing Tutorial: <https://learn.microsoft.com/en-us/windows-hardware/drivers/install/windows-driver-signing-tutorial>

**Apple**
- Notarizing macOS software before distribution: <https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution>
- Core Audio framework（AudioHardwarePlugin=CFBundle、taps、aggregate、Creating an Audio Server Driver Plug-in）: <https://developer.apple.com/documentation/coreaudio> 、<https://developer.apple.com/documentation/coreaudio/creating-an-audio-server-driver-plug-in>
- Core Audio Overview（archive；三层架构、render-callback pull 模型）: <https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/CoreAudioEssentials/CoreAudioEssentials.html>
- mac 侧 tap/SCC/BlackHole 细节全部复用 T06 引用（不重复）

**厂商官网/手册**
- VB-CABLE（产品页+mac 版+打包45）: <https://vb-audio.com/Cable/>
- VoiceMeeter Banana（规格页）: <https://vb-audio.com/Voicemeeter/banana.htm>
- VoiceMeeter Banana User Manual PDF（WDM/WASAPI<30ms、驱动重启、Communications "Do Nothing"、Skype/Zoom/Discord 步骤）: <https://vb-audio.com/Voicemeeter/VoicemeeterBanana_UserManual.pdf>
- VB-Audio Licensing（donationware 定义 / 捆绑规则 / volume 价格）: <https://vb-audio.com/Services/licensing.htm>
- Virtual Audio Cable（VAC 4.71）: <https://vac.muzychenko.net/en/>
- Rogue Amoeba Loopback（$99、64ch、FaceTime/Zoom、macOS 14.5+）: <https://rogueamoeba.com/loopback/> 、<https://rogueamoeba.com/loopback/buy.php>
- OBS Virtual Camera Guide（OBS 无虚拟音频，仅视频虚拟摄像头）: <https://obsproject.com/kb/virtual-camera-guide>

**GitHub（issue/PR URL 即 primary）**
- whisper.cpp README（Metal/CoreML/CUDA 支持声明）: <https://github.com/ggml-org/whisper.cpp>
- whisper.cpp benchmark 汇总 issue #89: <https://github.com/ggml-org/whisper.cpp/issues/89>（正文表 + 评论：[aleksas RTX4090 CUDA](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2386681899)、[peardox RTX4070M CUDA/Vulkan + M4 对比](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2746144586)、[obeone M3 Pro Metal](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-2076059931)、[vadi2 M1 Pro CoreML](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1626895189)、[Tetsuya81 M2 CoreML](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1535843651)、[henry2man M1 Ultra Metal](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1742441700)）
- whisper.cpp PR #566 评论（ANE vs Metal 同机对比）: <https://github.com/ggml-org/whisper.cpp/pull/566#issuecomment-1725106230>
- CosyVoice issue #134（macOS/MPS 无支持，open）: <https://github.com/FunAudioLLM/CosyVoice/issues/134>
- CosyVoice README（NVIDIA 部署栈 / TRT-LLM 4x / vLLM）: <https://github.com/FunAudioLLM/CosyVoice/blob/main/README.md>
- Soundflower（2.0b2@2014，README 限 Catalina）: <https://github.com/mattingalls/Soundflower/releases>
- BlackHole wiki Multi-Output-Device（时钟源/首位设备要求）: <https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device>

**本仓互锁**
- T06: `.scratch/macos-siminterpret-poc/research/06-macos-audio-routing-options.md`
- T22: `.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md`

### 抓取限制声明（诚实披露）

- Zoom Help Center / Microsoft support / 腾讯会议帮助中心均 JS 渲染 + 部分反爬，本票未能取得其虚拟设备专题页正文；会议软件结论基于 VB-Audio 官方手册 + Rogue Amoeba/BlackHole 官方页 + 金喜教程实证（T22），PoC 阶段必须实测。
- Windows per-app（进程级）loopback 未找到可引用的 primary doc，本票**不宣称** win 具备该能力（只宣称全局混音）。
- VB-CABLE Reference Manual PDF 链接 404（2026-02 抓取时），VB-Cable 架构结论改用产品页 + VoiceMeeter 官方手册 + MS 内核签名文档三角互证。
- firecrawl 免费额度在本票抓取中途耗尽，Apple developer docs 的 JS 页改用 archive 版本与已缓存抓取；所有最终引用均实际取到正文。
