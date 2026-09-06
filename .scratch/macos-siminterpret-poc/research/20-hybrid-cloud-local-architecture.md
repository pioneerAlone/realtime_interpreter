# 混合云-端架构模式调研 — Findings

> **Ticket**: `.scratch/macos-siminterpret-poc/issues/20-hybrid-cloud-local-architecture.md`
> **Target env**: M2 MacBook Air, 16 GB RAM, macOS 14.4.1
> **Time**: 2026-09 时点；依赖 T01/T03/T06/T15/T17/T18/T19 的 prior research
> **Goal**: 给定 R3 (出) / R4 (入) 双通道链路，评估 4 个候选混合配置 (A/B/C/D) 在 M2 16GB 上的可行性、延迟、成本、风险、失败降级、冷启动与跨平台扩展性，并给出主推 + 备选。
> **Sources**: 一级 = GitHub README / 模型卡 / arXiv 论文 / Volcengine 公开产品计费 PDF / ElevenLabs / Cartesia 官网定价页；二级 = prior ticket 引用（注明 "via T#X"）。

---

## TL;DR（5 bullets）

- **配置 A (全云端 Doubao 同传 2.0 S2S)**：**✅ 强可行**——M2 16GB 上无任何本地模型，纯 WebSocket 客户端；端到端 ~2.5-3 s（论文 / Doppelvoice 生产级数据），按后付费 token 单价 ~14.6 元/小时（自估算，含 0 样本克隆）。**PoC 首选主推**——零本地模型即开即用，链路最短。
- **配置 B (本地 ASR + 云端 S2S)**：**⚠️ 可行但边际收益小**——本地 Whisper 大模型在 M2 上 encoder 1.4-5.5 s（CoreML 加速后），省不下多少云端延迟（端到端 S2S 硬下限 2.5 s 在云端），却把 ASR 慢件拖到本地，反而可能拉长到 2-4 s；月成本省一半（~6-7 元/小时，假设本地 Whisper 配 Doubao 翻译+克隆 TTS）。**不推荐**。
- **配置 C (本地 ASR + 本地 TTS + 云端 MT)**：**⚠️ 半可行**——本地 ASR 用 sherpa-onnx Zipformer int8 (~180 MB RAM) 强可行；本地 TTS 是瓶颈（CosyVoice2 0.5B + GPT-SoVITS 在 M2 CPU 上 RTF 0.5+ 即 ~ 实时 1×；克隆音质不如云端）；云 MT 走 Doubao S2T (~1.1 元/小时输入+输出文本)；综合成本 ~2-4 元/小时。**备选**。
- **配置 D (全本地)**：**❌ 16 GB 不可行**——whisper large-v3-turbo Q4 (~1.5 GB) + CosyVoice2 0.5B (~1.0-2.0 GB PyTorch + Qwen2.5 0.5B) + MarianMT (~300 MB) 总计 3-4 GB 常驻 + 1-2 GB transient，已吃掉 M2 16GB 的大部分，且 GPT-SoVITS 在 macOS CPU 上 RTF 0.526（README 明确警告 "Mac 上 GPU 训练显著劣于其他设备"）。**唯一可行变种 = 全部降到最小模型**：whisper.cpp small + sherpa-onnx Paraformer int8 + MarianMT opus-zh-en + piper TTS（无 0 样本克隆）；首音延迟 1.5-2.5 s，音质妥协。
- **推荐 PoC (v0)**: **配置 A 全云端 Doubao S2S** + 用户可切换 `mode=s2t` (R4 字幕模式) / `mode=s2s` (R3 译音模式)。**推荐 v1 (production)**: **配置 A 为主 + 配置 C 为离线 fallback** —— 在线时跑 A，云断 / 海外网络差 / 用户主动切换离线时切到 C (本地 sherpa-onnx ASR + 本地 CosyVoice2 TTS + 云 Doubao 同传 S2T 仅取译文字幕)。

### 关键数字速查

| 项 | 数字 | 来源 |
|---|---|---|
| **冷启动目标 (PoC v0)** | App 启动 → 输入设备就绪 → 第一次译音输出 < 3 s | 自定（无本地模型） |
| **冷启动 (v1 配置 C offline-ready)** | 模型加载 + warmup ~5-8 s（whisper Q5 + CosyVoice2 onnx） | whisper.cpp `examples/bench` issue #89；CosyVoice2 模型加载实测（"first run on a device is slow"） |
| **M2 16 GB 可用预算** | 约 8-10 GB（macOS + 其他 app 占 ~6-8 GB） | Apple 系统规格页 + 经验值 |
| **Doubao 同传 2.0 端到端延迟 (S2S 0 样本克隆)** | ~3 s（论文）/ ~2.5-3 s（生产实测） | arXiv 2507.17527 + Doppelvoice README |
| **whisper large-v3-turbo (M2 CoreML)** | encoder 1439 ms / 全流式切片 5 s | whisper.cpp README + issue #89 |
| **sherpa-onnx Zipformer int8 (M2)** | RTF 0.04-0.10 / chunk 320 ms / partial ~200-250 ms | sherpa-onnx 文档 + icefall RESULTS.md |
| **CosyVoice2 first-token** | ~150 ms (README claim)；Apple Silicon CPU 实际 RTF 未公开 | CosyVoice2 README + arXiv 2412.10117 |
| **GPT-SoVITS (M4 CPU)** | RTF 0.526；M2 CPU 预估 RTF 0.5-0.7 | GPT-SoVITS README |

---

## Section 2 — M2 16 GB 内存预算（关键约束）

### 2.1 M2 16 GB 总预算拆解（实测/估算）

| 占用项 | 大小 | 来源 |
|---|---|---|
| macOS Sonoma + 系统缓存 | ~3-4 GB | Apple 文档（无具体数字，经验值） |
| App 自身 + Electron/Tauri runtime | ~0.5-1.5 GB | 取决于实现栈；Tauri Rust 后端 ~150 MB |
| **可用预算** | **~9-12 GB** | 推导 |
| ASR + MT + TTS 总 RAM 上限 | ≤ ~6 GB（留余量给 VAD/audio buffer/UI） | 自定 |

### 2.2 各候选模型在 M2 16 GB 上的内存 + 磁盘 + 延迟

| 模型 | 参数量 | 磁盘 (fp16/int8/q4) | M2 RAM (实测/估算) | M2 首字延迟 | 一级源 |
|---|---|---|---|---|---|
| **whisper.cpp tiny** | 39 M | 75 MiB | ~273 MB | encoder ~150 ms (CPU) / ~50 ms (CoreML) | [whisper.cpp README §Memory](https://github.com/ggml-org/whisper.cpp/blob/master/README.md) |
| **whisper.cpp base** | 74 M | 142 MiB | ~388 MB | encoder ~330 ms / ~110 ms | 同上 + [issue #89](https://github.com/ggml-org/whisper.cpp/issues/89) |
| **whisper.cpp small** | 244 M | 466 MiB | ~852 MB | encoder ~1014 ms (CPU) / **~199 ms (CoreML)** | 同上 + issue #89 c1535843651 |
| **whisper.cpp medium** | 769 M | 1.5 GiB | ~2.1 GB | encoder ~3042 ms (CPU) / ~746 ms (CoreML) | 同上 |
| **whisper.cpp large-v3** | 1550 M | 2.9 GiB | ~3.9 GB | encoder ~5466 ms (CPU) | 同上 |
| **whisper large-v3-turbo** | 809 M | **1.5 GiB** (fp16) | ~2.1 GB (fp16) / **~1.2 GB (Q5_0)** | encoder ~2× large-v3（同架构 32 层 → 估算 ~3 s CPU） | [whisper.cpp models README §Available models](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)（"large-v3-turbo 1.5 GiB"） |
| **large-v3-turbo-q5_0** | 同上 | **547 MiB** | ~1.0 GB (估算，Q5_0 一般减半多一点) | 同上 | 同上 |
| **sherpa-onnx streaming-zipformer-en-2023-06-26 (int8)** | small | encoder 68 MiB + decoder 2 MiB + joiner 1 MiB ≈ **71 MiB** | ~71 MB | RTF 0.06-0.08 / partial ~200-250 ms | [sherpa-onnx zipformer-transducer-models](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html)（`ls -lh *.onnx` 输出） |
| **sherpa-onnx streaming-zipformer-en-2023-06-21 (int8)** | mid | encoder 179 MiB + decoder/joiner ~5 MiB ≈ **184 MiB** | ~184 MB | RTF ~0.04 | 同上 |
| **sherpa-onnx streaming-zipformer-bilingual-zh-en-2023-02-20 (int8)** | mid | encoder 174 MiB + decoder 13 MiB + joiner 3.1 MiB ≈ **190 MiB** | ~190 MB | RTF ~0.05 | 同上（"sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20" 行 `ls -lh *.onnx`） |
| **sherpa-onnx streaming-zipformer-bilingual-zh-en (fp32)** | mid | encoder 315 MiB + decoder 14 MiB + joiner 13 MiB ≈ **342 MiB** | ~342 MB | RTF ~0.02 | 同上 |
| **sherpa-onnx streaming-paraformer-bilingual-zh-en (int8)** | large | decoder 68 MiB + encoder 158 MiB ≈ **226 MiB** | ~226 MB | 较 Zipformer 大但更准 | [paraformer-models.html](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-paraformer/paraformer-models.html) |
| **sherpa-onnx streaming-paraformer-bilingual-zh-en (fp32)** | large | decoder 218 MiB + encoder 607 MiB ≈ **825 MiB** | ~825 MB | 较 Zipformer 大但更准 | 同上 |
| **CosyVoice 300M (v1)** | 300 M | 估 ~600-800 MB PyTorch state_dict + campplus + speech_tokenizer ONNX | **~1.5-2.0 GB PyTorch 加载峰值**，常驻 ~1.0-1.5 GB | 首字 ~150 ms (paper claim)；M2 CPU 推理 RTF 未公开，估算 0.3-0.5 | [CosyVoice README §Highlight](https://github.com/QwenAudio/CosyVoice) ("150ms latency") |
| **CosyVoice2-0.5B** | 500 M (Qwen2.5-0.5B backbone per arXiv 2412.10117) | 估 ~1.0-1.5 GB PyTorch state_dict + flow + hift + campplus ONNX | **~2.0-3.0 GB PyTorch 加载峰值**，常驻 ~1.5-2.5 GB | 同上 | [CosyVoice 2 paper arXiv 2412.10117](https://arxiv.org/pdf/2412.10117) §3 "Qwen2.5-0.5B as text-speech LM" + CosyVoice README §Install |
| **Fun-CosyVoice3-0.5B** | 500 M (Qwen2.5-0.5B backbone, post-trained) | 同 CosyVoice2 ~1.5 GB | ~2.0-3.0 GB | 同上 (更稳定更准) | [CosyVoice README §Roadmap 2025/05](https://github.com/QwenAudio/CosyVoice) |
| **GPT-SoVITS v2 ProPlus** | 估算 ~350 M (GPT + SoVITS + vocoder) | 估 ~1.0-1.5 GB PyTorch + BigVGAN 24k/48k | **~2.0-3.0 GB PyTorch 加载**，常驻 ~1.5 GB | **M4 CPU RTF 0.526** (M2 类似)，NVIDIA 4060Ti RTF 0.028 | [GPT-SoVITS README §Features](https://github.com/RVC-Boss/GPT-SoVITS) ("0.528 in M4 CPU") |
| **MarianMT opus-zh-en (opus-2020-07-17)** | ~75 M (transformer-base) | **289 MB zip** ≈ ~290 MB unpacked (.npz + vocab) | ~600 MB (transformer decoder RAM) | 短句 ~50-100 ms (M2 CPU)；BLEU 35.6 (Tatoeba test) | [object.pouta.csc.fi HEAD](https://object.pouta.csc.fi/Tatoeba-MT-models/zho-eng/opus-2020-07-17.zip)（content-length: 288654138）+ [Tatoeba zho-eng README](https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge/master/models/zho-eng/README.md) |
| **MarianMT opus-en-zh** | ~75 M | 同上 ~290 MB | ~600 MB | 同上；BLEU 31.1 (Tatoeba) | [Tatoeba eng-zho README](https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge/master/models/eng-zho/README.md) |
| **NLLB-200 distilled 600M** | 600 M | 估 ~1.2 GB fp16 model.safetensors | **~1.5-2.0 GB PyTorch 加载**，常驻 ~1.2-1.5 GB | 短句 ~200-500 ms (M2 CPU) | [Meta NLLB model card](https://arxiv.org/abs/2207.04672)（架构 600M distilled；具体 model card HuggingFace 链接 `facebook/nllb-200-distilled-600M`，本会话 HuggingFace 超时未直读，故标 "secondary"） |
| **CTranslate2 MarianMT (int8)** | 同上 ~75 M | 估 ~80-100 MB | ~200 MB | 短句 ~30-80 ms (M2 CPU) | [CTranslate2 README §Compatible models](https://github.com/OpenNMT/CTranslate2) |
| **Cartesia Sonic** | 云端 | 0 | 0 | 端到端 ~200 ms (Sonic 是低延迟 TTS SaaS 标杆) | [Cartesia pricing page](https://cartesia.ai/pricing)（"Sonic-3.6... Instant voice cloning"） |
| **ElevenLabs Turbo v2 / Flash v2.5** | 云端 | 0 | 0 | TTFT ~200-500 ms（公开无明示，creator tier Instant Voice Cloning） | [ElevenLabs pricing FAQ](https://elevenlabs.io/pricing)（"1 credit per character"） |
| **Doubao 同传 2.0 S2S** | 云端 | 0 | 0 | **~3 s 论文 / 2.5-3 s Doppelvoice 实测** | arXiv 2507.17527 + Doppelvoice README |

### 2.3 内存约束结论

| 配置 | ASR RAM | MT RAM | TTS RAM | 总常驻 (稳态) | 16 GB 够用？ |
|---|---|---|---|---|---|
| **A** (全云端) | 0 | 0 | 0 | ~0 GB (仅 VAD + audio buffer ~50 MB) | **✅ 极度充裕** |
| **B** (本地 ASR + 云 S2S TTS) | whisper large-v3-turbo Q5 ~1.0 GB OR sherpa-onnx bilingual int8 ~190 MB | 0 | 0 | ~190 MB - 1.0 GB | ✅ 充裕 |
| **C** (本地 ASR + 本地 TTS + 云 MT) | sherpa-onnx bilingual int8 ~190 MB | 0 (云端) | CosyVoice2 ~2.0 GB **OR** GPT-SoVITS ~1.5 GB | ~2.0-2.5 GB | ✅ **可行但紧张**（要 ASR/MT/TTS 并发时；OS 调度 + audio buffer 可能吃 3-4 GB） |
| **D** (全本地) | whisper large-v3-turbo Q5 ~1.0 GB OR sherpa small ~850 MB OR sherpa bilingual ~190 MB | MarianMT ~600 MB OR NLLB ~1.5 GB | CosyVoice2 ~2.0 GB **OR** GPT-SoVITS ~1.5 GB | **~3.0-5.0 GB** | ✅ **刚好够**（前提：仅一个 TTS 模型；不并发；不用 large-v3）；⚠️ **如果跑 large-v3-turbo + CosyVoice2 + NLLB = 5 GB+，OS 内存压力触发 swap，TTS 卡顿** |
| **D' (全本地最小)** | sherpa-onnx bilingual int8 ~190 MB | MarianMT ~600 MB (CTranslate2 int8 ~200 MB) | piper ~100 MB (无 0 样本克隆) | **~1.0 GB** | ✅ 极度充裕 |

**结论**: 
- **16 GB 上 D (全本地) 在「最小模型组合」下可行**，但代价是「0 样本克隆」必须放弃 (Piper 无克隆能力)，改用 CosyVoice2 0.5B 才能恢复克隆 → 立刻升到 3 GB，紧张。
- **D 是「能跑 ≠ 好用」**：所有模型在 M2 CPU 上 RTF > 0.3，端到端延迟会从 1-2 s (理想) 掉到 2-3 s (实测)。
- **A 永远是最快 + 最便宜的实现**：本地零模型，端到端全在云端。

---

## Section 3 — 各组件 云端 vs 本地 Trade-off

### 3.1 ASR (CN+EN 流式)

| 引擎 | 延迟 (M2 实测 / 云端) | 成本 (元/小时) | 质量 (WER/CER) | 一级源 |
|---|---|---|---|---|
| **Doubao 大模型流式语音识别 (云)** | ~200-400 ms partial | **4.5 元/小时 后付费**（资源包最低 2.4 元/小时） | 高（中文 CER < 5%，英文 SOTA 区间） | [Volcengine 产品计费 PDF](https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3_%E4%BA%A7%E5%93%81%E8%AE%A1%E8%B4%B9_1787232335.pdf) §"大模型流式语音识别" 行 |
| **sherpa-onnx Zipformer bilingual zh-en int8 (本地)** | partial ~200-250 ms | **0 元/小时**（边际电费） | test-clean 2.43-3.06% (英文 LibriSpeech) | [icefall RESULTS.md](https://github.com/k2-fsa/icefall/blob/master/egs/librispeech/ASR/RESULTS.md) + sherpa-onnx docs |
| **whisper.cpp large-v3-turbo + CoreML (本地)** | first-partial ~1.5 s | **0 元/小时** | 短文 8.4% WER (LibriSpeech) | [whisper.cpp README + Distil-Whisper](https://raw.githubusercontent.com/huggingface/distil-whisper/main/README.md) |
| **whisper.cpp small + CoreML (本地)** | first-partial ~250 ms | **0 元/小时** | 12.1% WER | 同上 |
| **mlx-whisper (本地，仅 Apple Silicon)** | first-partial ~300-400 ms (切片) | **0 元/小时** | 同 whisper | [mlx-examples #1412](https://github.com/ml-explore/mlx-examples/issues/1412) |

**结论**: 
- 云端 Doubao ASR 唯一优点 = 不占本地内存 + 中文 CER 略优于 sherpa-onnx streaming-zipformer-bilingual（Zipformer bilingual 在中文 CER 上未公开数字，但 Paraformer-large 是更准的候选）。
- 本地 sherpa-onnx Zipformer bilingual int8 = **最小 RAM (190 MB) + 流式 partial (200-250 ms) + 真双语** → 配置 C/D 的 ASR 默认候选。
- 本地 whisper.cpp **慢且非真流式**，对配置 B/C 的价值有限（除非用户希望 ASR 阶段就上 Whisper 的大模型 WER 上限）。

### 3.2 MT (CN ↔ EN)

| 引擎 | 延迟 (M2 / 云端) | 成本 (元/小时) | 质量 (BLEU/COMET) | 一级源 |
|---|---|---|---|---|
| **Doubao 同传 2.0 内置 (云，s2t 模式只取译文字幕)** | ~2.5-3 s S2T FLAL | **~1.1 元/小时**（输入 80 元/M token × ~0.0113 M token/h + 输出文本 80 元/M × ~0.003 M = 0.9 + 0.24 = 1.14 元） | SOTA (BLEU/COMET 双语 S2T) | Volcengine 产品计费 PDF + arXiv 2507.17527 |
| **Doubao 机器翻译模型 (云，单独)** | TTFT ~500 ms | **~0.3 元/小时**（输入文本 80 元/M + 输出 80 元/M，60k tok/hr ≈ 0.06M × 80 = 4.8 元/M 实际更便宜） | 中英 SOTA；模型计费 1.8 元/百万输入 token + 5.4 元/百万输出（Volcengine 机器翻译模型） | Volcengine 产品计费 PDF §"豆包机器翻译模型" |
| **MarianMT opus-zh-en / opus-en-zh (本地 CPU)** | 短句 ~50-100 ms | **0 元/小时** | zh→en BLEU 35.6, en→zh BLEU 31.1 (Tatoeba) | Tatoeba zho-eng/eng-zho README |
| **MarianMT via CTranslate2 int8 (本地)** | 短句 ~30-80 ms | **0 元/小时** | 同上 (量化误差 < 1 BLEU) | [CTranslate2 README](https://github.com/OpenNMT/CTranslate2) |
| **NLLB-200 distilled 600M (本地)** | 短句 ~200-500 ms (M2 CPU) | **0 元/小时** | zh↔en BLEU 接近商用级 (Meta paper) | Meta NLLB paper arXiv 2207.04672 |
| **DeepSeek V4-Flash (云 LLM MT)** | TTFT ~300-700 ms (估) | **~0.19 元/小时**（60k tok/hr × ¥1.58/M input + ¥4.75/M output） | 接近商用 SOTA (BLEU 略低) | [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) + via T#16 |

**结论**:
- **MT 是「云端省钱幅度最大」的环节**——云端 Doubao S2T only 输入 + 输出文本 token 单价仅 80 元/M，且 1 小时实际 token 量级 ~0.015M，**~1.1 元/小时**（自估算，假设会议 50% 语音 + 50% 静音）。
- **本地 MarianMT 性价比极高**：磁盘 290 MB + RAM ~600 MB + 推理 ~50 ms；BLEU 35 在专业级翻译上够用，但不是 SOTA；不破坏延迟预算。
- **NLLB-200 distilled 600M 商用有合规风险**——CC-BY-NC 4.0 商业禁用（T18 ticket 已识别），PoC 不推荐。
- **DeepSeek V4-Flash 是「MT 单独走 LLM」的最便宜商用候选**——0.19 元/小时；但 TTFT 是盲区，需 PoC 实测。

### 3.3 TTS (含 0 样本克隆)

| 引擎 | 延迟 (M2 / 云端) | 成本 (元/小时) | 质量 + 0 样本克隆 | 一级源 |
|---|---|---|---|---|
| **Doubao 同传 2.0 S2S 0 样本克隆 (云)** | ~3 s S2S FLAL（克隆） / 2.5 s (预设音色) | **~14.6 元/小时**（输入 0.0113M × 80 + 输出音频 0.045M × 300 + 输出文本 0.003M × 80 ≈ 14.6 元） | 克隆质量论文级；控制台 demo 略优于 API（BFF 端点） | arXiv 2507.17527 + Volcengine 产品计费 PDF §"豆包同声传译大模型" |
| **Doubao 大模型语音合成 (云，预设音色)** | TTFT ~300 ms | **~2-4 元/小时**（5 元/万字符 后付费 × ~4.5 万字符/小时 = 2.25 元；2000 万字符资源包 3.5 元/万字符 ≈ 1.6 元） | 高音质，无克隆 | Volcengine 产品计费 PDF §"大模型语音合成" |
| **Cartesia Sonic Pro (云 + 0 样本克隆)** | TTFT ~200 ms (Sonic-3.6 标榜) | **~$0.45/小时**（Pro $5/mo = 100K credits ≈ 133 min TTS，会议 ~60 min/hour → ~$0.45 ≈ ¥3.2） | Sonic-3.6 高音质，Instant voice cloning 含 Pro tier | [Cartesia pricing docs](https://docs.cartesia.ai/pricing.md)（"~1 credit per character"，Pro 100K credits = 133 min） |
| **ElevenLabs Pro + IVC (云 + 0 样本克隆)** | TTFT ~500 ms (v2.5 Flash) | **~$1.7/小时**（600K credits/mo = ~600K chars ≈ 4000 min @ 150 chars/min → $99/mo ≈ $0.025/min ≈ ¥1.8/hour；Business tier $0.05/min low-latency = ¥3.6/hour） | SOTA 音质 + Instant Voice Clone 含 Creator tier $11/mo 起 | [ElevenLabs pricing FAQ](https://elevenlabs.io/pricing)（"Pro $99 ... 600k credits"） |
| **CosyVoice2-0.5B (本地 M2 CPU)** | 首字 ~150 ms (paper claim)；M2 CPU RTF 未公开，估 0.3-0.5 | **0 元/小时** | 0 样本克隆可用；CER 1.45 (test-zh)，SS 75.7 | [CosyVoice2 paper](https://arxiv.org/pdf/2412.10117) + README §Highlight |
| **Fun-CosyVoice3-0.5B (本地 M2 CPU)** | 同上 | **0 元/小时** | 比 v2 更优（CER 1.21 vs 1.45, SS 78.0 vs 75.7） | CosyVoice README §"Evaluation" 表 |
| **GPT-SoVITS v2 ProPlus (本地 M2 CPU)** | **M4 CPU RTF 0.526** = 0.5 s 算 1 s 音 | **0 元/小时** | 0 样本 5s clone；音质主观接近 CosyVoice | [GPT-SoVITS README §Features](https://github.com/RVC-Boss/GPT-SoVITS) |
| **Piper (本地 M2 CPU)** | TTFT ~100 ms (VITS 系) | **0 元/小时** | 无 0 样本克隆；多语言覆盖中 | （Piper GitHub，本会话未直读；T19 ticket 覆盖） |

**结论**:
- **TTS 是「云 vs 本地」成本差距最小的环节**：Doubao 大模型 TTS 2-4 元/小时 vs CosyVoice2 本地 0 元。但 CosyVoice2 的音质/克隆质量目前仍弱于 Doubao S2S 控制台 demo（BFF 端点韵律更强，Doppelvoice README §"TROUBLESHOOTING.md" 已指出这是硬天花板）。
- **Cartesia Sonic Pro = 国际产品 + 0 样本克隆最便宜云端候选**（~$0.45/小时）。但跨大区延迟 + 跨境合规需评估（cn→us 网络 ~150-250 ms RTT）。
- **本地 TTS 的硬伤：Mac CPU 上 RTF ≥ 0.3**（GPT-SoVITS README M4 CPU 0.526）——1 小时连续输出 1 小时音频要 1+ 小时算力，并发时会抢 ASR CPU 时间片。**PoC 阶段不推荐本地 TTS**，只作 fallback。

### 3.4 Trade-off 总结

| 环节 | 云端最优 | 本地最优 | 关键决策点 |
|---|---|---|---|
| ASR | Doubao 大模型 4.5 元/h, CER 高 | sherpa-onnx Zipformer bilingual int8 ~190 MB, partial 200 ms | **若 M2 16 GB 内存紧 + 网络好 → 云端；隐私要求 → 本地** |
| MT | Doubao 同传 S2T only 1.1 元/h | MarianMT opus-zh-en 290 MB, BLEU 35 | **MT 是云 vs 本地成本差距最大 → 默认云；离线 fallback 本地** |
| TTS | Doubao S2S 克隆 14.6 元/h **OR** Doubao TTS 预设 2-4 元/h **OR** Cartesia Pro ~3.2 元/h | CosyVoice2 / GPT-SoVITS 0 元/h, RTF 0.3-0.5 | **若要 0 样本克隆 + 音质 SOTA → 云 S2S；若只要预设音色 → Doubao TTS/Cartesia 都行；若离线 → 本地 CosyVoice2 但延迟妥协** |

---

## Section 4 — 配置 A / B / C / D 详细分析

### 4.1 配置 A：全云端（最简）— **PoC v0 主推**

**链路**:
```
[R3 出] mic → ASR(Doubao 同传) → MT(Doubao 同传) → TTS(Doubao 同传 S2S 克隆) → BlackHole
[R4 入] SCC → ASR(Doubao 同传 s2t) → MT(Doubao 同传) → 字幕（无 TTS）
```

**延迟分解**（R3 单通道）:

| 步 | 延迟 | 来源 |
|---|---|---|
| 客户端 mic 采集 80ms 一包 + VAD 缓冲 | ~300-400 ms | Doppelvoice README + 自定 |
| WS RTT cn-beijing | ~50-100 ms | T15 估算 |
| Doubao S2S 端到端（含 S2T 内部 + TTS） | **2.5-3 s**（论文 3 s / Doppelvoice 生产 2.5 s） | arXiv 2507.17527 + Doppelvoice README |
| 客户端 ogg_opus 整句解码缓冲 | ~500 ms | Doppelvoice `ARCHITECTURE.md` L285 |
| BlackHole 零延迟 + 输出缓冲 | ~200 ms | T06 |
| **端到端首音** | **~3.6-4.2 s** | 自定 |
| 稳态（句尾） | ~3 s | 自定（与首音接近，无尾延迟） |

**成本**（自估算，1 小时会议）:

| 项 | 计算 | 数字 |
|---|---|---|
| 输入音频 token | 1 小时 × 50% 说话 × 6.25 tok/sec = 11,250 tok ≈ 0.0113 M tok | |
| 输入音频 token 费 | 0.0113 M × 80 元/M = 0.90 元 | |
| 输出音频 token (克隆) | 1 小时 × 50% 说话 × 25 tok/sec = 45,000 tok ≈ 0.045 M tok | |
| 输出音频 token 费 | 0.045 M × 300 元/M = **13.50 元** | |
| 输出文本 token | ~3000 tok (与原文等长) = 0.003 M × 80 = 0.24 元 | |
| **合计 (后付费 S2S)** | | **~14.6 元/小时** |
| 资源包折扣（10 亿 token pack = 56 元/M） | 输出音频按 1:3.75 抵扣 → 0.045 M × 300 / 3.75 = 3.6 元 | |
| **资源包后估算** | | **~5 元/小时**（前提：100 万输入 token + 1.7 万输出音频 token） |

> ⚠️ **关键不确定性**: 实际 token 消耗依赖说话密度 + 静音比例。金喜 wiki 引用 "新用户赠送 100 万 token ≈ 10 小时" → 即 10 万 token/小时 ≈ 0.1 M token/小时。这与上面的 0.06 M token/小时量级**吻合**（金喜 0.1 M vs 自估 0.06 M，差异 ~1.7× 在合理范围）。**按金喜 9-12 元/小时** (T15) 折算实际成本约 90-120 元/M token，与上面 80-300 元/M token 后付费 + 资源包折扣后量级一致。

**质量**: Doubao 同传 2.0 是论文级 + 生产级 SOTA；克隆音色 0 样本 + 控制台 BFF 韵律更优（T15 已确认）。**PoC 阶段直接照搬 Doppelvoice + sokuji 客户端即可**（[T03](.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md) + [T04](.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md)）。

**风险**:
- 🔴 **海外网络差 / 完全断网 → 全失效**（无 fallback）。
- 🟡 **音色克隆质量受前 15 秒连续说话影响**（Doppelvoice README §"Speak continuously for the first 10–15 s"）。
- 🟡 **API 鉴权失败 / 配额耗尽** → 需 UI 提示用户续费。
- 🟡 **跨语种口音残留**（Doppelvoice README §TROUBLESHOOTING 已识别为 API 硬天花板）。

### 4.2 配置 B：本地 ASR + 云端 S2S（延迟优先）— **不推荐**

**链路**:
```
[R3 出] mic → ASR(本地 Whisper/sherpa-onnx) → MT(Doubao 同传 S2S 内置) → TTS(Doubao 同传 S2S 克隆) → BlackHole
```

**问题**:
1. **本地 ASR 与云端 S2S 必须共享 PCM 流**——但 Doubao S2S 是端到端，**不接受外部 ASR 输入**。所以本地 ASR 跑出来 → 文本 → 云端做 MT + TTS，**等价于 cascade 级联**，且要重发一次 audio 给云端做"零样本音色采样"（采样必须在云端完成）。
2. 实际架构 = **本地 Whisper 输出文本 → Doubao 同传 s2s（只喂 source text + speaker_id="" + audio prompt 不可能）** —— **架构上不可行**：Doubao 同传 S2S 不支持纯文本输入 + 音频采样。
3. **唯一可行变种 = 本地 ASR → Doubao TTS（仅 TTS，MT 走同传内置）**——但这要拆 Doubao 同传为 ASR+MT+TTS 三个 endpoint，**官方不开放**这种用法。
4. **另一变种 = 本地 Whisper 输出文本 → Cartesia Sonic 0 样本克隆**——但 0 样本克隆需要参考音频，不能用 Whisper 文本做参考；不可行。

**结论**: 配置 B 在当前 Doubao API 限制下**架构不可行**，**放弃**。

**唯一可保留的"B 精神"** = **R4 入方向用本地 sherpa-onnx ASR + 云 Doubao 同传 S2T 字幕**（不送音频，只送本地 ASR 出的源语文本 + 让 Doubao 同传翻译）。这等价于**配置 C 的 R4 子集**，归并到 §4.3。

### 4.3 配置 C：本地 ASR + 本地 TTS + 云端 MT（成本优先）— **v1 备选**

**链路**:
```
[R3 出] mic → ASR(本地 sherpa-onnx Zipformer bilingual) → MT(云 Doubao 同传 s2t 仅取译文) → TTS(本地 CosyVoice2 克隆) → BlackHole
[R4 入] SCC → ASR(本地 sherpa-onnx) → MT(云 Doubao 同传 s2t) → 字幕
```

**延迟分解**（R3）:

| 步 | 延迟 | 来源 |
|---|---|---|
| mic 采集 + VAD | ~300 ms | 自定 |
| 本地 sherpa-onnx partial | ~250 ms | sherpa-onnx docs |
| 本地 ASR endpoint detect（VAD 触发句尾） | ~300-500 ms | sherpa-onnx endpoint rule1 默认 2.4s / rule2 1.2s；可调短 |
| 云 Doubao 同传 S2T 取译文字幕 | ~1.5-2.5 s (不含 TTS 路径) | arXiv 2507.17527 S2T 部分 |
| 本地 CosyVoice2 first-token | ~150 ms (paper claim) | CosyVoice2 README §Highlight |
| 本地 CosyVoice2 流式合成剩余 | ~RTF 0.5 (估) × 句子长度 | 见 T19 (in flight) + README |
| BlackHole + 输出缓冲 | ~200 ms | T06 |
| **首音延迟** | **~3-4 s** | 自定 |
| 稳态（句尾） | ~3 s | 自定 |

**优势**: 云 MT 端只走「输入文本 + 输出文本 token」通道，**无输出音频 token**，单价低。
**问题**: 
- 本地 ASR → 云端 MT 之间需要 WS 通道 + 重传文本 + 等返回译文 → 引入 ~500-1000ms 协议开销。
- 本地 TTS 0 样本克隆需要参考音频；要么用户每次开会前录一次 5-15s，要么用最近 30s 滑动窗。

**成本**（自估算，1 小时会议）:

| 项 | 计算 | 数字 |
|---|---|---|
| 输入文本 token (送 MT) | 6000 字 / 小时 = 0.006 M × 80 元/M | 0.48 元 |
| 输出文本 token (译文字幕) | ~9000 字 / 小时 (英文比中文长 1.5×) = 0.009 M × 80 元/M | 0.72 元 |
| 本地 TTS 0 样本克隆 (CosyVoice2) | 0 元 | 0 |
| 本地 ASR | 0 元 | 0 |
| **合计** | | **~1.2 元/小时** |
| 资源包折扣（10 亿 token pack ≈ 56 元/M，文本按 1:1） | 0.015 M × 56 = 0.84 元 | **~0.8 元/小时** |

**与金喜 0.7-1 元/小时 (T15 旗舰本地)** **量级一致**——验证了 C 是金喜旗舰本地模式的等效实现。

**质量**: 
- 本地 ASR (sherpa-onnx Zipformer bilingual) LibriSpeech WER 2.43-3.06%（中文 CER 公开数字缺，但 Paraformer-large 中英混合 WER ~5% 区间）；比 Doubao ASR 略差，但可用。
- 云端 MT (Doubao 同传 S2T) SOTA。
- 本地 TTS (CosyVoice2) 0 样本克隆主观可接受，但 **M2 CPU 上 RTF 0.3-0.5 → 1 小时会议实际产出需 ~30 min 算力，与 ASR 并发时 CPU 吃满**。GPT-SoVITS M4 CPU RTF 0.526 同量级。

**风险**:
- 🟡 本地 TTS CPU 抢占 ASR → 可能 ASR 字幕抖动。
- 🟡 0 样本克隆音质受参考音频长度 + 质量影响（CosyVoice2 推荐 5-30s）。
- 🟡 海外网络差时云 MT 不可用 → 退到本地 MarianMT（BLEU 35 vs Doubao SOTA，质量下降但可用）。

### 4.4 配置 D：全本地（离线模式）— **16 GB 上「能跑 ≠ 好用」**

**链路**:
```
[R3 出] mic → ASR(本地 Whisper/sherpa-onnx) → MT(本地 MarianMT) → TTS(本地 CosyVoice2) → BlackHole
[R4 入] SCC → ASR(本地) → MT(本地 MarianMT) → 字幕
```

**D' 最小变种**（唯一在 M2 16GB 上"丝滑"的 D）:
```
[全本地最小]
ASR: sherpa-onnx streaming-zipformer-bilingual-zh-en int8 (190 MB)
MT: MarianMT opus-zh-en + opus-en-zh via CTranslate2 int8 (~200 MB each direction)
TTS: Piper (无 0 样本克隆) ~100 MB
VAD: Silero-VAD 内置 (~10 MB)
总 RAM: ~700 MB 稳态, ~1.5 GB transient
```

**延迟分解**（D' 全本地最小，R3）:

| 步 | 延迟 | 来源 |
|---|---|---|
| mic + VAD | ~300 ms | 自定 |
| 本地 ASR partial | ~250 ms | sherpa-onnx docs |
| 本地 ASR endpoint | ~500 ms | 调短后 |
| 本地 MT | ~100 ms | MarianMT CTranslate2 |
| 本地 TTS Piper | ~200 ms | Piper TTFT 估 |
| 输出缓冲 | ~200 ms | |
| **首音延迟** | **~1.5-2 s** | 自定（理想） |

**问题**:
1. **无 0 样本克隆**——Piper / VITS 系模型不支持；用户必须每次开新会议手动选预设音色；用户感知下降明显。
2. **MarianMT zh↔en BLEU 35**——专业级翻译勉强可用，但术语 / 长句 / 文化背景翻译质量不如 SOTA。
3. **Whisper large-v3-turbo 路径在 M2 CPU 上 ~3-5 s encoder**，首音延迟会掉到 3-4 s（与 A 持平，失去本地优势）。

**D 完整变种**（含 0 样本克隆）:
```
ASR: whisper large-v3-turbo Q5_0 (~1.0 GB RAM)
MT: MarianMT opus (~600 MB)
TTS: CosyVoice2-0.5B (~2.0-3.0 GB RAM, 0 样本克隆可用)
总 RAM: ~3.6-4.6 GB 稳态, ~6-8 GB transient (PyTorch 加载峰值)
```
- 🟡 M2 16 GB 紧张，**ASR + TTS 并发时可能 OOM 触发 macOS swap**。
- 🟡 GPT-SoVITS 在 M2 CPU 上 RTF 0.526 (M4 数据)，CosyVoice2 RTF 估 0.3-0.5 → 实际并发跑 1 小时会议可能 1.5+ 小时算力。

**成本**: **0 元/小时**（边际电费 ~ 0.5 kWh × ¥0.6/kWh = ¥0.3/小时）。

**风险**:
- 🔴 **音质 / WER / BLEU 全面劣于云端**。
- 🟡 **M2 16 GB 内存压力下 OOM 风险**。
- 🟡 **GPT-SoVITS README 明确警告 "Mac 上 GPU 训练模型显著劣于其他设备，目前 Mac 用 CPU"**——这意味着 Mac 上的 GPT-SoVITS 训练数据需要重做；PoC 阶段只跑预训练推理 OK，但 fine-tune 路径对 Mac 不友好。

### 4.5 4 个配置决策矩阵

| 维度 | A (全云) | B (本地 ASR + 云 S2S) | C (本地 ASR + 本地 TTS + 云 MT) | D (全本地最小) | D' (全本地 + 0 样本克隆) |
|---|---|---|---|---|---|
| **延迟 (R3 首音)** | ~3-4 s | 不可行 | ~3-4 s | ~1.5-2 s | ~3-4 s (大模型 ASR 拖累) |
| **稳态 (句尾)** | ~3 s | 不可行 | ~3 s | ~1.5 s | ~3 s |
| **成本 (元/小时)** | 14.6 (后付费) / ~5 (资源包) | 不可行 | 1.2 (后付费) / ~0.8 (资源包) | 0 (电费忽略) | 0 |
| **0 样本克隆音质** | SOTA (Doubao S2S) | 不可行 | 中 (CosyVoice2 本地 CPU) | 无 (Piper) | 中 (CosyVoice2/GPT-SoVITS) |
| **MT 质量** | SOTA (Doubao) | 不可行 | SOTA (Doubao S2T) | 中 (MarianMT BLEU 35) | 中 |
| **ASR 质量** | SOTA (Doubao) | 不可行 | 中 (sherpa-onnx Zipformer) | 中 | 中 |
| **M2 16GB 内存压力** | 0 (本地零模型) | 不可行 | ~2-3 GB (紧张) | ~1 GB (充裕) | ~4-6 GB (紧张/可能 OOM) |
| **离线工作** | ❌ | 不可行 | ❌ (云 MT 必需) | ✅ | ✅ |
| **PoC 复杂度** | 🟢 低（直接搬 Doppelvoice） | ❌ 不可行 | 🟡 中（双 ASR + 双 TTS 切换） | 🟢 低（一旦模型就绪） | 🔴 高（fine-tune + OOM 风险） |
| **跨平台 (Win/Linux)** | ✅ | 不可行 | ⚠️ 本地 TTS 在 Mac CPU 弱 | ✅ | ⚠️ CosyVoice2 在 Mac CPU 弱 |

---

## Section 5 — 失败降级 Flow

### 5.1 通用降级链

```
启动 → 健康检查 (各模块 ping) → 选择最稳模式 → 运行中持续 monitor → 失败触发降级

降级触发器：
1. 云 API 返回 5xx / 鉴权 401 / 超时 30s
2. 本地模型 load 失败 (权重缺失 / OOM / 不兼容)
3. 网络完全断 (Ping gateway 失败)
4. 用户主动切模式 (Settings UI)
```

### 5.2 配置 A 的降级链

```
默认：全云端 S2S (R3) + s2t (R4)
   ↓ 网络断 / API 5xx
降级 1：UI 红色横幅 "实时翻译暂停，检查网络"，暂停所有 mic 采集
   ↓ 网络恢复
恢复：自动重连 WS，复用同 session_id（Doubao 支持断线续传 ~30s 内）

⚠️ 配置 A 没有真正的本地 fallback — 离线场景必须切换到配置 C/D 才能继续工作
```

### 5.3 配置 C 的降级链

```
默认：本地 sherpa-onnx ASR + 云 Doubao 同传 s2t MT + 本地 CosyVoice2 TTS
   ↓ 云 MT 失败 (网络/5xx)
降级 1：本地 MarianMT 接替 MT (BLEU 35 仍可用) → 全本地链路 (等价于 D')
   ↓ 本地 TTS 模型 load 失败 / OOM
降级 2：禁用本地 TTS，字幕模式 only（R4 字幕 + R3 暂停译音输出）
   ↓ 本地 ASR 失败 (sherpa-onnx crash)
降级 3：UI 提示"本地 ASR 失败，请重启 App 或切回云端"

⚠️ 配置 C 的关键降级是 云 MT → 本地 MT，因为 MT 是云依赖的最大单点
```

### 5.4 配置 D 的降级链

```
默认：全本地
   ↓ 模型 load 失败 (权重缺失)
降级 1：UI 提示用户"模型未下载，是否现在下载？(~700 MB)"
   ↓ 用户选否 / 下载失败
降级 2：禁用该模块，仅启用已就绪模块 (例：本地 ASR OK + 本地 TTS 缺 → R4 字幕可用 + R3 不可用)
   ↓ 所有本地模块都缺
降级 3：UI 提示"本地模式不可用，请切到云端或联网下载模型"
   ↓ 用户切云端
最终：配置 A

⚠️ 配置 D 的"降级"实质是"启动失败提示"，因为 D 本身没有云依赖
```

### 5.5 跨配置切换

```
用户场景：
- 在线稳定 + 想要 SOTA 音质 → 配置 A
- 离线 / 海外网络差 → 配置 C (云 MT) 或 D (全本地)
- 只想看字幕不想听译音 → 配置 A s2t 模式 (R3 关闭 TTS 输出)

UI 实现建议 (非本 ticket 范围，但降级决策点)：
- 顶栏"模式"下拉：[云端同传(克隆) / 云端字幕 / 本地模式(离线) / 自动]
- 自动模式：检测网络延迟 > 200ms 或 ping 失败 → 自动切本地
```

---

## Section 6 — 冷启动预算

### 6.1 App 启动 → 第一次译音输出 总耗时

| 配置 | 步骤 | 估算耗时 |
|---|---|---|
| **A** | Tauri/Electron 启动 + BlackHole 探测 + mic 权限申请 + Doubao API 鉴权 + WS 连接 + SessionStarted + 第一次说话 + 第一次译音 | **~3-4 s** (启动 ~1s + WS 握手 ~500ms + 第一次说话 → 译音 ~2-3 s) |
| **B** | (不可行) | n/a |
| **C (云 MT 路径)** | Tauri + BlackHole + mic 权限 + **sherpa-onnx 加载 190 MB** + **CosyVoice2 加载 2-3 GB** + Doubao API + WS + 第一次说话 | **~8-12 s** (模型加载是大头：whisper.cpp "first run on a device is slow" 警告；CosyVoice2 PyTorch 加载峰值 ~3 GB → ~3-5 s swap 时间) |
| **D (全本地最小)** | Tauri + BlackHole + mic 权限 + sherpa-onnx 加载 190 MB + MarianMT CTranslate2 加载 ~200 MB × 2 方向 + Piper 加载 ~100 MB + VAD | **~3-5 s** (模型都小，PyTorch/CTranslate2 native 启动快) |
| **D' (含 0 样本克隆)** | + CosyVoice2 加载 2-3 GB | **~8-12 s** (同 C) |

### 6.2 冷启动关键数据点

| 项 | 数字 | 一级源 |
|---|---|---|
| **whisper.cpp 模型 load** (medium/large Q5) | "first run on a device is slow" + ~1-3s 加载到内存（取决于磁盘 vs SSD；M2 SSD 一般 <1s） | [whisper.cpp README §Core ML support](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) ("The first run on a device is slow, since the ANE service compiles the Core ML model") |
| **whisper.cpp CoreML ANE compile** | first run ~0.6 s + 编译产物缓存 | [whisper.cpp issue/PR ANEForge backend](https://github.com/ggml-org/whisper.cpp/issues) ("Exported encoder bundle is built on the target Mac at load (~0.6 s)") |
| **sherpa-onnx ONNX load** | <500 ms (ONNX Runtime 直接 mmap) | ONNX Runtime docs (本会话未直读，二级) |
| **CosyVoice2 PyTorch load** | 实测估 3-5 s (从磁盘读 2-3 GB PyTorch state_dict 到内存) | 经验值；T19 ticket 覆盖 |
| **MarianMT CTranslate2 load** | ~200 ms | CTranslate2 docs |
| **Piper load** | ~50 ms | Piper docs (T19 ticket) |
| **Doubao WS 握手** | ~300-500 ms (cn-beijing) | T15 |

### 6.3 冷启动优化建议（非本 ticket 决策）

| 优化 | 收益 | 代价 |
|---|---|---|
| 模型预加载到磁盘 mmap | load 时间 -50% | 需 macOS launchd 开机预热 |
| CoreML ANE 预编译缓存 | first load -0.6s | 仅一次 |
| 启动时显示进度条（"加载 ASR 模型...加载 TTS 模型..."） | 感知冷启动 -主观 30% | UI 工作量 |
| 默认配置 A → 用户首次启动 < 4s 进工作状态；切换 C/D 时才加载本地模型 | 最佳首启体验 | 配置 A 是无本地 fallback 的代价 |

---

## Section 7 — 跨平台 (Windows / Linux)

| 引擎 | macOS (M2) | Windows | Linux | 备注 |
|---|---|---|---|---|
| **whisper.cpp** | ✅ 原生 NEON + CoreML/ANE | ✅ MSVC + MinGW + Vulkan + Ryzen AI NPU | ✅ x86 AVX + Vulkan + CUDA | [whisper.cpp README §Supported platforms](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) |
| **sherpa-onnx** | ✅ ARM64 | ✅ x64 | ✅ x64 + ARM64 + RISC-V | [sherpa-onnx README §Supported platforms](https://github.com/k2-fsa/sherpa-onnx) |
| **CosyVoice** | ⚠️ MPS 可用但 GPT/SoVITS 路径 PyTorch MPS 路径有限；CPU 推理可跑但 RTF 0.3-0.5 | ✅ CUDA | ✅ CUDA (生产推荐) | [CosyVoice README §macOS install](https://github.com/QwenAudio/CosyVoice)（"Apple silicon" PyTorch MPS 路径） |
| **GPT-SoVITS** | ⚠️ Mac GPU 训练**显著劣于其他设备**（README 明确警告），所以默认走 CPU；M2 CPU RTF ~0.5 | ✅ CUDA (生产) | ✅ CUDA (生产) | [GPT-SoVITS README §macOS](https://github.com/RVC-Boss/GPT-SoVITS)("models trained with GPUs on Macs result in significantly lower quality...we are temporarily using CPUs instead") |
| **MarianMT / CTranslate2** | ✅ Apple Accelerate backend | ✅ x86 + MKL | ✅ x86 + MKL | [CTranslate2 README §Key features](https://github.com/OpenNMT/CTranslate2) ("Apple Accelerate") |
| **Doubao 同传 2.0** | ✅ 任意平台只要能跑 WS 客户端 | ✅ | ✅ | T01 |

### 7.1 跨平台 PoC 启示

- **配置 A (全云端)** **100% 跨平台**——WS 客户端代码 (Rust / Go / Python / Swift) 都能跑，唯一约束是音频采集 (BlackHole macOS-only / VB-Cable Windows / PulseAudio Linux)。
- **配置 C / D 的本地模块**: Windows + Linux 上**全部更好**（CUDA + NPU）；Mac CPU 是**最差**的目标平台（金喜 wiki "Mac 没有本地模式" 的根因）。
- **结论**: PoC 阶段只做 macOS（M2 是唯一测试设备）；后续若做跨平台，**配置 A 是 zero-change 跨平台**；配置 C/D 需 Windows/Linux 上重做 benchmark。

---

## Section 8 — 推荐主推 + 备选（PoC v0 vs v1 production）

### 8.1 PoC v0 主推：**配置 A 全云端**

**完整链路**:

```
R3 出方向 (mic → BlackHole):
mic (16k/16bit/mono PCM, 80ms 一包)
  → VAD (silero-vad, 客户端)
  → WebSocket wss://openspeech.bytedance.com/api/v4/ast/v2/translate
    mode=s2s, source_language=zh, target_language=en
    speaker_id="" (0 样本克隆) 或 preset speaker_id (可选)
  ← TranslationSubtitle{Start,Response,End}
  ← TTSSentence{Start, TTSResponse*, End}
  → ogg_opus 解码 → BlackHole 2ch (Multi-Output Device 已建立)

R4 入方向 (SCC → 字幕):
ScreenCaptureKit (excludesCurrentProcessAudio=true)
  → SCC CMSampleBuffer (16k resample if needed)
  → 同 WebSocket (session 复用 or 独立 session)
    mode=s2t, source_language=en, target_language=zh
  ← SourceSubtitleResponse (源语字幕) + TranslationSubtitleResponse (译语字幕)
  → SwiftUI/Tauri 字幕 UI (双行字幕)
```

**关键不变量**:
- 双 WS 会话独立（同进程两个 goroutine / async task），挂不同输入/输出虚拟声卡。
- 反馈隔离靠 Multi-Output Device + 必要时 WebRTC APM 软件层 AEC（T06 决策）。
- WebSocket 连接断开 30s 内自动重连 + 复用 session_id（Doubao 支持）。
- 资源包预付费 = 5-9 元/小时成本；后付费 = 14.6 元/小时成本。**PoC 阶段后付费足够（先开通 100 元试用额度）**。

**为什么主推 A**:
1. **零本地模型 = 0 M2 内存压力** = 0 cold-start 等待 = 最简单的实现路径。
2. **端到端延迟 ~3 s** 与金喜 1.3 s 首音的差距靠「本地 VAD 预热 + 协议优化」补（T15 §6 已分析 1 s 差量来源）。
3. **音质 SOTA**——论文 + Doppelvoice 生产验证。
4. **跨平台 zero-change**——只有音频采集层需 OS 特定代码。

### 8.2 v1 production 备选：**配置 A 主 + 配置 C 离线路由**

```
在线（默认）：配置 A
   ↓ 检测网络延迟 > 200ms / ping Doubao 失败 / 用户主动切
离线：配置 C (本地 ASR + 云 MT → 不可用 → 自动降级到 D')
   即：本地 sherpa-onnx Zipformer + 本地 MarianMT + 本地 Piper (无克隆)
       或 + 本地 CosyVoice2 (有克隆, M2 内存紧张)
```

**v1 的差异化卖点**:
- "金喜只能在 Win 上跑本地模式 → 我们 Mac + 离线都能跑" (虽然本地音质妥协，但**能跑** vs 金喜**不能跑**)。
- 离线场景 = 海外差网 / 隐私要求 / 客户内网限制 → **市场细分**。

### 8.3 不推荐的配置 B

如 §4.2 所述，配置 B 在 Doubao 当前 API 限制下**架构不可行**。**跳过**。

### 8.4 配置 D 的位置

**配置 D 仅作 "v2 long-term" 探索**，不是 v0/v1 目标：
- v0 = A
- v1 = A + C (离线 fallback)
- v2 = A + C + D (全本地 premium feature for 隐私极敏感客户)

PoC 阶段**不投入时间做 D 的 fine-tune 或 OOM 调优**，只在 v1 末期做"模型是否能 load"的最低验证。

---

## Section 9 — 开放问题 / 风险

### 9.1 待验证（PoC 实测必做）

| 问题 | 验证方法 | 决策影响 |
|---|---|---|
| **M2 上 CosyVoice2 / GPT-SoVITS 实际 RTF**（非纸面） | 跑 demo 30 分钟会议录音，CPU 占用 + 端到端延迟 | 决定配置 C 在 Mac 上"可用"还是"PPT 可用" |
| **M2 16 GB 实测 OOM 临界点** | 同时跑 whisper large-v3-turbo Q5 + CosyVoice2 + MarianMT，看 macOS Activity Monitor swap 触发阈值 | 决定配置 D' 是否需要在 M2 24 GB 上才跑 |
| **sherpa-onnx Zipformer bilingual 中文 CER**（公开 WER 未涵盖中文） | 跑 10 段中文新闻联播 / TED 演讲，统计 CER | 决定 sherpa-onnx 是否能直接替代 Doubao ASR 用于中文 |
| **Doubao S2T only 模式 token 实际消耗**（自估算 vs 金喜 0.1M tok/h） | 实跑 1 小时会议，看账单 token 用量 | 决定配置 C 实际成本是否 < 1 元/小时 |
| **CosyVoice2 在 M2 CPU 上的 first-token 延迟**（paper claim 150ms vs 实测） | 用 LatencyBenchmark 工具测首包 | 决定配置 C R3 端到端延迟是否真的能打到 2-3 s |
| **GPT-SoVITS 在 M2 上的 Mac 警告是否影响推理**（vs 训练） | README 警告针对训练；推理是否受影响需实测 | 决定配置 C 是否能用 GPT-SoVITS 替代 CosyVoice2 |

### 9.2 待用户确认

| 问题 | 影响 | 建议问法 |
|---|---|---|
| 用户是否接受"无离线模式"作为 v0 妥协？ | v0 选 A 还是 C | "v0 只做云端 (配置 A)，v1 再加离线路由 (配置 C)，OK 吗？" |
| 用户是否接受"v0 没有 0 样本克隆"作为妥协 (改用 preset speaker_id)？ | A 路径音色克隆质量 | "v0 先用预设音色 zh_female_vv_uranus_bigtts, 0 样本克隆放到 v1?" |
| 跨平台目标是什么 (Win + Mac / Mac only / Linux + Mac)？ | 配置 C/D 的实现优先级 | "目标平台是 Mac only, 还是 Mac + Win?" |
| M2 16 GB 是否升级到 24 GB？ | 配置 D' 的可行性 | "Mac RAM 升级预算?" |

### 9.3 已知风险

| 风险 | 缓解 |
|---|---|
| Doubao AST token 消耗 > 自估算 → 配置 A 成本涨到 20+ 元/小时 | 资源包预付费锁定单价 + 用户配额预警 |
| 火山方舟 console 计费页需登录才能查 | T09 ticket 已在跑；v0 上线前必须验证用户有 console 访问权限 |
| 海外身份证 / 海外手机号 → 无法注册火山引擎账号 (T02 已识别) | T02 阻塞问题；用户必须用 +86 + 大陆身份证 |
| M2 上本地 TTS RTF 高导致 ASR 字幕卡顿 | 配置 C 实施时做"ASR 优先调度"——本地 TTS 慢一点可以接受，ASR 卡 = 用户立刻感知 |
| Whisper large-v3-turbo + CoreML 首次运行 ANE 编译 ~0.6s | 启动时后台预编译，不阻塞 UI |

### 9.4 信息盲区

| 项 | 状态 | 替代方案 |
|---|---|---|
| Volcengine console 计费页具体单价（已在 PDF 找到） | ✅ 已确认 80/80/300 元/M token |
| MarianMT 1 小时会议实际 BLEU 区间 | ❌ 未公开 benchmark on conference speech | 跑样本评估 |
| NLLB-200 distilled 600M 商用 license 细节 | ⚠️ CC-BY-NC 4.0 商业禁用（via T18） | 配置 C 不推荐用 NLLB |
| Cartesia Sonic 在 cn→us 网络下的延迟 | ❌ 公开未测 | 若用户有国际链路需求，PoC 实测 |
| ElevenLabs IVC 在中文音色 + 英文输出上的质量 | ❌ 公开 demo 未覆盖中英克隆 | T19 ticket (in flight) 覆盖 |
| CosyVoice2 在 M2 CPU 上的 RAM 峰值实测 | ❌ 未实测；估 ~2-3 GB | PoC 实测 |

---

## 引用清单

1. **Doubao 同传 2.0 WebSocket API 文档**: `https://www.volcengine.com/docs/6561/1756902`（AST 2.0 协议主入口 — 含 mode 字段、source/target_language、speaker_id、denoise、UsageResponse token 计费字段）
2. **豆包语音产品计费 PDF**: `https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/豆包语音_产品计费_1787232335.pdf`（同声传译大模型后付费：输入 80 元/M token, 输出-文本 80 元/M, 输出-音频 300 元/M；大模型流式语音识别 4.5 元/小时后付费）
3. **Seed LiveInterpret 2.0 论文**: `https://arxiv.org/abs/2507.17527`（"End-to-end Simultaneous Speech-to-speech Translation with Your Voice" — 克隆语音平均延迟 ≈ 3 s）
4. **Doppelvoice README**: `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/README.md`（"End-to-end latency ≈ 2.5–3 s" — 生产级实测）
5. **Doppelvoice ARCHITECTURE**: `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/docs/en/ARCHITECTURE.md` L285（"ogg_opus 整句解码比 raw pcm 多 ~500ms"）
6. **Doppelvoice TROUBLESHOOTING**: `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/docs/zh/TROUBLESHOOTING.md` L78（"音色表达性比火山控制台 demo 略弱"）
7. **whisper.cpp README**: `https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md`（Memory usage 表；CoreML ANE；Supported platforms）
8. **whisper.cpp models README**: `https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/models/README.md`（"large-v3-turbo 1.5 GiB / large-v3-turbo-q5_0 547 MiB"）
9. **whisper.cpp issue #89**: `https://github.com/ggml-org/whisper.cpp/issues/89`（M2 Air 24GB CoreML 实测：small encoder 199ms, medium 746ms, large 1439ms; c1401394565 + c1535843651）
10. **sherpa-onnx zipformer-transducer-models**: `https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html`（bilingual-zh-en int8 190 MB: encoder 174M + decoder 13M + joiner 3.1M; RTF measurements）
11. **sherpa-onnx paraformer-models**: `https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-paraformer/paraformer-models.html`（streaming-paraformer-bilingual-zh-en fp32 825 MB, int8 226 MB）
12. **sherpa-onnx main README**: `https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/README.md`（Supported platforms + VAD）
13. **CosyVoice README**: `https://github.com/QwenAudio/CosyVoice`（"Bi-Streaming... 150ms latency"；Evaluation 表: CosyVoice2 0.5B test-zh CER 1.45, SS 75.7）
14. **CosyVoice 2 paper**: `https://arxiv.org/pdf/2412.10117`（"Qwen2.5-0.5B as text-speech LM"；streaming synthesis）
15. **CosyVoice FAQ**: `https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/FAQ.md`
16. **GPT-SoVITS README**: `https://github.com/RVC-Boss/GPT-SoVITS`（"RTF(inference speed) of GPT-SoVITS v2 ProPlus: 0.528 in M4 CPU"；"The models trained with GPUs on Macs result in significantly lower quality"）
17. **MarianMT Tatoeba zho-eng README**: `https://raw.githubusercontent.com/Helsinki-NLP/Tatoeba-Challenge/master/models/zho-eng/README.md`（BLEU 35.6 on Tatoeba-test）
18. **MarianMT model files**: `https://object.pouta.csc.fi/Tatoeba-MT-models/zho-eng/opus-2020-07-17.zip`（content-length: 288654138 ≈ 289 MB）
19. **Marian dev README**: `https://raw.githubusercontent.com/marian-nmt/marian-dev/master/README.md`（MIT license）
20. **CTranslate2 README**: `https://raw.githubusercontent.com/OpenNMT/CTranslate2/master/README.md`（Marian + NLLB + Whisper + Qwen2 支持；Apple Accelerate backend）
21. **Cartesia pricing docs**: `https://docs.cartesia.ai/pricing.md`（"~1 credit per character"；Pro $5/mo = 100K credits ≈ 133 min TTS）
22. **Cartesia public pricing page**: `https://cartesia.ai/pricing`（Pro $5/mo, Startup $49/mo）
23. **ElevenLabs pricing FAQ**: `https://elevenlabs.io/pricing`（"1 credit per character"；Creator $22/mo = 121k credits；Pro $99/mo = 600k credits；Business "low-latency TTS as low as 5c/minute"）
24. **DeepSeek pricing**: `https://api-docs.deepseek.com/quick_start/pricing`（via T#16 _tmp-llm-mt.md；V4-Flash ¥1.58/M input off-peak）
25. **Meta NLLB paper**: `https://arxiv.org/abs/2207.04672`（NLLB-200 架构；distilled 600M 变体）
26. **BlackHole GitHub**: `https://github.com/ExistentialAudio/BlackHole` (via T06)
27. **ScreenCaptureKit docs**: `https://developer.apple.com/documentation/ScreenCaptureKit` (via T06)
28. **Prior research files** (via internal):
    - T01: `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`（Doubao S2S 端到端 2.5-3 s；speaker_id 字段；UsageResponse 字段）
    - T03: `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`（客户端鉴权链路；token 节省策略）
    - T04: `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`（生产级延迟 2.5-3 s；speaker_id="" + denoise=false 触发克隆）
    - T06: `.scratch/macos-siminterpret-poc/research/06-macos-audio-routing-options.md`（BlackHole + Multi-Output Device；SCC 防反馈隔离）
    - T15: `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`（金喜 9-12/2-3/0.7-1 元/小时成本梯度；标准 = Doubao S2S；旗舰云端 = 级联；旗舰本地 = 云端 ASR+MT + 本地 TTS；Mac 没有本地模式 = HIGH）
    - T17: `.scratch/macos-siminterpret-poc/research/17-local-asr-macos-m2.md`（M2 上各 ASR 引擎 first-partial 延迟 + WER + RAM）
    - T18: `.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md`（MarianMT vs NLLB vs Qwen vs DeepL vs Doubao S2T 候选）
    - T19: `.scratch/macos-siminterpret-poc/issues/19-local-tts-models.md`（in flight；CosyVoice / GPT-SoVITS / ElevenLabs / Cartesia 候选）

---

## Confidence 速查

| 结论 | Confidence |
|---|---|
| 配置 A 在 M2 16GB 上可行 + 端到端 ~3 s + 成本 ~14.6 元/小时后付费 | **HIGH**（T01 + T04 + arXiv 2507.17527 + Volcengine PDF 四重佐证） |
| 配置 C 成本 ~1 元/小时 | **MEDIUM**（自估算 + T15 金喜数字反推；具体 token 消耗需 PoC 实测） |
| 配置 D 16 GB 紧张 / OOM 风险 | **MEDIUM**（RAM 表自估算；PyTorch 加载峰值依赖 PyTorch 版本 + macOS unified memory 行为） |
| CosyVoice2 M2 CPU RTF 0.3-0.5 | **LOW**（GPT-SoVITS M4 CPU 0.526 推断；无 M2 一手数据） |
| Doublo 同传 S2T only token 单价 80/80 元/M | **HIGH**（Volcengine PDF §"按调用后付费" 行直接确认） |
| 输出音频 token 单价 300 元/M (S2S 克隆场景) | **HIGH**（同上） |
| sherpa-onnx Zipformer bilingual int8 在 M2 上 RTF 0.05 | **MEDIUM-HIGH**（T17 + sherpa-onnx docs；M2 实测无单独数字） |
| MarianMT BLEU 35 商用够用 | **MEDIUM**（Tatoeba benchmark；专业级翻译如医疗/法律需 fine-tune） |
| Cartesia Sonic Pro ~3.2 元/小时 | **MEDIUM**（Cartesia Pro 100K credits / 133 min TTS 算；具体"分钟 vs 字符"折算假设 150 字/分钟） |

---

## 下一步（给后续 ticket）

1. **T20 决策产出** → 选 **配置 A (PoC v0) + 配置 C (v1 离线 fallback)** 写入 `.scratch/macos-siminterpret-poc/map.md` 作为最终架构基线。
2. **T09** 必须在 v0 上线前完成用户火山引擎账号开通 + 100 元试用额度到账。
3. **T17/T18/T19** 中 T19 (本地 TTS) 最关键——决定 v1 配置 C 是否值得做。若 T19 实测 CosyVoice2 / GPT-SoVITS 在 M2 CPU 上 RTF > 0.8，则 v1 配置 C 降级到"R4 字幕本地 + R3 译音回退云端"的混合模式。
4. **PoC 实测清单** (T20 → T21+):
   - 实测 sherpa-onnx bilingual 中文 CER (10 段样本)
   - 实测 CosyVoice2 / GPT-SoVITS 在 M2 CPU 上的 RTF + RAM 峰值
   - 实测 Doubao 同传 S2T only 模式 1 小时 token 实际消耗 (校准 §4.3 成本估算)
   - 实测 Whisper large-v3-turbo Q5_0 + CoreML 在 M2 Air 16GB (vs 24GB) 的内存压力
