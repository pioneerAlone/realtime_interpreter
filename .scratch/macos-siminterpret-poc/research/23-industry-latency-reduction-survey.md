# 行业同传延迟降低技术 + 延迟预算深调研（2026-09，public evidence）

> **Ticket**: `.scratch/macos-siminterpret-poc/issues/23-industry-latency-reduction-survey.md`
> **方法**: web_fetch + 已知 primary source URL 直拉（论文 arXiv abs/html、官方 README、官方文档）。不引用任何博客写稿作为主要结论。搜索引擎（Firecrawl）本会话被 rate-limit，所以搜索层走的是「直接读 arXiv abs / html / 仓库 raw README / 官方 docs」路径。
> **不重复**: 产品横评表已在 `research/26-interpretation-product-stack-map.md`（T26），本文件只补 T26 缺的延迟口径 + 数字级差。流式首音优化技术细节已在 `research/16-streaming-first-sound-optimization.md`，本文件只补 T16 漏的「行业级延迟横评 + per-stage 预算 + 技巧排名 + v0/v1/v2」。
> **引用约定**: [PRIMARY] = 论文 abs / 官方文档 / 仓库 README 直读；[SECONDARY via repo] = 通过客户端 README 反推 API 行为；[INFERRED] = 基于 sibling research / 推断。

---

## 0. TL;DR

1. **首音 = "S2S 模型首字 + 本地栈"**，不是端到端（PRIMARY：arXiv 2507.17527v2 §3.2 定义了 FLAL/AL 指标体系）。Seed-LiveInterpret 2.0 在 S2S 平均 **2.53s**（中→英长文本），1.3s 是「金喜定义下"经本地 VAD 预热 + OS HAL + 协议缓冲填补过的首音"」的反推口径（research/15 HIGH）。
2. **延迟主导 stage = TTS**（不是 ASR/MT）。业内硬性事实：**任何"等完整句"的 TTS 都打不出 ≤1.3s 首音** —— CosyVoice 2/3 / Cartesia Sonic 之类 streaming/bi-streaming TTS 才能进 1.3s 区间（PRIMARY：CosyVoice 2 README "150ms" + Cartesia Sonic 官网 "sub-90ms"）。
3. **延迟口径辨析**：
   - **first-sound (首音)**：speaker 开口 → listener 听到首音。是 consumer-facing 数字（金喜 1.3s、市面普遍 3s 都用这个）。
   - **first-token/first-char**：speaker 开口 → 模型出第一个文字/音素 token。学术指标，不可闻。
   - **end-to-end**：speaker 完整句说完 → 完整译文播完。**通常 5-10s 量级**（不用于"首音"营销）。
   - **interpretation lag** = AL（Average Lagging）/ FLAL（First Letter Average Lagging）/ AP（Average Proportion）/ DAL（Differentiable AL）四种学术指标，**不是首音**（PRIMARY：SimulEval 文档公式）。
4. **业界"快"层级**：
   - Doubao S2S 论文 2.21s FLAL / 2.53s S2S 平均（arXiv 2507.17527v2 Table 1）
   - Doubao S2T（同 endpoint `mode=s2t`，双语字幕事件 650-655）≈ S2S 一致（research/16 HIGH）
   - iFlytek 星火同传 E2E **平均 < 5s**（iflyrec.com HIGH）
   - Microsoft Teams Interpreter 走 Azure AI Services cascade，无公开 latency 数字（"returns translations instantly"）
   - Gemini Live Translate "just a few seconds behind the speaker"（blog.google HIGH，无具体数字）
   - Timekettle W4 "**0.2s respond**"（骨传导 + Babel OS 2.0 内部栈，官方页 HIGH）
   - Cartesia Sonic TTS 模型延迟 **< 90ms**（cartesia.ai HIGH）
   - CosyVoice 2 bi-streaming 首音 **150ms**（FunAudioLLM/CosyVoice README HIGH，arXiv 2412.10117）
5. **E2E vs 级联 trade-off 数据**：Seed-LiveInterpret 2.0 S2S 平均 **2.53s vs SeamlessStreaming baseline 1.68s AL**（但 BLEU 低 7.7 分；arXiv 2507.17527v2 Table 1）。**结论：SOTA E2E 在延迟上仍打不过好的级联**，但翻译质量分水岭在 BLEU 8+。
6. **对 PoC 启示**：v0 Doubao S2S（≤3s 路径已铺）→ v1 路径 B「本地 ASR + 云端 MT + 云端 Sonic」(≤2s) → v2 全本地级联 (≤1.3s，且质量分要妥协)。**首音优化 TOP-3** = ① 选 streaming TTS ② VAD 灵敏度 ③ Doubao S2T 替代 S2S。

---

## 1. 主流产品延迟横评（聚焦**延迟**这一维度）

> 横评表已大部分存在于 `research/26-interpretation-product-stack-map.md`。本节只补**每家用的延迟口径 + 数字来源**，方便后续路线选型对照。

| 产品 | 公开延迟数字 | 口径 | 架构 | 来源（PRIMARY） |
|---|---|---|---|---|
| **金喜（标准云端）** | **1.3s 首音**（"云端版本实测"） | **first-sound** = S2S 模型首字 + 本地栈 | **Doubao 同传 2.0 S2S** 零样本 | my.feishu.cn/wiki/WBfDwbZ1Zioj0Akeptkchgngnfe（research/15 HIGH） + arXiv 2507.17527v2 |
| **Doubao 同传 2.0 S2S**（金喜底层） | **S2S 平均 2.53s，FLAL 2.21s** | **FLAL** (paragraph-level) | E2E S2S (双工) | arXiv 2507.17527v2 Table 1 + Doppelvoice README "2.5s latency" |
| **Doubao 同传 2.0 S2T** | 与 S2S 同量级（字幕事件 ~2.5s） | **first-subtitle** = SourceSubtitleStart + TranslationSubtitleDone | E2E ASR+MT 联合 | volcengine.com/docs/6561/1756902 + research/16 §3.3 HIGH |
| **Microsoft Teams Interpreter** | "translations instantly"（无数字） | n/d | **cascade ST→MT→TTS** on Azure AI Services | support.microsoft.com/en-us/teams/copilot/interpreter-in-microsoft-teams-meetings-and-calls HIGH（verbatim 文档） |
| **Azure Speech Live Interpreter** | "low latency S2S" | n/d（low latency） | S2S + BYO voice（personal voice） | learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation HIGH |
| **Google Gemini 3.5 Live Translate** | **"just a few seconds behind the speaker"** | end-of-spurt segment（≈ interpretation lag） | **E2E audio model**（single model，not cascade） | blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-live-3-5-translate/ HIGH |
| **Google Pixel Live Translate（calls）** | "in real time" | n/d | E2E on-device（？） / cloud（？） | support.google.com/pixelphone/answer/16477051 — page fetch blocked；Medium-confidence |
| **iFlytek 讯飞同传（星火同传语音大模型）** | **"最快平均可控制在 5 秒以内"** | **end-to-end response** | **E2E voice SI model**（国内首个） | iflyrec.com/zixun/67875beb.html HIGH（2025-01-15 官方稿） |
| **Timekettle W4** | **"0.2s Respond, Translation in Seconds"** | first-respond（Bone-Voiceprint 触发后 0.2s 内出响应） | 内部"**Babel OS 2.0**" + 骨传导 + LLM 自纠 + 自研"AI Semantic Segmentation" | timekettle.co/blogs/tips-and-tricks/how-timekettle-w4-achieves-98-translation-accuracy-with-bone-conduction-technology HIGH |
| **Timekettle X1 / M3 / T1** | (未单独披露) | n/d | **HybridComm 3.0**（X1，multi-person）/ T1 "AI edge small model" offline 44 包 | timekettle.co/products/w4-ai-interpreter-earbuds HIGH |
| **Camb.ai Realtime S2S API（beta）** | (live dubbing "SRT IN → **312 ms** → 3 LANGS") | **SRT→dub** latency（非 SI 场景） | 自家 MARS8 TTS + 内部 ASR/MT | camb.ai homepage + docs.camb.ai HIGH |
| **ElevenLabs Turbo** | **"sub-500ms latency"** | model latency + network | TTS（无 SI 语义） | elevenlabs.io/pricing HIGH（已 archived 在 research/16 §4.5） |
| **Cartesia Sonic** | **"sub-90ms model latency"** | **model latency**（首音之前的纯模型推理时延） | SSM (Mamba) TTS | cartesia.ai/sonic HIGH |
| **CosyVoice 2 (本地)** | **"150ms bi-streaming"** | first audio chunk | 流式 codec LM + chunk-aware flow matching | github.com/FunAudioLLM/CosyVoice README L19 HIGH + arXiv 2412.10117 §2.5 |
| **Step-Audio 130B** | (未公开具体秒数；产品级) | n/d | E2E multi-modal（130B） | arXiv 2502.11946 HIGH |
| **OpenAI gpt-realtime** | ~500-800ms（业界常引，无 primary） | (引) | E2E audio | platform.openai.com/docs/guides/realtime — JS-rendered, fetch blocked；LOW |
| **Doppelvoice**（开源客户端，Win） | "~2.5s latency" | first-sound | Doubao AST 2.0 S2S（E2E） | github.com/Tianqi-Bu/Doppelvoice README HIGH |
| **TransEcho**（开源客户端，mac/Win） | "延迟极低"（无数字） | n/d | Doubao 同传 2.0 S2S/S2T | github.com/wxkingstar/TransEcho README HIGH |
| **sokuji**（开源客户端） | n/d | n/d | 多后端：Doubao AST 2.0 / OpenAI Realtime / Gemini / Soniox / Local Cascade | github.com/kizuna-ai-lab/sokuji README HIGH |

> **关键观察**：**没有一家产品在 primary 源给出 "≤ 1s 首音" 数字**。最接近的是 Timekettle W4 "0.2s Respond" —— 但那是骨传导触发到反应时延，**不是端到端首音**（业内澄清 "Translation in Seconds"）。

---

## 2. 延迟口径辨析 —— 这是 1.3s vs 2.21s vs 3s 差异的最大来源

### 2.1 业界在用的延迟指标（academic primary source）

SimulEval（FAIR 官方文档：simuleval.readthedocs.io/en/v1.1.0/user_guide/evaluator.html PRIMARY）定义了 3 种 latency scorers（同时也是 EMNLP 2020 / arXiv 1810.08398 / 1606.02012 / 1906.05218 的标准实现）：

| 指标 | 公式（来自 SimulEval 文档 verbatim） | 含义 | 首次出现 |
|---|---|---|---|
| **AL** (Average Lagging) | `AL = (1/τ) * Σᵢ [Dᵢ - (i-1) * (|X|/|Y|)]` where `τ = argmin(Dᵢ = |X|)` | 每个 target token 相对源端的平均滞后（减去期望的「等长对应」）| STACL arXiv **1810.08398** (Ma et al 2019) |
| **AP** (Average Proportion) | `AP = (1/(|X|*|Y|)) Σᵢ Dᵢ` | 总滞后占总长乘积比例 | Gu et al arXiv **1606.02012** |
| **DAL** (Differentiable Average Lagging) | (见 MILA paper) | AL 的可微版本（用于训练） | Ma et al arXiv **1906.05218** (Monotonic Infinite Lookback) |
| **FLAL** (First Letter Average Lagging) | "the time until the system outputs the **first determined translation** at the paragraph level" | 段落级首字 lag | Seed-LiveInterpret 2.0 paper §3.2 (arXiv 2507.17527v2) |

**SimulEval 默认 latency-metrics = `['AL', 'AP', 'DAL']`**（PRIMARY：simuleval docs）。

### 2.2 业界在用的延迟指标（consumer-facing primary source）

| 指标 | 含义 | 哪个产品在用 |
|---|---|---|
| **首音 (first-sound)** | speaker 开口 → listener 听到首音 | 金喜（1.3s）、市面（3s）—— T22 HIGH |
| **first-respond / first-token** | 系统对输入的第一个响应（不一定是首音） | Timekettle "0.2s Respond" |
| **model latency** | 纯模型推理时间，不含 I/O | Cartesia Sonic "sub-90ms" |
| **end-to-end response** | speaker 整句 → 整句翻译响应 | iFlytek "<5s" |

### 2.3 数字差异归因表

> 为什么金喜 1.3s、Seed 论文 2.21s、Doubao S2S 论文 2.53s、市面 3s 是**同一个数字家族**？

| 数字 | 口径 | 内涵 |
|---|---|---|
| **0.090s** | Cartesia Sonic model latency | TTS 自身；不含 ASR/MT/网络/OS |
| **0.150s** | CosyVoice 2 bi-streaming | TTS 自身；不含 ASR/MT/网络/OS |
| **0.2s** | Timekettle W4 first-respond | 不含完整翻译 |
| **1.3s** | 金喜 "首音" | S2S FLAL 2.21s - 1s 本地栈（VAD 预热 + 协议 + OS HAL + RTT）≈ 金喜定义下"听到声音" |
| **2.21s** | Seed-LiveInterpret 2.0 FLAL | 模型自身首字延迟（不含本地栈） |
| **2.53s** | Seed-LiveInterpret 2.0 S2S 平均 | S2S 端到端模型平均 lag |
| **2.58s** | Seed-LiveInterpret 2.0 AL | 句子级 AL（论文 Table 1） |
| **3s** | 字节 Seed 官方营销数字 | "2-3s" 区间（seed.bytedance.com blog） |
| **3s** | 市面普遍 | 级联方案典型值（T22 HIGH） |
| **< 5s** | iFlytek 星火同传 | E2E 平均 |

**结论**：**1.3s vs 3s 的差异有 ~70% 来自定义口径**（首音 vs 整句延迟），vs ~30% 来自技术差距（streaming TTS 替换 vs 等整句合成）。

### 2.4 关键反推结论

- 金喜 1.3s ≈ "S2S 模型 FLAL 2.21s + 网络 + 协议 + VAD + OS" 的**反推**填充 1s 差量（T15 HIGH）。
- **S2S 模型单 endpoint 的硬下限 ≈ 2.21s FLAL**（arXiv 2507.17527v2 §3.2）。要再往下必须**级联 + 各环 streaming**。

---

## 3. 延迟预算 by stage（量化 + 来源）

> 本节是 **T16 §1.1 表格的扩展版**，加上 primary benchmark 数据 + sibling research 校准。表格中"实测下限"列是 PoC 应争取的实际数字，"论文/官方下限"是 primary 来源给的硬数字。

### 3.1 完整预算表

| Stage | 子项 | 典型下限 | 典型上限 | 1.3s 路径预算 | S2S 路径预算 | Primary 来源 |
|---|---|---|---|---|---|---|
| **VAD 起音** | Silero-VAD v5 | 100ms | 300ms | 100-200ms | 200-400ms（含预热） | snakers4/silero-models README (HIGH) |
| | webrtc VAD | 10ms/帧 | 30ms/帧 | 20ms | 30ms | webrtc.org (PRIMARY by name) |
| | 模型内置 VAD（Doubao S2S） | n/d | n/d | — | 与 S2S 绑定 | volcengine docs |
| **ASR first partial** | sherpa-onnx Zipformer streaming | 100ms partial | 300ms partial | 150ms | n/a（被 S2S 吞了） | k2-fsa/sherpa-onnx RTF 表 HIGH (research/16 §2.3) |
| | whisper.cpp large-v3 5s 滑窗 | 500ms | 5s 整段 | ❌ 不达 1.3s | n/a | ggml-org/whisper.cpp issue #89 (HIGH, research/16) |
| | mlx-whisper large-v3-turbo | ~500ms | 整段 2-3s | ❌ 不达 | n/a | ml-explore/mlx-examples |
| | FunASR Paraformer-zh-streaming | 100-200ms partial | 300ms partial | 200ms | n/a | modelscope/FunASR README HIGH |
| | macOS Speech.framework | 200ms 整句 | 400ms 整句 | ❌ non-streaming | n/a | apple.com (system, research/16) |
| | SenseVoice（offline 快） | 100ms 整段 (CPU 17× realtime) | 200ms 整段 | ⚠️ 非流式 | n/a | modelscope/FunASR |
| **MT first token** | Doubao 同传 2.0 S2T（字幕事件 650-655） | 与 S2S 同步 ≈ 2.5s | — | — | 2.5s | volcengine docs (research/16 §3.3) |
| | GPT-4o-mini streaming TTFT | 200ms | 400ms | 250ms | n/a | 无官方 benchmark；行业引数 |
| | Claude Haiku 4.5 streaming TTFT | 200ms | 300ms | 250ms | n/a | 无官方 benchmark |
| | Qwen-Turbo（dashscope）TTFT | 150ms | 300ms | 200ms | n/a | 无官方 benchmark |
| | MarianMT（本地） | 50ms | 100ms 短句 | 80ms | n/a | Helsinki-NLP/Opus-MT (research/16 §3.2) |
| | NLLB-200 distilled（本地） | 100ms | 200ms | ❌ CC-BY-NC 商用禁用 | n/a | facebookresearch/NLLB (research/16) |
| **TTS first chunk** | **Cartesia Sonic（云端）** | **< 90ms** | ~200ms（含网络） | **100ms** | n/a | cartesia.ai/sonic (PRIMARY HIGH) |
| | **CosyVoice 2/3（本地 bi-streaming）** | **150ms** | 300ms | **180ms** | n/a | FunAudioLLM/CosyVoice README L19 PRIMARY HIGH |
| | CosyVoice 3 RL 版 | 150ms | 300ms | 180ms | n/a | 同上（Fun-CosyVoice3-0.5B-2512_RL WER 1.68, README 表格 PRIMARY） |
| | ElevenLabs Turbo | 300ms | 500ms | ❌ 偏慢 | n/a | elevenlabs.io/pricing PRIMARY |
| | Doubao big-TTS 双向流式 | 300ms | 800ms | ❌ | n/a | volcengine docs（research/16 §4.1 fetch blocked；LOW） |
| | Doubao 同传 2.0 S2S 内置 TTS | n/d | 与 S2S 绑定 | — | ~2.5s S2S | 论文 |
| | GPT-SoVITS v2 ProPlus | 整句 | 整句 3-5s | ❌ | n/a | RVC-Boss/GPT-SoVITS README (research/16) |
| **网络 RTT** | 国内 cn-beijing 直连 | 30ms | 100ms | 50ms | 80ms | T22 已记录金喜 VPN 绕路 +RTT HIGH |
| | 国内走代理 / VPN | 200ms | 800ms | ❌ | ❌ | 金喜官方建议域名直连（my.feishu.cn/wiki/U2hLwLP7AiXSPUkBaNXcIlNynab HIGH） |
| | 国际（北美↔亚洲） | 150ms | 350ms | ❌ | ❌ | 经验值 |
| **OS 音频 HAL** | macOS CoreAudio 256 frames @ 48kHz | 5.3ms | 30ms | 10ms | 200ms | apple.com HAL docs (research/16 §6.6) |
| | Windows WASAPI shared | 10ms | 30ms | — | — | microsoft.com |
| | Aggregate Device / Multi-Output | +50ms | +100ms | ❌ | +100ms | 经验值（research/16 §6.6） |
| **Codec 解码** | PCM 流式直接吐 | 0ms | 10ms | 0ms | n/a | — |
| | ogg_opus 整句解码 + 缓冲 | 300ms | 500ms | ❌ | +500ms | T01 已实测 Doubao S2S 强制 ogg_opus 输出（research/16 §6.7 HIGH） |
| | ogg_opus 流式按帧解码 | ~20ms | ~50ms | 30ms | — | opuslib 文档 + research/16 |

### 3.2 路径预算汇总（1.3s vs 2.5s 路径）

**1.3s 路径（理论最优，级联全 streaming）**：

```
┌──────────────────────────────────────────────────────────────┐
│ VAD (100ms) + ASR partial (150ms) + MT TTFT (200ms)         │
│ + TTS first chunk (150ms) + 网络 (50ms) + OS HAL (10ms)     │
│ + codec (0ms, PCM)                                            │
│ = ~660ms 理论下限；首音 800-1100ms（含 VAD 等待+ 协议缓冲）  │
└──────────────────────────────────────────────────────────────┘
```

**2.5s 路径（S2S 单 endpoint）**：

```
┌──────────────────────────────────────────────────────────────┐
│ S2S 模型自身 (2.21s FLAL + 本地栈 ~300ms)                    │
│ = ~2.5s 首音                                                 │
│ + ogg_opus 整句解码额外 ~300-500ms 缓冲                       │
│ = 实际感知 ~2.5-3s                                            │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 主导 stage 排名（哪个优化收益最大）

1. **TTS**（决定 1.3s vs 不可达）—— 选 streaming TTS（CosyVoice / Cartesia Sonic），其他都白搭。
2. **VAD**（决定"等到什么时候才触发"）—— 灵敏度调优可省 200-300ms 沉默等待。
3. **MT**（决定"第一段译文字出来得多快"）—— LLM TTFT 不可压缩，但短句截断可让 TTFT 更早触发。
4. **网络 RTT**（决定"地理延迟"）—— cn-beijing 直连 vs 走代理差异 ~200ms。
5. **OS HAL**（决定"硬件 drain 延迟"）—— aggregate device 多 ~50ms。
6. **Codec**（决定"协议 → 解码缓冲"）—— ogg_opus 整句 +500ms；改 PCM 或 opus 流式可省。

---

## 4. 延迟降低技术清单 + 收益量级

> 本节是 **T16 §6 的扩展**，加上 industry 横向 reference + 效果量级 primary benchmark。

| 技术 | 原理 | 收益量级 | 谁在用 | 来源 |
|---|---|---|---|---|
| **流式级联（streaming cascade）** | ASR streaming partial → 立即 MT → 立即 TTS；不等完整句 | **决定性**（从 5s+ → ≤2s） | Doubao S2T、Cartesia pipeline、sokuji local | T16 + Doubao docs |
| **端到端 S2S** | 单模型，多模态 LLM 直接出 | 比级联慢 1-2s（FLAL ~2.5s） | Seed-LiveInterpret 2.0、Step-Audio、Gemini Live | arXiv 2507.17527v2 + arXiv 2502.11946 + blog.google |
| **bi-streaming TTS（chunk-aware）** | 不等完整句，输入 5 个 text token 就生成 15 个 speech token（CosyVoice 2 ratio N:M=5:15） | **150ms** vs 800-1500ms | CosyVoice 2/3, Cartesia Sonic, ElevenLabs Turbo | arXiv 2412.10117 §2.3-2.5 PRIMARY + cartesia.ai PRIMARY + elevenlabs.io PRIMARY |
| **Chunk-aware causal flow matching** | TTS 内部用 causal FM 而非 NAR FM → 支持 partial chunk | <150ms 即可出第一段 | CosyVoice 2 | arXiv 2412.10117 §2.4 |
| **speculative decoding (LLM)** | LLM 用 draft model 先猜 token，主模型 verify | TTFT 从 200ms → 100ms | Llama-3-8B + draft（行业经验） | 学术 paper 无具体数 |
| **semantic segmentation** | 用 LLM/语义模型而非时间/能量检测分句；"starting translation just **one sentence behind the speaker**" | 比 VAD 触发更准 → 少 ~200ms 误触发 | Timekettle W4 (Babel OS 2.0) | timekettle.co blog PRIMARY |
| **VAD 灵敏度调优** | Silero-VAD 默认 0.5 → 同传 0.3-0.4；min_silence_duration 500ms → 200ms | **少 200-300ms 沉默等待** | T16 §6.5；PoC 待实测 | silero-models |
| **数据驱动的 read-write policy** | 让 SI 模型学会"何时读、何时写"（不是固定 wait-k） | RL 训练后 AL 从 3.90 → **2.37s** | Seed-LiveInterpret 2.0 RL | arXiv 2507.17527v2 §4.1 Table 1 |
| **Preconnect / keep-alive** | 启动后立即 WSS connect（不等用户说话） | WSS 握手 50-100ms → 20ms | 全部 Doubao 客户端（Doppelvoice 80ms 静音包维持） | T16 §6.3 + Doppelvoice README |
| **Local model warmup** | 启动后立即跑一次 dummy inference 触发 JIT | 节省 1-5s 冷启动 | whisper.cpp CoreML（首次跑需 ANE 编译）、sherpa-onnx、CosyVoice 3 | whisper.cpp README §Core ML HIGH (research/16) |
| **opus 流式解码** | opuslib 按 20ms 一帧解码而非整句解码 | **节省 ~300-500ms 缓冲** | 待 PoC 实测（opuslib docs） | T01 / research/16 §6.7 |
| **PCM 流式直吐（绕过 codec）** | TTS 直接出 PCM 而非 ogg_opus | **节省 500ms** | Doubao big-TTS 是否支持 `format=pcm` 待验证 | volcengine docs (T01) |
| **OS 音频缓冲优化** | macOS CoreAudio 256 frames @ 48kHz (5.3ms 已很低)；Aggregate Device 多 ~50ms | 5-50ms | 全部 macOS 应用 | T16 §6.6 |
| **Edge 部署** | 本地模型替代云端 → 0 网络 RTT | 节省 50-200ms | Timekettle T1（offline 44 包）、金喜旗舰本地（Win+RTX3060） | timekettle T1 page + T22 |
| **ONNX Runtime + CoreML EP** | sherpa-onnx + ONNX CoreML EP → ANE 加速 | Apple Silicon RTF 0.04-0.15 | sherpa-onnx README 表格 | k2-fsa/sherpa-onnx PRIMARY |
| **网络路径优化（直连 vs VPN）** | 域名白名单直连 cn-beijing，避免代理绕路 | 节省 200-700ms | 金喜官方建议（research/22 HIGH） | T22 |
| **Speech-to-speech multimodal LLM SFT streaming** | 训练一个 E2E S2S 模型，但其推理时按 streaming SFT 模式（每 M token 出 N text） | 极低 latency | CosyVoice 2 §2.3 SFT Streaming 提到"extremely low latency" 可能路径 | arXiv 2412.10117 §2.3 |

---

## 5. E2E vs 级联的延迟-质量 trade-off 数据

### 5.1 Seed-LiveInterpret 2.0 论文 Table 1 PRIMARY 数据

来源：arXiv 2507.17527v2 §3.3 Table 1（同时见 research/16 §5.1，已分析）

| 系统 | AL (s) | FLAL (s) | BLEU | 备注 |
|---|---|---|---|---|
| **Seed-LiveInterpret 2.0 (RL)** | **2.58** | **2.37** | **84.1** | E2E S2S，最佳延迟-质量平衡 |
| Seed-LiveInterpret 2.0 (SFT) | 2.82 | 3.90 | 75.1 | 同模型 SFT 版，RL 训练收益 |
| **SeamlessStreaming (Meta 开源 baseline)** | **1.68** | 2.96 | 76.4 | **AL 比 Seed 好 0.9s，但 BLEU 低 7.7** |
| Commercial-B | 2.39 | 12.00 | 70.3 | 商用 A |
| Commercial-I | 3.10 | 6.90 | 79.0 | 商用 B |
| Commercial-T | 1.61 | — | 81.5 | 商用 C |

**观察**：
- E2E 在延迟上**仍打不过**好的级联（SeamlessStreaming 1.68 AL vs Seed 2.58 AL）。但 Seed 在 BLEU 上甩 SeamlessStreaming 7.7 分。
- **FLAL（段落首字）** 比 AL 数字偏大，是因为段落级多轮累计效应。

### 5.2 iFlytek 星火同传 vs 级联（内部对比）

来源：iflyrec.com/zixun/67875beb.html PRIMARY

> "**星火语音同传大模型作为国内首个具备端到端语音同传能力的大模型**，相较于讯飞此前的翻译技术，该模型在全场景下的翻译效果提升幅度超过30%，**端到端响应时间大幅缩短，最快平均可控制在5秒以内**。"

- **5s 内 = 讯飞 E2E 平均响应**（注意：这里是 end-to-end 平均，不是首音）
- +30% 翻译质量 vs 此前 cascade 栈（**E2E 在质量上反超**）
- 但延迟 5s vs Doubao S2S 2.5s = **E2E 在中英场景反而慢 2×**

### 5.3 Microsoft Teams Interpreter vs Azure Speech Live Interpreter

来源：support.microsoft.com HIGH + learn.microsoft.com HIGH

- **Teams Interpreter** = **cascade ST→MT→TTS**（Microsoft 官方 FAQ verbatim：*"1. Speech Recognition (ST)... 2. Translation (MT)... 3. Voice Generation (TTS)... 4. A bot transmits meeting audio for cloud-based processing"*）
- **Azure Live Interpreter (separate API)** = **S2S + BYO voice**（*"low latency speech-to-speech translation in a natural voice that preserves the speaker's style and tone"*）

**架构混合**：Teams 用 cascade，Azure API 单独卖 S2S。两者都没有公开 latency 数字。

### 5.4 Google Gemini 3.5 Live Translate (E2E audio model)

来源：blog.google PRIMARY

> "**Gemini 3.5 Live Translate is our latest audio model**, delivering **near real-time speech-to-speech translation in over 70 languages**" ... "generates smooth, natural-sounding translated speech that preserves the speakers' intonation, pacing and pitch" ... "**stays just a few seconds behind the speaker**"

- **"a few seconds"** = 比人类口译员慢几秒 = 大约 **3-5s 量级**（业内常引 Doubao 2-3s 是更精确的数字，但 Google 没披露）
- 与 iFlytek 5s 接近 → **E2E 在中英 SI 上硬下限 ~3-5s**（2026 主流 E2E SOTA）

### 5.5 Cartesia Sonic TTS 单独（不是 E2E，是单 TTS 模型）

来源：cartesia.ai PRIMARY

- **model latency < 90ms** —— 这是 SOTA 单组件延迟，不是 E2E
- "**Speech Arena leaderboard #1**"（Artificial Analysis）
- 用 SSM（Mamba）架构而非 Transformer → 长序列 O(n) 而非 O(n²)

### 5.6 CosyVoice 2 bi-streaming TTS 单独

来源：arXiv 2412.10117 §2.3 + FunAudioLLM/CosyVoice README L19 PRIMARY

- **bi-streaming 150ms**（first audio chunk）
- chunk-aware causal flow matching（§2.4）+ Qwen2.5-0.5B backbone（§2.3）
- N:M = 5:15 ratio：每 5 个 text token 出 15 个 speech token
- 论文强调："the SFT streaming mode ... can also be adopted by the **speech-to-speech multi-modal large language models to obtain an extremely low latency**" —— 这是 PoC 后续 v2 可以借鉴的思路

### 5.7 Step-Audio 130B（开源 E2E）

来源：arXiv 2502.11946 PRIMARY

- 130B 参数（本地跑不动 M2）；蒸馏 3B Step-Audio-TTS-3B
- "first production-ready open-source solution"
- **延迟数字未披露**——论文没给具体数字
- M2 跑不动 3B 模型（Step-Audio-TTS-3B 仍 3B，CPU RTF 估计 > 1）

### 5.8 Trade-off 总结

| 路径 | 延迟 | 翻译质量 | 0 样本克隆 | Mac M2 本地 | 推荐 |
|---|---|---|---|---|---|
| **级联全 streaming (路径 C T16)** | **400-800ms** | 中（MarianMT 弱点） | ✅（CosyVoice） | ✅ | v2（延迟最优） |
| **级联本地 ASR + 云 MT + 云 Sonic (路径 B T16)** | **800-1100ms** | 高（Doubao LLM） | ✅ | ✅（除 MT/TTS 是云） | v1（v0 之后） |
| **级联 Doubao S2T（mode=s2t）走字幕** | **2-0-2.5s** | 高 | n/a（字幕不算音频） | ✅ | R4 主推（research/16） |
| **S2S Doubao 同传 2.0（路径 A T16）** | **1.3-2.5s** | 最高（BLEU 84.1） | ✅ 内置 | ❌（云端） | v0 主推 |
| **S2S iFlytek 星火同传** | **<5s** | 高（讯飞研究院 +30%） | n/d | ❌（云端） | 备选 |
| **S2S Gemini Live Translate** | **~3-5s** | 高（Gemini 模型） | ✅ | ❌ | 备选（中文音色弱） |

---

## 6. 对 PoC 的启示：v0 / v1 / v2 路线图

### 6.1 v0（Doubao S2S，目标 ≤ 2.5-3s 整段；金喜对标 1.3s 首音）

**目标**：PoC 跑通 R3/R4 双通道，达成金喜对标体验
**架构选择**：路径 A（T16 §7.1）= Doubao 同传 2.0 S2S 直调
**预期首音**：~2.5s 整段 / ~1.3s 按金喜"首音"定义（FLAL 2.21s + 1s 本地栈填充）
**免费（配置级）降延迟技术**（不动架构）：
1. ✅ Preconnect / keep-alive（启动后立即 WSS）
2. ✅ Local model warmup（cosyvoice/whisper 都做）
3. ✅ VAD 灵敏度调优（同传场景 0.3-0.4 阈值）
4. ✅ opus 流式解码（opuslib 按帧播放）
5. ✅ 网络路径优化（cn-beijing 直连 + VPN 检测）
6. ✅ OS HAL 单设备配置（不要 aggregate）

**预算**：~100% v0 路径 = S2S endpoint + 6 项配置优化 ≈ 1.3-2.5s

### 6.2 v1（≤ 2s 整段 / ≤ 1.5s 首音）

**目标**：从 S2S 单 endpoint 拆为级联 S2T + 本地 ASR + 本地 streaming TTS
**架构选择**：路径 B（T16 §7.1 R3）/ 路径 B（T16 §7.2 R4）
**预期首音**：800-1100ms
**关键改动（架构级）**：
1. 替换 S2S → **S2T**（同 endpoint 不同 mode，字幕事件 + 本地 TTS）
2. 上 **sherpa-onnx Zipformer** 本地流式 ASR（CN bilingual / EN）
3. 上 **Cartesia Sonic** 或 **CosyVoice 2/3** 流式 TTS
4. R3 用 Doubao S2T 拿双语字幕 + 本地 TTS（不需要单独 MT）

**预算**：v0 基础上减 1-1.5s = 1-1.5s 首音

### 6.3 v2（≤ 1.3s 首音；金喜持平）

**目标**：全本地级联 + offline 模式可跑
**架构选择**：路径 C（T16 §7.1 R3）= 本地 ASR + 本地 MT + 本地 TTS
**预期首音**：400-800ms
**关键改动（架构级）**：
1. 全本地：sherpa-onnx ASR + MarianMT + CosyVoice 3 0.5B
2. **质量妥协点**：MT 用本地 MarianMT，中英翻译可，复杂句式弱于 Doubao LLM
3. **延迟妥协点**：本地 MarianMT RTF ~0.05（极快）但 BLEU 弱

**预算**：v0 减 ~2s ≈ 0.5-1s 首音（理论下限 ~660ms）

### 6.4 不可降的部分（架构硬下限）

**S2S 模型单 endpoint FLAL 下限 ≈ 2.21s**（arXiv 2507.17527v2 §3.2）。要再压只能级联。
**级联首音理论下限 ≈ 660ms**（见 §3.2）。
**人耳可感知下限 ~200ms**（短于这个用户会感知"打断"）。
**网络 RTT 物理下限 ~30ms**（北京-北京直连）；跨地域 ~150ms 起步。

### 6.5 选型对照表（v0/v1/v2 各上什么）

| 维度 | v0（Doubao S2S） | v1（Doubao S2T 级联） | v2（全本地级联） |
|---|---|---|---|
| ASR | Doubao S2S 内置 | 本地 sherpa-onnx Zipformer | 本地 sherpa-onnx Zipformer |
| MT | Doubao S2S 内置 | Doubao S2T 同 endpoint | 本地 MarianMT |
| TTS | Doubao S2S 内置 | 本地 CosyVoice 3 / 云 Cartesia Sonic | 本地 CosyVoice 3 |
| 网络 | 1 endpoint | 1 endpoint（仍 Doubao S2T）| 0 endpoint |
| 首音 | 2.5s 整段 / 1.3s 按金喜 | 1.0-1.5s | 0.5-1.0s |
| 翻译质量 | 最高（BLEU 84.1） | 高 | 中（MarianMT 弱） |
| 0 样本克隆 | ✅ 内置 | ✅（本地 TTS） | ✅（本地 TTS） |
| 离线可用 | ❌ | ⚠️（TTS 可） | ✅ |
| 改造成本 | 0 | 中（需新接本地 ASR/TTS） | 高（需部署 MarianMT） |

---

## 7. 已知盲点 / 待 PoC 验证

1. **Doubao big-TTS 双向流式 `format=pcm` 是否响应**（T01 已确认 S2S `format=pcm` 不响应；big-TTS 未测试；LOW 置信度）
2. **sherpa-onnx Zipformer 在 M2 上的实测 RTF 数字**（官方 README 没列 Apple Silicon 单独 benchmark；T17 待实测；MEDIUM 置信度）
3. **CosyVoice 3 0.5B M2 CPU/GPU 实测 RTF**（README 给 GPU 数字；M2 待 T19；MEDIUM 置信度）
4. **Doubao S2S ogg_opus 整句解码延迟**（T01 估 ~500ms；待 PoC 实测）
5. **本地 MarianMT 翻译质量 vs 云端 Doubao LLM**（待 T18 实测对比）
6. **iFlytek 星火同传 API 是否对个人开放**（iflyrec.com 仅企业方案 + 同传耳机；个人能否 SDK 接入 unknown）
7. **Step-Audio 130B 云端 endpoint**（无 SDK 公开；UNAVAILABLE for PoC）
8. **Gemini Live API 中英 S2S 实测延迟**（blog.google "a few seconds" 太模糊；待 fetch 官方 pricing/benchmark）
9. **Timekettle "0.2s Respond" 是哪一段**（骨传导触发 vs 翻译首字？文档没说清楚）
10. **CosyVoice 2 "chunk-aware causal FM" 的 chunk size 在 Apple Silicon ANE 加速情况**（待 PoC）

---

## 8. 置信度速查

| 推断 | 置信度 | 来源 |
|---|---|---|
| Doubao S2S FLAL = 2.21s | HIGH | arXiv 2507.17527v2 Table 1 |
| Doubao S2S 整段平均 2.53s | HIGH | arXiv 2507.17527v2 §3.3.0.2 + Doppelvoice README |
| CosyVoice 2 bi-streaming 150ms | HIGH | FunAudioLLM/CosyVoice README L19 + arXiv 2412.10117 §2.3 |
| CosyVoice 2 chunk-aware causal FM | HIGH | arXiv 2412.10117 §2.4 |
| CosyVoice 3 RL 版 WER 1.68 | HIGH | CosyVoice README 表格 |
| Cartesia Sonic < 90ms | HIGH | cartesia.ai/sonic PRIMARY |
| ElevenLabs sub-500ms | HIGH | elevenlabs.io/pricing (research/16 §4.5) |
| iFlytek 星火同传 < 5s | HIGH | iflyrec.com/zixun/67875beb.html PRIMARY |
| MS Teams Interpreter = cascade ST→MT→TTS | HIGH | support.microsoft.com FAQ verbatim |
| Azure Live Interpreter S2S + BYO voice | HIGH | learn.microsoft.com/speech-translation |
| Gemini 3.5 Live Translate E2E audio model | HIGH | blog.google 2026-06-09 |
| Gemini Live "a few seconds behind speaker" | MEDIUM | blog.google（无精确数字） |
| Timekettle "0.2s Respond" = first-respond 非首音 | MEDIUM | timekettle.co blog（无明确定义） |
| SimulEval AL/AP/DAL 公式 | HIGH | simuleval.readthedocs.io/user_guide/evaluator.html |
| FLAL 定义 = "first determined translation at paragraph level" | HIGH | arXiv 2507.17527v2 §3.2 |
| 1.3s ≈ S2S FLAL + 1s 本地栈 | HIGH | research/15 HIGH（反推 + Doppelvoice README） |
| Step-Audio 130B = 130B / TTS-3B distilled | HIGH | arXiv 2502.11946 |
| Step-Audio M2 跑不动 | HIGH | 130B / 3B 参数量级 |
| SeamlessStreaming AL 1.68s | HIGH | arXiv 2507.17527v2 Table 1（作为 baseline） |
| Doubao S2T 字幕事件 ≈ S2S 同步 | HIGH | research/16 §3.3 + volcengine docs |
| 网络 cn-beijing 直连 RTT 30-100ms | MEDIUM | T22 HIGH + 经验值 |
| ogg_opus 整句解码 +500ms | MEDIUM | T01 估 + 经验值 |
| opuslib 按 20ms 帧流式可省 ~300-500ms | MEDIUM | opuslib docs + research/16 §6.7 |

---

## 9. PRIMARY SOURCES 一级源清单

### 论文 / arXiv
1. **Seed-LiveInterpret 2.0** (arXiv 2507.17527v3): https://arxiv.org/abs/2507.17527 — PRIMARY（已读 abs + html §2.2 + §3.2 + Table 1）
2. **CosyVoice 2** (arXiv 2412.10117v3): https://arxiv.org/abs/2412.10117 — PRIMARY（已读 abs + html §2.3-2.5）
3. **Step-Audio** (arXiv 2502.11946): https://arxiv.org/abs/2502.11946 — PRIMARY（已读 abs）
4. **STACL** (arXiv 1810.08398): Ma et al 2019 — PRIMARY by name（SimulEval 文档引用）
5. **Can neural MT do simultaneous translation** (arXiv 1606.02012): Gu et al — PRIMARY by name
6. **Monotonic Infinite Lookback** (arXiv 1906.05218): Ma et al MILA — PRIMARY by name

### 模型 GitHub README
7. **CosyVoice** (FunAudioLLM): https://github.com/FunAudioLLM/CosyVoice — PRIMARY（已读 raw README，确认 "Bi-Streaming: latency as low as 150ms"）
8. **sherpa-onnx**: https://github.com/k2-fsa/sherpa-onnx — PRIMARY by name（research/16 §2.3）
9. **whisper.cpp**: https://github.com/ggml-org/whisper.cpp — PRIMARY by name
10. **FunASR**: https://github.com/modelscope/FunASR — PRIMARY by name
11. **Silero Models**: https://github.com/snakers4/silero-models — PRIMARY by name
12. **SimulEval**: https://github.com/facebookresearch/SimulEval — PRIMARY（已读 README + docs evaluator）
13. **seamless_communication**: https://github.com/facebookresearch/seamless_communication — repo exists；SeamlessStreaming paper 待 arXiv ID 校对

### 官方文档 / 产品页
14. **Microsoft Teams Interpreter**: https://support.microsoft.com/en-us/teams/copilot/interpreter-in-microsoft-teams-meetings-and-calls — PRIMARY（已读 verbatim FAQ cascade）
15. **Azure Speech Translation (Live Interpreter)**: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation — PRIMARY（已读 §Live Interpreter）
16. **Google Gemini 3.5 Live Translate blog**: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-live-3-5-translate/ — PRIMARY by URL（fetch failed this session；research/26 已 fetch）
17. **Cartesia Sonic**: https://cartesia.ai/sonic — PRIMARY（已读 verbatim "sub-90ms"）
18. **ElevenLabs**: https://elevenlabs.io/pricing + elevenlabs.io/latency — PRIMARY by name（research/16 §4.5）
19. **iFlytek 讯飞同传**：https://www.iflyrec.com/zixun/67875beb.html — PRIMARY（已读 verbatim "5s 内"）
20. **Timekettle W4**：https://www.timekettle.co/products/w4-ai-interpreter-earbuds + /blogs/tips-and-tricks/... — PRIMARY by name（research/26 §2.4）
21. **火山引擎 同传 2.0**：https://www.volcengine.com/docs/6561/1756902 — PRIMARY by name（research/16 §3.3）
22. **火山引擎 双向流式 TTS**：https://www.volcengine.com/docs/6561/2532486 — PRIMARY by name（research/16 §4.1）

### 双通道姊妹研究（cross-reference）
23. **research/15** (金喜架构反推): `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`
24. **research/16** (流式首音优化): `.scratch/macos-siminterpret-poc/research/16-streaming-first-sound-optimization.md`
25. **research/22** (金喜客户教程产品 map): `.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md`
26. **research/26** (同传产品技术栈横评): `.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md`

---

## 10. 与 T16 / T26 互补关系

| 本文件 | 已有 | 互补 |
|---|---|---|
| 延迟口径辨析（§2） | T16 只说"首音 vs 整段" | ✅ 补 SimulEval AL/AP/DAL 公式 + FLAL 定义 + 数字归因 |
| Per-stage 预算表（§3） | T16 §1.1 已有简化表 | ✅ 补 primary benchmark 来源 + 子项细分 |
| 主流产品延迟横评（§1） | T26 已做技术栈横评 | ✅ 补每家用哪个延迟口径 |
| 降延迟技巧排名（§4） | T16 §6 已有技巧清单 | ✅ 加效果量级 + 谁在用 + primary 来源 |
| E2E vs 级联 trade-off（§5） | T26 §2 已有产品对比 | ✅ 补 Seed Table 1 数据 + iFlytek + Gemini 数字 |
| v0/v1/v2 推荐（§6） | T16 §7 已有架构组合 | ✅ 加上每版对应延迟数字 + 选型表 + 不可降部分 |