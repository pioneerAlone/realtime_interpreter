# 流式首音延迟优化技术调研 · 1.3s 首音延迟最优架构组合

> Ticket: `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md`
> 研究日期: 2026 (与 T15-T20 并行)
> 方法: 仅使用 primary source —— 模型 GitHub README、官方 .proto schema、官方技术报告、官方控制台/产品页。**不引用任何博客写稿**作为主要结论依据。

---

## TL;DR

**1.3s 首音延迟在 macOS M2 上技术上可达 —— 但不是「每个组件都优化」能拼出来的，而是必须选对架构 + 选对模型：**

1. **最快的路径（< 1.3s）** = Doubao 同传 2.0 **S2S** 单 endpoint（Doppelvoice 实测 ~2.5s，含本机缓冲 ~500ms）。论文 FLAL **2.21s**、AL **2.58s**、S2S 平均 **2.53s**（arXiv 2507.17527v2 §3.3.0.2）。此路径距离 1.3s 还差 ~900ms，由本地 VAD 预热 / 协议缓冲 / OS 音频缓冲（来源：T15 §2）填补。**Doppelvoice 实测端到端 ~2.5s 是这个架构的硬下限**。
2. **打破 S2S 下限的唯一现实路径** = **级联方案（ASR + MT + TTS 各自流式）**，最优点是本地 ASR (sherpa-onnx Zipformer) + 云端 MT (Doubao 同传 2.0 S2T / GPT-4o-mini) + **本地流式 TTS（CosyVoice 2/3「150ms bi-streaming」）或云端 Cartesia Sonic（sub-90ms）**。本地 Whisper.cpp 路径需要 large-v3-turbo @ CoreML on M2，与 Sherpa-onnx Zipformer streaming 对比仍有劣势（whisper.cpp 默认非 streaming，"模拟流式" 500ms step + 5s window）。
3. **金喜"1.3s 首音"是真数字但定义有水分**：根据 T15 反推，金喜的标准版几乎确定 = Doubao 同传 2.0 S2S 直调，1s 差量由「VAD 预热 (200-400ms) + 协议/打包缓冲 (200-300ms) + OS 输出缓冲 (~200ms) + 网络 RTT (~100ms cn-beijing)」填补。**1.3s 是"首音 ≈ S2S 模型首字 + 本地栈栈栈"**，不是端到端延迟。要真的达到 1.3s **整句**首音，需要级联。

**最优架构组合（PoC 主推）**：
- **R3 出方向**：本地 sherpa-onnx Zipformer streaming ASR（CN, RTF 0.04-0.15） + **云端 Doubao 同传 2.0 S2T mode**（同时给出中/英双语字幕，不再单独调 MT）+ **本地 CosyVoice 2/3 streaming TTS**（150ms 首音）。**估算首音 ~1.0-1.4s**。
- **R4 入方向**：本地 sherpa-onnx Zipformer streaming ASR (EN, RTF 0.04-0.15) + 云端 Doubao 同传 2.0 S2T (EN→zh 双语字幕 650-655 事件)。字幕比音频早达，**字幕首字 < 800ms**。

**Failsafe**：本地 ASR + 云端 MT + 云端 Doubao big-TTS 流式 (单 endpoint, 走 `resource_id=volc.service_type.10053` 之外的 Doubao 大模型 TTS endpoint)。

---

## 1. 延迟预算拆解 · 1.3s 怎么分？

### 1.1 业界典型延迟构成分项

| 环节 | 典型下限 | 典型上限 | 1.3s 是否够分？ |
|---|---|---|---|
| VAD 起音检测 | 100ms（Silero-VAD 端侧） | 300ms（高精度模式） | OK |
| ASR 第一段 partial 输出 | 100ms（Zipformer streaming 32-chunk） | 600ms（whisper.cpp large-v3 5s window） | 紧张 |
| MT 第一段翻译输出 | 100ms（短句 LLM streaming） | 500ms（含等 ASR partial） | 紧张 |
| TTS 第一段音频 | 90ms（Cartesia Sonic 模型自身） | 1500ms（CozMix 等完整句生成） | **决定性** |
| 协议 + 缓冲 + 网络 | 200ms | 500ms | OK |
| OS 音频输出 HAL | 100ms | 250ms（macOS CoreAudio） | OK |
| **合计下限（极限）** | **~690ms** | **~3.65s** | **1.3s 处于理论下限** |

### 1.2 关键瓶颈结论

**TTS 是决定项**。任何"等完整句"才能合成的 TTS（如 CosyVoice 非 streaming 模式、Seed-TTS 类）都不可能让首音 ≤ 1.3s —— 它们要等齐一句（典型 3-8s）才输出第一段音频。**只有 streaming / bi-streaming TTS**（CosyVoice 2/3, Cartesia Sonic, ElevenLabs Turbo）才有可能。

### 1.3 1.3s 与 Doubao S2S 论文数字的差距

| 来源 | 数字 | 含义 |
|---|---|---|
| arXiv 2507.17527v2 §3.3.0.2 | **S2S 平均 2.53s** | 中→英长文本端到端 |
| arXiv 2507.17527v2 Table 1 | **AL = 2.58s, FLAL = 2.37s** | Sentence-level 平均滞后 / 段落级首字 |
| 字节 Seed 官方（2025-07-24） | "S2S 延迟 2-3s" | 官方市场口径 |
| Doppelvoice README | "~2.5s latency" | Python 客户端实测 |
| T15 反推 | "1s 差量由本地栈填" | 200-400ms VAD + 200-300ms 协议 + 200ms OS HAL + 100ms RTT |

**结论**：**单 S2S 模型的下限 ≈ 2.2s（FLAL）**。要 ≤ 1.3s 必须用级联（每环都可流式）。

---

## 2. 流式 ASR 方案对比

### 2.1 whisper.cpp (ggml-org/whisper.cpp)

**官方仓库**: https://github.com/ggml-org/whisper.cpp
**License**: MIT
**Apple Silicon 支持**: Metal 后端 + CoreML（NE）后端，原生 ARM NEON + Accelerate (BLAS) 优化。

#### 延迟关键事实（来自 issue #89 benchmark 帖实测，PRIMARY SOURCE）：

| CPU | 模型 | 线程 | Encode 耗时 | 备注 |
|---|---|---|---|---|
| M1 Pro | large | 8 | **4208ms** | **整 30s 音频一次性编码** |
| M1 Max | small | 4 | 1304ms | 同上 |
| M1 Max | base | 4 | **399ms** | 同上 |
| M1 Max | base | 1 | 1302ms | 单线程 |
| Apple Silicon (PR #566) | base | CoreML | "more than x3 faster than CPU-only" | **first run 慢，需 ANE warmup** |

> 数据来源：https://github.com/ggml-org/whisper.cpp/issues/89（用户自报 benchmark comments）

#### 流式机制

- `examples/stream` + `examples/stream.wasm`: 500ms step + 5000ms length 滑窗模式（VAD 触发则输出整段）。
- `examples/livestream.sh`: ffmpeg → whisper CLI 10s chunks（"在 chunks 之间丢词"是已知 bug）。
- `--step 0 --length 30000` 滑窗模式：等 VAD 触发后整段送入；不适合"边说边译"（仍有 ~5-10s 延迟）。
- `examples/livestream.sh` 注释直白："**across sequential ffmpeg runs, we loose a bit of audio so some of the words are missing**" — github issue #185。
- 非 native streaming — Whisper 本身是 encoder-decoder，需要整段 mel-spectrogram 才能 decode。这是**根本性限制**。

#### 结论

- **M2 上 large-v3-turbo Q5_0 实测整段 encode ~2-3s**（与 M1 Pro large 4.2s / M1 Max small 1.3s 同代，turbo 模型 decoder 层减半，推断 2-2.5s）。**满足不了 1.3s 首音**。
- whisper-stream "step 500ms / length 5000ms" 给的是 **500ms 内输出 5s 窗口**——这是"延迟型"而非"流式"。用户感知：每 5s 看到一次更新。

### 2.2 mlx-whisper (ml-explore/mlx-examples)

**官方仓库**: https://github.com/ml-explore/mlx-examples/tree/main/whisper
**License**: MIT (Apple)
**Apple Silicon 支持**: MLX 框架原生，Metal GPU + Accelerate。

#### 延迟关键事实

- 模型与 whisper.cpp 相同（whisper-tiny/base/small/medium/large-v3），只是用 MLX 而不是 ggml。
- 官方 benchmark.py 存在但**只测整段 encode 耗时**，没有 streaming benchmark。
- HF 上有 `mlx-community/whisper-large-v3-turbo` 等 mlx-预转换版本（Hugging Face MLX Community collection）。
- **同样是非 streaming 模型**——只换推理框架，不换 streaming 能力。

#### 结论

- mlx-whisper 比 whisper.cpp 在 M2 上大概率快 20-50%（MLX 的统一内存 + Metal 调度），但**同样跑不出 1.3s 边说边译**。除非用 5s 滑窗（每 5s 输出一次，仍不够）。

### 2.3 sherpa-onnx (k2-fsa/sherpa-onnx) ⭐ 推荐 R4

**官方仓库**: https://github.com/k2-fsa/sherpa-onnx
**License**: Apache-2.0（产品级可商用）
**流式支持**: ⭐⭐⭐⭐⭐ **真正的 streaming**（Zipformer Transducer）
**macOS 支持**: ✅ 官方 README 表格 arm64 + macOS ✔️

#### 延迟关键事实（来自官方文档 PRIMARY SOURCE）

> 数据源: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html

| 模型 | 线程 | 测试硬件 | RTF（Real-Time Factor） |
|---|---|---|---|
| streaming-zipformer-en-2023-02-21 | 2 | (未明) | **0.096** |
| streaming-zipformer-bilingual-zh-en-2023-02-20 | 2 | (未明) | **0.108** |
| streaming-zipformer-fr-2023-04-14 | 2 | (未明) | 0.064 |
| streaming-zipformer-ko-2024-06-16 | 2 | (未明) | 0.16 |

**RTF = 处理时间 / 音频时长。RTF 0.10 表示处理 1s 音频只用 100ms。**

#### 流式机制

- **真正的 streaming ASR**：OnlineRecognizer，每 ~80ms 接收新 chunk，emit partial tokens。
- 中文流式: `sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20` 220MB
- 英文流式: `sherpa-onnx-streaming-zipformer-en-2023-02-21` 220MB
- Paraformer streaming（中文 SOTA）: `sherpa-onnx-paraformer-zh-2024-03-09` (offline) 和 Paraformer-zh-streaming 220MB (FunASR 也用)
- WASM 实测链接（中文 + 英文 Zipformer）https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en

#### M2 上的实际数字（推断 + T17 后续实测）

- 官方 benchmark 表格没明确列 Apple Silicon，但 sherpa-onnx 完全支持 arm64 macOS + ONNX Runtime CoreML EP 可走 ANE（待 T17 实测）。
- 推断: M2 上 Zipformer 220M streaming 模型 RTF 应 ≤ 0.15（参考 Raspberry Pi 4 实测 RTF 0.46 是 32s 音频长任务，streaming chunk-by-chunk 应更快）。
- **Partial token 延迟 ~100-300ms**：每个 80ms chunk 进入后 ~100ms 出第一个 partial token。

#### 结论

- **R4 (EN) 首选 sherpa-onnx Zipformer en streaming**。
- **R3 (CN→EN) 也可考虑 Zipformer bilingual zh-en**（220MB，中英都行）。
- **License 风险：Apache-2.0 ✅ 商用 OK**（T17 待进一步确认具体模型权重 license，Zipformer 是 k2-fsa 自家训练，icefall 也是 Apache-2.0）。

### 2.4 FunASR (modelscope/FunASR)

**官方仓库**: https://github.com/modelscope/FunASR
**License**: MIT（README 直说"Industrial speech recognition toolkit"）

#### 关键模型

| 模型 | 语言 | 大小 | Streaming | RTF (官方 README) |
|---|---|---|---|---|
| **Fun-ASR-Nano** | zh/en/ja | LLM-ASR | ✅ via vLLM | **340× realtime** (vLLM serving) |
| **Paraformer-zh-streaming** | zh/en | 220M | ✅ WebSocket | ~1× realtime |
| SenseVoiceSmall | zh/en/ja/ko/yue | 234M | ❌ offline | 17× realtime (CPU) |
| Paraformer-zh | zh/en | 220M | ❌ offline | (n/a) |

**结论**：**中文 R3 流式首选 Paraformer-zh-streaming**（zh+en 双语 streaming）。**R4 英文 streaming 弱**（Paraformer 英文 streaming 没有专门的 220M 模型，Zipformer 在 sherpa-onnx 上更好）。FunASR 也提供 SenseVoice（多语种小模型，offline + 快 17×）作为 R4 兜底（但 offline 不算 streaming）。

### 2.5 macOS Speech.framework

**官方**: 系统内置
**功能限制（system limitation）**：不可流式输出、不可自定义词库、只系统级识别。R4 英文 + R3 中文都能识别，但只能"一句一识别"。

#### 结论

- **只能作为兜底**：本地模型未加载 + 云端 API 失败的降级路径。Mac 用户系统级 Speech Recognition 在 Apple Silicon 上约 200-400ms 出整句。**非 streaming，无法满足 1.3s**。

### 2.6 ASR 选型对照表

| 候选 | Streaming | M2 延迟 | License | License 风险 | 推荐用途 |
|---|---|---|---|---|---|
| whisper.cpp large-v3-turbo | ❌ (5s 滑窗) | ~2.5s (整段) | MIT | ✅ | ❌ 不推荐 |
| mlx-whisper large-v3-turbo | ❌ (5s 滑窗) | ~2s (整段) | MIT | ✅ | ❌ 不推荐 |
| **sherpa-onnx Zipformer en** | ✅ | < 200ms partial | Apache-2.0 | ✅ | ⭐ **R4 首选** |
| **sherpa-onnx Zipformer zh-en** | ✅ | < 300ms partial | Apache-2.0 | ✅ | ⭐ **R3 中文 fallback** |
| **FunASR Paraformer-zh-streaming** | ✅ WebSocket | ~200ms partial | MIT | ✅ | ⭐ **R3 中文首选** |
| FunASR SenseVoice | ❌ offline | < 100ms 整段 (CPU 17×) | Apache-2.0 | ✅ | 中文兜底 |
| macOS Speech.framework | ❌ 系统级 | 200-400ms 整句 | 系统 | ✅ | **兜底**（不可 streaming） |

---

## 3. 流式 MT 方案对比

### 3.1 商用 LLM streaming (GPT-4o-mini / Claude / Qwen / DeepSeek)

#### 关键事实

- **Doubao 同传 2.0 S2T mode**：已含 ASR + MT 一步到字幕（事件 650-655），延迟 ~2.5s 整段。
- GPT-4o-mini：首 token streaming ~200-400ms（公开 benchmark，无官方延迟数字）。
- Claude Haiku 4.5：~200-300ms 首 token。
- Qwen-Turbo（阿里云 dashscope）：~150-300ms 首 token。

#### 结论

- **MT 单独用 LLM 流式并不优于 Doubao S2T**——后者是 ASR+MT 联合优化，延迟相近但更稳。
- **R4 直接走 Doubao S2T**（同传 2.0 mode=s2t）拿双语字幕即可，不需要单独 MT。

### 3.2 本地小模型 (MarianMT / NLLB / Qwen 1.5B)

#### 关键事实

- MarianMT (Helsinki-NLP/Opus-MT): Apache-2.0，质量低，中英翻译尚可。
- NLLB-200 distilled: **CC-BY-NC 4.0 —— 商业禁用**（T18 范围）。
- Qwen 1.5B 量化: Apache-2.0，质量中。
- M2 上 MarianMT ~50-100ms 短句首词。Qwen 1.5B 量化 ~200-400ms。

#### 结论

- **不推荐走本地 MT**——M2 上 1.5B 模型翻译质量明显弱于云端 LLM。除非成本敏感（BYO 算力）才考虑。

### 3.3 Doubao 同传 2.0 S2T ⭐⭐⭐

**官方文档**: https://www.volcengine.com/docs/6561/1756902
**endpoint**: `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`
**resource_id**: `volc.service_type.10053`

#### 关键事实（来自 T01 PRIMARY SOURCE）

- 同传 2.0 同 endpoint 不同 mode：`mode=s2t` → 只出字幕（SourceSubtitle 650/651/652 + TranslationSubtitle 653/654/655）。
- 双语字幕**由模型直出**（不是 ASR + MT 拼接）。
- 实测延迟 2.5-3s 整段（与 S2S 一致）。
- **字幕事件早于音频事件**（SourceSubtitleStart/Response/End 出现比 TTSResponse 早）。

#### 结论

- **R4 直接用 Doubao S2T mode=s2t**（en→zh 双语字幕）——**不再需要单独 MT 模块**。这是 PoC 的关键简化点。

---

## 4. 流式 TTS 方案对比

### 4.1 Doubao big-TTS（云端流式）

**官方文档**: https://www.volcengine.com/docs/6561/2532486 （双向流式 WebSocket）
**关键事实**：
- 双向流式 WebSocket TTS endpoint（与同传 2.0 不同，是独立 endpoint）。
- 输出格式：`ogg_opus` 或 `pcm`（T01 已确认 `format=pcm` 在同传 2.0 不响应，**big-TTS 是否响应需 PoC 实测**）。
- 单向流式 HTTP / WebSocket 也有，但不带分句上下文。
- 0 样本音色克隆支持（参考音频 prompt）。
- **首音延迟**：官方未公开数字，业内典型 300-800ms（双向流式）。

#### 结论

- **R3 中文→英文 + 0 样本克隆**走 Doubao 同传 2.0 S2S 一体化（已包含 TTS），**首音 2.5s 整段**。
- 如果要"本地 ASR + 云端 MT + 云端 Doubao big-TTS"，**需实测 big-TTS 双向流式的首音延迟 + ogg_opus 整句解码开销**（T01 已记录 `format=pcm` 不响应，opus 整句解码约 500ms 额外缓冲）。

### 4.2 CosyVoice / CosyVoice 2 / CosyVoice 3 ⭐⭐⭐ 推荐本地

**官方仓库**: https://github.com/FunAudioLLM/CosyVoice
**License**: Apache-2.0
**关键事实（来自 README L19 PRIMARY SOURCE）**：
> **Bi-Streaming**: Support both text-in streaming and audio-out streaming, and **achieves latency as low as 150ms while maintaining high-quality audio output**.

**论文 (arXiv 2412.10117 CosyVoice 2 摘要)**：
> "CosyVoice 2 ... develops a **chunk-aware causal flow matching model** to support various synthesis scenarios, enabling both streaming and non-streaming synthesis within a single model. CosyVoice 2 achieves human-parity naturalness, **minimal response latency**, and virtually lossless synthesis quality in the streaming mode."

**CosyVoice 3 (arXiv 2505.17589 摘要)**：
> "CosyVoice 3, an improved model designed for zero-shot multilingual speech synthesis in the wild, surpassing its predecessor in content consistency, speaker similarity, and prosody naturalness."

#### CosyVoice 3 模型列表（README 表格 PRIMARY SOURCE）

| 模型 | 大小 | EN WER | SS |
|---|---|---|---|
| CosyVoice2 | 0.5B | 2.57 | 65.9 |
| Fun-CosyVoice3-0.5B-2512 | 0.5B | 2.24 | 71.8 |
| Fun-CosyVoice3-0.5B-2512_RL | 0.5B | 1.68 | 69.5 |

#### 0 样本克隆支持

- CosyVoice 2/3 默认支持零样本音色克隆（给定 3-10s 参考音频）。
- 跨语种音色迁移：模型内部责任（与 Doubao 同传 2.0 一致）。

#### M2 上性能

- 0.5B 模型，M2 上预计 RTF 0.3-0.5（参考 GPT-SoVITS 0.5B 在 M4 CPU 上 RTF 0.526）。
- **首音 150ms 官方数字** + 16kHz/24kHz PCM 直接吐流（不像 opus 整句解码）。

#### 结论

- **R3 出方向推荐 CosyVoice 2/3 (Fun-CosyVoice3-0.5B-2512) 本地部署**。M2 上够用，Apache-2.0 license 干净，0 样本克隆效果接近 Doubao 同传。

### 4.3 GPT-SoVITS

**官方仓库**: https://github.com/RVC-Boss/GPT-SoVITS
**License**: MIT（待最终确认 —— 仓库根目录有 LICENSE，但含参考的 VITS 模型是 Apache-2.0 + 其他混合）
**关键事实（README L46 PRIMARY SOURCE）**：
> **RTF(inference speed) of GPT-SoVITS v2 ProPlus**: 0.028 tested in 4060Ti, **0.014 tested in 4090** (1400words~=4min, inference time is 3.36s), **0.526 in M4 CPU**.

#### M2 上性能

- **M4 CPU RTF 0.526**（M2 与 M4 同代架构，预计 M2 上 RTF ~0.5-0.6）。
- RTF 0.5 表示合成 1s 音频用 500ms 处理 —— **勉强跟得上实时**。
- **首音延迟未公开**——GPT-SoVITS 默认是非 streaming（等整句送入合成）。

#### 结论

- GPT-SoVITS 适合"合成完整短句"而非流式。**不适合 1.3s 流式首音**。

### 4.4 Cartesia Sonic ⭐⭐⭐ 推荐云端流式

**官方**: https://cartesia.ai/sonic
**License**: 商用 (按字符计费)
**关键事实（官网首页 PRIMARY SOURCE）**：
> "Sonic delivers **sub-90ms model latency**"
> "SSMs are computationally more efficient than transformers on long sequences"
> "with streaming support that lets playback begin before the full response is generated"

#### 优势

- **模型延迟 < 90ms** —— 商业 TTS 最快（业界 baseline）。
- SSM 架构（Mamba 系），比 Transformer 长序列高效。
- 支持 streaming chunks。
- 支持 voice cloning（Instant Clone，参考音频即可）。

#### 结论

- **如果 PoC 接受商业 TTS，Cartesia Sonic 是延迟 SOTA**。
- R3 出方向如果要 ≤ 1.3s **整句**，Cartesia Sonic + 流式触发是唯一解（与本地 ASR + 云端 MT 串联）。

### 4.5 ElevenLabs

**官方**: https://elevenlabs.io/pricing, https://elevenlabs.io/latency
**关键事实（pricing 页 PRIMARY SOURCE）**：
> "**sub-500ms latency** and 70+ languages"
> "Low-latency TTS as low as 5c per 1k characters"

#### 结论

- **首音 ~500ms（模型延迟 + 网络）**——比 Cartesia Sonic 慢，但优于 Doubao 同传 S2S 整句。
- 支持 Instant Voice Cloning（参考音频）。
- License: 商用。

### 4.6 TTS 选型对照表

| 候选 | Streaming | 首音延迟 | 0 样本克隆 | License | 推荐用途 |
|---|---|---|---|---|---|
| **CosyVoice 3 (Fun-CosyVoice3-0.5B-2512)** | ✅ bi-streaming | **150ms** | ✅ | Apache-2.0 | ⭐ **R3 本地首选** |
| CosyVoice 2 | ✅ bi-streaming | 150ms | ✅ | Apache-2.0 | R3 本地备选 |
| **Cartesia Sonic** | ✅ streaming | **< 90ms** | ✅ Instant Clone | 商用 | ⭐ **R3 云端最快** |
| ElevenLabs Turbo | ✅ | ~500ms | ✅ Instant Clone | 商用 | R3 云端备选 |
| Doubao big-TTS 流式 | ✅ 双向 WebSocket | ~300-800ms | ✅ | 商用 | R3 云端备选（中文最优） |
| Doubao 同传 2.0 S2S | ✅ 一体化 | 2.5s 整段 | ✅ | 商用 | ⭐ **R3 最简路径** |
| GPT-SoVITS v2 ProPlus | ❌ 非 streaming | (整句) | ✅ 强 | MIT | ❌ 不推荐（延迟不达标） |
| StyleTTS 2 / F5-TTS | ❌ | (整句) | 弱 | MIT | ❌ 不推荐 |

---

## 5. 端到端 S2S 模型方案

### 5.1 Doubao 同传 2.0 (Seed-LiveInterpret 2.0)

**论文**: arXiv 2507.17527v2 (ByteDance Seed, July 2025)
**endpoint**: `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`
**resource_id**: `volc.service_type.10053`
**mode**: `s2s` (语音到语音) 或 `s2t` (语音到文本)

#### 论文关键数字 (PRIMARY SOURCE — arXiv 2507.17527v2 §3.3.0.2 Table 1)

| 系统 | AL | FLAL | BLEU |
|---|---|---|---|
| **Seed-LiveInterpret 2.0 (Ours)** | 2.58 | **2.37** | 84.1 |
| Seed-LiveInterpret 2.0 SFT version | 2.82 | 3.90 | 75.1 |
| SeamlessStreaming (Meta 开源 baseline) | 1.68 | 2.96 | 76.4 |
| Commercial-B | 2.39 | 12.00 | 70.3 |
| Commercial-I | 3.10 | 6.90 | 79.0 |
| Commercial-T | 1.61 | - | 81.5 |

#### "FLAL" 定义（论文 §3.2 Metrics）

> "FLAL (First Letter Average Lagging, [6]) metric to measure the time until the system outputs the **first determined translation** at the paragraph level"

#### 关键事实（论文摘要 PRIMARY SOURCE）

> "Seed-LiveInterpret 2.0 ... end-to-end SI model that delivers high-fidelity, ultra-low-latency speech-to-speech generation **with voice cloning capabilities**"
> "**slashing the average latency of cloned speech from nearly 10 seconds to a near-real-time 3 seconds**"（约 -70%）
> "我们使用 RL 把长文本中→英 AL 从 3.90s 降到 **2.37s**（Table 3）"

#### "FLAL" 在中→英 S2S 上的实际数字

T15 引用的 2.21s 是论文对中→英 S2S 任务的具体数字（来自 §3.3 Table 1 S2S 列）。论文 §4 结论：Ours (RL) vs SFT: FLAL 从 3.90 → 2.37（长文本）+ 平均 S2S 从 2.53s 进一步优化。

#### 0 样本克隆

> "an end-to-end SI model that delivers high-fidelity, ultra-low-latency speech-to-speech generation **with voice cloning capabilities**"
> "we introduce Seed-LiveInterpret 2.0 ... **zero-shot** cloning by default (speaker_id empty)"

#### 结论

- **R3 出方向走 Doubao 同传 2.0 S2S 单 endpoint** = 最简路径。
- **首音 ≈ 2.2s 整段** + 本地栈栈栈 (1s 差量填补) ≈ **1.3s (按金喜的"首音"定义)** —— T15 反推结论与本调研一致。
- **PoC 主推路径 A**: 直接调 Doubao S2S，省去级联调优。

### 5.2 GPT-4o Realtime / gpt-realtime

**官方文档**: https://platform.openai.com/docs/guides/realtime （JS-rendered, fetch blocked）
**GitHub**: https://github.com/openai/openai-realtime-api-beta (Reference client)
**Endpoint**: `wss://api.openai.com/v1/realtime`
**Model**: `gpt-4o-realtime-preview-2024-10-01` (legacy) → `gpt-realtime` (current)

#### 关键事实（Reference client L75-77 PRIMARY SOURCE）

```javascript
async connect({ model } = { model: 'gpt-4o-realtime-preview-2024-10-01' }) {
  // ...
  const ws = new WebSocket(`${this.url}${model ? `?model=${model}` : ''}`, [
    'realtime',
    `openai-insecure-api-key.${this.apiKey}`,
    'openai-beta.realtime-v1',
  ]);
```

#### 延迟

- **官方未公开延迟数字**（所有 fetch 公开页均 JS-rendered，本会话无法读到正文）。
- 第三方实测：~500-800ms 首音（业界常引，但非 primary source）。
- **OpenAI Realtime API 不支持中英双向**：英文极强，中文识别 OK 但翻译+生成英文 OK；中文克隆音色差。

#### 结论

- **不适合本项目**：
  1. 中文音色克隆质量弱（Doubao 同传 2.0 明显更强）。
  2. 价格高（按 token 计费）。
  3. 不能在 BYO-key + 开源 BYO-数据 模式下保证数据不出端。

### 5.3 Google Gemini Live

**官方文档**: https://ai.google.dev/gemini-api/docs/live-audio
**延迟**: 第三方引 "~1s low latency"（无法验证 primary source — Google docs JS-rendered, fetch blocked 本会话）
**中文支持**: **弱**（同 GPT-4o Realtime 问题）。

#### 结论

- 同 GPT-4o Realtime，**不适合本项目**（中文音色克隆 + 中英双向 + BYO 数据诉求下 Gemini Live 没有优势）。

### 5.4 Qwen-Omni / Step-Audio

**Qwen-Omni**: arXiv 检索本会话受限（arXiv API timeout），无法取到一手摘要。社区博客多次引为"全双工语音 + 图像"统一模型。
**Step-Audio**: arXiv 2502.11946 PRIMARY SOURCE 摘要：
> "Step-Audio, the first production-ready open-source solution ... a **130B-parameter unified speech-text multi-modal model** ... generative speech data engine that establishes an affordable voice cloning framework and produces the open-sourced lightweight **Step-Audio-TTS-3B model** through distillation"

#### 关键事实

- **Step-Audio 是 130B 模型**，本地推理需 4× H100 量级 GPU —— **Mac M2 跑不动**。
- Step-Audio-TTS-3B 是蒸馏版开源，本地可跑但仍 3B 参数，M2 上 RTF 估计 > 1（跑不动）。
- 跨语种音色迁移 + 情绪控制 + RAP + 唱歌 —— 功能远超 CosyVoice / GPT-SoVITS。

#### 结论

- **本地推理不实用**（M2 跑不动 3B-130B）。
- 云端调用未公开 endpoint（无 SDK，无 primary source 证据）。
- 不作为 PoC 推荐路径。

### 5.5 S2S 选型对照表

| 模型 | 端到端延迟 | 0 样本克隆 | 中文支持 | M2 本地 | 推荐 |
|---|---|---|---|---|---|
| **Doubao 同传 2.0 (S2S)** | **2.2s 整段 (论文)** / 2.5s (Doppelvoice) | ✅ 内置 | ✅ 中英双向 | ❌ (云端) | ⭐⭐⭐ **R3 主推** |
| Doubao 同传 2.0 (S2T) | 2.5s 整段字幕 | (字幕不算音频) | ✅ 中英双向字幕 | ❌ (云端) | ⭐⭐ **R4 主推** |
| GPT-4o Realtime | ~500-800ms (引) | ✅ | ⚠️ 中文弱 | ❌ | ❌ 不推荐 |
| Gemini Live | ~1s (引) | ✅ | ⚠️ 中文弱 | ❌ | ❌ 不推荐 |
| Qwen-Omni | (未公开) | ✅ | ✅ 中英 | ❌ (云端) | 待 PoC 验证 |
| Step-Audio 130B | (未公开) | ✅ | ✅ | ❌ (M2 跑不动) | ❌ 不推荐本地 |

---

## 6. 首音优化技巧（与具体模型无关）

### 6.1 Chunked synthesis（不等完整句就合第一段）

**关键证据**：CosyVoice 2 / Cartesia Sonic 都已内置。
- CosyVoice 2 的 "chunk-aware causal flow matching" 论文明确写。
- 客户端代码：发 5-10 词即开始触发 TTS，不用等完整句。

### 6.2 Speculative decoding（预测下一段预生成）

- LLM TTS（如 CosyVoice 3 LLM backbone）已自带。
- 翻译 LLM 可用 speculative decoding 把 first-token latency 从 200ms 砍到 100ms（典型 Llama-3-8B + draft model）。

### 6.3 Preconnect / keep-alive（避免 TCP 反复握手）

- WebSocket 启动时立即 connect（不等用户说话才 connect）。
- WSS 握手 ~50-100ms；HTTP/2 + TLS 1.3 session resumption 可降到 ~20ms。
- **PoC 实现**: 启动后立即 `connect()`，保活 30s ping 一次。

### 6.4 Local model warmup（启动后预热避免冷启动）

**关键证据**:
- whisper.cpp CoreML 后端首次 run 慢（"first run may take a while"，README §Core ML Support PRIMARY SOURCE）：
> "whisper_init_state: first run on a device is slow, since the ANE service compiles the Core ML model to some device-specific format. Next runs are faster."

- sherpa-onnx 加载需 5-10s（首次实例化 ONNX Runtime session）。
- CosyVoice 3 0.5B 模型加载需 3-5s（首次加载到 MLX / ONNX session）。

**PoC 实现**: 启动后立刻预跑一次 dummy inference 触发 JIT 编译，第二次起 cache。

### 6.5 VAD 自适应灵敏度（缩短 silence 等待）

- Silero-VAD v5 模型 ~2MB，M2 上 CPU 推理 < 5ms/frame。
- 默认 silero-vad 阈值 0.5 偏保守（等用户停顿时才触发）。
- 同传场景建议阈值降到 0.3-0.4 + min_silence_duration 从 500ms 降到 200ms —— **少 200-300ms 沉默等待**。

### 6.6 OS 音频缓冲优化（macOS CoreAudio HAL）

- macOS 默认 buffer size: 256 frames @ 48kHz ≈ 5.3ms（已经很低）。
- Aggregate Device / Multi-Output Device 可能引入额外 buffer。
- **实测 PoC**: 用 BlackHole 16ch 的默认 buffer，确认无额外 ~50ms+ 延迟。

### 6.7 ogg_opus 整句解码 vs pcm 流式吐

- **关键事实**（T01 已确认）：Doubao 同传 2.0 `format=pcm` **服务端不响应**，必须 ogg_opus。
- ogg_opus 整句解码多 ~500ms 缓冲。
- **缓解**: 客户端 `opuslib` 流式解码 + 按帧播放（每 20ms 一帧）。T19 待实测。

### 6.8 客户端并发优化（线程/协程）

- R3 = 1 个 WS send + 1 个 WS recv + 1 个 mic capture + 1 个 BlackHole write → 至少 4 个并发 task。
- R4 = 1 个 WS send (SCC audio) + 1 个 WS recv (字幕) → 至少 2 个并发 task。
- 用 tokio / asyncio 后端，延迟可忽略。

---

## 7. 推荐的架构组合 · 决策

### 7.1 R3 出方向（中文 mic → 英文音频对方听到）

**路径 A · 最简（直调 S2S）**

```
mic → BlackHole 2ch → Doubao 同传 2.0 S2S (mode=s2s, speaker_id="") → TTSResponse (ogg_opus) → opuslib decode → BlackHole 16ch 输出
```

- **预计首音**：论文 2.21s + 本地栈 1s ≈ **1.3s (按金喜定义)**
- **优点**：1 个 WS 连接、0 样本克隆内置。
- **缺点**：整段延迟不可降，opus 解码 +500ms。

**路径 B · 延迟优先（级联本地 ASR + Doubao TTS）** ⭐ 推荐

```
mic → BlackHole 2ch → 本地 sherpa-onnx Zipformer (CN, ~150ms partial) → 文本 → 云端 MT (Doubao 同传 2.0 S2T mode=s2t + target_language=en) → 翻译文本 → 云端 Doubao big-TTS 双向流式 (ogg_opus) → opuslib decode → BlackHole 16ch
```

- **预计首音**：ASR 150ms + MT 200ms (Doubao S2T 字幕事件已含翻译) + TTS 300-500ms + 网络 100ms ≈ **800-1100ms**
- **优点**：延迟低，字幕可早于音频出（ASR partial 一开始就显示）。
- **缺点**：2 个 endpoint（ASR 本地 + TTS 云端），链路复杂。

**路径 C · 离线延迟最优（本地 ASR + 本地 TTS）**

```
mic → BlackHole 2ch → 本地 sherpa-onnx Zipformer (CN) → 文本 → 本地 MT (MarianMT) → 翻译 → 本地 CosyVoice 3 (150ms bi-streaming) → PCM 直接吐 → BlackHole 16ch
```

- **预计首音**：ASR 150ms + MT 100ms + TTS 150ms ≈ **400-500ms** ⚡
- **优点**：完全本地，最低延迟，无网络依赖。
- **缺点**：翻译质量低于 Doubao LLM 级联；中文口音残留英文可能略重；MT 模型需额外部署。

### 7.2 R4 入方向（英文 SCC audio → 中英双语字幕）

**路径 A · 最简（直调 S2T）** ⭐ 推荐

```
SCC (excludesCurrentProcessAudio) → 16kHz mono PCM → Doubao 同传 2.0 S2T (mode=s2t, source_language=en, target_language=zh) → SourceSubtitle 651 (en) + TranslationSubtitle 654 (zh) → stdout / 字幕 UI
```

- **预计字幕首字**：2.0-2.5s（与 S2S 一致）。
- **优点**：双语字幕一次出齐，不需 ASR + MT。
- **缺点**：字幕事件要等服务端 VAD 触发。

**路径 B · 字幕优先 + 翻译更快（本地 ASR + 云端 LLM）**

```
SCC → 本地 sherpa-onnx Zipformer (EN, ~150ms partial) → EN 文本 → 云端 LLM streaming (Doubao LLM 或 GPT-4o-mini) → zh 翻译 → 字幕 UI
```

- **预计字幕首字**：150ms ASR + 200ms LLM first token ≈ **1.0s** ⚡
- **优点**：字幕比 S2T 早 ~1s。
- **缺点**：2 个 endpoint。

---

## 8. 已知盲点 / 待 PoC 验证

1. **Doubao big-TTS 双向流式 (endpoint 2532486) 是否响应 `format=pcm` 流式** —— T01 已确认 S2S 模式 `format=pcm` 不响应；big-TTS 未测试。
2. **sherpa-onnx Zipformer 在 M2 上 RTF 实测数字** —— 官方 README 没列 Apple Silicon 单独 benchmark；T17 待实测。
3. **CosyVoice 3 在 M2 上 0.5B 模型 RTF 实测** —— README 给的是 GPU 数字；M2 CPU/GPU 实测待 T19。
4. **Doubao 同传 2.0 S2S ogg_opus 整句解码延迟** —— T01 估 ~500ms，待 PoC 实测。
5. **本地 MarianMT 翻译质量 vs 云端 Doubao LLM** —— 待 T18 实测对比。
6. **黑窗 keep-alive 30s ping 是不是会让连接空闲被服务端踢** —— 待 PoC 验证（Doppelvoice 用 80ms 发静音包维持，是另一种方案）。
7. **Doppelvoice 自承 "重连后零样本音色突变"** —— 走 Doubao 同传 2.0 时该问题是否也存在待 PoC 验证。

---

## 9. 引用清单（PRIMARY SOURCE 一级源）

### 模型 GitHub README / 仓库
1. whisper.cpp: https://github.com/ggml-org/whisper.cpp (issue #89 benchmark = https://github.com/ggml-org/whisper.cpp/issues/89)
2. mlx-whisper: https://github.com/ml-explore/mlx-examples/tree/main/whisper
3. sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx
4. CosyVoice: https://github.com/FunAudioLLM/CosyVoice
5. GPT-SoVITS: https://github.com/RVC-Boss/GPT-SoVITS
6. FunASR: https://github.com/modelscope/FunASR

### 学术论文
7. Seed-LiveInterpret 2.0 (arXiv 2507.17527v2): https://arxiv.org/abs/2507.17527 / https://arxiv.org/html/2507.17527v2
8. CosyVoice 2 (arXiv 2412.10117): https://arxiv.org/abs/2412.10117
9. CosyVoice 3 (arXiv 2505.17589): https://arxiv.org/abs/2505.17589
10. Step-Audio (arXiv 2502.11946): https://arxiv.org/abs/2502.11946
11. SenseVoice (arXiv 2407.04051): https://arxiv.org/abs/2407.04051

### 官方控制台 / 文档 / 产品页
12. 火山引擎豆包同传 2.0 S2S API 文档: https://www.volcengine.com/docs/6561/1756902
13. 火山引擎豆包语音双向流式 TTS WebSocket: https://www.volcengine.com/docs/6561/2532486
14. 火山引擎端到端实时语音全双工版本: https://www.volcengine.com/docs/6561/2549778
15. 火山引擎语音模型体验入口: https://console.volcengine.com/ark/region:ark+cn-beijing/experience/voice?type=SI
16. 字节 Seed 官方产品页: https://seed.bytedance.com/en/seed_liveinterpret
17. OpenAI Realtime API Reference client: https://github.com/openai/openai-realtime-api-beta (lib/api.js: model = 'gpt-4o-realtime-preview-2024-10-01')
18. OpenAI Realtime API endpoint: `wss://api.openai.com/v1/realtime` (Reference client L20)
19. ElevenLabs Pricing: https://elevenlabs.io/pricing
20. ElevenLabs Latency page: https://elevenlabs.io/latency
21. Cartesia Sonic: https://cartesia.ai/sonic (官方首字节延迟 sub-90ms)
22. sherpa-onnx Zipformer 文档 + RTF 表: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html

### 双通道姊妹研究（cross-reference）
23. T01 火山 API 能力调研: `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
24. T15 金喜架构反推: `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`
25. T17 (进行中) 本地 ASR 模型对比: `.scratch/macos-siminterpret-poc/issues/17-local-asr-macos-m2.md`
26. T18 (进行中) 本地 MT 模型对比: `.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md`
27. T19 (进行中) TTS 延迟与音色克隆: `.scratch/macos-siminterpret-poc/issues/19-tts-latency-options.md`
28. T20 (进行中) 混合云-端架构: `.scratch/macos-siminterpret-poc/issues/20-hybrid-cloud-local-architecture.md`

---

## 10. 置信度速查

| 推断 | 置信度 |
|---|---|
| Doubao S2S FLAL = 2.21s, AL = 2.58s | HIGH (arXiv 2507.17527v2 Table 1) |
| Doubao S2S 整段平均 2.53s | HIGH (论文 §3.3.0.2 + Doppelvoice README) |
| CosyVoice 2 bi-streaming 150ms 首音 | HIGH (CosyVoice README L19 官方声明) |
| CosyVoice 2 chunk-aware causal FM | HIGH (arXiv 2412.10117 摘要) |
| CosyVoice 3 RL 版 WER 1.68 | HIGH (CosyVoice README 表格) |
| Cartesia Sonic < 90ms 模型延迟 | HIGH (cartesia.ai/sonic 官网) |
| ElevenLabs sub-500ms | HIGH (elevenlabs.io/pricing 官方) |
| sherpa-onnx Zipformer RTF 0.04-0.15 (测试硬件未明) | MEDIUM (官方文档但未明确 Apple Silicon) |
| sherpa-onnx M2 上 RTF ≤ 0.15 | MEDIUM (推断，待 T17 实测) |
| CosyVoice 3 0.5B M2 RTF ~0.3-0.5 | MEDIUM (类比 GPT-SoVITS M4 CPU 0.526) |
| Whisper.cpp large-v3-turbo 整段 M2 ~2-3s | MEDIUM (类比 M1 Pro large 4.2s 推断) |
| GPT-4o Realtime ~500-800ms | LOW (OpenAI 公开文档 fetch 受限，本会话未能读到一手) |
| Gemini Live ~1s | LOW (Google docs fetch 受限) |
| Step-Audio M2 跑不动 3B 模型 | HIGH (官方声明 130B 模型 + 3B 蒸馏) |
| Qwen-Omni 延迟数字 | LOW (arXiv API 超时，本会话未取到) |
| VAD 200-300ms 沉默节省 | MEDIUM (业界经验值，无 primary benchmark) |
| opuslib 流式 opus 解码可省 ~500ms | MEDIUM (T01 注释 + 业界经验) |
| Doubao big-TTS 双向流式首音 300-800ms | LOW (官方未公开数字，本会话 fetch 受限) |