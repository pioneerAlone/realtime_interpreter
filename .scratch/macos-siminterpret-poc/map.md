# 实时中英双向同传产品 · 音色克隆版（对标金喜双通道）

Labels: wayfinder:map

Status: ready-for-agent
Type: wayfinder:map

Blocked by:

## Destination

A macOS-first open-source product that competes with **金喜同声传译双通道版**（dachengzionly / 一人公司 OPC，¥49-4999 商业闭源，1.3s 首音延迟）。用户场景：在 Teams/Zoom 上说中文 → 对方听到自己音色的英文；对方说英文 → 自己看到中英双语字幕。

**Acceptance（验收硬指标，按版本阶段递进）**：
1. **首音延迟目标**：
   - **v0 PoC** ≤ 4 秒首音（M2 MacBook Air 上 5 次跑测中位数，与金喜标准云端同水平）
   - **v1** ≤ 2 秒首音（通过本地 ASR 加速 + 流式 TTS 优化）
   - **v2** ≤ 1.3 秒首音（与金喜最佳 case 齐平，需本地 TTS + 本地 ASR 满载级联）
2. **R3+R4 双通道端到端**：自开会议跑通，无反馈环
3. **0 样本音色克隆**（无需训练，开口即克隆）+ 跨语种迁移（中文音色说英文）
4. **API 成本**：v0 接受 ~5-14 元/小时（金喜标准云端同等水平）；v1+ 目标 < ¥2/小时（通过本地 TTS 降本）
5. **开源可改**：MIT/Apache 许可证 + 干净的模块边界 + 完整构建文档 + Docker/CI 可跑

**v0 R3 路径选择**：**直接 Doubao 同传 2.0 S2S**（与金喜标准版同 API 同延迟，最简），同时**代码里预留 v1 cascade 接口**（本地 sherpa-onnx ASR + Doubao S2T + 本地 CosyVoice 3 的级联路径，目标 ≤ 2s）。

**超出 destination**（下一张 v1+ map）：Windows 平台对等、AEC 免耳机模式、产品级 UI（菜单栏 / 浮动字幕）、DMG 打包 / 代码签名、跨会话稳定音色（声音复刻 2.0 训练子命令）、30+ 语言扩展、商业化定价策略、cascade 路径的实现（v1）。

**基准对照**：用户 ¥49 买金喜测试卡（3 天）作 A/B 对照测试——金喜实测数据是 PoC 验收的"活靶子"。

## Notes

**关键转折**：原 PDF §3 的结论「市面无现成产品能同时满足音色克隆 + 单侧部署 + 在线会议」**被金喜直接反驳**。金喜是 2026 出现的商业闭源产品，PDF 调研漏掉了它。本地图原为"Doubao 链路过 PoC"导向，现升级为"产品对标金喜"导向。

**Tech route（基线）**：
- 云端翻译引擎：火山引擎 豆包同传 2.0（S2S 模式，0 样本克隆 + 双语字幕）
- 虚拟麦克风：BlackHole 2ch（macOS）/ VB-Cable（Windows，二期）
- 系统音频回采：ScreenCaptureKit `excludesCurrentProcessAudio=true`
- 防回声：B1 总线隔离思想（来自 realtime-voice-translator）+ 启动前拓扑 checker

**对标金喜的差异化（vs 闭源商业）**：
- 开源 + 可定制（部署在自己机器 / 改 TTS / 改 UI）
- 成本可控（用户自己 BYO API key，无中间商赚差价）
- 数据不出端（本地模式可选）
- 代码可审计（无黑盒）

**Notes 用户上下文**：
- 硬件：M2 MacBook Air（macOS 14.4.1）—— 用户唯一环境
- 用户目标：**C · 做产品竞争**（不是"自用"或"学习"）
- 已有火山引擎账号 + 实名 + API key（按 T02 路径，但要走"豆包语音 APP ID"路径，非方舟 API key）

**Skills every session should consult**：
- `research`（云端能力、参考仓、本地模型、流式延迟优化—— T01-T06 + T15-T20）
- `prototype`（总线隔离、混合架构的最小可行验证—— T12）
- `grilling` + `domain-modeling`（决策票 T10 / T11 + 必要时新出现的词汇 / 决策）
- `code-review` + `tdd`（实际写代码时）

**Standing 偏好**：
- Chart the route, don't execute it. 图表 + research，本 session 不写代码。
- 1.3s 是金喜给出的硬指标，达到这个数字才算"产品级"。
- 开源就意味着代码质量 / 文档 / 测试覆盖不能糊弄——架构边界要清晰。

## Decisions so far

<!-- populated as tickets close -->

- [macOS 音频路由选项对比](.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md): **研究结论（候选，非决策）** — macOS 上唯一可行的 R3+R4 组合 = BlackHole 2ch（系统层做虚拟 mic，v0.7.1 GPL-3.0，原生 AS 支持）+ ScreenCaptureKit `excludesCurrentProcessAudio=true`（app 层抓进程音频并排除自家防反馈）。Process Tap 与 ScreenCaptureKit 都不是输出设备，故 R3 维度 N/A；Multi-Output Device 总线被避开以规避 BlackHole #824 时钟 drift bug。决策权归 T10（音色克隆选型）+ T12（总线隔离 prototype）。Findings 详 → [research/06](.scratch/macos-siminterpret-poc/research/06-macos-audio-routing-options.md)。待 PoC 实测验证项：Zoom/Teams 兼容性（官方文档 JS 渲染 subagent 未抓到正文）、BlackHole #793 在 M2 + 14.4.1 是否复现。

- [TransEcho 仓库深读](.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md): **PDF 笔误纠正 + 起点代码画像** — 实际仓库 `wxkingstar/TransEcho`（PDF §7 写的 `tianpomin/TransEcho` 是错的）。技术栈 = Tauri 2 + Rust + Svelte 5 SPA + ScreenCaptureKit/WASAPI + Rubato 48k→16k 重采样 + Rodio TTS + tokio-tungstenite WebSocket + Protobuf，协议端点 `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`，硬编码 `volc.service_type.10053`（豆包同传 2.0）。代码 2,678 行（Rust 1,835 + Svelte 843），最近 commit 2026-03-27（v0.1.4）。当前是**单向** system-audio→字幕+s2s-TTS，本 PoC 要变双向需开 2 个 WS 连接。**关键约束**：TransEcho 内置 `speaker_id` 只支持**预设音色**（如 `zh_female_vv_uranus_bigtts`），**不支持「声音复刻 2.0」训练的 `voice_id`** —— 走克隆路线必须先在「声音复刻 2.0」训练，再在 StartSession 把 `speaker_id` 替换为训练得到的 `voice_id`（待 T01 API 能力 + T10 模式选型复核）。10 项 gap 清单（删 Tauri/Svelte 加 CLI / R3 真实麦采集 / R3 TTS 输出到 BlackHole / R4 字幕走 stdout / 双向 WS / 声音复刻 2.0 接入 / BlackHole Multi-Output 配置脚本 / 关闭 `excludesCurrentProcessAudio` / 开 denoise / 凭证从 settings.json 移到 .env）估 +200~+500 行 Rust 净增。Findings 详 → [research/03](.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md)。

- [Doppelvoice 仓库深读](.scratch/macos-siminterpret-poc/issues/04-doppelvoice-deep-read.md): **0 样本克隆架构确认 + 已知问题** — 0 样本音色复刻是**豆包同传 2.0 WebSocket 内置能力**（`speaker_id=""` + `denoise=false` 触发），**完全独立于声音复刻 2.0 API**，跨语种音色迁移是模型内部责任、客户端无 special path。9 语言靠客户端字符串 + `zhen` 互锁下拉。proto schema 来自字节内部 mirror；仅一根 WebSocket（`volc.service_type.10053`）。错误处理：致命/瞬时分类 + 指数退避，**无"降级到默认 AI 音色"路径**（架构上不可达）。MIT 许可可直接 copy 须保留版权声明。**已知问题**：Doppelvoice CHANGELOG v0.2.2 + docs/ARCHITECTURE.md 自承「重连后零样本音色突变（server 每次 session 重新采样 0 样本音色档案）」——本 PoC 复现概率高，**必写入 PoC 限制说明**。Findings 详 → [research/04](.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md)。

- [realtime-voice-translator 仓库深读（防回声架构）](.scratch/macos-siminterpret-poc/issues/05-realtime-voice-translator-deep-read.md): **B1 物理隔离原理 + License 风险** — Voicemeeter B1 总线隔离 = **物理路由切断反馈环，仓库无任何 AEC/回声抑制代码**（无依赖、无算法），全靠 `check_voicemeeter.py` 3-test RMS 阈值功能验证。双独立 Gemini Live WebSocket session（协议层 `target_language_code` 单值约束）。路由矩阵：VAIO→{A1,B1}，mic 只→A1 不→B1；服务端 `echo_target_language=True` 防回放源语言。**License 风险**：README 自称 MIT 但仓库**无 LICENSE 文件**（GitHub API `license: None`），拓扑/方法论可自由复用、**代码勿直接 copy**。macOS PoC 复用策略：源码加文件头声明「独立编写，参考 `ricardobing/realtime-voice-translator` 的架构设计」。macOS B1 候选 5 个（BlackHole+Multi-Output / +SCC / +Process Tap / Aggregate / 单 BH），决策权归 T06 + T10 + T12。**PoC 必须内置等价 checker**：启动前自动验证拓扑（实时算 RMS 阈值），替代 realtime-voice-translator 的 `check_voicemeeter.py`。Findings 详 → [research/05](.scratch/macos-siminterpret-poc/research/05-realtime-voice-translator-deep-read.md)。

- [Volcengine 豆包同传 2.0 S2S API 与 speaker_id 支持现状](.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md): **核心 API 路径打通 — 跨语种克隆不需要单独声音复刻 2.0** — endpoint `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`，resource_id `volc.service_type.10053`，鉴权字段 `X-Api-App-Key` / `X-Api-Access-Key` / `X-Api-Resource-Id` / `X-Api-Connect-Id`（**注意**：控制台「App Key」≠ 通用「API Key」）。Mode `s2s` = 语音到语音（带 TTS 350/351/352 事件）；Mode `s2t` = 语音到文本（只出字幕 650–655 事件）。**关键发现**：双语字幕由同传 2.0 同会话同 endpoint 一次出齐——源语 650/651/652 + 译语 653/654/655，意味着 R3 出方向 + R4 入方向字幕可各自一个 session 搞定（同 endpoint 不同 mode）。**speaker_id 字段**：留空 = 0 样本自动复刻（默认）；填预设音色 = 走 bigtts 库；**跨语种音色迁移（中文音色说英文）由同传 2.0 模型内部完成，客户端无 special path，无需先调独立的声音复刻 2.0** —— T03/T04 此前的疑虑是错的（声音复刻 2.0 仅是「跨会话稳定音色」的预训练素材来源、不是 S2S 前置）。延迟实测 2.5–3s（Doppelvoice 实测）+ 本地处理 <500ms + 输出选 ogg_opus 时额外 ~500ms 整句解码；chunk size 80ms × 16kHz × 16bit × mono = 2560 bytes/包；VAD 服务端控制、AST 客户端不可调。`format=pcm` 流式输出 Doppelvoice 实测服务端不响应，目前仅 ogg_opus 路径通。Findings 详 → [research/01](.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md)。

- [火山引擎账号 / API key 申请路径](.scratch/macos-siminterpret-poc/issues/02-volcengine-account-application.md): **注册路径打通 + 2 个硬阻塞风险** — 个人 + 大陆身份证 + +86 手机号即可注册+实名；实名到首次调用约 30 分钟；控制台「试用」赠免费额度+正式开通按量计费后付费（无需先充值）；同传 2.0 走火山方舟 API Key、声音复刻 2.0 走豆包语音 APP ID + Access Token（**两个独立应用**，同一账号下）。**硬阻塞 #1：海外身份证 / 海外手机号注册无公开路径**——若用户只有海外证件，T09 执行时会被实名环节卡死，必须先与用户确认身份。**硬阻塞 #2：充值方式 / 最低金额 / 支付渠道（支付宝/微信/海外卡）的公开文档页需登录 console 才能查看**，T09 执行时需登录才能拿到数字。**T01 + T02 共同确认**：同传 2.0 S2S 内建音色采样（「传译过程中即可完成音色采样，并以复刻音色输出译文语音」），不需单独调声音复刻 2.0——印证 T01 纠错。Findings 详 → [research/02](.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md)。

- [金喜双通道版功能架构反推（benchmark）](.scratch/macos-siminterpret-poc/issues/15-jinxi-architecture-reverse.md): **金喜不是自研同传模型 — 标准云端几乎确定 = Doubao-同声传译 2.0 (S2S) 二次封装** — 依据：字节 Seed 官方 2025-07-24 发布声明「首个延迟 & 准确率接近人类水平的产品级中英语音同传系统」「零样本声音复刻」+ arXiv 2507.17527v2 论文「首字 2.21s / 平均 S2S 2.53s」，与金喜宣传的 0 样本克隆 + 1.3s 首音 + 中英双向一一对应。**1.3s 首音实现**：1s 差量由本地 VAD 预热 (200-400ms) + 协议缓冲 (200-300ms) + OS 音频输出缓冲 (200ms) + 网络 RTT (~100ms cn-beijing) 填补；流式 WebSocket 分片是必要条件。**双通道架构**：同进程两个独立 WebSocket 会话，挂不同输入/输出虚拟声卡；反馈隔离靠「设备级隔离 + Multi-Output Device」+ 必要时 WebRTC APM 软件层 AEC。**音色克隆**：标准版 0 样本 = Doubao 2.0 同传时实时采样；旗舰版「自定义任何音色」MEDIUM 置信度（可能是 Doubao 同传模式的参考音频 prompt，而非预训练克隆）。**macOS 集成**：自带「免费虚拟声卡」HIGH 置信度 = 定制打包的 BlackHole（kDriver_Name / BundleID / Icon 可定制，GPLv3 商业需付费 license，支持 mirror device 适合双通道）。**API 费用梯度结构**：标准云端 9-12 元/小时 = Doubao S2S 单 endpoint 大模型费率；旗舰云端 2-3 元/小时 = 级联「Doubao ASR + Doubao LLM + 轻量云端 TTS」；旗舰本地 0.7-1 元/小时 = 云端 ASR+MT + 本地 TTS 免费（TTS 候选 CosyVoice/Piper/GPT-SoVITS）。**Mac 没有本地模式**：HIGH 置信度——本地 TTS 通常需 CUDA，macOS MPS 支持有限。**对 PoC 的关键启示**：① 标准版直接调 Doubao S2S 即可达到 1.3s 数字，省去自研级联（除非要更便宜）；② 如果 PoC 目标 ¥2/小时，需走「云端 ASR+MT + 本地 TTS」级联（macOS MPS 限制要本地 TTS 是否能在 M2 跑 CosyVoice 待 T19 验证）；③ BlackHole 是行业标准、双通道 mirror device 是正解；④ 金喜的 9-12 元/小时 与 Doubao S2S 公开价 100 万 token 赠送 10 小时可能一致——PoC 跑测后能验证。**借鉴的产品形态**：双声卡独立配置 / 自定义词库 / 测试卡驱动转化 / 一账号多平台 / 自助下单 + 教程 + 客户群答疑。Findings 详 → [research/15](.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md)。

- [macOS 本地 ASR 模型对比（M2 MacBook Air）](.scratch/macos-siminterpret-poc/issues/17-local-asr-macos-m2.md): **R4 首选 sherpa-onnx + streaming-zipformer-en-2023-06-21 (int8)** — 唯一真流式 partial 输出（~200ms first-partial, LibRiSpeech test-clean 2.43% WER, RTF 0.04–0.10, <200MB RAM, Apache-2.0, 跨平台商业安全）。**备选 whisper.cpp + CoreML + distil-large-v3**（~300-500ms partial 但非真流式）。**排除项**：FunASR 英语路径只有 SenseVoiceSmall（离线）或 Fun-ASR-Nano（需 GPU），不符合流式目标；Speech.framework 平台锁定 + 无自定义词库，仅 fallback。**10×5 对比表全部 primary source 填好**（whisper.cpp M2 Air 24GB CoreML benchmark issue #89、sherpa-onnx Zipformer docs、icefall RESULTS.md WER、FunASR model_selection.md、SFSpeechRecognitionRequest Apple docs）。**对架构的影响**：如果走本地 ASR，R4 ASR 步骤延迟贡献仅 ~200ms，给 R4 后续 MT/TTS 留 ~1100ms 预算——支持「1.3s 首音」目标可达。本地 ASR 路径同时降低网络依赖 + 数据隐私（英文不过云端）。**License**：5 个引擎全部商业安全（whisper.cpp MIT / mlx-whisper MIT / sherpa-onnx Apache-2.0 / FunASR MIT / SenseVoice MIT），仅 Speech.framework 受 Apple SDK 限制。**PoC 风险**：int8 量化后英语口音 / 专业术语 WER 可能上升 1-2%；默认建议 + 自定义词库（Hotwords FST）配置。Findings 详 → [research/17](.scratch/macos-siminterpret-poc/research/17-local-asr-macos-m2.md)。

- [混合云-端架构模式调研](.scratch/macos-siminterpret-poc/issues/20-hybrid-cloud-local-architecture.md): **PoC v0 = 配置 A 全云端 Doubao 同传 2.0 (~3-4s 首音, ~14.6 元/小时后付费 / ~5 元/小时资源包)** — 延迟数字与 T15 金喜 S2S 实测对齐（同 Doubao API）；零本地模型加载，冷启动 < 4s。**v1 加配置 C 作离线 fallback**（本地 ASR + 本地 TTS + 云 MT，~1.2 元/小时；冷启动 ~8-12s 受 CosyVoice2 PyTorch 2-3GB 加载峰值瓶颈）。**配置 B 架构不可行** — Doubao S2S 不接受外部 ASR 文本输入、0 样本音色采样必须在云端完成（不能用本地 Whisper 文本做参考音频）。**配置 D 全本地留 v2 long-term**（~1.5-2s 首音但 Mac 适配差：GPT-SoVITS README 警告 "Mac GPU 训练劣于其他设备" + 金喜 wiki 已确认 "Mac 没有本地模式"）。**后付费单价确认**：输入 80 元/M token, 输出-文本 80 元/M, 输出-音频 300 元/M; 资源包 56 元/M (1:3.75 抵扣)；与金喜 9-12 元/小时量级一致。**冷启动对比**：A < 4s、C ~8-12s、D' (Piper 无克隆) ~3-5s、D 含克隆 ~8-12s。**Cartesia Sonic Pro** ≈ 3.2 元/小时国际云 TTS + 0 样本克隆，但 cn→us 网络 RTT ~150-250ms 需评估。**待用户决策**：是否接受 v0 无离线模式 / M2 RAM 是否 24GB / v0 用预设音色 vs 0 样本。Findings 详 → [research/20](.scratch/macos-siminterpret-poc/research/20-hybrid-cloud-local-architecture.md)。

**T20 关键发现对 destination 的影响**：原 destination 写「首音延迟 ≤ 1.3 秒」，但 T20 显示 PoC v0 全云端实测 ~3-4s（与金喜 S2S 一致），1.3s 需要全本地或精心调优的混合架构（M2 MPS 限制下本地 TTS 加载慢）。**destination 应修订**：v0 接受 ≤ 4s 首音（与金喜同水平）；v1+ 目标 ≤ 2s（通过本地模型混合）。这一修订需要在所有 subagent 完成后正式更新。

- [流式首音延迟优化技术调研](.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md): **1.3s 首音可达但 TTS 是决定项** — Doubao 同传 2.0 S2S 单 endpoint 论文 FLAL 2.21s + 本地栈 ~1s 差量 ≈ 1.3s（金喜"首音"定义已 T15 确认）。要"端到端真 ≤ 1.3s"必须级联。**Recommended stack (R3 出方向 · 路径 B 级联延迟优先)**: 本地 sherpa-onnx Zipformer bilingual-zh-en streaming ASR (RTF 0.04-0.15) → Doubao 同传 2.0 S2T mode → 本地 Fun-CosyVoice3-0.5B-2512 (官方 150ms bi-streaming) → BlackHole 16ch；首音 ~0.8-1.1s，0 样本克隆由 CosyVoice 3 自带。**R4 入方向 · 路径 A 直调 S2T**: Doubao 同传 2.0 mode=s2t（同 endpoint 同 WebSocket）直接给中英双语字幕，首字 < 2.5s。**跨架构通用优化**：preconnect + 30s keep-alive ping；Silero-v5 VAD 阈值 0.3；opuslib 流式解码避免 500ms 整句缓冲；本地模型启动后立即 warmup。**Failure modes**：① 降级到 Doubao 同传 2.0 S2S 单 endpoint（金喜标准版路径）；② 接受 ≥ 1.5s 首音；③ fallback S2T + Cartesia Sonic 云端 TTS（sub-90ms）。**28 primary sources**（6 GitHub repos + 5 arXiv papers + 11 official docs + 6 cross-references）。**重大简化洞察**：T01 + T16 共同确认——R4 不需要独立 MT 模块，S2T mode 同 endpoint 同 WebSocket 直接出双语字幕（650-655 事件），PoC 复杂度从 3 环节降到 1 环节。**互锁 T20**：T20 的「配置 B 不可行」结论是基于 S2S mode；T16 揭示用 S2T mode + 本地 ASR + 本地 TTS 的级联是延迟优先路径，应作为新的「配置 B'」加入 T20 矩阵。Findings 详 → [research/16](.scratch/macos-siminterpret-poc/research/16-streaming-first-sound-optimization.md)。

- [中英本地 MT 模型对比](.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md): **R4 走 Doubao s2t mode 单 session — 与 T16 完全一致** — 论文 arxiv 2507.17527 §3.3 表 2：S2T zh-en 句级 FLAL 2.12s + 客户端 ~100ms = **~2.1-2.4s 首字幕延迟**；字幕翻译质量 zh-en BLEURT 64.9 / en-zh BLEURT 62.0 (SOTA)，比拆 ASR + 本地 MarianMT (Tatoeba BLEU 31.4) 高 5+ BLEURT 点（论文 §5 Related Work 明文："cascaded architectures suffer from error propagation"）。**实现**：R4 = 1 WS + 1 session，mode=s2t，source=en，target=zh，省略 target_audio 字段，过滤 TTS 事件 350-352；字幕事件 650/651/652 (SourceSubtitle) + 653/654/655 (TranslationSubtitle) 与 R3 s2s session 事件流完全一致，**客户端代码可共用**。**License 确认**：NLLB-200 distilled = CC-BY-NC 4.0 + Meta 明文"not for production deployment" → 商用禁用；Opus-MT en-zh = Apache-2.0（比预期好）；Qwen2.5 = Apache-2.0。**4 路径决策矩阵**：路径A (Doubao s2t) 复杂度最低 + 质量最高；路径B (本地 ASR + Doubao MT 大模型) 隐私敏感场景复用 console；路径C (本地 MarianMT Apache-2.0) 极端隐私但 M2 tokens/sec 数据空白需本地 benchmark；路径D (Qwen-MT API) 成本 ~0.07-0.10/h。**Doubao 同传 2.0 vs 金喜**：金喜旗舰版用类似级联架构但加本地 TTS 达到 ~2-3 元/h（T15 揭示）；我们的开源实现可达到同等延迟但成本 ~5-14 元/h（无 CosyVoice 本地 TTS 降本）。**T16 + T18 一致推荐**：R4 不写本地 MT 代码，全部走 s2t mode。Findings 详 → [research/18](.scratch/macos-siminterpret-poc/research/18-local-mt-models.md)。

- [TTS 延迟优化 + 音色克隆方案](.scratch/macos-siminterpret-poc/issues/19-tts-latency-options.md): **R3 首选直接走 Doubao 同传 2.0 S2S — 端到端 0 样本克隆 + 跨语种音色迁移内置** — 论文 arxiv 2507.17527 给出 S2S zh-en FLAL 2.21s 整句延迟；Doppelvoice README 实测 2.5-3s；商务同传节奏可接受（T19 与 T15 一致：金喜标准版即此路径）。**≤1.3s 硬约束备选**：Cartesia Sonic (~90ms TTFA) + 本地 MT（MT 不在 T18 推荐范围内，跨链依赖强）。**本地 CosyVoice 3 (Apache-2.0) 备选**但 M2 MPS RTF 未见 benchmark。**Cost @ 100 chars/min**：Doubao S2S 待 T02 补（推测 ~¥1-2/h）；Cartesia Sonic + MT 仅 TTS 段 ~¥1.30/h；CosyVoice 3 本地仅电费 ~¥0.03/h。**9 引擎 × 10 维度对比表全填**（首音延迟 / 0 样本克隆 / 跨语种 / License / 单价 / 时薪 / 流式 / M2 可行 / 仓库 / URL）。**关键缺口（已在 research §五标注）**：① Doubao 同传 2.0 / bigtts per-char 单价（T02 范围）；② CosyVoice 3 在 M2 MPS RTF 实测（T17 同步做）；③ 跨语种克隆中文口音残留量化数字（所有引擎官方均未给，PoC 必须自评）。**与 T16 路径对比**：T19 推「直接 S2S」（最简，~2.5-3s）；T16 推「级联 cascade」（最快，~0.8-1.1s，需本地 ASR + 本地 TTS）；两者不冲突——是 R3 的两条不同实现路径，按 destination 优先级取舍。Findings 详 → [research/19](.scratch/macos-siminterpret-poc/issues/19-tts-latency-options.md)。

- [行业同传延迟降低技术 + 延迟预算深调研](.scratch/macos-siminterpret-poc/issues/23-industry-latency-reduction-survey.md): **关键洞察：TTS 是延迟主导 stage，不是 ASR/MT** — CosyVoice 2 bi-streaming 150ms（README L19 + arXiv 2412.10117v3 PRIMARY）/ Cartesia Sonic sub-90ms（PRIMARY）。任何"等完整句"TTS 都打不出 ≤1.3s 首音。**延迟口径辨析**：①首音（金喜 1.3s / 市面 3s）②first-token（Timekettle 0.2s Respond）③end-to-end response（iFlytek <5s, iflyrec.com PRIMARY）④SimulEval AL/AP/DAL + Seed FLAL。**1.3s vs 3s 差异分解**：~70% 来自口径（金喜 1.3s ≈ Doubao S2S FLAL 2.21s + 本地栈 ~1s 填充 = 看似 3s 实则 1.3s 首音），~30% 来自技术。**S2S 单 endpoint 硬下限 = 2.21s FLAL**（arXiv 2507.17527v2 §3.2 Table 1 PRIMARY），要 ≤1.3s 必须级联全 streaming。**降延迟 TOP-3 技巧**（按收益排序）：①bi-streaming TTS（决定性 800-1500ms → 90-150ms）②Doubao S2T 替代 S2S（同 endpoint 省 ~1s）③VAD 灵敏度 + read-write policy（Silero 0.3-0.4；Seed RL AL 3.90→2.37s per arXiv §4.1，节省 200-300ms）。**E2E vs 级联 trade-off**：Seed S2S AL 2.58s BLEU 84.1；SeamlessStreaming AL 1.68s（比 Seed 快 0.9s）但 BLEU 低 7.7 → E2E 在延迟上仍打不过好的级联，质量分水岭在 BLEU 8+。**Per-stage 预算表（完整版见 findings §3.1）**：v0 S2S 整段吞入 / v1 S2T+级联 ~800-1100ms / v2 全本地 ~400-800ms。**v0/v1/v2 一句话**：v0=Doubao S2S+6 项配置级优化 ~1.3s 金喜对标；v1=S2T+本地 Zipformer+CosyVoice 3 ≤2s/~1s 首音；v2=全本地级联 ≤1.3s（MT 质量妥协）。**Primary 来源**：arXiv 2507.17527v2 + 2412.10117v3 + 2502.11946 + FunAudioLLM/CosyVoice raw README + Cartesia Sonic + MS Teams Interpreter FAQ + Azure Speech Translation + iFlytek iflyrec + SimulEval + 火山引擎。Findings 详 → [research/23](.scratch/macos-siminterpret-poc/research/23-industry-latency-reduction-survey.md)。

- [macOS vs Windows 平台差异深调研](.scratch/macos-siminterpret-poc/issues/25-macos-vs-windows-platform-diff.md): **最大平台不对称在本地加速生态，不在音频路由** — **ASR 层** mac 与 win 接近对等（RTX 4070M CUDA ≈ 1.28× 快于 M4 Mini CoreML，encoder-only ~3.7×）；**TTS 层（CosyVoice 类）上游完全没有 MPS 支持**（CosyVoice#134 自 2024-07 open 至今），整个部署栈是 NVIDIA-only（Docker `--runtime=nvidia`、TensorRT-LLM、vLLM）——**这就是金喜「轻量本地版仅 Windows+NVIDIA」的根因，也是我们 mac 本地模式的硬天花板**。**Loopback 不对称**：Windows 有原生 WASAPI loopback（一个 flag、零安装、零权限弹窗）；macOS 无原生回采，必须 BlackHole / Process Tap (14.2+) / ScreenCaptureKit (13+) + TCC 权限弹窗。**驱动模型相反**：mac 虚拟声卡 = 用户态 HAL PlugIn（无 kext、无内核签名）；win 虚拟声卡 = 内核态 WDM/KS 驱动（强制内核签名）。**自研虚拟声卡 win 成本远高于 mac** → 两平台都依赖第三方（BlackHole / VB-CABLE）。**分发信任模型**：mac notarization 确定性（<1h 自动化）；win SmartScreen 概率性（新二进制即使 OV/EV 签名仍弹「Windows protected your PC」，信誉需数百次干净安装累积，EV 已不再豁免）。**音频 API 缓冲层** 两平台对等（~10ms quantum，Win10+ IAudioClient3 可压到 2.66ms，CoreAudio AUHAL 同样可协商）—— 缓冲差异（±10ms）远小于 ASR 窗口/网络影响，不构成产品级不对称。**会议软件**：两平台虚拟设备都当普通 endpoint，差异在 win 的 Windows Communications 自动降音 / WDM-MME 模式选择 vs mac 的 Multi-Output 时钟 drift / SCC 权限 UX。**商用 license 风险点**：BlackHole GPLv3（开源产品可直接依赖、闭源需商业 license）；VB-CABLE donationware（个人免费免费、捆绑分发保留归属 + 告知用户即可）。**对 PoC 的启示**：v0 mac 唯一硬天花板是本地 TTS 的 MPS 不支持（v0 必须用云 TTS）；v1 加 win 移植清单 = 内核驱动不可自研 + SmartScreen 信誉期需 1-3 个月 + Windows Communications 兼容性测试。**VB-CABLE 也有 mac 版**（VBCable_MACDriver_Pack108）—— 印证金喜 mac 教程「BlackHole + VB-CABLE 双装」的原因（T22）。**Loopback 商业版价格** $99（不是 T25 票里的 $109）。Findings 详 → [research/25](.scratch/macos-siminterpret-poc/research/25-macos-vs-windows-platform-diff.md)。

- [同传/语音翻译产品 × 技术栈映射（10 个产品 + 行业 landscape）](.scratch/macos-siminterpret-poc/issues/26-interpretation-product-stack-map.md): **行业 landscape — 10 个主流产品技术栈横评** — **Microsoft Teams Interpreter** = 云端 cascade ST→MT→TTS on Azure AI Services（官方 FAQ 明文），含 20 h/人/月 Copilot license。**Google Gemini Live Translate** = 端到端 S2S 音频模型（70+ 语言、保留音调、SynthID 水印）；GA 给企业（2026-02）+ Live API 公开 preview。**iFlytek 讯飞同传** = 星火同传语音大模型（国内首个 E2E 语音同传大模型、E2E avg response <5s、+30% 质量）。**Timekettle** = 自研 Babel OS 2.0 + HybridComm 3.0 + AI Voice Cloning 52 语言（硬件+软件）。**Camb.ai** = 自研 MARS8 TTS family (Flash 600M) + Live dubbing 312 ms SRT→3 langs + Realtime S2S WebSocket API beta。**金喜** = T15/T22 已反推（标准云端 Doubao 同传 2.0 S2S）。**Doppelvoice** = 确认 Doubao AST 2.0 E2E S2S、~2.5–3 s、**仅 Win**（README 数据）。**TransEcho** = 豆包同传 2.0 + Tauri 跨平台。**sokuji** = 多 backend 客户端（OpenAI / Gemini / Soniox / Doubao AST 2.0 / Zoom AI）+ 完全本地 WASM+WebGPU（44 ASR + 75 MT + 137 TTS 模型），AGPL-3.0。**Chatterbox 是两个东西**：Resemble AI 开源 Chatterbox (MIT、26k stars、非 realtime) vs CAMB.AI Chatterbox 是 Windows 桌面同传 app。**关键发现**：① 主流 10 家中 8 家走 cascade + 商用云 API，只 Google + 讯飞 + Camb.ai 有 E2E 自研模型——金喜「轻量云端=级联+训练音色」是行业最成熟模式；② **Doubao AST 2.0 是中文开源同传事实标准**（金喜 / Doppelvoice / TransEcho / sokuji 都用它）—— 印证 v0 选 Doubao；③ 跨平台差异显著（Doppelvoice 确认仅 Win；sokuji 跨平台+本地是唯一开源多后端方案）。**差异化机会**：开源 + BYO-key + 完全本地（数据可控）+ 自定义术语库（T22 已确认这是金喜自认的差异化点）。**自研挑战**：Doubao 同传 2.0 这种 E2E 是字节自研、复制不了；只能靠级联 + 本地 TTS 优化。**Notes**：T26 实际上替代了 T23 的「主流产品 latency 横评」部分内容（T23 subagent 失败，retry 在进行中）。Findings 详 → [research/26](.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md)。

- [语音模型 × 技术栈 行业横评（2026-09）](.scratch/macos-siminterpret-poc/issues/24-speech-model-landscape-2026.md): **v0/v1/v2 三档模型选型 + License 红线 + 去字节对冲** — 表格横评本地/云端 ASR/MT/TTS/E2E S2S 全部主流模型，含延迟/质量/license/cost/平台/音色克隆维度。**关键发现**：① **Moshi 是唯一商用安全的开源 E2E S2S**（CC-BY 4.0 weights + MIT/Apache code, 200ms latency on L4 GPU）—— **但仅英文**，zh-en 不行；② **唯一商用安全开源 zh-en E2E**：Qwen2.5-Omni-7B + Step-Audio 2 mini（均 Apache-2.0, CoVoST2 zh-en BLEU ~29.4）；③ Deepgram Nova-3 multilingual **$0.288/h** 是海外 zh-en ASR 性价比第一；豆包流式 ASR ¥1-4.5/h 最便宜；讯飞 RTASR ¥0.42-0.69/h 但仅限中国大陆；④ **Piper 迁库后改 GPL-3.0**（原 MIT 不再有效，语音包限 personal/research）—— 原 MIT 不再可用；⑤ **SeamlessM4T v2 / SeamlessStreaming 均 CC-BY-NC-4.0 商用禁用**（LICENSE verbatim 核实）；⑥ **Qwen 全家桶**（Paraformer + Qwen-MT + CosyVoice 3）= 唯一完整 Apache-2.0 **去字节对冲栈**；⑦ Chatterbox (MIT + MPS 官方) + Kokoro-82M (Apache-2.0 + MPS 官方) 是 Mac 本地可商用 TTS 双选项。**License 红线清单**（商用禁用）：NLLB-200 distilled (CC-BY-NC) / mBART-50 (无 LICENSE 文件) / F5-TTS 权重 (CC-BY-NC) / ChatTTS (AGPL+CC-BY-NC) / SeamlessM4T v2 (CC-BY-NC) / SeamlessStreaming (CC-BY-NC) / Moshi 英文 OK / Translatotron 3 research-only。**v0/v1/v2 选型**：v0 全 Doubao ¥14.6/h（同 T20/T19 结论）；v1 本地 sherpa Zipformer (ASR) + Doubao s2t (MT) + CosyVoice 3 (TTS) ~¥1.2/h（同 T20 config C）；v2 全本地 ¥0 但 Piper 无克隆是天花板（同 T20 config D）。**Primary 来源**：模型仓库 LICENSE verbatim、官方定价页 PDF/REST、arXiv、官方 HF model cards。**Known gaps**（5 项已标注「未公开/待二次核验」）：Google Cloud STT v2、Azure TTS per-1M char、Kimi-Audio LICENSE path、OpenAI / Google docs Cloudflare/timeout 拦截、iFlytek 中国大陆 ToS。Findings 详 → [research/24](.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md)。

- [大成子 ONLY · 虚拟声卡原理 wiki 内容抓取 + 合成](.scratch/macos-siminterpret-poc/issues/21-virtual-sound-card-wiki-synthesis.md): **3 个新增典型误区 — T06 调研缺失的反面教材** — 通过 orca computer-use 在用户已登录 Chrome 抓取 wiki DOM accessibility tree（324 elements）+ 截图。**链路 A（我→对方）+ 链路 B（对方→我）独立双链路架构**与 T05 B1 总线隔离 + T06 mirror device 思想一致（不同表述、同一原理）。**核心新增 · 3 个误区**（应作为 T12 + T13 + T14 验收 checklist 必检项）：① 误区 1（死循环）：两个翻译输出用同一虚拟声卡 → 无限套娃 + 回声爆炸；② 误区 2（传原文）：会议软件麦克风选真实麦 → 未翻译原文传给会议；③ 误区 3（串音）：对方翻译输出接虚拟声卡 → 串音给会议。**R4 单字幕模式可行**（作者回复用户评论「可以，配置完全自由，声音不外放就就行」）」→与 T16 + T18 推荐的 s2t mode 路径完全一致；T10 音色克隆选型可简化（只关心 R3 出方向）。**百度网盘安装包**：https://pan.baidu.com/s/1C6N2XO3Jb_1K8g_-kYepeg?pwd=8888（同作者提供的虚拟声卡工具集，可能含定制 BlackHole；T07 仍走标准 brew 路径，此安装包留作 v1+ "一键安装"备选）。Findings 详 → [research/21](.scratch/macos-siminterpret-poc/research/21-virtual-sound-card-wiki-synthesis.md)。

**T01 关键纠错**：地图原 Notes「声音复刻 2.0 + 预训练 speaker_id」表述需修订——声音复刻 2.0 是「跨会话稳定音色的预训练素材」，**不是** S2S 前置；PoC 阶段可直接用 0 样本（`speaker_id=""`），声音复刻 2.0 留作 v1 跨会话稳定性需求时再做。

## Not yet specified

<!-- in-scope fog: specifiable once frontier advances -->

- **【用户身份确认 · 已解除】** 用户已确认有大陆身份证 + +86 手机号（基于已登录 console 的截图）；T09 实名阻塞 #1 不再卡。但海外用户路径仍未在公开文档中——若需服务海外用户须另开调研票。
- **【关键 · 待 T15-T20】** 1.3s 首音延迟的实现路径——是流式首音 + Doubao 云端？本地 ASR + 云端 MT/TTS 混合？还是全本地？这取决于 T15 (金喜反推) + T16 (流式优化) + T17/T18/T19 (本地模型) + T20 (混合架构) 的结论。
- **【关键 · 待 T15-T20】** 产品差异化优先级排序——开源 + BYO-key 已经和 金喜（闭源 + 自营 key）形成差异；还需要哪些差异化？更低延迟？更低成本？更多语言？更好 UI？
- **【关键 · 待 T15-T20】** 是否本地模式做？（金喜旗舰版本地模式 0.7-1 元/小时是竞争力极强的一档）
- **【次要 · 待 T13/T14 实测】** 1.3s 的实际可达性——金喜 1.3s 是首音延迟 vs 端到端延迟？我们的实现能不能达到？需要 T15 金喜反推 + 实际 PoC 跑测双重确认
- **【次要】** 用户的开发 / 测试 / 文档能力——单兵作战 vs 团队？开源治理模式（一人 / 小团队 / 社区）？
- **【次要】** PoC 的"金喜能用我们也能用"对比基准：是否要购买金喜测试卡做 A/B 对照测试（¥49 成本）
- **【T02 揭示的硬阻塞 #2】** 充值方式 / 最低金额 / 支付渠道 公开文档需登录 console 才能看到，T09 执行时需现场查。
- Exact BlackHole bus topology on macOS 14.4.1 (which inputs feed which outputs, how to prevent the R4 loopback from picking up R3 output) — pending T12
- Whether the PoC exercises a **file-based** test (pre-recorded CN audio → file output) alongside the live-mic test, to make regression comparison cheap — likely yes, deferred to T13 design
- How to measure "voice clone quality" objectively (cosine similarity to reference? ABX preference test? user-judgement-only?) — likely user-judgement-only for PoC, deferred to T13
- Whether the CLI should multiplex stdout (interleaved JSON event stream) or split into two streams (R3 audio out via BlackHole / R4 subtitles on stdout) — likely split, deferred to T11
- Whether 0-sample auto clone (同传 2.0 内置) actually maintains timbre stability across a 30-minute meeting in practice, vs degrading — unknown without PoC run, deferred to T13/T14 results; **已知限制**：Doppelvoice CHANGELOG 自承「重连后零样本音色突变」，PoC 单 session 内是否有此问题未知
- The latency budget: PDF §3 says ~3s end-to-end, but actual measurement on M2 + 豆包 may differ; we don't know until T13
- 是否需要为 PoC 内置一个类似 `check_voicemeeter.py` 的启动前拓扑验证工具（基于 T05 的发现）
- T01 揭示 `format=pcm` 流式输出不通、必须 `ogg_opus` —— 本 PoC 是否需要在 audio output 侧增加 ogg_opus 解码？Rubato 已用于重采样，是否包含 ogg 解码？T08 baseline 跑通时验证
- **【大成子 wiki 揭示 · T21】** 3 个必检误区必须加入 PoC 验收 checklist：
  - 误区 1 自检：链路 A 输出虚拟声卡 ≠ 链路 B 输入虚拟声卡（设备级隔离）
  - 误区 2 自检：会议软件麦克风输入 = 我的翻译输出对应的虚拟声卡 Output（而非真实麦）
  - 误区 3 自检：对方翻译输出走真实耳机（而非虚拟声卡），只在本地播放
  - 这 3 项应作为 T12（macOS 总线隔离 PoC）+ T13（BlackHole 音频环路验收）+ T14（自开会议端到端）的必检项
- **【大成子 wiki 揭示 · T21】** R4 单字幕模式（无 TTS）明确被作者支持——v0 PoC R4 可只输出字幕、不做声音合成；v1+ 可选加 R4 TTS

## Out of scope

These are **consciously excluded** from this map (destination fixes scope):

- **Windows 平台对等** —— 用户唯一环境是 macOS；Win 端口是 v1+ 后续 map 的事
- **Speakerphone / 不戴耳机模式**（AEC）—— WebRTC AEC3 / Neural LocalVQE / RTX AEC，Phase 2，金喜也没把这当主推
- **跨会话稳定音色打磨** —— Doppelvoice CHANGELOG 自承的"重连后零样本音色突变"问题，留给 v1 + 声音复刻 2.0 训练子命令
- **产品级 UI**（菜单栏 app / 浮动字幕 / 系统托盘 / dark mode）—— 超出 destination，CLI 阶段够用
- **macOS DMG 打包 / 代码签名 / 公证** —— 超出 destination，留给 v1 发布阶段
- **多语言扩展**（30+ 语言本地模型）—— destination 只锁中英；扩展是 v1+ 的事
- **离线完全本地模式**（无网也能跑）—— 需要模型量化 + 本地推理栈，工程量翻倍；destination 不强求
- **企业级合规**（GDPR / 隐私 / 审计）—— destination 不强求，留给商业化阶段
- **实时字幕的会议软件层注入**（如 Zoom 内置字幕 API）—— 不同产品面，不是同一产品
- **跨会话多用户支持 / 多租户 SaaS** —— 超出 destination
- **CJK 字体 / 无障碍 / RTL** —— 超出 destination
- **金喜的"自营 API key + 中间商赚差价"模式** —— 我们做 BYO-key 开源，反向差异化；商业化定价策略留 v1+ 决策

## Comments

- **2026-09 chart session #1**：基于 PDF 调研设 destination 为「macOS PoC 验证 Doubao 链路」。Grilling 3 轮锁定 destination / pipeline / 模式 / 代码起点 / UI / 仓库深度。Chart 14 张子票，6 张 research 已完成（火山 API / 账号 / TransEcho / Doppelvoice / realtime-voice-translator / macOS 路由）。
- **2026-09 chart session #2 (本次)**：用户发现金喜同声传译双通道版是 2026 出现的商业闭源产品（¥49-4999，1.3s 首音延迟），直接反驳 PDF §3 的「市面无现成产品」结论。用户目标从「自用 PoC」升级为「**C · 做产品竞争**」。Destination 升级为「macOS-first 开源产品，对标金喜 1.3s + < ¥2/h 成本 + 开源可改」。新加 6 张 research 子票 T15-T20 专门调研"怎么做到 1.3s"+"本地+云端混合架构"。原 T01-T06 仍有效（基础事实不变），但需重新解读为「产品对标」的输入而非「PoC 链路」的输入。

- **2026-09 chart session #3 (本次续)**：用户要求「再来一轮深入调研」——行业同传主流方案 / 降延迟技术 / 主流技术栈 / mac-win 差异 / 虚拟声卡 / 语音模型 / 延迟来源。先用 computer-use 抓取金喜客户专属教程 wiki（T22，resolved）：三模式技术分层（零样本实时/训练音色两卡槽/本地参考音频仅 Win+NVIDIA）+ 延迟 FAQ（首音 1.3s vs 市面 3s；VPN 加延迟需域名直连）+ 原声直出双向 bypass + 术语库=核心差异化 + mac 安装链=标准 brew BlackHole 2ch。再开 3 张行业深调研票 T23（延迟降低+预算）/ T24（模型 inventory）/ T25（mac-win 平台差异），3 个 subagent 并行。