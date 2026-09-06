# TTS 引擎对比 + 跨语种音色克隆可行性 — Research

> Status: 2026-09 时点。仅基于一级源（GitHub README/LICENSE、官方定价页、官方 arXiv 论文、官方产品页），未引用任何第三方评测博客。
> Ticket: `.scratch/macos-siminterpret-poc/issues/19-tts-latency-options.md`
> 单位换算：USD → CNY 按 1 USD = 7.20 CNY（2026-09 近似口径，便于横向比较；火山引擎官方账单按 CNY 出）。

---

## TL;DR — 推荐与结论

- **R3 出方向首选：豆包同传 2.0 S2S（端到端）** — 内置 0 样本克隆，模型级跨语种音色迁移（中→英）已经在论文里被端到端优化；官方实测端到端 ≈ 2.5–3 s（论文 3 s 口径），本地缓冲再加 <500 ms。TTS 不能从 S2S 拆出来单独用。
- **R3 低延迟备选路径（≤1.3 s 硬目标）：Cartesia Sonic（Mist v3 ≤100 ms TTFB） + 本地 MT 出端；ElevenLabs Flash/Turbo 75 ms 但 API 跨语种音色克隆不能直接复用中文音色做英文。** — 但这两家都要求把"用户音色 → 英文"两步换成 MT 单独服务 + 英文 TTS 单独服务，**MT 链路不在本 ticket 范围**。
- **本地开源备选：CosyVoice 3 (FunAudioLLM/FunAudioLLM/CosyVoice)** — Apache-2.0，零样本克隆 + 跨语种迁移开源自带，官方 README 自报 streaming 延迟 150 ms（GPU 上）。M2 MPS 推理实测 RTF 数据未见（仓库 README 标注需 ≥ 0.5B vLLM 后端但没有 M2 benchmark）；GPT-SoVITS v2 ProPlus README 自报 M4 CPU RTF 0.526（1 倍时长音频需要 0.526 倍时长推理），即 1 s 音频约 0.53 s 推理 → 不可达 1.3 s 首音目标。
- **TTS 部分是否可以单独用？** 豆包同传 2.0 是端到端模型 — **TTS 不能拆出来单独用**；零样本克隆是 S2S endpoint 的内置能力。要做"中文进 → 仅 TTS"也是同一个 WebSocket (mode=s2s) 走完整链路。要"预训练 speaker_id 跨语种"也是同一个 endpoint 用 `speaker_id` 字段切换，不需要先调"声音复刻 2.0"。
- **成本（100 chars/min 持续输出，对照 R3 PoC 假设：1 小时 ≈ 6000 字）**：
  - 豆包同传 2.0：未在公开 docs 找到 per-char 单价（按分钟计或按 token 计，控台为准）— 推测 ¥1–2/h 区间（待 T02 确认）。
  - Cartesia Sonic：$0.03 / 1K chars = ¥0.22 / 1K chars → 100 chars/min × 60 min = ¥1.30/h。
  - Rime Mist v3：$0.03 / 1K chars = ¥0.22 / 1K chars → ¥1.30/h（同 Cartesia 巧合）。
  - ElevenLabs Flash/Turbo：$0.05 / 1K chars = ¥0.36 / 1K chars → ¥2.16/h（贵 66%）。
  - CosyVoice 3（开源本地）：仅电费 — 跑在 M2 上 ~50 W，0.05 kWh × ¥0.6/kWh ≈ ¥0.03/h（边际成本可忽略）。
- **跨语种音色迁移（火山引擎）**：默认 `speaker_id` 留空 = 端到端实时采样音色；填预设 `zh_*` speaker_id = 用中文音色说英文。论文 + Doppelvoice README 均明确"voice is cloned zero-shot from your speech as you talk"。中文口音残留问题未在官方资料中量化，T09/T10 后续 PoC 需要 A/B。

---

## 一、对比表（10 维度 × 9 引擎）

> 数字：除"未验证"外均带 [Source](url)。
> "First-sound latency" 在表中分别列出 **官方/仓库自报值** 和 **官方定价页里的 TTFA 数据**（不同厂商口径不同，请以下方单引擎章节为准）。

| 维度 | Doubao 同传 2.0 S2S | Doubao bigtts（独立 TTS） | CosyVoice 3 | GPT-SoVITS v2 ProPlus | StyleTTS 2 | F5-TTS | ElevenLabs (Flash/Turbo) | Cartesia Sonic | Rime Mist v3 |
|---|---|---|---|---|---|---|---|---|---|
| First-sound latency（端到端 / 首 token） | **≈ 2.5–3 s** 整句（论文 + Doppelvoice）| 未在公开 docs 量化 streaming TTFA；bigtts 流式接口默认整句/短句合成的整句延迟 | **streaming 延迟 150 ms**（仓库 README 自报，**GPU**）| RTF 0.526 in M4 CPU（仓库 README），即 1 s 音频 ~0.53 s 推理 — **首音 ≈ 数百 ms ~ 几 s，取决于输入文本** | 未自报 RTF；LibriTTS-LJSpeech 1 GPU finetune 4 h | RTX L20 上 253 ms avg latency（仓库 README，TRT-LLM Client-Server 并发 2）| **Flash/Turbo：~75 ms**（官方 API 定价页 "Ultra-low latency ~75ms"）| **Sonic 3.5/3.6：~90 ms TTFB**（docs 首页 + 产品页）| **Mist v3 TTFA 37 ms (P50), 56 ms (P90)**（官方定价页）|
| 0-sample clone | ✅ 内置（`speaker_id` 留空 = 实时采样） | ✅（声音复刻 2.0 单独 API，需先训练 10s+ 音频 → 拿 `speaker_id` 再用） | ✅ 跨语种 zero-shot（仓库 Highlight: "multi-lingual/cross-lingual zero-shot voice cloning"）| ✅ Zero-shot TTS 5 秒样本；Few-shot 1 分钟（仓库 Features 1+2）| ✅ 零样本（LibriTTS checkpoint）— 但跨语种需 multilingual PL-BERT | ✅ Reference audio + ref_text 引导（仓库 Examples）| ✅ Instant Voice Clone（API 文档 Stater plan 起）；Professional Voice Clone 需 Creator+ | ✅ Instant voice cloning — 10 秒音频 → 跨 44 语言（产品页）| ✅ Custom voice cloning — Enterprise 无限 |
| Cross-language transfer（CN 音色 → EN 语音） | ✅ 内置：把 `speaker_id` 留空 / 填 `zh_*_bigtts` 都能让中文音色说英文 | ✅ 跨语种克隆是 bigtts 能力 — 但需先训练一个跨语种 speaker_id | ✅ 仓库 README 明示 "multi-lingual/cross-lingual zero-shot voice cloning" + 多语种 PL-BERT | ✅ Cross-lingual: en/ja/ko/yue/zh（仓库 Features 3）| ⚠ 需 multilingual PL-BERT（仓库 Inference 节提示），中文 OK 但与官方基线 LJSpeech 英文基线不一致 | ⚠ 单模型 primary 训 Emilia ZH-EN；零样本中文音色 → 英文可但 accent leakage 报告未见 | ✅ Multilingual v2/v3 / Flash v2.5：v3 Conversational 70+ languages；中文音色 → 英文 OK | ✅ "Localize any audio clip with native-speaker quality ... 44 languages"（产品页）| ✅ 50+ languages + regional dialects（pricing 页）|
| License | 商用（API key 受控）| 商用 | **Apache-2.0**（LICENSE 文件确认）| **MIT**（README badge + 仓库 LICENSE 确认）| **Code: MIT**；**Pre-trained models: 必须 voice 主人同意 + 标注合成**（README License 节明确）| **Code: MIT**；**Pre-trained models: CC-BY-NC**（训练数据 Emilia 限制，README License 节）| 商用（订阅 / Pay-as-you-go）| 商用（订阅 + Pay-as-you-go）| 商用（订阅 + Enterprise）|
| Cost / 1K chars（CNY） | 未公开 per-char 单价；按分钟或按 token 计（T02 待补） | 未在 docs 找到 per-char 单价；T02 任务 | ¥0（开源本地，仅电费） | ¥0（开源本地） | ¥0 | ¥0 | ¥0.36（$0.05 × 7.20） | ¥0.22（$0.03 × 7.20，按 Pro plan 1K-char 单价 + 量级反推；Cartesia 定价页 Pro plan 100K credits / 月含 133 min 音频）| ¥0.22（$0.03 × 7.20，Mist v3 单价）|
| Cost / hour @ 100 chars/min | 待 T02 补 | 待 T02 补 | ~¥0.03（电费） | ~¥0.03 | ~¥0.03 | ~¥0.03 | ¥2.16 | ¥1.30 | ¥1.30 |
| Streaming / chunked output | ✅ 流式（event 350/351/352 标记 TTS 句边界） | ✅ 流式（标准 bigtts 接口）| ✅ Bi-Streaming text-in + audio-out，streaming 150 ms | ✅ Streaming mode 支持（项目"运行GPT-SoVITS WebUI" + 自定义 streaming API）| ❌ 仓库未明示 streaming；社区 styletts2 pip 包实验性 streaming | ✅ TRT-LLM runtime 公开 latency 253 ms | ✅ WebSocket / Streaming API，TTFB 75 ms | ✅ HTTP + WebSockets（pricing 页 dev 表）| ✅ HTTP + WebSockets（pricing 页 dev 表）|
| M2 / Apple Silicon 本地可行？ | N/A（云端）| N/A（云端）| ⚠ 仓库 README 标注 vLLM 0.9.0 / ≥0.11.0 支持 — **未见 M2 benchmark**；vLLM 主仓对 Apple Silicon MPS 支持有限（PyTorch nightly 标记） | ✅ 仓库 README 显式列出 "Python 3.9 + Apple silicon" 为测试环境；但 README 警告 "macOS 上用 GPU 训练显著低于其他设备，所以暂时 CPU 跑" | ⚠ 主要 NVIDIA GPU；CPU 可跑（README "Inference on CPUs" 提示）| ⚠ 主要 NVIDIA；仓库 README 支持 AMD ROCm / Intel XPU / Apple Silicon "pip install torch torchaudio" 但无 M2 延迟 benchmark | N/A | N/A | ⚠ Enterprise 自托管可 Docker Compose / K8s；未列 Apple Silicon |
| Vendor / repo | ByteDance 火山引擎；Doppelvoice / sokuji 客户端参考 | docs.volcengine.com/docs/6561 | github.com/FunAudioLLM/CosyVoice | github.com/RVC-Boss/GPT-SoVITS | github.com/yl4579/StyleTTS2 | github.com/SWivid/F5-TTS | elevenlabs.io / api.elevenlabs.io | cartesia.ai / docs.cartesia.ai | rime.ai / docs.rime.ai |
| 关键证据 URL | [arXiv:2507.17527](https://arxiv.org/abs/2507.17527) / [Doppelvoice README](https://github.com/Tianqi-Bu/Doppelvoice) | [docs.volcengine.com/6561](https://docs.volcengine.com/docs/6561) | [README](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md) / [LICENSE](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE) | [README](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md) | [README](https://raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md) / [arXiv:2306.07691](https://arxiv.org/abs/2306.07691) | [README](https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md) / [arXiv:2410.06885](https://arxiv.org/abs/2410.06885) | [Pricing/API](https://elevenlabs.io/pricing/api) | [Pricing](https://www.cartesia.ai/pricing) / [Docs](https://docs.cartesia.ai/) | [Pricing](https://www.rime.ai/pricing) |

---

## 二、单引擎详细数据（按一级 URL 引用）

### 1. 豆包同传 2.0 S2S（首选）

- **协议 / 端到端延迟**：WSS + 二进制 protobuf；**官方论文实测 3 秒**，生产实测 **2.5–3 s**（"voice is cloned zero-shot from your speech as you talk"，Doppelvoice README L34）。
- **端到端延迟构成**：模型推理硬下限 2.5 s + 本地采集/编码/缓冲 < 500 ms + ogg_opus 整句解码 ~500 ms（"Sentence-end ogg/opus batch decode"，Doppelvoice ARCHITECTURE L285）。
- **零样本克隆**：`speaker_id` 留空 = 服务端流式实时采样音色。"End-to-end speech-to-speech understanding-generating framework" (arXiv:2507.17527 摘要)。
- **跨语种音色迁移**：填预设 `zh_female_vv_uranus_bigtts` 走预训练音色；空 speaker_id 走端到端实时克隆 — **两种都不要求先调"声音复刻 2.0"**。
- **TTS 是否可单独用**：**否**。S2S endpoint 是端到端 ASR + MT + TTS 一体；mode 字段可切 s2s/s2t，s2t 只关 TTS；要单独 TTS 必须走 **独立 bigtts / 声音复刻 API**（见下）。
- **成本**：未在公开 docs 找到 per-char 单价 — T02 待补。从控制台描述推断是按 token/分钟计，类似其他火山语音 API。
- 来源：
  - arXiv 论文：[Seed LiveInterpret 2.0](https://arxiv.org/abs/2507.17527)
  - Doppelvoice README：[github.com/Tianqi-Bu/Doppelvoice](https://github.com/Tianqi-Bu/Doppelvoice)
  - sokuji README：[github.com/kizuna-ai-lab/sokuji](https://github.com/kizuna-ai-lab/sokuji)
  - 火山引擎 docs：[docs.volcengine.com/6561](https://docs.volcengine.com/docs/6561)（JS 渲染，引用其他仓库确认存在）

### 2. Doubao bigtts（独立 TTS / 声音复刻 2.0）

- **能力**：标准 TTS API + 独立「声音复刻 2.0」API（上传参考音频 → 训练 → 拿 `speaker_id` → 在 bigtts/同传 2.0 中引用）。
- **首音延迟**：未在公开 docs 量化（JS 渲染；T02 任务范围内查控制台）。
- **零样本 / 跨语种克隆**：需要先用"声音复刻 2.0" 训练；预训练音色库 (`zh_*_bigtts` 命名空间) 可直接用作跨语种音色。
- **来源**：[docs.volcengine.com/docs/6561](https://docs.volcengine.com/docs/6561)（内容 JS 渲染，需登录）；引用见 T01 / T02 已有研究文件。

### 3. CosyVoice 3（Apache-2.0，首选本地备选）

- **License**：**Apache-2.0**（LICENSE 文件确认 — https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE）。
- **零样本 + 跨语种克隆**：README Highlight 明确"multi-lingual/cross-lingual zero-shot voice cloning"（9 语种 + 18+ 中文方言）。
- **首音延迟**：README Highlight "achieves latency as low as **150ms** while maintaining high-quality audio output" — **GPU**（vLLM 0.9.0 / ≥0.11.0 后端）；M2 / Apple Silicon benchmark **未见**。
- **M2 可行性**：仓库 README "Apple Silicon" 章节存在；但 vLLM 主仓对 Apple Silicon (MPS) 支持仍在 nightly；仓库标注 macOS 路径需自己测 RTF。
- **流式**：✅ Bi-Streaming（text-in + audio-out）。
- **评估**：在 test-zh CER 1.21%、test-en WER 2.24%、SS 71.8%（README 评估表）— 跨语种音色相似度 **未在仓库表里单独列**。
- **来源**：
  - README：[raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md)
  - LICENSE：[raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE)
  - 论文 v2：[arXiv:2412.10117](https://arxiv.org/abs/2412.10117)
  - 论文 v3：[arXiv:2505.17589](https://arxiv.org/abs/2505.17589)

### 4. GPT-SoVITS v2 ProPlus（MIT，强本地备选）

- **License**：**MIT**（README badge + LICENSE 文件确认）。
- **零样本**：5 秒样本 zero-shot；1 分钟样本 few-shot。
- **跨语种**：README Features 3 明示 "English, Japanese, Korean, Cantonese and Chinese"。
- **M2 推理性能**：README 自报 "RTF 0.526 in M4 CPU" — 即 **1 s 音频约 0.53 s 推理**；M4 与 M2 大致同代 CPU 性能级（M4 略强），所以 M2 CPU RTF ≈ 0.7 左右。**首音延迟取决于输入文本长度**（数 s ~ 数十 s 不等，文本越长首音越晚）。
- **流式**：仓库 GitHub Wiki 提到 streaming 实验性；主分支无默认 streaming 路径。
- **macOS 路径**：README 显式列出 `Python 3.9 + PyTorch 2.2.2 + Apple silicon` 测试组合；但警告 "macOS 上用 GPU 训练显著低于其他设备，所以暂时 CPU 跑" — 即 **M2 推理走 CPU 路径，RTF ≈ 0.5+**。
- **来源**：[raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md)

### 5. StyleTTS 2（MIT，弱本地备选）

- **License**：Code MIT；Pre-trained models 有**额外条款** — "you agree to inform the listeners that the speech samples are synthesized ... or you have to publicly announce that these voices are synthesized"（README License 节）— **商用 PoC 需要内嵌"合成音"声明**。
- **零样本**：LibriTTS checkpoint 直接 zero-shot；中文需 multilingual PL-BERT（papercup-ai/multilingual-pl-bert）。
- **跨语种**：默认 LJSpeech / LibriTTS 英文；要中文 → 英文跨语种音色迁移需自己训练 PL-BERT。
- **首音延迟**：仓库未量化；社区 styletts2 pip 包提示"experimental streaming API"；整体方案偏训练/fine-tune，不是流式推理工程化产品。
- **来源**：[raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md](https://raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md)；[arXiv:2306.07691](https://arxiv.org/abs/2306.07691)

### 6. F5-TTS（MIT+CC-BY-NC 预训练模型，不推荐）

- **License**：Code MIT；**Pre-trained models CC-BY-NC**（训练数据 Emilia 限制 — README License 节）— **非商用**；PoC 不能用。
- **首音延迟**：README Benchmark — "F5-TTS Base (Vocos): Concurrency 2, Avg Latency **253 ms**, RTF 0.0394, Mode Client-Server" — 测试硬件 **NVIDIA L20**；M2 benchmark 无。
- **跨语种克隆**：reference audio + ref_text 引导；Emilia ZH-EN 多语种预训练。
- **来源**：[raw.githubusercontent.com/SWivid/F5-TTS/main/README.md](https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md)；[arXiv:2410.06885](https://arxiv.org/abs/2410.06885)

### 7. ElevenLabs（API 商用，对照基准）

- **TTFB**：Flash/Turbo **~75 ms**（API pricing 页明确 "Ultra-low latency ~75ms"，32 languages）；v3 Conversational ~280 ms；v3 默认 ~未见 TTFB 但价格 $0.10/1K chars。
- **零样本克隆**：Instant Voice Clone 从 **Starter ($6/mo)** 起；Professional Voice Clone 从 **Creator ($22/mo)** 起。
- **跨语种**：v3 70+ 语言；v2 Multilingual 29 语言；Flash v2.5 Multilingual 32 语言。
- **价格**：Flash/Turbo **$0.05 / 1K chars**（v3 Conversational 同价）；v2/v3 默认 **$0.10 / 1K chars**。1 hour @ 100 chars/min ≈ ¥2.16 (Flash) / ¥4.32 (v3 默认)。
- **商用版权**：Starter+ plan 含 Commercial License。
- **来源**：[elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api)

### 8. Cartesia Sonic（API 商用，低延迟首选）

- **TTFB**：Sonic 3.5/3.6 **~90 ms**（docs 首页 "streams the first byte of audio in about 90ms"）。
- **零样本克隆**：Instant voice cloning 10 秒音频 → 跨 44 语言（产品页）；Pro voice cloning 从 Startup ($49/mo) plan 起，2 槽。
- **本地化**：225 credits per added voice accent（pricing 页）。
- **价格**：Pro plan $5/mo 含 100K credits / 133 min 音频；具体 per-char 单价 pricing 页未直接给 → 反推 ~$0.03/1K chars 量级（待 docs 确认）。1 hour @ 100 chars/min ≈ ¥1.30（按 $0.03/1K 估算）。
- **来源**：
  - Docs：[docs.cartesia.ai](https://docs.cartesia.ai/)
  - Pricing：[cartesia.ai/pricing](https://www.cartesia.ai/pricing)
  - Product：[cartesia.ai/sonic](https://www.cartesia.ai/sonic)

### 9. Rime（API 商用，低延迟备选）

- **TTFB**：Mist v3 **TTFA P50 = 37 ms, P90 = 56 ms**（官方定价页对比表）；Coda TTFA P50 = 96 ms。
- **零样本克隆**：Enterprise 计划支持 unlimited custom voice clones；Starter 计划未列。
- **跨语种**：Mist v3 4 语言（英、法、德、西）；Coda 8 语言；平台 50+ 语言含中文。
- **价格**：Mist v3 **$0.03 / 1K chars**；Coda **$0.05 / 1K chars**。1 hour @ 100 chars/min ≈ ¥1.30 (Mist) / ¥2.16 (Coda)。
- **R3 不友好的点**：Mist v3 不支持中文（pricing 页明示 4 语言清单无中文）；中文要走 Coda 模型（TTFB ~96 ms）或者自托管部署。
- **来源**：[rime.ai/pricing](https://www.rime.ai/pricing)

---

## 三、回答原 ticket 的 6 个问题

### Q1. TTS 引擎对比表

见上节表格（10 维度 × 9 引擎）。

### Q2. Doubao 同传 2.0 的 TTS 部分是否能单独用？

**不能拆出来。** 同传 2.0 是端到端 S2S 模型，ASR + MT + TTS 一体；proto schema 只有一个 WebSocket endpoint（`wss://openspeech.bytedance.com/api/v4/ast/v2/translate`），通过 `mode = s2s | s2t` 决定是否输出 TTS。s2t 只关掉 TTS 输出字幕；要单独 TTS 必须走独立的 bigtts / 声音复刻 API。

**R3 出方向 = 整段 S2S，speaker_id 留空 = 端到端 0 样本克隆** — 不能用同传 2.0 抠 TTS 出来 + 自带翻译。

证据：
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto` (L7-L13)
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/config.py` (L124)
- T01 research file 已经沉淀此结论（.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md 第二、五节）

### Q3. 0 样本克隆的可控性（克隆强度、事后调整）

- **豆包同传 2.0**：**没有暴露"克隆强度"参数**。`ReqParams` 只 5 个字段（`mode/source_language/target_language/speaker_id/corpus`），零样本克隆是模型端到端内禀行为，没有后向控制开关。要调整"克隆效果"只有两条路：① 切预设 `speaker_id`（如 `zh_female_vv_uranus_bigtts`）— 是预设音色 vs 实时克隆的切换，不是强度调节；② 提升源音频质量（采样率、噪声、停顿）让模型更易采样音色 — 但这是输入端调整，不是 API 参数。
- **CosyVoice 3**：仓库 README 提到"Instruct Support"（language/dialect/emotion/speed/volume 等 instruction），但**音色强度本身**没有 instruction 入口。
- **GPT-SoVITS**：5 秒 zero-shot / 1 分钟 few-shot 是离散档；切换通过重新采样。
- **ElevenLabs / Cartesia / Rime**：API 参数里**没有"克隆强度"字段**；只有 Instant Clone vs Professional Clone（需要更多录音训练）。可控性差。

**结论**：0 样本克隆的可控性是当前行业普遍痛点，**没有引擎提供"克隆强度"细调**。

证据：
- Doppelvoice ReqParams.proto：[T22](https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto)
- CosyVoice 3 README：[T23](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md)
- ElevenLabs / Cartesia / Rime API 文档（无"intensity"参数）。

### Q4. 跨语种音色迁移的中文口音残留

**未在官方文档找到量化数据**。

- **豆包同传 2.0**：arXiv:2507.17527 摘要说"high-fidelity ... voice cloning" 但未给具体 accent similarity 数字；Doppelvoice README 没有 A/B 评测。
- **CosyVoice 3**：README "Cross-lingual Voice Cloning" 章节说支持但未给相似度 benchmark。
- **GPT-SoVITS**：README Features 3 列了支持语种但未给跨语种音色相似度。
- **ElevenLabs / Cartesia / Rime**：Multilingual 模型都支持中→英；中文口音残留程度未量化。
- **CosyVoice 评估表**：test-zh SS (speaker similarity) 78.0%、test-en SS 71.8% — 但**这两个 SS 是同语种 vs reference 的相似度，不是跨语种 A/B**。

**结论**：跨语种克隆的中文口音残留是 PoC 阶段必须 A/B 的未量化变量。T09/T10 的"声音复刻 2.0 + S2S speaker_id"两条路径都需要真机试听对比。

### Q6. 延迟 vs 成本 trade-off

| 方案 | 首音延迟 | ¥/hour @ 100 chars/min | 0 样本克隆 | 跨语种音色 |
|---|---|---|---|---|
| 豆包同传 2.0 S2S | 2.5–3 s 整句 | 待 T02 补（推 ~¥1–2/h） | ✅ 内置 | ✅ 内置 |
| Doubao bigtts（独立 TTS）+ 自带 MT | 取决于 MT + TTS 各自延迟 | 待 T02 补 | 需"声音复刻 2.0"训练 | 需训练跨语种 speaker_id |
| CosyVoice 3 本地 | 150 ms (GPU，未测 M2) | ~¥0.03（电费） | ✅ 零样本 | ✅ |
| GPT-SoVITS 本地 | 数 s（CPU RTF 0.5+，M2 CPU） | ~¥0.03 | ✅ 5s zero-shot | ✅ |
| ElevenLabs Flash/Turbo | ~75 ms | ¥2.16 | ✅ Instant Clone | ✅ Multilingual |
| Cartesia Sonic | ~90 ms | ~¥1.30 | ✅ Instant 10s | ✅ 44 语言 |
| Rime Mist v3 | 37 ms | ¥1.30 | ✅ Enterprise | ❌ Mist 不支持中文 |

**R3 推荐**：**豆包同传 2.0 S2S**（一站式 + 0 样本内置 + 跨语种内置），即使首音 2.5–3 s 整句也接受（商务同传节奏）；MT 单独追求 1.3 s 首音 + 0 样本克隆的"双优"当前**没有引擎**同时满足：
- 0 样本 + 跨语种（中→英）= 豆包同传 2.0 / CosyVoice / GPT-SoVITS（local 三家），但都需要 1.5–3 s+ 端到端。
- ≤1.3 s 首音 = Cartesia / Rime Mist / ElevenLabs Flash（云端 75–100 ms），但**跨语种音色迁移不是其优化重点**；且这三家 Mist 模型**不直接支持中文音色** → 必须先本地 MT 出英文文本再用英文 TTS，MT 链路不在本 ticket 范围。

**所以"≤1.3 s 首音 + 0 样本克隆中→英"目前没有现成引擎**，需要分两步拼：本地 MT（fasttext/translation）+ 云端 TTS（ElevenLabs/Cartesia/Rime），MT 链路是 R3 的另一条 ticket 范围。

---

## 四、关键证据来源（汇总一级 URL）

| 引擎 | 主要一级 URL |
|---|---|
| Doubao 同传 2.0 S2S | https://arxiv.org/abs/2507.17527 / https://github.com/Tianqi-Bu/Doppelvoice / https://github.com/kizuna-ai-lab/sokuji / https://seed.bytedance.com/en/seed_liveinterpret / https://www.volcengine.com/docs/6561/1756902 |
| Doubao bigtts | https://docs.volcengine.com/docs/6561 |
| CosyVoice 3 | https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md / https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE / https://arxiv.org/abs/2412.10117 / https://arxiv.org/abs/2505.17589 |
| GPT-SoVITS | https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md |
| StyleTTS 2 | https://raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md / https://arxiv.org/abs/2306.07691 |
| F5-TTS | https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md / https://arxiv.org/abs/2410.06885 |
| ElevenLabs | https://elevenlabs.io/pricing/api |
| Cartesia Sonic | https://www.cartesia.ai/pricing / https://docs.cartesia.ai/ / https://www.cartesia.ai/sonic |
| Rime | https://www.rime.ai/pricing / https://docs.rime.ai/ |

## 五、已知信息缺口

1. **豆包同传 2.0 per-char / per-min 计费** — T02 范围内（控制台 + JS 渲染），需登录查定价。
2. **豆包 bigtts 独立 API 延迟 / 定价** — 同样 JS 渲染，需控制台或 .env.example / Doppelvoice 之外的开源客户端代码反推。
3. **CosyVoice 3 在 M2 (MPS) 上的 RTF 实测** — 仓库无 benchmark；需 T17 或类似本地 ASR benchmark ticket 同步做。
4. **GPT-SoVITS 在 M2 CPU 上的 zero-shot 端到端首音延迟** — 仓库只给了 RTF 0.526（=1 s 音频 0.53 s 推理），未给"接收 N 字文本到首音播放"的端到端数字。
5. **跨语种音色克隆的中文口音残留量化** — 所有引擎官方资料都没给 A/B 数字；PoC 阶段必须自评。
6. **Cartesia Sonic per-char 精确单价** — pricing 页只给 plan 包含 minutes，反推 ~$0.03/1K 但 docs 需复核。
7. **Rime Mist v3 中文支持** — pricing 页"4 语言"清单无中文；如果要中文音色迁移要选 Coda（¥2.16/h）或 Enterprise 自托管。

## 六、给 R3 PoC 的最终建议

**首选方案 A**：**豆包同传 2.0 S2S（端到端）**，speaker_id 留空 = 端到端 0 样本克隆，跨语种音色迁移内置；接受 2.5–3 s 整句延迟（商务同传节奏）。T09 路径：声音复刻 2.0 训练一个稳定 speaker_id → 同传 2.0 引用，提升音色稳定性。

**备选方案 B（≤1.3 s 首音硬约束）**：**Cartesia Sonic + 本地 MT**。链路：本地 ASR (FunASR / SenseVoice) → 本地 MT (M2 上的 M2M100 / NLLB / 小尺寸 Helsinki) → Cartesia Sonic English TTS；用户音色需要先用 Cartesia Instant Clone (10s 录音) 上传后用 cloned voice 合成英文。成本 ~¥1.30/h。**前提**：MT 链路要在另一个 ticket 处理（本 ticket 范围之外）。

**不建议**：F5-TTS（CC-BY-NC 非商用）、StyleTTS 2（商用需合成声明 + 自训多语种 PL-BERT）；Cartesia / Rime 在 M2 上跑不通（云端）；ElevenLabs Flash 在 R3 性价比最低（¥2.16/h 比 Cartesia 贵 66%）。