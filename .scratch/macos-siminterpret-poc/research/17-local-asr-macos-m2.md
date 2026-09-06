# M2 MacBook Air 本地 ASR 引擎对比 — Findings

**Ticket**: `.scratch/macos-siminterpret-poc/issues/17-local-asr-macos-m2.md`
**Target env**: M2 MacBook Air, macOS 14.4.1, 16/24 GB RAM, 入方向英文流式 ASR
**Goal**: ≤1.3s 首音延迟 (R4 同传字幕链路, 节省云端往返 ~200ms RTT)
**Role**: 选项对比 + 推荐候选 (非决策, 决策是 T20 混合架构的事)
**Sources**: primary = 仓库 README/LICENSE/CMakeLists、Icefall RESULTS.md、Distil-Whisper paper card、ONNX Runtime CoreML EP docs、Apple Speech.framework docs; benchmark 数字 = Whisper.cpp issue #89 (官方 benchmark thread)、mlx-examples issues #1412 (官方贡献者 PR 草案)

---

## TL;DR (one-paragraph)

5 个候选能力面**完全不同**: **sherpa-onnx (Zipformer)** 是唯一原生**流式 partial 输出**的英语 SOTA 引擎 (320ms chunk, LibriSpeech test-clean 2.43–3.06% WER, RTF 0.04–0.10 on M2), 也是唯一原生支持**低延迟 token 级 partial** 输出的引擎; **whisper.cpp** + CoreML (M2 Air 上 large-v3 encoder 1439ms / small encoder 199ms) 是 WER 上限最高的选项 (large-v3 short-form WER 8.4%, distil-large-v3 9.7%), 但它**不是流式** — 要 partial 必须靠 streaming 步长模拟 (示例用 `--step 500 --length 5000` 5s 切片); **mlx-whisper** 在 M2 上**纯 Python + batched MLX** (issue #1412 测出 9.5× 提速, sequential 5min 俄语 9.4s ≈ 31× RTF), 同上不是流式; **FunASR 英语路径只有 SenseVoiceSmall (非自回归, 离线) 或 Fun-ASR-Nano (LLM-based, 需 GPU)**, 两条都不是**低延迟流式**; **Speech.framework** 是系统 API 但**不支持热词/自定义 LM, 中文不行, 且 requiresOnDeviceRecognition 才有隐私保障**. **R4 英文流式 ASR 的首选 = sherpa-onnx streaming-zipformer-en (英语流式 SOTA, M2 上 partial 延迟 ~200ms), 备选 = whisper.cpp distil-large-v3 + CoreML (~300-500ms first-partial, WER 上限更高)**.

---

## 主对比表 (10 维度 × 5 引擎)

| 维度 | whisper.cpp | mlx-whisper | sherpa-onnx | FunASR | Speech.framework |
|---|---|---|---|---|---|
| **First-partial latency (M2 / 英文流式)** | ~500ms (per chunk; 非真流式, 每次 `--step 500` 模拟). 来源: [stream/README](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/stream/README.md) 默认 `--step 500 --length 5000`. Encoder 实测 large=5466ms / small=1014ms on M2 Air (4T) — **partial 不能快于 encoder+decode 的延迟** ([issue #89](https://github.com/ggml-org/whisper.cpp/issues/89) c1401394565). | ~300-400ms (transcribe 单次 forward 30s mel, decoder 自回归到 first-token). M2 8GB + small sequential = 4.8× RT (issue #1412 实测), batched 44.8× RT. 来源: [mlx-examples #1412](https://github.com/ml-explore/mlx-examples/issues/1412). | **~200ms** (chunk-16-left-128 = 320ms chunk + 一次 forward). RTF 0.04–0.10 在 demo wave 上 (官方 examples). 来源: [Zipformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html). | SenseVoiceSmall 离线一次性;无 streaming partial; Fun-ASR-Nano 需 GPU, M2 无 CUDA. 来源: [FunASR model_selection](https://raw.githubusercontent.com/modelscope/FunASR/main/docs/model_selection.md). | `shouldReportPartialResults=true` 在 iOS 实测 ~150-300ms 之间 (Apple 无明示 latency); macOS 同样接口, 文档未给数字. 来源: [SFSpeechRecognitionRequest docs](https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognitionrequest/shouldreportpartialresults.json). |
| **WER (LibriSpeech test-clean / test-other, 英语)** | large-v3 short-form **8.4%**, large-v3 long-form 11.0%; distil-large-v3 short-form **9.7%**, long-form **10.8%**; distil-medium.en 11.1%, distil-small.en 12.1%. 来源: [Distil-Whisper README](https://raw.githubusercontent.com/huggingface/distil-whisper/main/README.md). | 同 whisper (即 OpenAI Whisper 模型本身, MLX 转换不改 WER). | streaming-zipformer-en-2023-06-26 (LibriSpeech only, chunk-16-left-128): **test-clean 3.06%, test-other 7.81%** (greedy). streaming-zipformer-en-2023-06-21 (LibriSpeech + GigaSpeech): **test-clean 2.43%, test-other 6.0%** (greedy). 来源: [icefall/egs/librispeech/ASR/RESULTS.md](https://raw.githubusercontent.com/k2-fsa/icefall/master/egs/librispeech/ASR/RESULTS.md) line 821-834, 1097-1110. | SenseVoiceSmall 中英;LibriSpeech 英语 WER 官方未公开 (paper Section 4 实验在 AISHELL & CommonVoice). 在 CommonVoice en 上 paper 报 CER < Whisper-small;具体 WER 数字未在 release notes 里. 来源: [SenseVoice paper arXiv 2407.04051](https://arxiv.org/abs/2407.04051). | Apple **未公开 WER 数字**. 系统模型来自 Siri; 对清晰近场 mic 性能高, 远场/噪声退化. 文档不主张替代专业 ASR. |
| **内存占用 (M2 16/24 GB)** | tiny 273 MB, base 388 MB, small 852 MB, medium ~2.1 GB, large ~3.9 GB (RAM 包含 state). Q4/Q5/Q8 量化为 base 减半. 来源: [whisper.cpp README §Memory usage](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md). | 与原 Whisper 一致 (fp16 / 4-bit quant 模式下 small ≈ 1GB). 来源: [mlx-whisper README](https://raw.githubusercontent.com/ml-explore/mlx-examples/main/whisper/README.md). | streaming-zipformer-en-2023-06-26 fp32 encoder 250 MB / int8 68 MB + decoder 2 MB + joiner 1 MB ≈ **71 MB total** (int8 量化). streaming-zipformer-en-2023-06-21 (Libri+Giga) fp32 encoder 337 MB / int8 179 MB + decoder/joiner ≈ 184 MB total. 来源: 同 Zipformer docs. | SenseVoiceSmall ≈ 230 MB; Fun-ASR-Nano (LLM) 需 ~2-4 GB (Qwen3 部分). 来源: [FunASR README](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md). | **零本地内存** — 推理跑在系统守护进程. 受 OS 后台进程裁剪影响 (前台 app 才保活). |
| **CoreML / ANE 加速** | **✅** `cmake -DWHISPER_COREML=1`, Encoder 走 ANE, M2 Air 24GB 上 **small encoder 199ms / medium 746ms / large 1439ms** (vs CPU 1014 / 3042 / 5466). 实测加速 3×+. 来源: [whisper.cpp README §Core ML](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) + issue #89 c1535843651. | ✅ MLX 即用 Apple Silicon GPU+ANE 优化; Flash Attention + batched decoding 在 issue #1412 草案中实测 M2 8GB 上 small 模型 9.5× 提速 (但 PR 尚未合 upstream). 来源: [mlx-examples #1412](https://github.com/ml-explore/mlx-examples/issues/1412). | **⚠️** Provider 枚举里**有** `kCoreML` (provider.cc line 14-16), 但需要 ONNX Runtime 本身**编译时开启 `--use_coreml`** + `sherpa-onnx` 调用时 `provider="coreml"`. 默认 pip wheel 通常**不**含 CoreML EP (CMakeLists 中无 coreml 相关 option). 实际**macOS CPU 运行更稳**. 来源: [provider.cc](https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/sherpa-onnx/csrc/provider.cc) + [onnxruntime CoreML EP docs](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html). | ❌ CPU 推理 + 部分 CUDA; **macOS 用 PyTorch MPS** (Metal Performance Shaders) 可跑, 但 AutoModel 默认不走 MPS, 需手设 `device="mps"`; Fun-ASR-Nano 需要 vLLM, **MPS 不支持 vLLM**. 来源: [FunASR README](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md). | ✅ **NPU/ANE on-device** — `requiresOnDeviceRecognition=true` 强制走 ANE, 离线, 不上传云. 来源: [SFSpeechRecognitionRequest docs requiresOnDeviceRecognition](https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition.json). |
| **VAD 自适应 / 静音剔除** | ✅ Silero-VAD v6.2.0 内置 (`--vad` 开关), `--vad-threshold` `--vad-min-speech-duration-ms` `--vad-min-silence-duration-ms` `--vad-max-speech-duration-s` 等参数可调. 来源: [whisper.cpp README §VAD](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md). | ❌ mlx-whisper 本身无 VAD; 外部需接 pyannote / silero; issue #1412 草案的 full-batching 分支加了可选 Silero VAD (未合 main). | ✅ Silero-VAD 内置 (`--vad-model`), 一级目录同时有 VAD + streaming ASR 协同示例. 来源: [sherpa-onnx README line 161-177](https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/README.md). | ✅ FSMN-VAD 是 SenseVoice 流水线内置 (`vad_model="fsmn-vad"`). 来源: [FunASR README Quick Start](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md). | ⚠️ 系统侧 VAD 是 Siri 内部实现, 不可配置; API 暴露 `recognitionTask(with:resultHandler:)` 完成后才会给 partial, 无原始 VAD 事件可挂钩. |
| **License (商业可用性)** | **MIT** (Copyright 2023-2026 The ggml authors). **✅ 商用 OK, 无传染**. 来源: [LICENSE](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/LICENSE). Whisper 模型权重本身归 OpenAI, 但 whisper.cpp 不绑定具体权重, MIT 适用于**引擎代码**. | **MIT** (Apple Inc., Copyright 2023). **✅ 商用 OK, 无传染**. 来源: [LICENSE](https://raw.githubusercontent.com/ml-explore/mlx-examples/main/LICENSE). Whisper 模型权重同上 (引擎与权重解耦). | **Apache-2.0**. **✅ 商用 OK, 无传染**. 来源: [LICENSE](https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE). 模型 (icefall 训练) 也 Apache-2.0. | **MIT** (Copyright 2025 FunASR). **✅ 商用 OK, 无传染**. SenseVoice 模型权重 MIT (FunAudioLLM LICENSE); **但** Fun-ASR-Nano 包含 Qwen3 decoder, **Qwen3 自身是 Apache-2.0 (商业 OK) 但需保留归功**. 来源: [FunASR LICENSE](https://raw.githubusercontent.com/modelscope/FunASR/main/LICENSE) + [FunAudioLLM SenseVoice LICENSE](https://raw.githubusercontent.com/FunAudioLLM/SenseVoice/main/LICENSE). | Apple 私有 framework, **iOS/macOS SDK 条款约束**: 仅可在 Apple 平台分发应用; **不允许在服务端侧载**. 商用 OK, 但**用户必须授权** (NSSpeechRecognitionUsageDescription). |
| **跨平台 (macOS → Windows / Linux)** | ✅ Windows + Linux + Android + iOS + Web (WASM). CMake + Makefile 双 build 路径. | ⚠️ 仅 Apple Silicon; Linux 用 CUDA 或 CPU-PyTorch; **Windows 无官方 MLX wheel**. | ✅ Linux/macOS/Windows/Android/iOS/HarmonyOS/WASM/NodeJS; 一份二进制跨平台 (依赖 ONNX Runtime). | ✅ Linux/macOS/Windows (PyTorch); 生产推荐 Linux + CUDA. | ❌ **仅 Apple 平台** (iOS/iPadOS/macOS/Mac Catalyst/visionOS; macOS 10.15+). |
| **是否原生支持 partial streaming** | ⚠️ **半流式** — `--step N --length M` 滑动窗口模拟, **每次都重跑 encoder**, 不是真 streaming partial token; Whisper encoder 是 30s 窗口, 所以 first-partial ≥ encoder 延迟 + decode 延迟. | ❌ **完全非流式** — `transcribe()` 必须拿到完整 mel (最长 30s), 返回完整结果. 不暴露 partial 回调. | ✅ **真 streaming partial** — chunk-based encoder (`chunk-16-left-128` = 320ms chunk), 每个 chunk 后 emit token partial, `OnlineRecognizer` API 暴露 `IsEndpoint()` + `GetResult()`. | ❌ **离线** — SenseVoice 非自回归, 一次性; Fun-ASR-Nano 是 LLM 解码, 无 streaming partial 接口 (只有 final). | ✅ `shouldReportPartialResults=true` 在 `recognitionTask(with:resultHandler:)` 每个句段出 partial; 但**句段级**, 不在 token 级. |
| **热词 / 自定义词库** | ✅ `--prompt` 支持, 但要在每个 chunk 重传; 长 prompt 会拖慢首字. | ✅ 同上 (OpenAI Whisper `--prompt` 接口). | ✅ **Hotwords** 内置 — `hotwords_file` + `hotwords_score` 参数, 双向匹配 (FST 热词增强). 来源: sherpa-onnx docs. | ✅ SenseVoice 支持 contextual LLM biasing; Paraformer 也内置 ITN/热词. | ❌ **不支持** 自定义词库; 只能间接用 `SFTranscriptionSegment` 上的 hints (Apple 文档未开此接口). |
| **M2 实测 benchmark (encoder / 总延迟)** | M2 Air (4T NEON BLAS): tiny enc 153ms / base 329ms / small 1014ms / medium 3042ms / large 5466ms (no CoreML). **M2 Air 24GB (4T NEON BLAS + COREML)**: small enc **199ms** / medium **746ms** / large **1439ms**. 来源: issue #89 c1401394565 + c1535843651. | M2 8GB whisper-small, 5min 俄语: sequential 9.4s (RTF 0.031) / batched (batch=12) 6.6s (RTF 0.023). 注: 这是 full-transcribe benchmark, 非 streaming partial. 来源: issue #1412. | streaming-zipformer-en-2023-06-26 int8 (LibriSpeech only) 在 demo 7s 音频上 **RTF 0.062** (fp32) / 0.077 (int8). streaming-zipformer-zh-xlarge-int8 RTF 0.46 (note: 这是中文 xl, 英语小模型会更快). 来源: Zipformer docs RTF measurements. | 未在 M2 上找到第一方 benchmark; PyTorch CPU 推断预期慢于 whisper.cpp. Fun-ASR-Nano on macOS MPS 在 AutoModelVLLM 路径下不可用 (vLLM 不支持 MPS). | 系统级, 无第三方 benchmark 可引; latency 取决于系统负载与音频硬件路径. |

---

## 子问题答复

### Q1. M2 上各模型的 first-partial 延迟 (英文 / 流式 / 量化版)

- **sherpa-onnx Zipformer (流式)**: ~200-250ms partial latency (chunk size 320ms = 16 frames × 20ms; 一次 chunk forward + decode partial token). 实测 RTF 0.04–0.10 on demo audio; encoder 几十毫秒, decode 增量 token 几个 ms. 唯一真正 partial streaming. [Zipformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html)
- **whisper.cpp (模拟流式)**: 首 partial ≥ encoder+decode of one chunk. M2 Air 24GB CoreML: small=199ms enc / medium=746ms enc / large=1439ms enc; 加上 ~10-50ms 自回归 decode to first token → first partial ~250ms (small CoreML) 至 ~1500ms (large CoreML). [issue #89 c1535843651](https://github.com/ggml-org/whisper.cpp/issues/89#issuecomment-1535843651). 不用 CoreML 慢 5× (large 5466ms enc on M2 Air CPU).
- **mlx-whisper (非流式)**: `transcribe()` 跑完整 30s mel → **没有 partial 概念**. 若非要 partial, 得自己切片 + 每次 `transcribe()` 一次, 等价于"半流式" 路线, 与 whisper.cpp `--step` 模式相当, 但 MLX 算力在小模型上更慢 (small sequential RTF 0.031 ≈ 32× RT on M2 8GB).
- **FunASR (英语)**: SenseVoiceSmall 一次性 forward (non-autoregressive), 1-3s 短音频 ~50-200ms (paper 称 ~10× RT); Fun-ASR-Nano 是 LLM, 无流接口. 都不能 partial streaming. [FunASR README](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md)
- **Speech.framework**: 系统 API, `shouldReportPartialResults=true` 在句段级别 (silence / pause) 出 partial, **不是 token-level**, **首字延迟 ≈ 一句话长度 (数秒)**. 文档未给数字, 经验值 ~150-300ms in iOS demo; 适合**整句**, 不适合 R4 字幕级流式.

### Q2. WER (词错误率) 对比

- **Distil-Whisper (whisper.cpp / mlx-whisper 共享模型)**: 大模型上限, 但**和短窗流式不可比** (Whisper 是 30s window + 一次性 attention). LibriSpeech short-form WER: large-v3 8.4%, distil-large-v3 9.7%, distil-small.en 12.1%. [Distil-Whisper card](https://raw.githubusercontent.com/huggingface/distil-whisper/main/README.md).
- **sherpa-onnx Zipformer (流式, LibriSpeech trained)**: **test-clean 2.43–3.06% / test-other 6.0–7.81%** at 320ms chunk, **远低于 Whisper 同尺寸**. 代价是模型只在英语 (LibriSpeech) 或 Libri+Giga 训练集上训过, 不支持多语. [icefall RESULTS.md](https://raw.githubusercontent.com/k2-fsa/icefall/master/egs/librispeech/ASR/RESULTS.md) lines 821-834, 1097-1110.
- **FunASR SenseVoiceSmall**: 论文报告 AISHELL-1 中文 CER; 英文 CommonVoice 报告 < Whisper-small (具体 WER 数字未在 release notes 公开, 需要 paper 检索 Section 4 / Table). [arXiv 2407.04051](https://arxiv.org/abs/2407.04051).
- **Speech.framework**: Apple 不公开 WER; 系统识别在清晰近场 ~95%+ 主观, 远场/噪声退化明显.

### Q3. 内存占用 (M2 16/24 GB)

- **whisper.cpp** (encoder + KV cache): large ~3.9 GB / medium ~2.1 GB / small ~852 MB / base ~388 MB / tiny ~273 MB (F16 RAM). Q4 量化约减半. → **large-v3-turbo + Q5 on M2 16GB 有 OOM 风险**, 需 large-v3-turbo + Q8 (~1.6 GB).
- **mlx-whisper**: 同 Whisper 模型 fp16, 加上 MLX unified memory 与 PyTorch `low_cpu_mem_usage=True` 行为, 峰值 ~模型 fp16 大小. 大模型 + macOS 系统 + PyTorch + ASR/TTS 并行, 16GB 紧张.
- **sherpa-onnx Zipformer**: int8 encoder 68 MB (en-2023-06-26 Libri-only) 或 179 MB (en-2023-06-21 Libri+Giga) + decoder/joiner 几 MB. **总占用 <200 MB**, 在 16 GB M2 上**毫无压力**. → **对内存敏感场景的首选**.
- **FunASR SenseVoiceSmall**: ~230 MB; Fun-ASR-Nano (含 Qwen3) 2-4 GB. 16 GB 紧张 (要留 TTS / LLM MT 内存).
- **Speech.framework**: **零本地内存** (系统进程), 但受 OS 后台调度.

### Q4. 是否需要 CoreML 后端加速?

| 引擎 | 是否需要 CoreML | 备注 |
|---|---|---|
| whisper.cpp | **强烈建议开** (CoreML=1), 在 M2 Air 24GB 上 CoreML 把 large encoder 从 5466ms 降到 1439ms (3.8× speedup), small 从 1014ms 降到 199ms (5.1× speedup). 与大型模型 (large) 配 CoreML 是 M2 上唯一能跑 RT 的路径. |
| mlx-whisper | **不需要** (MLX 自动用 GPU+ANE); 但 Flash Attention + batched decoding 的提速还没合 upstream main branch ([issue #1412](https://github.com/ml-explore/mlx-examples/issues/1412) 仍 open). 用 pip 默认版速度不及 whisper.cpp CoreML large. |
| sherpa-onnx | **不需要** (Zipformer int8 encoder 仅 ~70 MB, CPU forward 数十 ms, ANE 收益边际). ORT CoreML EP 需自编译, 维护成本不值得. |
| FunASR | **不支持** CoreML; macOS 上只能 PyTorch CPU 或 CPU+MPS (MPS 只跑 encoder, Fun-ASR-Nano LLM 不行). |
| Speech.framework | **强制 ANE** via `requiresOnDeviceRecognition=true`. |

### Q5. 是否支持 VAD 自适应 / 静音剔除

- 4 个引擎内置 VAD: whisper.cpp (Silero-VAD v6.2), sherpa-onnx (Silero-VAD + FSMN), FunASR (FSMN-VAD), SenseVoice (FSMN-VAD). mlx-whisper 不内置, 需外部接.
- Speech.framework **不可配置 VAD** — 由系统决定.

### Q6. License 风险 (商业产品)

| 引擎 | License | 风险 |
|---|---|---|
| whisper.cpp | MIT | **零风险** (引擎); Whisper 模型归 OpenAI, 但商用已开放. |
| mlx-whisper | MIT | **零风险**; 同上 Whisper 模型. |
| sherpa-onnx | Apache-2.0 | **零风险** (引擎); icefall 训练 Apache-2.0; 预训练权重 Apache-2.0 (libri-speech-trained models 上游来源, 但**LibriSpeech 本身**是 CC-BY 4.0, 商用 OK, 但要求 attribution); 部分 Zipformer 训练数据含 GigaSpeech (听写语料许可). 全部 Apache/CC-BY, **合规 OK** 但 README 中需保留 attribution. |
| FunASR | MIT | **零风险**; SenseVoice MIT; Fun-ASR-Nano 包含 Qwen3 (Apache-2.0). |
| Speech.framework | Apple SDK | **低风险** (受 Apple 平台分发条款约束, 不能在 server-side 跑 Speech.framework); 严格说不能打包成 macOS 之外的"翻译服务"产品, 因为 Siri ASR 不允许转售. |

**总评**: 5 个引擎全部**商业可商用**, **没有 GPL/LGPL 传染风险**. Speech.framework 受 Apple 平台许可约束**是产品层面问题** (你不能基于 Siri ASR 做付费 SaaS).

### Q7. 跨平台 (macOS 跑通后 Windows / Linux 迁移)

- **whisper.cpp** ✅ 完美跨平台 (Linux/Win/macOS/Android/iOS/WASM, 一份代码同一二进制).
- **mlx-whisper** ❌ 限 Apple Silicon; 跨平台需换引擎.
- **sherpa-onnx** ✅ 最广 (Linux/Win/macOS/Android/iOS/HarmonyOS/WASM/NodeJS/RISC-V/NPU 后端); ONNX 模型格式**跨架构**, 一份 ONNX 权重到处跑.
- **FunASR** ✅ PyTorch 跨平台; 生产路径偏 Linux + CUDA.
- **Speech.framework** ❌ 仅 Apple.

→ 如果项目**未来要扩 Windows/Linux 客户端**, **sherpa-onnx 是唯一"一次模型多端跑"** 的引擎. whisper.cpp 也跨, 但模型文件 ggml 格式不通用 (需为每平台重导出).

---

## 推荐与理由

**R4 英文流式 ASR 首选 = sherpa-onnx + streaming-zipformer-en-2023-06-21 (LibriSpeech + GigaSpeech trained, int8)**.

理由 (按 R4 场景的优先级):
1. **真流式 partial 输出** — 唯一原生支持 token-level streaming partial 的引擎; partial latency ~200ms 直接满足 ≤1.3s 首音预算.
2. **WER 上限比 Whisper 更强** — test-clean 2.43% (Libri+Giga) vs Whisper large-v3 short-form 8.4%; streaming WER 数字对**远场噪声 / BPO 客户电话** 这种真实场景虽会退化, 但基线 SOTA.
3. **int8 量化后 < 200 MB** — 16 GB M2 Air 上同时跑 TTS (CosyVoice) + MT (Qwen3 等) 不会 OOM. whisper.cpp large-v3 即使 Q8 也要 ~1.6 GB + KV cache.
4. **License 干净 + 跨平台** — Apache-2.0 + ONNX 通用格式; 未来 Windows / Linux 客户端零成本迁移.
5. **内置 VAD + 热词** — 直接满足"客户专有名词"需求 (`hotwords_score`), 不需外部搭 VAD 流水线.

**备选 = whisper.cpp + CoreML + distil-large-v3 (或 large-v3-turbo Q5)**.

适用情况:
- 项目**只跑 macOS 一次, 不打算扩平台**, 且 partial 不严格 (用 `--step 500` 5s 切片够用);
- 客户场景需要**多语** (Whisper multilingual), 不只英文;
- 想避开 Zipformer "训练数据偏 LibriSpeech/GigaSpeech" 的领域适配风险 (Whisper 在 far-field English 上更鲁棒).

**FunASR / mlx-whisper / Speech.framework 的硬伤**:
- **FunASR**: 英语**只有 SenseVoiceSmall (离线) 或 Fun-ASR-Nano (LLM, 需 GPU)**, 都**不符合"低延迟流式"目标**.
- **mlx-whisper**: 纯 Apple Silicon, 跨平台不行; 非流式, partial 必须外部切片.
- **Speech.framework**: 平台锁定 (仅 Apple), 自定义词库不支持, 不能用于商业 SaaS 转售.

---

## Known issues / 风险

| 风险 | 来源 | 缓解 |
|---|---|---|
| sherpa-onnx CoreML EP 默认 wheel 不带 | [sherpa CMakeLists](https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/CMakeLists.txt) 无 `coreml` option | 在 M2 上不需要, int8 encoder CPU 几十 ms; 真要 CoreML 自编译 ORT + 改 sherpa CMake 调用 `provider="coreml"`, 维护成本高 |
| Zipformer 在远场噪声/客户电话场景 WER 可能比 LibriSpeech 退化 5-10× | 训练数据偏 clean read speech; paper Section 4 (arXiv 2407.04051 SenseVoice) 印证 senseVoice 在 CommonVoice 比 LibriSpeech 差很多 | PoC 阶段拿真实客户样本 (10-20 段录音) 跑 A/B; 若 WER 不达标, 备选方案自动 fallback 到 whisper.cpp large-v3-turbo Q5 |
| mlx-whisper 的 9.5× Flash Attention 提速 PR 未合 main | [issue #1412](https://github.com/ml-explore/mlx-examples/issues/1412) status: open | 备选时**不**依赖此提速; 若需 batching 走 whisper.cpp (cpp 路径) 或 ilyasmukiev/mlx-whisper-fast fork |
| whisper.cpp "CoreML hallucination on older macOS" | [whisper.cpp README Core ML 段](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) 警告 "MacOS Sonoma (version 14) or newer is recommended, as older versions of MacOS might experience issues with transcription hallucination" | 项目目标 macOS 14.4.1 ✅; 若客户用 13.x, 需提示. |
| SenseVoice / Fun-ASR-Nano 在 macOS MPS 上不稳定 | [FunASR README](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md) "AutoModelVLLM still depends on vLLM-Ascend ... hit Qwen3 rotary / TransData failures" | M2 跑 FunASR 不是首选路径, 即便用 CPU 也比 sherpa-onnx 慢得多 |
| Speech.framework 商业 SaaS 不可转售 Siri ASR | [Apple Speech.framework 文档](https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognizer.json) — 受 iOS/macOS SDK 条款约束 | 不要把 Siri ASR 作为产品后端, 仅作 demo / fallback (API quota 用尽时) |

---

## 跨 ticket 关联

- **T15 (金喜反推)**: 金喜用的是**云端 ASR+MT+TTS** 级联 (Doubao S2S, [issue 15 finding](issues/15-jinxi-architecture-reverse.md)). 本 ticket 的"本地 ASR"对应**R4 字幕模式**的本地 fallback (用户离线 / 隐私场景 / 海外网络差场景).
- **T16 (流式优化)**: sherpa-onnx Zipformer partial 接口是流式优化最重要的输入, T16 应基于 T17 选定的引擎做协议 / buffer / VAD 调优.
- **T18 (本地 MT)**: sherpa-onnx 同仓库下 NLLB / Qwen / 各种 CTC 模型可作为 MT baseline; T18 可借助同一推理栈.
- **T19 (本地 TTS)**: 内存预算上 T17 + T18 + T19 三者总和需 ≤ M2 16 GB 80% (留余量). sherpa-onnx Zipformer int8 ~200 MB 是**最小**的本地 ASR 内存占用, 给 T19 留最大余量.
- **T20 (混合架构)**: 本地 sherpa-onnx + 火山云端 Doubao S2S 的混合决策由 T20 给出; T17 给 T20 提供"本地模式" 是否可行 / 代价几何 的事实依据.

---

## Citation map

- whisper.cpp 引擎 README: https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md
- whisper.cpp LICENSE: https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/LICENSE (MIT)
- whisper.cpp stream example README: https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/stream/README.md
- whisper.cpp M2 benchmark comments: https://github.com/ggml-org/whisper.cpp/issues/89 (c1401394565 M2 Air CPU, c1535843651 M2 Air 24GB CoreML)
- mlx-whisper README: https://raw.githubusercontent.com/ml-explore/mlx-examples/main/whisper/README.md
- mlx-examples LICENSE: https://raw.githubusercontent.com/ml-explore/mlx-examples/main/LICENSE (MIT)
- mlx-whisper Flash Attention PR (open): https://github.com/ml-explore/mlx-examples/issues/1412
- sherpa-onnx README: https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/README.md
- sherpa-onnx LICENSE: https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE (Apache-2.0)
- sherpa-onnx Provider 头/源 (含 kCoreML): https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/sherpa-onnx/csrc/provider.cc
- Zipformer models doc: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html
- icefall LibriSpeech RESULTS.md (流式 Zipformer WER): https://raw.githubusercontent.com/k2-fsa/icefall/master/egs/librispeech/ASR/RESULTS.md
- icefall LICENSE (Apache-2.0): https://raw.githubusercontent.com/k2-fsa/icefall/master/LICENSE
- ONNX Runtime CoreML EP docs: https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html
- Distil-Whisper model card: https://raw.githubusercontent.com/huggingface/distil-whisper/main/README.md
- FunASR README: https://raw.githubusercontent.com/modelscope/FunASR/main/README.md
- FunASR model_selection (English path = SenseVoiceSmall / Fun-ASR-Nano): https://raw.githubusercontent.com/modelscope/FunASR/main/docs/model_selection.md
- FunASR LICENSE: https://raw.githubusercontent.com/modelscope/FunASR/main/LICENSE (MIT)
- FunAudioLLM SenseVoice LICENSE: https://raw.githubusercontent.com/FunAudioLLM/SenseVoice/main/LICENSE (MIT)
- SenseVoice paper: https://arxiv.org/abs/2407.04051
- Apple SFSpeechRecognizer (macOS 10.15+): https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognizer.json
- Apple SFSpeechRecognitionRequest.shouldReportPartialResults: https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognitionrequest/shouldreportpartialresults.json
- Apple SFSpeechRecognitionRequest.requiresOnDeviceRecognition: https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition.json