# 混合云-端架构模式调研

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

金喜旗舰版采用"混合架构"——用户可在云端轻量方案与本地模型方案间切换。本票调研：哪些组件放本地 / 哪些放云端 / 失败降级 / 离线模式 / 成本最优配置。

要回答的问题：

1. **组件拆分**（以同传链路 ASR → MT → TTS 为骨架）：
   - R3 出方向：mic → ASR → MT → TTS → BlackHole（5 步）
   - R4 入方向：SCC → ASR → MT → 字幕（4 步，TTS 不需要）

2. **每一步的本地/云端 trade-off**：

| 步骤 | 云端（豆包） | 本地（M2） | 延迟差异 | 成本差异 | 质量差异 |
|---|---|---|---|---|---|
| ASR (CN) | Doubao ASR | sherpa-onnx FunASR | 200ms | 微 | 中 |
| ASR (EN) | Doubao ASR | sherpa-onnx Zipformer | 200ms | 微 | 中 |
| MT (CN→EN) | Doubao 同传内置 | 本地 MarianMT / Qwen 小模型 | 300ms | 中 | 中 |
| MT (EN→CN) | 同上 | 同上 | 同上 | 同上 | 同上 |
| TTS (音色克隆) | Doubao 同传 S2S | 本地 CosyVoice / GPT-SoVITS | 500ms | 中 | 中 |
| VAD | 客户端 | 客户端 | 0 | 0 | - |

3. **典型混合配置**：
   - **配置 A：全云端（最简）**——全走 Doubao 同传 2.0 S2S / S2T。预计延迟 ~2.5-3s，成本 ~9-12 元/小时（达到金喜标准云端级别）
   - **配置 B：本地 ASR + 云端 TTS（延迟优先）**——本地 Whisper / sherpa-onnx ASR + Doubao 同传 S2S（仅用 MT + TTS 部分）。预计延迟 ~1.5-2s，成本 ~5-7 元/小时
   - **配置 C：本地 ASR + 本地 TTS + 云端 MT（成本优先）**——本地全推理 + 云端只走翻译。预计延迟 ~1-1.5s，成本 ~1-3 元/小时
   - **配置 D：全本地（离线模式）**——Whisper + MarianMT + CosyVoice 全本地推理。预计延迟 ~1-2s，成本 ~0 元/小时（电费忽略）

4. **失败降级策略**：
   - 云端 API 失败 → 切到本地（如果有）
   - 本地模型加载失败 → 切到云端
   - 网络中断 → 暂停 + 提示
5. **冷启动成本**：用户启动 app 后多久能"进入工作状态"？本地模型加载时间？
6. **跨平台考虑**：本地模式在 Windows / Linux 上能跑通吗？

最终交付：「推荐的混合架构配置（一个主推 + 一个备选）+ 失败降级流程图 + 冷启动时间估算」。

特别考虑：用户唯一环境是 M2 MacBook Air（16GB 内存？需要确认），全本地模式可能受限于内存。需在答案中说明最低硬件要求。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/20-hybrid-cloud-local-architecture.md`

**Gist**: PoC v0 推 **配置 A 全云端**（零本地模型, M2 16GB 极度充裕, ~3-4 s 首音, 后付费 ~14.6 元/小时 / 资源包 ~5 元/小时, 与金喜 9-12 元/小时同量级)；v1 加 **配置 C 离线路由**（本地 sherpa-onnx ASR + 云 Doubao 同传 s2t MT + 本地 CosyVoice2 TTS, ~1 元/小时, 与金喜 0.7-1 元旗舰本地量级一致）。**配置 B 在 Doubao 当前 API 限制下架构不可行**（S2S 不接受外部 ASR 文本输入），跳过。配置 D 仅作 v2 long-term 探索。冷启动 A < 4 s, C ~8-12 s（CosyVoice2 PyTorch 加载峰值 ~3 GB 是大头）。

Recommended configurations:
- **PoC 默认**: **配置 A — 全云端 Doubao 同传 2.0** — R3 ~3-4 s 首音 / R4 字幕即时 — 后付费 ~14.6 元/小时（资源包 ~5 元/小时） — 零本地模型 = 零内存压力 + 最短冷启动 + 音质 SOTA + 跨平台 zero-change; 直接 fork Doppelvoice 客户端 + 套 macOS 音频路由层
- **PoC 可选 / v1 production 备选**: **配置 C — 本地 ASR + 本地 TTS + 云端 MT** — R3 ~3-4 s 首音 — 后付费 ~1.2 元/小时（资源包 ~0.8 元/小时） — 差异化卖点 = 离线/差网场景 + 海外用户绕开火山引擎账号壁垒 + 1 元/小时量级与金喜旗舰本地持平; M2 16GB 内存压力 ~2-3 GB（紧张但可行，ASR + TTS 并发时可能 OOM）
- **v2 long-term 离线模式**: **配置 D' — 全本地最小（Piper 无 0 样本克隆）** — R3 ~1.5-2 s 首音 — 0 元/小时 — M2 16GB 上极度充裕（~1 GB 稳态）；代价 = 音质/翻译质量全面劣于云端，且无 0 样本克隆能力（Piper / VITS 系模型不支持）

Failure mode handling (per config):

1. **云端 API 失败** (配置 A 默认路径):
   - WS 鉴权 401 / API 5xx / 超时 30s → UI 红色横幅「实时翻译暂停，检查网络」, 暂停所有 mic 采集; 30s 内自动重连复用同 session_id; **若持续失败提示用户切配置 C**。
2. **本地模型未加载** (配置 C / D 路径):
   - 权重文件缺失/OOM → UI 提示用户「模型未下载,是否现在下载?(~700 MB - 1.5 GB)」; 用户选否 → 禁用该模块, 仅启用已就绪模块（例: 本地 ASR OK + 本地 TTS 缺 → R4 字幕可用 + R3 不可用）。
3. **网络中断**:
   - 配置 A → 等同于「云端 API 失败」, 暂停所有采集 + 提示; **无本地 fallback**, 必须切配置 C/D。
   - 配置 C → 检测云 MT 不可达 → 自动降级到本地 MarianMT (BLEU 35 仍可用) → 等价于配置 D' 全本地链路; 本地 TTS load 失败则禁用 TTS, 仅保字幕模式。
   - 配置 D → 全本地无云依赖, 不受影响。

Cold start estimate (user opens app → ready to interpret):
- **配置 A**: **< 4 s**（App 启动 ~1 s + BlackHole 探测 + mic 权限 + Doubao WS 握手 ~500 ms + 第一次说话 → 译音 ~2-3 s）— 零本地模型, 立刻进工作状态
- **配置 C**: **~8-12 s**（sherpa-onnx 加载 190 MB + CosyVoice2 PyTorch 加载峰值 2-3 GB, 加载时间是主瓶颈）— 用户首次启动可见进度条
- **配置 D (全本地最小)**: **~3-5 s**（sherpa-onnx + MarianMT CTranslate2 + Piper 全部轻量, 总加载 ~700 MB）
- **配置 D' (含 CosyVoice2 0 样本克隆)**: **~8-12 s**（同 C）

## Comments

<!-- conversation history -->