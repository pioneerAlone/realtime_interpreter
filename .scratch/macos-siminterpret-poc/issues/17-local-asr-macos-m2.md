# macOS 本地 ASR 模型对比（M2 MacBook Air）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

R4 入方向需要把客户英文语音实时识别。如果走本地 ASR（绕过云端往返省 ~200ms 延迟），需要选一个 macOS M2 上跑的模型。

候选（按重要度排序）：
1. **whisper.cpp**（ggml-org/whisper.cpp）
   - 模型：large-v3-turbo、distil-large-v3、medium、small
   - 量化：Q4/Q5/Q8
   - 流式支持：原生 incremental mode
   - Apple Silicon：CoreML 后端可用
2. **mlx-whisper**（Apple 官方 mlx-examples）
   - Apple Silicon 专属优化
   - 延迟 vs whisper.cpp？
3. **sherpa-onnx**（k2-fsa/sherpa-onnx）
   - 模型：Zipformer（英语流式 SOTA）、Paraformer（中文流式）、SenseVoice（多语种小模型）
   - 延迟极低（流式 < 300ms partial）
   - 缺点：英语流式 Zipformer 是从 icefall 来的，模型 license 需确认
4. **FunASR**（达摩院开源）
   - 中文 SOTA，但英语 streaming 弱
   - 适合作为 PoC 中期 R4 中文侧的 fallback
5. **macOS Speech.framework**（系统级）
   - 零成本 / 零依赖，但不支持流式输出、不支持自定义词库
   - 只能做兜底（API 调用失败 / 模型未加载）

要回答的问题：

1. **M2 上各模型的 first-partial 延迟**（英文 / 流式 / 量化版）
2. **WER（词错误率）**对比
3. **内存占用**（M2 16GB / 24GB 内存紧张情况）
4. **是否需要 CoreML 后端**加速
5. **是否支持 VAD 自适应 / 静音剔除**
6. **license 风险**（MIT / Apache / GPL？商业产品能用？）
7. **跨平台**（macOS 跑通后 Windows / Linux 迁移成本）

最终交付：「M2 上 R4 英文流式 ASR 的首选 + 备选方案」，含延迟 / 准确率 / 内存 / license 对照表。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/17-local-asr-macos-m2.md`

**Gist**: 首选 **sherpa-onnx streaming-zipformer-en (int8)** — 唯一真流式 partial (~200ms first-partial, LibriSpeech test-clean 2.43%, RTF 0.04-0.10, <200MB RAM, Apache-2.0). 备选 **whisper.cpp + CoreML + distil-large-v3 / large-v3-turbo** — WER 上限更高 (但 partial ~300-500ms, 不是真流式). FunASR 英语只有 SenseVoiceSmall (离线) 或 Fun-ASR-Nano (LLM, 需 GPU), 不符合"低延迟流式"目标. Speech.framework 平台锁定 + 不支持自定义词库, 仅适合 demo / fallback.

Comparison table (10 维度 × 5 引擎):

| 维度 | whisper.cpp | mlx-whisper | sherpa-onnx | FunASR | Speech.framework |
|---|---|---|---|---|---|
| First-partial latency | ~500ms (--step 500 模拟, 真 partial 受限于 encoder+decode) | ~300-400ms (transcribe 单次 forward, 无 token partial) | **~200ms** (320ms chunk + 真 partial tokens, RTF 0.04-0.10) | SenseVoice 离线; Fun-ASR-Nano 需 GPU | 句段级 partial (~150-300ms, 非 token 级) |
| WER (LibriSpeech test-clean) | large-v3 8.4% / distil-large-v3 9.7% (短窗) | 同 Whisper 模型 | **2.43-3.06%** (Zipformer 流式, Libri+Giga 或 Libri-only) | 论文未公开 LibriSpeech 数字 | 不公开, 主观清晰近场 ~95%+ |
| Memory (M2 16/24 GB) | large ~3.9GB / small ~852MB / tiny ~273MB; Q5/Q8 减半 | 同 Whisper 模型 fp16; 16GB 紧张 | **int8 <200MB** (Zipformer en 68MB encoder + ~5MB dec/join) | SenseVoiceSmall ~230MB; Fun-ASR-Nano 2-4GB | 0 本地 (系统进程) |
| CoreML / ANE | **✅ 强烈建议开** (M2 Air 24GB CoreML: large enc 1439ms vs CPU 5466ms, 3.8× speedup) | ✅ MLX 自动用 GPU+ANE (但 FA+batched 提速未合 main) | ⚠️ Provider 枚举有 kCoreML 但默认 wheel 不含; int8 CPU 几十 ms 已够, 无需 ANE | ❌ PyTorch CPU 或 MPS, CoreML 不支持 | ✅ 强制 ANE via `requiresOnDeviceRecognition=true` |
| VAD | ✅ Silero-VAD v6.2 内置 (`--vad`) | ❌ 需外部接 (issue #1412 草案加 Silero, 未合 main) | ✅ Silero-VAD 内置 + Hotwords 支持 | ✅ FSMN-VAD 内置 | ⚠️ 系统内部 VAD, 不可配置, 无原始事件回调 |
| License (商业) | MIT, **零风险** | MIT, **零风险** | Apache-2.0, **零风险** (LibriSpeech CC-BY attribution) | MIT, **零风险** (含 Qwen3 Apache-2.0) | Apple SDK, 受平台条款约束 (禁 server-side 转售) |
| 跨平台 | ✅ Linux/Win/macOS/Android/iOS/WASM | ❌ Apple Silicon only | ✅ **最广** (Linux/Win/macOS/Android/iOS/HarmonyOS/WASM/NodeJS/RISC-V) | ✅ PyTorch 跨平台 (生产偏 Linux+CUDA) | ❌ 仅 Apple |
| 原生 partial streaming | ⚠️ 半流式 (--step 滑动, 不是 token partial) | ❌ 非流式 (整 30s mel 一次 transcribe) | ✅ **真 streaming partial** (chunk encoder + token-level IsEndpoint/GetResult) | ❌ 离线 (SenseVoice) / LLM 无 partial (Fun-ASR-Nano) | ✅ 句段级 partial (非 token 级) |
| 热词 / 自定义词库 | ✅ `--prompt` (每 chunk 需重传) | ✅ 同 Whisper `--prompt` | ✅ **Hotwords 内置** (`hotwords_file` + `hotwords_score`, FST 增强) | ✅ SenseVoice/Paraformer ITN + 热词 | ❌ 不支持 (API 无词库 hook) |
| M2 实测 benchmark | M2 Air 24GB CoreML: small enc 199ms / medium 746ms / large 1439ms (issue #89 c1535843651) | M2 8GB small sequential 9.4s/5min (RTF 0.031) — full transcribe (issue #1412) | demo 7s wave RTF 0.04-0.10 (官方 docs); 16ch ANE 不需要 | 未找到 M2 第一方 benchmark; MPS 跑不稳 | 系统级, 无第三方 benchmark |

**Recommendation**: **sherpa-onnx + streaming-zipformer-en-2023-06-21 (Libri+Giga int8)** — 唯一满足 R4 真流式 partial ≤1.3s 的引擎; WER 流式基线 SOTA (test-clean 2.43%); int8 <200MB 内存留给 TTS+MT; Apache-2.0 商用零风险; ONNX 跨平台为未来 Windows/Linux 客户端留路. 备选 whisper.cpp + CoreML + distil-large-v3 (需要 partial 不严 + 多语场景).

**License risk**: 全 5 引擎商业可用, 无 GPL/LGPL 传染; 唯一平台限制 = Speech.framework 不能基于 Siri ASR 做 server-side SaaS 转售 (但 R4 主路径不依赖 Speech).

## Comments

<!-- conversation history -->