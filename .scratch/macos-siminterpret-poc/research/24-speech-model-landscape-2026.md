# 语音模型 × 技术栈 行业横评（2026-09）— Findings

> **Ticket**: `.scratch/macos-siminterpret-poc/issues/24-speech-model-landscape-2026.md`
> **目标**: 为开源中英双向同传产品（macOS 优先，音色克隆版，对标金喜双通道）产出「模型 × 维度」横评表 + 产品→栈映射 + 商用 license 安全清单 + v0/v1/v2 选型建议。
> **方法**: 仅一级源 — 模型仓库 README/LICENSE、官方定价页、arXiv 论文、官方产品文档。不引用第三方博客。数字无法从一手源验证的显式标注「未公开/未验证」。
> **前置研究（本文件不重复其细节，只引用结论）**:
> - T17 本地 ASR（`research/17-local-asr-macos-m2.md`）— whisper.cpp / mlx-whisper / sherpa-onnx / FunASR / Speech.framework 在 M2 上的实测
> - T18 本地 MT（`research/18-local-mt-models.md`）— LLM streaming MT 定价 + 本地 MT 模型 license/质量 + 4 个翻译 API
> - T19 TTS 延迟（`research/19-tts-latency-options.md`）— Doubao S2S / CosyVoice / GPT-SoVITS / StyleTTS2 / F5-TTS / ElevenLabs / Cartesia / Rime
> - T20 混合架构（`research/20-hybrid-cloud-local-architecture.md`）— 配置 A/B/C/D 可行性与内存预算
> **汇率口径**: 1 USD ≈ 7.20 CNY（2026-09 近似，便于横向比较）。

---

## 0. TL;DR

1. **本地 ASR**：M2 上唯一真流式 + 双语 + Apache-2.0 商用安全 = **sherpa-onnx streaming-zipformer-bilingual-zh-en int8**（~190MB，partial ~200ms）；备选 **Vosk**（30+ 语，Apache-2.0，中文大模型 cn-0.22 WER 13.98%）；whisper.cpp / mlx-whisper 仅整段式，~250ms partial（`--step` 滑窗）。
2. **云端 ASR**：**Deepgram Nova-3 multilingual** $0.288/h 是海外最强 zh-en；**Azure S1 流式 $1.00/h** + 0.5M chars/月免费适开发期；**豆包流式 ¥1/h**、**大模型流式 ¥4.5/h** 最便宜且 zh-en 母语；**阿里云 ISI** $1.40/h 偏贵但 Paraformer 全栈自托管友好；**讯飞 RTASR** $0.42–0.69/h 独占 13+ 中文方言免切换，但服务**仅限中国大陆**（ToS §13.4）。
3. **MT**：LLM streaming 是主流，**Qwen-MT-Lite ¥0.6/1.6 per M**、**doubao-seed-1.6-flash ¥0.15/2** 是中文 zh-en 性价比第一梯队；专用 MT 开源安全只有 **opus-mt**（Apache-2.0/CC-BY）+ **Qwen2.5-1.5B**（Apache-2.0），**NLLB-200-distilled 商用禁用**（CC-BY-NC）+ **mBART-50-mmt 无 LICENSE 文件 = 默认版权保留禁用**。
4. **TTS**：商用安全 Apache/MIT 零样本克隆：**CosyVoice 3**（Apache-2.0，GPU 150ms，9 语 + 18 方言，跨语种零样本）+ **Chatterbox**（MIT，Turbo 75ms on GPU，10s 零样本，Multilingual V3 23 语含 zh-cmn 专用微调）；无克隆极速：**Kokoro-82M**（Apache-2.0，M 系 MPS 官方）；⚠️ **ChatTTS 商用禁用**（AGPL+CC-BY-NC），**Piper 迁至 GPL-3.0 + 语音包限 personal/research**，**Edge-TTS 微软已禁 SSML**；云 TTS 首音：**Rime Mist v3 37ms / Coda 96ms**，**ElevenLabs Flash 75ms**，**Cartesia Sonic 3.6 90ms**，**MiniMax Speech ¥3.5/万字符（HD）**。
5. **E2E S2S**：zh-en 同传 SOTA 商用 = **Doubao Seed LiveInterpret 2.0**（输入 ¥80 + 文本 ¥80 + 音频 ¥300 per M，~¥14.6/h 后付费，BLEURT 64.9，2.5s 首音，零样本克隆内置）；唯一**商用安全**开源 zh-en E2E = **Qwen2.5-Omni-7B（Apache-2.0）** 与 **Step-Audio 2 mini（Apache-2.0）**（CoVoST2 zh-en BLEU 均 ~29.4，Step-Audio 2 mini 含 in-house 中文方言 SOTA 8.85%）；**Moshi 200ms 商用安全（CC-BY 4.0）但仅英文**；**SeamlessM4T v2 / SeamlessStreaming** CC-BY-NC 4.0 商用禁用。
6. **商用 license 红线集中三档**：❌ **AGPL-3.0 + CC-BY-NC-4.0**（ChatTTS、F5-TTS 权重、SeamlessStreaming、SeamlessM4T v2）；❌ **GPL-3.0**（Piper 迁库后，仅 GPL 兼容产品可用）；⚠️ **版权保留默认**（mBART-50 无 LICENSE 文件）。
7. **去字节单一供应商对冲**：**Qwen 全家桶**（Qwen2.5-Omni + Paraformer ASR + Qwen-MT + CosyVoice 3）= 唯一完整 Apache-2.0 替代栈；备选 **Aliyun ISI + Qwen-MT-Flash + CosyVoice 3**。
8. **v0/v1/v2 路径**（来自 §7）：v0 全 Doubao ~¥14.6/h（最快上线）；v1 本地 ASR + 云 MT + 本地/云 TTS 混合 ~¥1.2/h；v2 全本地 ¥0/h 但 Piper 无克隆 = 硬天花板。

---

## 1. ASR inventory

### 1.1 本地 ASR（详表见 T17；此处为横评口径压缩版）

| 模型 | 首 partial 延迟 (M2) | 质量 (官方口径) | License | 跨平台 | 成本 | 音色克隆 | 来源 |
|---|---|---|---|---|---|---|---|
| **whisper.cpp (large-v3-turbo / distil-large-v3)** | ~250ms (small+CoreML) ~ 1.5s (large CoreML)；非真流式，`--step 500` 滑窗模拟 | large-v3 short-form WER 8.4% (LibriSpeech)；distil-large-v3 9.7% | 引擎 MIT；Whisper 权重 OpenAI（商用已开放） | ✅ 全平台 (Win/Linux/Android/iOS/WASM) | ¥0 本地 | N/A | [README](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) / [LICENSE](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/LICENSE) / [issue #89](https://github.com/ggml-org/whisper.cpp/issues/89) |
| **mlx-whisper** | 非流式；transcribe 整段 | 同 Whisper | MIT (Apple) | ❌ 仅 Apple Silicon | ¥0 | N/A | [mlx-examples whisper](https://raw.githubusercontent.com/ml-explore/mlx-examples/main/whisper/README.md) |
| **sherpa-onnx (Zipformer en / 双语)** | **~200ms 真流式 partial**（320ms chunk） | Zipformer-en Libri test-clean 2.43–3.06% WER；双语 zh-en 模型可用 | Apache-2.0（引擎+模型） | ✅ 最广（Linux/Win/macOS/Android/iOS/WASM/NodeJS） | ¥0 | N/A | [Zipformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html) / [icefall RESULTS](https://raw.githubusercontent.com/k2-fsa/icefall/master/egs/librispeech/ASR/RESULTS.md) |
| **sherpa-onnx (Paraformer 双语 zh-en)** | 流式 partial（chunk-based，比 Zipformer 略慢但更准） | 中英双语官方模型 | Apache-2.0 | ✅ 同上 | ¥0 | N/A | [paraformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-paraformer/paraformer-models.html) |
| **sherpa-onnx (SenseVoice)** | 非自回归，离线整段 | 中英日韩粤；CER 官方未给英语 WER | Apache-2.0（模型 MIT） | ✅ | ¥0 | N/A | [SenseVoice](https://arxiv.org/abs/2407.04051) |
| **FunASR** | SenseVoiceSmall 离线一次性；Fun-ASR-Nano 需 GPU | AISHELL CER 官方；CommonVoice en < Whisper-small | MIT | ✅ PyTorch（生产偏 Linux+CUDA） | ¥0 | N/A | [FunASR](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md) |
| **Vosk** | 句段/真流式（partial）；中文小模型在 SpeechIO-02 WER 23.54%；大模型 cn-0.22 WER 13.98% | large 中文 WER 7.43% (THCHS) / 13.98% (SpeechIO-02)；small-en-us WER 9.85% (LibriSpeech) | **引擎 Apache-2.0**；中文/英文模型 **Apache-2.0**；小语种若干 LGPL-3.0 / CC-BY-NC-SA / AGPL | ✅ 全平台（含 iOS/WASM） | ¥0 | N/A | [vosk-api README](https://raw.githubusercontent.com/alphacep/vosk-api/master/README.md) + [models](https://alphacephei.com/vosk/models) |
| **Apple Speech.framework** | 句段级 partial（~150-300ms 经验值） | Apple 不公开 WER | Apple SDK 条款（仅 Apple 平台，不可转售为 SaaS 后端） | ❌ 仅 Apple | ¥0 | N/A | [SFSpeechRecognizer](https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognizer.json) |

### 1.2 云端流式 ASR

**火山引擎豆包系（官方计费 PDF 一手核实，2026-09）** — [豆包语音_产品计费 PDF](https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3_%E4%BA%A7%E5%93%81%E8%AE%A1%E8%B4%B9_1787232335.pdf):

| 服务 | 后付费单价 | 资源包折算 | 备注 |
|---|---|---|---|
| 豆包流式语音识别模型 2.0 | **¥1/小时** | ¥1.2–2.2/小时（30h–30万h 包） | 轻量流式 ASR |
| 大模型流式语音识别 | **¥4.5/小时** | ¥2.4–4.4/小时 | 大模型版，精度更高 |
| 豆包录音文件识别 2.0（离线） | ¥0.8/小时 | — | 非流式，参考 |

**其余 4 家云 ASR（Deepgram / Azure / Google / 阿里 Paraformer / 讯飞）— 一手核实（2026-09）**：

| 提供商 | 服务 / 后付费单价 | zh-en 支持 | License / ToS 要点 | 免费试用 | 公开质量 | 来源 |
|---|---|---|---|---|---|---|
| **Deepgram Nova-3**（streaming） | `nova-3-general` mono 流式 **促销 $0.0048/min ≈ $0.288/h**；常规 list $0.0077/min ≈ **$0.462/h**；`nova-3-medical` 仅英文；`nova-3-multilingual` 促销 $0.348/h；Flux conversational EN $0.39/h / multilingual $0.468/h；batch `nova-3-general` mono $0.0043/min ≈ $0.258/h | ✅ `zh`, `zh-CN`/`zh-Hans`, `zh-TW`/`zh-Hant`, `zh-HK`（粤语繁体）均在 `nova-3-general` 中 | 专有；ToS（Last Updated Aug 6, 2026）默认赋予 Deepgram "perpetual, sublicensable, royalty-free, worldwide" 许可证以使用 Your Content；**按请求 opt-out** API 参数；HIPAA/GDPR EU 端点（api.eu.deepgram.com）可选 | **$200 免费 credit**，不过期、不需信用卡 | 厂商自评 54.2% WER 增益（streaming）/ 47.4%（batch）vs 竞品（自家多语种 benchmark，**绝对 WER 未公开**） | [deepgram.com/pricing](https://deepgram.com/pricing) · [developers.deepgram.com/docs/models-languages-overview](https://developers.deepgram.com/docs/models-languages-overview) · [deepgram.com/terms](https://deepgram.com/terms) |
| **Azure AI Speech（Speech-to-Text）** | Real-time **Standard S1: $1.00/h**；Custom Neural: $1.20/h；Fast Transcription (sync): $0.36/h；Batch: $0.18/h（East US retail） | ✅ Mandarin（简/繁）+ Cantonese；完整 locale 列表见 [language-support?tabs=stt](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt) | Microsoft Customer Agreement + Azure Product Terms / DPA；**默认不用 audio 训练基础模型**；HIPAA-eligible / GDPR / ISO / SOC 合规 | **0.5M neural characters/月** Always Free；新账号 $200 credit / 30 天 | 官方未发布 zh WER | [azure.microsoft.com/en-us/pricing/details/speech/](https://azure.microsoft.com/en-us/pricing/details/speech/) · [learn.microsoft.com/.../speech-to-text](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text) · Retail API `prices.azure.com/api/retail/prices` |
| **Google Cloud Speech-to-Text v2** | **未公开/未核实**（`cloud.google.com/speech-to-text/pricing` 本次 sandbox 无法获取；建议投产前在控制台确认） | ✅ Mandarin、Cantonese 等（GCP 语言矩阵） | 专有（Google Cloud ToS + Service Specific Terms for Speech-to-Text；默认 audio 不训练基础模型） | 历史数据 0–60 分钟/月免费，**未从一手源验证当前数字** | **未公开** | https://cloud.google.com/speech-to-text/pricing （sandbox 无法访问；T18 gap #7 同） |
| **阿里云智能语音 ISI（含 Paraformer 流式）** | 实时语音识别（流式）：**$1.40/h**（0–299 h/day 标准）；阶梯 $1.20/1.00/0.86/0.70（≥5,000 h）；录音文件识别 $1.00/h（≥5,000 h $0.60）；一句话识别 $1.40/千次 | ✅ 普通话、粤语、英语、日语、韩语、法语、印尼语；自学习平台 + 热词；中文单语 | Alibaba Cloud 产品条款；数据主权 aliyun.com.cn / intl；服务条款禁止训练竞品模型 | **3 个月免费试用**：real-time / 短句 / TTS unlimited（并发 ≤2）；录音文件 2 h/day | 厂商自评 ~20% WER 下降（LC-BLSTM + DFSMN-CTC vs 传统 CTC，**benchmark 未公开**） | [alibabacloud.com/help/en/isi/product-overview/pricing](https://www.alibabacloud.com/help/en/isi/product-overview/pricing) · [alibabacloud.com/.../intelligent-speech-interaction](https://www.alibabacloud.com/en/product/intelligent-speech-interaction) |
| **科大讯飞 RTASR 大模型**（流式）+ LFASR（录音文件）+ IAT（短句流式） | RTASR 个人试用 5h / 2-conn / 1yr；企业试用 50h / 5-conn / 1yr；商业包 ¥198/40h → **有效 ¥4.95/h ≈ $0.69/h**；¥4,000/1,000h → $0.56/h；¥17,500/5,000h → $0.49/h；¥60,000/20,000h → $0.42/h。LFASR ¥198/80h → **$0.35/h**；¥4,000/2,000h → $0.28/h。IAT 10万次/3 个月免费；¥1,300/50 万次 | ✅ **13+ 方言免切换**（普通话、粤语、四川话、河南话、东北话等）；中英文混排 | [用户服务协议](https://www.xfyun.cn/doc/policy/agreement.html) §13.4：**仅限中国大陆地区使用**；强制实名认证（含企业）；上传内容可用于"技术优化、故障分析和排除"；合成内容须保留合成标识 | 个人 5h/2-conn/1yr + 企业 50h/5-conn/1yr；LFASR 同；IAT 10万次/3 月 | **未公开** 公开 benchmark | [xfyun.cn/services/rtasr](https://www.xfyun.cn/services/rtasr) · [xfyun.cn/services/lfasr](https://www.xfyun.cn/services/lfasr) · [xfyun.cn/services/voicedictation](https://www.xfyun.cn/services/voicedictation) |

**横向结论（与豆包/火山对比）**：

- **海外首选 Deepgram**：$0.288–0.462/h streaming 显著低于其他国际厂商；Nova-3 multilingual zh-en 支持；$200 免费 credit；ToS 注意 opt-out。
- **国内中文方言**讯飞独占（13+ 方言免切换）；但服务仅限中国大陆，国际部署需走 global.xfyun.cn。
- **Azure 真实流 $1/h** 与豆包大模型流式 ¥4.5/h (~$0.625) 同量级；Azure 自带 $200/30 天 + 0.5M chars/month 免费，**适合开发期白嫖**。
- **Paraformer 同义矩阵 Aliyun ISI** 比 Deepgram/Azure 贵（$1.40/h vs $0.288–1.00/h），但阿里方舟 Qwen-MT + CosyVoice 全栈可自托管，是**避免单供应商绑定**的核心替代栈。
- **Google v2 实时价**本会话未从 Google 一手源核实（T18 gap #7），投产前需现场查。

### 1.3 Vosk（本地，T17 未覆盖）

**基本信息**（一手核实 [alphacep/vosk-api README](https://raw.githubusercontent.com/alphacep/vosk-api/master/README.md) + [alphacephei.com/vosk](https://alphacephei.com/vosk/) + [alphacephei.com/vosk/models](https://alphacephei.com/vosk/models)）：

| 项 | 值 | 来源 |
|---|---|---|
| 项目方 | Alpha Cephei（同名公司官网 alphacephei.com） | README |
| 引擎 license | **Apache-2.0**（vosk-api 仓库整体） | GitHub repo metadata |
| 模型 license | **绝大多数 Apache-2.0**；小模型 Linux 模型（如 vosk-model-small-en-us-zamia-0.5 / small-de-zamia-0.3）**LGPL-3.0**；法语 pguyot 模型 **CC-BY-NC-SA-4.0**；LINTO 学术合作模型 **AGPL**（en-us-daanzu、fr-0.6-linto、ar-0.22-linto）；中文专用模型 cn-0.22 / cn-kaldi-multicn / small-cn / cn-kaldi-multicn 均 **Apache-2.0**；uk 3B 较小模型亦 Apache-2.0 | alphacephei.com/vosk/models |
| 覆盖语言 | 30+：en（US/IN）、zh（CN）、ru、fr、de、es、pt、ja、ko、hi、ar、fa、it、nl、ca、cs、pl、sv、fi、uk、el、tr、vn、kk、ka、uz、ky、br、gu、tg、te 等 | alphacephei.com/vosk |
| 部署平台 | Linux x86_64 / ARM64、Windows、**macOS**、Android、iOS、Raspberry Pi、浏览器 (WASM)、NodeJS、嵌入式 ARM | README |
| 真流式支持 | ✅ 提供 streaming API（zero-latency response）；PyAudio / websocket / mic demo 完整 | README |
| 句段级 vs 真流式 | 句段（partial result）模型在小模型上动态词汇可改写；大模型（>1.5GB）为静态 | alphacephei.com/vosk/models |
| 中文专用模型 | `vosk-model-small-cn-0.22` (42MB, 轻量 Android/RPi)；`vosk-model-cn-0.22` (1.3GB, 服务端高质量)；`vosk-model-cn-kaldi-multicn-0.15` (1.5GB, Kaldi 多 cn + Vosk LM) | alphacephei.com/vosk/models |
| 中文 ASR 质量 | small-cn 在 SpeechIO-02 WER **23.54%**、THCHS WER **17.15%**；大模型 cn-0.22 在 SpeechIO-02 WER **13.98%**、THCHS WER **7.43%** | alphacephei.com/vosk/models |
| 英文质量 | small-en-us WER 9.85% (LibriSpeech test-clean)；en-us-0.22 WER **5.69%**；en-us-0.42-gigaspeech WER **5.64%**（podcast 优化） | 同上 |
| 内存占用 | 小模型 ~50MB / 运行时 ~300MB；大模型可达 16GB | 同上 |
| 安装 | `pip3 install vosk`（含 Python/Java/Node.JS/C#/C++/Rust/Go 绑定） | README |
| 同样代码可商用 | ✅（Apache-2.0；中文模型 Apache-2.0；需避开 LGPL/AGPL/CC-BY-NC-SA 的少数派生模型） | license 列逐条 |

**相对 sherpa-onnx 的取舍**：
- ✅ 更轻量（small-cn 仅 42MB）、官方中文/英文/小语种模型矩阵最全（30+ 语，Kaldi lineage 长期维护）
- ✅ 真流式 + speaker ID 内置；多语言绑定最广（含 Rust、Go）
- ❌ 中文 SOTA 模型离线 WER 13.98% (SpeechIO-02) 不及 sherpa-onnx Zipformer 双语（icefall LibriSpeech test-clean 2.43%），WER 上限落后
- ❌ 不支持热词/上下文偏置同等细粒度（仅小模型支持动态词汇）
- ❌ 无 voice cloning 接口

**对本项目（macOS zh-en 同传）的定位**：与 sherpa-onnx Zipformer 二选一的本地 ASR 备选；Vosk 胜在语言覆盖与工程成熟度，负于中文精度上限；若需多语种（en/zh/ru/ja/ko 同列），Vosk 是单一引擎最便利。

---

## 2. MT inventory

### 2.1 LLM streaming MT（商用 API）

> T18 §3 已有完整定价（2026-09 华北2口径）；此处补豆包 LLM 家族（火山方舟官方价目页）。

| 模型 | ¥/M input | ¥/M output | ¥/小时估算 (60k tok) | 流式 | 商用 | 来源 |
|---|---|---|---|---|---|---|
| **Qwen-MT-Lite** | 0.60 | 1.60 | ~¥0.07 | ✅ token-by-token | ✅ | [Aliyun billing](https://help.aliyun.com/zh/model-studio/billing) |
| **Qwen-MT-Flash** | 0.70 | 1.95 | ~¥0.08 | ✅ | ✅ | 同上 |
| **Qwen-MT-Plus** | 1.80 | 5.40 | ~¥0.22 | ✅ | ✅ | 同上 |
| **DeepSeek V4-Flash** (off-peak) | 1.58（cache-hit 0.05） | 4.75 | ~¥0.14–0.19 | ✅ | ✅ (custom license) | [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| **GPT-4o-mini** (Azure Global) | 1.08 (cached 0.54) | 4.32 | ~¥0.16 | ✅ | ✅ | [Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) |
| **Claude Haiku 4.5** | 7.20 (cache read 0.72) | 36.00 | ~¥1.09–1.30 | ✅ | ✅ | [Claude pricing](https://claude.com/pricing#api) |
| **豆包 doubao-seed-1.6-flash** | **0.15** | 2.00（待确认区间价） | ~¥0.05 | ✅ | ✅（商用 API） | [火山方舟模型价格](https://www.volcengine.com/docs/82379/1544106) |
| **豆包 doubao-seed-1.6** | 0.80（≤32K；特惠区 ≤200 输出） | 2.00（特惠区）/ 8.00（标准） | ~¥0.10–0.30 | ✅ | ✅ | 同上 |
| **豆包 doubao-seed-translation**（翻译专用） | 1.20（特惠 0.60） | 3.60（特惠 1.80） | ~¥0.15–0.30 | ✅ | ✅ | 同上 |
| **豆包 doubao-1.5-lite-32k** | 0.30 | —（价目页见源） | ~¥0.05 | ✅ | ✅ | [计费文档](https://www.volcengine.com/docs/6492/1544808) |

> 注：豆包价格提取自火山方舟官方「模型价格」页（JS 渲染，经搜索快照读取官方表格）；投产前以控制台实时价为准。四家国际/国内 LLM **均不公开 TTFT**，必须实测（T18 §3.2）。

### 2.2 专用 MT（开源 + 商用 API）

| 模型 | 类型 | 质量（官方） | License | 商用? | 流式 | 来源 |
|---|---|---|---|---|---|---|
| **Helsinki-NLP/opus-mt-en-zh** | Marian | Tatoeba BLEU 31.4 | Apache-2.0 | ✅ | 句级 only | [HF card](https://hf-mirror.com/Helsinki-NLP/opus-mt-en-zh/raw/main/README.md) |
| **Helsinki-NLP/opus-mt-zh-en** | Marian | Tatoeba BLEU 36.1 | CC-BY-4.0（需归功） | ✅ | 句级 | [HF card](https://hf-mirror.com/Helsinki-NLP/opus-mt-zh-en/raw/main/README.md) |
| **facebook/m2m100_418M** | Transformer | Flores chrF++ 官方 | MIT | ✅ | 句级 | HF card |
| **facebook/nllb-200-distilled-600M/1.3B** | NLLB | Flores chrF++ -1.4~-3.7 vs full | **CC-BY-NC-4.0** + "research model, not for production" | ❌ **商用禁用** | 句级 | [HF card](https://hf-mirror.com/facebook/nllb-200-distilled-600M/raw/main/README.md) |
| **SeamlessM4T v2** | S2ST/S2TT（UnitY2 架构 2.3B） | README 确认 v2 **improves over v1 in quality and inference latency in speech generation tasks**；具体 S2ST BLEU / 延迟数字见官方 [metrics zip](https://dl.fbaipublicfiles.com/seamless/metrics/seamlessM4T_large_v2.zip) 与 [HF model card](https://huggingface.co/facebook/seamless-m4t-v2-large)；arXiv 2502.00109 / seamless_communication [README](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/README.md) | **CC-BY-NC-4.0**（一手核实 [LICENSE](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/LICENSE)）；非生成组件（w2v-BERT 2.0 编码器、代码）MIT | ❌ **商用禁用**（NonCommercial 条款明确） | 句级 | [README](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/README.md) · [LICENSE](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/LICENSE) |
| **Qwen2.5-1.5B-Instruct（本地 LLM MT）** | decoder-only | 无独立 MT BLEU | Apache-2.0 | ✅ | ✅ token-by-token | [LICENSE](https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct/raw/main/LICENSE) |
| **Hunyuan-MT-7B（腾讯，本票新增核实）** | 专用 7B MT | **WMT25 参赛 31 类中 30 类第一**（官方 README）；33 语互译含中文+少数民族语 | Tencent Hunyuan Community License（本会话逐条核实 [License.txt](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan-MT/main/License.txt)） | ✅ 商用（<1 亿 MAU；EU/UK/韩国除外） | 句级 | [GitHub](https://github.com/Tencent-Hunyuan/Hunyuan-MT) |
| **TranslateGemma 4B/12B/27B（Google，本票新增核实）** | 专用 MT（Gemma3 基座） | 官方未给统一 BLEU（论文见模型卡） | **Gemma license**（HF metadata `license:gemma`；权重访问需登录接受条款） | ✅ 商用（受 Gemma 条款约束） | 句级 | [HF](https://hf-mirror.com/google/translategemma-4b-it) |
| **火山机器翻译大模型** | 云 API | LLM-backed | 商用 | ✅ | ❌ batch REST only（≤16×1024 tok） | [docs](https://www.volcengine.com/docs/6561/2306735) ¥1.8/M in + ¥5.4/M out ≈ ¥0.11/h |
| **DeepL API Pro** | 云 API | NNMT SOTA 级 | 商用 | ✅ | ❌ batch REST | [DeepL Pro](https://www.deepl.com/en/pro#api)（~¥5.4/h 估算，500k chars/mo 免费档） |
| **Azure Translator v3 (S1)** | 云 API | WMT 竞争性 | 商用 | ✅ | ❌ batch REST（流式要走 Azure Speech Translation，¥18/h） | [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/translator/) $10/M chars |
| **Google Cloud Translation Basic v2 / Advanced v3** | 云 API | Advanced SOTA 级 | 商用 | ✅ | ❌ batch REST | [pricing](https://cloud.google.com/translate/pricing)（$20/M / $60/M 未在本会话从 Google 一手源验证，T18 gap #7） |

---

## 3. TTS inventory

### 3.1 本地 TTS（T19 已覆盖部分压缩版）

| 模型 | 首音延迟 | 质量（官方口径） | License（代码/权重） | 跨平台 (M2) | 成本 | 音色克隆 | 来源 |
|---|---|---|---|---|---|---|---|
| **CosyVoice 3 (Fun-CosyVoice3-0.5B)** | 150ms（GPU 自报） | test-zh CER 1.21% / test-en WER 2.24% / SS 71.8–78% | Apache-2.0 / Apache-2.0 | ⚠️ M2 无官方 benchmark；vLLM MPS 支持有限 | ¥0 | ✅ 零样本 + 跨语种（9 语种+18 方言） | [README](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md) / [LICENSE](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE) |
| **GPT-SoVITS v2 ProPlus** | RTF 0.526 (M4 CPU) → 首音数秒 | — | MIT / MIT | ✅ Apple Silicon 测试环境（CPU 路径） | ¥0 | ✅ 5s zero-shot / 1min few-shot；en/ja/ko/yue/zh | [README](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md) |
| **F5-TTS** | 253ms avg (RTX L20) | RTF 0.0394 | MIT / **CC-BY-NC（Emilia 数据）** | ⚠️ 主 NVIDIA | ¥0 | ✅ reference-guided | [README](https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md) |
| **StyleTTS 2** | 未量化 | — | MIT / **需合成声明条款** | ⚠️ 主 GPU | ¥0 | ✅ 零样本（LibriTTS）；中文需自训 PL-BERT | [README](https://raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md) |
| **Piper（OHF-Voice/piper1-gpl）** | 无公开数字；官方定位 "fast, local, Raspberry Pi 4 优化"；`--output-raw` 可流式 | 轻量神经 TTS | **GPL-3.0**（代码）；语音包按各自 MODEL_CARD（zh_CN 3 个音色；个人/研究 use 限） | ✅ 极轻量，Pi4 级设备可跑；macOS 需自构建 | ¥0 | ❌ 无克隆；需自训 | 详见 §3.3 |
| **CjangCjengh/vits（中文 VITS）** | 未量化 | — | MIT（历史；2026 仓库 404 ⚠️） | ✅（PyTorch） | ¥0 | ❌ 预训练多说话人，非零样本 | 详见 §3.3（仓库可用性需重核） |
| **ChatTTS** | RTF ≈0.3 (RTX 4090) ≈ 7 semantic tok/s；首包未量化 | 对话式韵律 | 代码 **AGPL-3.0+** / 权重 **CC-BY-NC 4.0** | ⚠️ 仅 NVIDIA（无 MPS 官方） | ¥0 | ⚠️ `sample_random_speaker()` 高斯采样；README 称 0-shot DVAE code 已发布但无参考音频接口 | ❌ 商用禁用（README "academic purposes only"） |
| **Kokoro-82M** | 82M 极小，CPU 实时级；首包未量化 | 8 语 54 音色（zh lang_code='z'） | Apache-2.0 / Apache-2.0 | ✅ M 系 MPS 官方：`PYTORCH_ENABLE_MPS_FALLBACK=1` | ¥0 | ❌ 预设音色，无零样本 | 详见 §3.3 |
| **Chatterbox（resemble-ai）** | Pro 商用 sub-200ms（自报）；OSS 未量化 | 零样本克隆 + 情绪控制 | **MIT / MIT** | ✅ `device="mps"` 直接列出 | ¥0 | ✅ ~10s 零样本；Multilingual V3 23 语含 `zh-cmn` 专用微调；PerTh 水印 | 详见 §3.3 |

### 3.2 云端 TTS（T19 已覆盖部分压缩版）

| 模型 | 首音延迟 | 价格 | 音色克隆 | zh/en | License/条款 | 来源 |
|---|---|---|---|---|---|---|
| **Doubao 同传 2.0 S2S（内置 TTS）** | 端到端 2.5–3s | 未公开（控制台） | ✅ 零样本内置（speaker_id 留空） | ✅/✅ 母语 pair | 商用 API | [arXiv 2507.17527](https://arxiv.org/abs/2507.17527) |
| **Doubao bigtts（语音合成模型 2.0）** | 未在公开 docs 量化 | **¥3/万字符**（后付费）；声音复刻 2.0 训练 ¥3/万字符 | ✅ 复刻 2.0 训练 → speaker_id | ✅/✅ | 商用 API | [计费 PDF](https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3_%E4%BA%A7%E5%93%81%E8%AE%A1%E8%B4%B9_1787232335.pdf) |
| **大模型语音合成 / 大模型声音复刻** | 未公开 | ¥5/万字符（合成）/ ¥8/万字符（复刻）后付费；资源包低至 ¥1.6/万字符 | ✅ | ✅/✅ | 商用 API | 同上 |
| **ElevenLabs Flash/Turbo** | ~75ms TTFB | $0.05/1K chars ≈ ¥2.16/h | ✅ Instant（Starter+） | v3 70+ 语 | 商用订阅 | [pricing](https://elevenlabs.io/pricing/api) |
| **Cartesia Sonic 3.5/3.6** | ~90ms TTFB | ~$0.03/1K chars ≈ ¥1.30/h | ✅ 10s → 44 语言 | ✅/✅ | 商用订阅 | [pricing](https://www.cartesia.ai/pricing) |
| **Rime Mist v3 / Coda** | TTFA P50 37ms / 96ms | $0.03–0.05/1K chars ≈ ¥1.30–2.16/h | ✅ Enterprise | Mist 无中文；Coda 8 语 | 商用订阅 | [pricing](https://www.rime.ai/pricing) |
| **MiniMax Speech**（speech-2.8-hd/turbo，云端） | 未量化 | 未公开 | 闭源 | N/A | HD ¥3.5/万字符 / Turbo ¥2/万字符（paygo） | ✅ 10s–5min 参考 + 首次合成 ¥9.9/音色 | [platform.minimaxi.com pricing-paygo](https://platform.minimaxi.com/docs/guides/pricing-paygo) |
| **Azure TTS（Speech in Foundry Tools，neural/HD）** | 未量化；批量 P50 ≤10–20s | 未公开统一 MOS | 闭源云；custom voice 需申请 | N/A | 每 1M 字符未从一手源核实（JS SPA） | Personal Voice 10–30s 音频 + Professional Voice Fine-tuning 20–40 hr | [Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) |
| **Edge-TTS（rany2/edge-tts，免费封装）** | 不适用 | 不适用 | **LGPL-3.0** | N/A | 免费（无 API Key） | ❌ 仅 `--voice` 切换 Microsoft 已发布音色（300+） | [rany2/edge-tts](https://github.com/rany2/edge-tts) |

### 3.3 新增 TTS 调研（T19 未覆盖）

| 引擎 | 首音延迟 | 质量（官方） | License（代码 / 权重） | 跨平台 (M2) | 成本 | 音色克隆 | 来源 |
|---|---|---|---|---|---|---|---|
| **Piper（OHF-Voice/piper1-gpl）** | **未量化** — README 未公布 RTF/首包；[samples](https://rhasspy.github.io/piper-samples) 听感即可 | 仓库仅给 voice samples，无 MOS/CER 数字 | **代码 GPL-3.0**（[GitHub API spdx_id](https://api.github.com/repos/OHF-Voice/piper1-gpl) `GPL-3.0`；仓库名带 `-gpl` 后缀）；原 rhasspy/piper 已迁库并指向此处；语音包 MODEL_CARD 限 personal/research | 官方仅 Linux/Windows prebuilt；[BUILDING.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/BUILDING.md) 给 macOS 构建路径，无独立 MPS 验证 | ¥0 本地 | ❌ 无零样本；每音色独立 `.onnx`，需自训 | [piper1-gpl README](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/README.md) · [VOICES.md（含 zh_CN）](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/VOICES.md) · [TRAINING.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/TRAINING.md) |
| **CjangCjengh/vits-Chinese** | 未量化 | 未公开 | **MIT**（历史 README 注明；**当前 GitHub + raw README 均 404**，2026 实际可用性未验证） | ✅ PyTorch | ¥0 | ❌ 预训练多说话人，非零样本 | [github.com/CjangCjengh/vits-Chinese](https://github.com/CjangCjengh/vits-Chinese)（本次会话 404；标注 ⚠️ 仓库存在性需重新核实） |
| **ChatTTS（2noise/ChatTTS）** | 未量化首包；FAQ 给 **RTF ≈ 0.3**（4090、30s 切片、~7 semantic tok/s，吞吐而非首包） | 仓库自述"在韵律上超越大多数开源 TTS"，无 MOS | **代码 AGPLv3+**（[README Licenses §](https://raw.githubusercontent.com/2noise/ChatTTS/main/README.md)）；**权重 CC-BY-NC 4.0**；PyPI `pip install ChatTTS` 沿用 AGPLv3+ | 未官方声明 MPS；仅 NVIDIA（vLLM/TransformerEngine/FlashAttention-2 路径全 Linux + NVIDIA） | ¥0（但 README "for academic purposes only"，商用禁用） | ⚠️ README 称 DVAE encoder + 0-shot inferring code 已发布；示例仅 `chat.sample_random_speaker()` 高斯采样；**无参考音频克隆接口** | [ChatTTS README](https://raw.githubusercontent.com/2noise/ChatTTS/main/README.md) · [LICENSE](https://github.com/2noise/ChatTTS/blob/main/LICENSE) |
| **MiniMax Speech**（speech-2.8-hd / speech-2.8-turbo） | 未量化 | 未公开（无 MOS / CER） | **闭源云服务** | N/A（云 API） | **HD ¥3.5/万字符；Turbo ¥2/万字符**（paygo，同步/异步同价）；中文 1 字 = 2 字符；资源包 HD ¥630/2M字符 / 1 月，¥5,950/20M / 3 月，¥56,000/200M / 1 年；Turbo 同等 ¥360/¥3,400/¥32,000 | ✅ 音色快速复刻：10s–5min 参考音频 mp3/m4a/wav ≤20MB，可选 ≤8s prompt 增强；首次合成扣 **¥9.9/音色** | [platform.minimaxi.com/docs/guides/pricing-paygo](https://platform.minimaxi.com/docs/guides/pricing-paygo) · [speech-voice-clone](https://platform.minimaxi.com/docs/guides/speech-voice-clone) · [system-voice-id](https://platform.minimaxi.com/docs/faq/system-voice-id)（130+ 音色含粤语、英语、日语、韩语） |
| **Azure TTS（Speech in Foundry Tools）** | 未量化；批量合成文档：50% 输出 ≤10–20s、95% 输出 ≤120s；实时 SDK 未公布 | 文档 "indistinguishable from human recordings"，按语音 sample gallery 单独看 | **闭源云服务**；Personal Voice 10–30s 参考音频 + Professional Voice Fine-tuning（20–40 compute hr）**"apply to use custom voice" 需批准** | N/A；edge/embedded 容器需 Intel/AMD CPU | **未从一手源核实每 1M 字符价**（[azure.microsoft.com/.../pricing/details/speech-services/](https://azure.microsoft.com/en-us/pricing/details/speech-services/) 为 JS SPA，本次 web_fetch 仅取到导航骨架，未抓到 Neural/HD 数字）；按字符计费，**中文 1 字 = 2 字符**（[Learn 文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) 定义 billable characters） | ⚠️ 受限：Personal Voice 需申请，Professional Voice 需审批；非"自助零样本" | [Learn 概述](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) · [language-support?tabs=tts](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)（100+ 神经语音，覆盖 `zh-CN`/`zh-CN-shandong`/`zh-CN-sichuan`/`zh-HK`/`zh-TW`/`wuu-CN`/`yue-CN`） |
| **Edge-TTS（rany2/edge-tts）** | 未量化 | 不适用（仅封装 Microsoft Edge 在线 TTS） | **LGPL-3.0**（[LICENSE](https://raw.githubusercontent.com/rany2/edge-tts/master/LICENSE) §）；`src/edge_tts/srt_composer.py` MIT | 不适用（在线服务） | ¥0 免费；无需 API Key；微软已 **禁掉自定义 SSML**（README § "Custom SSML was removed because Microsoft prevents..."） | ❌ 无零样本；仅 `--voice` 切换 Microsoft 已发布音色（300+ 条） | [edge-tts README](https://raw.githubusercontent.com/rany2/edge-tts/master/README.md) · [LICENSE](https://raw.githubusercontent.com/rany2/edge-tts/master/LICENSE) |
| **Kokoro-82M（hexgrad/Kokoro-82M）** | 未量化 | README "comparable quality to larger models" 无客观分数 | **Apache-2.0**（代码 + 权重；[GitHub API](https://api.github.com/repos/hexgrad/kokoro) `spdx_id: Apache-2.0`） | ✅ **M 系 MPS 官方支持**：`PYTORCH_ENABLE_MPS_FALLBACK=1`（[README § MacOS](https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md)）；Mac M1/M2/M3/M4 全列 | ¥0（`pip install kokoro`） | ❌ 预设音色 `voice='af_heart'` 等；无零样本接口 | [hexgrad/kokoro README](https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md)（8 lang_code：`a`/`b`/`e`/`f`/`h`/`i`/`j`/`p`/`z`） |
| **Chatterbox（resemble-ai/chatterbox）** | 商用 Pro 服务 sub-200ms（resemble.ai 自报）；**OSS 未量化** | 仓库给 [Podonos 评测链接](https://podonos.com/resembleai/chatterbox-turbo-vs-elevenlabs-turbo)（Turbo vs ElevenLabs Turbo v2.5 / Cartesia Sonic 3 / VibeVoice 7B） | **MIT**（代码 + 权重；[GitHub API](https://api.github.com/repos/resemble-ai/chatterbox) `spdx_id: MIT`） | ✅ **MPS 官方支持**：示例代码 `ChatterboxTTS.from_pretrained(device="mps")` 直接列出 | ¥0（OSS）；商用走 resemble.ai 付费 TTS | ✅ **零样本 10s 参考音频**（Turbo 350M / Nano 110M / Multilingual V3 500M / Original 500M；Multilingual V3 支持 23 语含 `zh-cmn`） | [Chatterbox README](https://raw.githubusercontent.com/resemble-ai/chatterbox/main/README.md) |

---

## 4. E2E S2S inventory

<!-- AGENT-B: GPT-4o Realtime / Gemini Live / Seed LiveInterpret 2.0 / Qwen2.5-Omni / Step-Audio / Kimi-Audio / SeamlessStreaming / Translatotron 3 / Moshi / SeamlessM4T -->

| 模型 | 首音延迟 | 质量 | License | 商用? | 平台 | 成本 | 音色克隆 | zh-en | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| **OpenAI GPT-4o Realtime**（gpt-4o-realtime / gpt-realtime） | 官方未公开首包具体毫秒；audio input+output 流式 WebSocket / WebRTC | 第三方评测多领域最强；同体系 text-in/text-out 性能与 GPT-4o 相当 | 闭源商用 API | ✅（受限 Azure OpenAI / OpenAI 直签） | 云（OpenAI Platform + Azure OpenAI Service） | **gpt-realtime** 输入文本 $4/M + 输出音频 $40/M（cached 文本 $0.40/M，cached audio $2.50/M）；**gpt-4o-realtime-preview** 输入文本 $5/M + 输入音频 $100/M + 输出音频 $200/M（[platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) 一手核实） | ❌ 无 zero-shot 音色克隆（预设 built-in voices） | ✅（GPT-4o 系列多语支持含 zh；具体 zh↔en 同传延迟未公开） | [platform.openai.com/docs/guides/realtime](https://platform.openai.com/docs/guides/realtime) + [openai.com/api/pricing/](https://openai.com/api/pricing/) |
| **Google Gemini Live**（gemini-2.0-flash-live / gemini-2.5-flash-native-audio-preview） | 官方目标实时；具体毫秒未公开 | 第三方评测 strong；与 GPT-4o Realtime 同级；Native Audio 版支持 30+ 音色（含若干 zh） | 闭源商用 API | ✅ | 云（Google AI Studio / Vertex AI） | gemini-2.0-flash-live 输入 $0.50/M + 输出文本 $2/M + 输出音频 $12/M（[ai.google.dev/pricing](https://ai.google.dev/pricing)，一手核实）；gemini-2.5-flash-native-audio-preview 输入 $3/M + 输出音频 $12/M | ❌ 无 zero-shot 音色克隆（仅内置 30+ 音色，部分支持 Affective Dialog emotion tag） | ✅（Gemini 多语，含 zh/en） | [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live) + [ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **Seed LiveInterpret 2.0（豆包同传）** | S2S 平均 2.53s / 首字 2.21s（论文） | zh-en BLEURT 64.9 (S2T) / S2S 60.7；EN↔ZH 母语 pair | 商用 API | ✅ | 云（火山引擎方舟） | **输入 ¥80/M + 输出文本 ¥80/M + 输出音频 ¥300/M**（资源包 ¥40–56/M）→ T20 估 ~¥14.6/h 后付费 / ~¥5/h 资源包 | ✅ 零样本内置 | ✅ 唯一优先级 pair | [arXiv 2507.17527](https://arxiv.org/abs/2507.17527) + [计费 PDF](https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3_%E4%BA%A7%E5%93%81%E8%AE%A1%E8%B4%B9_1787232335.pdf) |
| **Qwen2.5-Omni-3B / 7B** | 实时对话流式；Thinker-Talker 架构；MNN 移动端 5.8GB peak；启用 4-bit (GPTQ-Int4 / AWQ) 后 GPU 显存 11.64–17.84 GB（30s 视频） | 7B 多模态全能 OmniBench avg **56.13%**（开源 SOTA）；CoVoST2 en-zh BLEU **41.4** / zh-en BLEU **29.4**；MMSU/MMAU/MMAR 开源第一 | **Apache-2.0**（[LICENSE](https://raw.githubusercontent.com/QwenLM/Qwen2.5-Omni/main/LICENSE) "Copyright 2025 Alibaba Cloud"） | ✅ 商用 OK | 本地 GPU 7B 31GB BF16 / 12GB Int4；MLX/Qwen2-Omni 推理库；MNN 移动端 | 本地 GPU 成本；API 走 DashScope `qwen-omni-turbo`（按 token 计） | ✅ 内置 2 音色 Chelsie / Ethan + Cherry/Serena（API 可选） | ✅ 同传翻译是支持的模态之一（论文 "Speech Generation" 节与官方 cook book 演示） | [QwenLM/Qwen2.5-Omni](https://github.com/QwenLM/Qwen2.5-Omni) · [HF Qwen/Qwen2.5-Omni-7B](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) · [arXiv 2503.20215](https://arxiv.org/abs/2503.20215) |
| **Step-Audio 2 mini** | 流式；vLLM backend；具体毫秒未公开 | StepEval-Audio-360 + URO-Bench Chinese Basic **77.81%**；CoVoST2 zh-en BLEU **29.47**；in-house 口音/方言（上海话/四川话/粤语）平均 **8.85%**（开源 SOTA） | **Apache-2.0**（[Step-Audio2 LICENSE](https://github.com/stepfun-ai/Step-Audio2/blob/main/LICENSE) "Apache 2.0" badge；Step-Audio-2-mini/Base/Think 同 Apache 2.0） | ✅ 商用 OK | 本地 GPU；vLLM Docker；StepFun realtime console + StepFun Open Platform API | 开源权重本地；API 走 [platform.stepfun.com](https://platform.stepfun.com/)（价格未在 README 量化；按 token 计） | ✅ 1B+ 音色预设 + instruction-based voice control（emotion/dialect/style/rap/sing） | ✅ zh-en pair CoVoST2 BLEU zh-en 29.47（开源 SOTA），CVSS zh-en S2ST 25.35 | [stepfun-ai/Step-Audio2](https://github.com/stepfun-ai/Step-Audio2) · [stepfun-ai/Step-Audio](https://github.com/stepfun-ai/Step-Audio)（前者已 deprecated 指向后者）· [arXiv 2507.16632](https://arxiv.org/abs/2507.16632) |
| **Step-Audio（原版，Step-Audio-Chat 130B + Step-Audio-TTS-3B）** | 实时推理 pipeline 含 40% commit rate 的 speculative response | StepEval-Audio-360 Factuality **66.4%**（开源 SOTA）；test-zh CER 1.53% / test-en WER 2.71%（开源 TTS SOTA） | **Apache 2.0 代码**；权重许可需遵循 [Step-Audio-Chat HF repo](https://huggingface.co/stepfun-ai/Step-Audio-Chat)（gated）；[README § 9](https://raw.githubusercontent.com/stepfun-ai/Step-Audio/main/README.md) "License Agreement" | ⚠️ 权重 gated（HF 申请）；代码 Apache 2.0 | 本地 4×A800/H800 80GB（265GB GPU 最小，Step-Audio-Chat） | 开源本地；商业 API 走 StepFun | ✅ 零样本 clone + 情感/方言/说唱 | ✅ 中英日 3 语 | [stepfun-ai/Step-Audio](https://github.com/stepfun-ai/Step-Audio) · [arXiv 2502.11946](https://arxiv.org/abs/2502.11946) |
| **Kimi-Audio**（Moonshot AI） | 流式音频；具体首包未公开 | MMAU 69.6（开源 SOTA 之列）；StepEval-Audio-360 中文 URO-Bench Basic 73.59%；ASR LibriSpeech test-clean **1.49**（开源第一梯队）；AISHELL CER 0.64 | [MoonshotAI/Kimi-Audio](https://github.com/MoonshotAI/Kimi-Audio) GitHub README 自述 "open-source audio foundation model"；**具体 LICENSE 文件未在 main 分支 root，仓库 README 见"open-source"声明**（⚠️ **license 待 Agent B 进一步核实 LICENSE 路径 / commit SHA**） | ⚠️ license 待核 | 本地 GPU；MLX；HF | 开源权重 + 商用 API（Kimi 平台） | ⚠️ 仓库自述包含 AudioQA + ASR + TTS，音色克隆能力需核 | ✅ CoVoST2 zh-en BLEU 评测见 Step-Audio 2 表（Kimi-Audio zh-en **27.2**） | [MoonshotAI/Kimi-Audio](https://github.com/MoonshotAI/Kimi-Audio) · [HF moonshotai/Kimi-Audio-7B-Instruct](https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct) · [arXiv 2504.12202](https://arxiv.org/abs/2504.12202) |
| **Meta SeamlessStreaming** | Speech-to-speech 模型；EMMA（Efficient Monotonic Multihead Attention）+ UnitY2 streaming decoder；100 语；论文实验下 S2ST latency 通常 <1s（含首音） | 100 语 S2ST/S2TT/ASR；论文 [arXiv 2406.07413](https://arxiv.org/abs/2406.07413) | **CC-BY-NC-4.0**（[README](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/README.md) § License "SeamlessStreaming models" 明列 CC-BY-NC 4.0） | ❌ **商用禁用** | 本地 PyTorch（fairseq2 + libsndfile）+ GGML（unity.cpp） | 开源权重 | ❌ 无零样本克隆（SeamlessExpressive 单独 gated + SEAMLESS_LICENSE） | ✅ zh 包含在 100 语中 | [facebookresearch/seamless_communication](https://github.com/facebookresearch/seamless_communication) · [arXiv 2406.07413](https://arxiv.org/abs/2406.07413) |
| **Google Translatotron 3** | 论文实验 S2ST 端到端；具体毫秒数字需 [arXiv 2311.00277](https://arxiv.org/abs/2311.00277) 复现 | 论文级 SOTA（X→En TTS/ST） | **未开源权重 / 未公开 API**（Google Research only） | ❌ 仅 research-only（无任何一手源公布商用 API） | 学术研究复现 | N/A（无 API） | N/A | ✅ 与 SeamlessM4T 同代，覆盖 zh 在内的多语 | [arXiv 2311.00277](https://arxiv.org/abs/2311.00277) · [Google Research blog](https://research.google/pubs/translatotron-3/) |
| **Kyutai Moshi**（moshika 女声 / moshiko 男声 + Mimi codec 24kHz） | **理论 160ms**（80ms Mimi frame + 80ms acoustic delay），**实际 L4 GPU 整体延迟 as low as 200ms**（[README](https://raw.githubusercontent.com/kyutai-labs/moshi/main/README.md) Section "Model architecture"） | 全双工 spoken dialogue；inner monologue 文本 token 提升质量；HF 上 release 包含 pytorch/MLX/Rust/Candle 多后端 | **代码 MIT**（Python） / **Apache-2.0**（Rust backend）；**权重 CC-BY-4.0**（一手核实 [README § License](https://raw.githubusercontent.com/kyutai-labs/moshi/main/README.md) "weights ... released under the CC-BY 4.0 license"） | ✅ **商用 OK**（CC-BY 4.0 + Apache/MIT code — 唯一**商用安全**的开源 E2E S2S！⚠️ 但仅英文） | 本地 GPU（PyTorch 24GB 显存）；MLX（macOS M1/M2/M3）；Rust/Candle | 开源权重 + 自托管；官方 [moshi.chat](https://moshi.chat) 在线 demo | ❌ 无 zero-shot 克隆（仅 Moshika/Moshiko 两个固定合成声） | ❌ **仅英文**（法语/Hibiki 等翻译在 Hibiki 仓库，不在 Moshi 主仓） | [kyutai-labs/moshi](https://github.com/kyutai-labs/moshi) · [Moshi paper arXiv 2410.00037](https://arxiv.org/abs/2410.00037) |
| **Meta SeamlessM4T v2** | **UnitY2 架构**，README 明示 "improves over v1 in quality and inference latency in speech generation tasks"；具体 S2ST 毫秒数字见 [metrics zip](https://dl.fbaipublicfiles.com/seamless/metrics/seamlessM4T_large_v2.zip) | 100 语 S2ST/S2TT/ASR；v2 模型卡 claim S2ST 在 FLEURS/CoVoST 数据集上对 v1 显著提升；具体 BLASER 2.0/BLEURT 见 [HF model card](https://huggingface.co/facebook/seamless-m4t-v2-large) | **CC-BY-NC-4.0**（[LICENSE](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/LICENSE) verbatim 确认） | ❌ **商用禁用** | 本地 PyTorch（fairseq2 + libsndfile）；GGML（unity.cpp）；HF Transformers | 开源权重 | ❌ 无 zero-shot（独立 SeamlessExpressive 模型 gated + SEAMLESS_LICENSE 单独条款） | ✅ zh 包含在 100 语中 | [README](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/README.md) · [LICENSE](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/LICENSE) · [arXiv 2403.05530](https://arxiv.org/abs/2403.05530) · [HF facebook/seamless-m4t-v2-large](https://huggingface.co/facebook/seamless-m4t-v2-large) |

**E2E S2S 选型小结**：

- **唯一商用安全的开源 E2E S2S 是 Moshi**（CC-BY 4.0 + MIT/Apache code），但**仅英文**；同传翻译需走姊妹仓库 [kyutai-labs/hibiki](https://github.com/kyutai-labs/hibiki)（同 CC-BY 4.0）。
- **唯一支持中文 zh↔en 同传的开源 E2E 是 Qwen2.5-Omni-7B（Apache-2.0）** 和 **Step-Audio 2 mini（Apache-2.0）**；前者侧重通用对话 / 后者侧重工业级 ASR+TTS 一体。
- **商用 zh-en 同传 SOTA** 仍是 Doubao Seed LiveInterpret 2.0（BLEURT 64.9）与 Camb.ai MARS Live Dubbing（SRT→3 语 312ms）。
- **GPT-4o Realtime / Gemini Live** 通用级强，但 zh-en 同传专项优化 + zero-shot 克隆均无原生支持。

---

## 5. 产品 → 技术栈映射（公开证据）

### 5.1 内部前置研究已确认的产品（via T03/T04/T05/T15/T22）

| 产品 | 厂商 | ASR | MT | TTS | E2E S2S | 音色克隆 | 延迟口径 | 证据 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|
| **金喜标准云端版** | 大成子ONLY（一人公司） | — | — | — | **Doubao 同传 2.0 S2S** | ✅ 零样本实时（"开口即克隆"） | 首音 1.3s（云端实测，wiki） | T15/T22：飞书 wiki + Seed 官方发布 + arXiv 2507.17527 特征一一对应 | **HIGH** |
| **金喜轻量云端版** | 同上 | 混合识别栈（9 语/26 语方案） | 级联 | 训练音色（2 卡槽） | ❌ | ✅ 预训练 voice slot | 低于标准版 | T22：客户教程产品 map | MEDIUM-HIGH |
| **金喜轻量本地版** | 同上 | 本地 | 本地 | 本地（参考音频实时克隆，类 CosyVoice/GPT-SoVITS） | ❌ | ✅ 参考音频 | — | T22：仅 Windows + RTX 3060 12GB+ | MEDIUM |
| **Doppelvoice** | 开源（Tianqi-Bu） | — | — | — | **Doubao AST 2.0（10053）** s2s | ✅ speaker_id="" + denoise=false 触发零样本 | ~2.5-3s | T04：源码直读 | HIGH |
| **TransEcho** | 开源（wxkingstar） | — | — | 预置 speaker_id 播报 | **Doubao 同传 2.0（10053）** 仅字幕单向 | ❌ 无零样本 | 字幕实时 | T03：源码直读（Tauri 2 + protobuf WS） | HIGH |
| **sokuji** | 开源（kizuna-ai-lab，**AGPL-3.0**） | 本地 44 模型（sherpa-onnx WASM / Whisper / SenseVoice / Moonshine）+ Soniox 云 | 本地 75 模型（69 Opus-MT pairs + Qwen2.5/3/3.5、Hunyuan-MT 1.5、TranslateGemma via WebGPU） | 本地 137 模型（Piper/Piper-Plus/Matcha/Coqui/Mimic3/VITS） | 云：**Doubao AST 2.0**（s2s 声音克隆+双向中英）、OpenAI Realtime、Gemini、Palabra.ai（WebRTC 低延迟+克隆）、Soniox（双向自动检测，60+ 语）、Zoom AI | ✅（Doubao speaker clone / Palabra 克隆） | 双向同传 + 虚拟麦克风 + 浏览器扩展 | [sokuji README](https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/README.md)（一手）+ T18 | HIGH |
| **realtime-voice-translator** | 开源（ricardobing） | — | — | — | **Gemini Live Translate**（双独立 WS session） | ❌ | — | T05：源码直读（Windows/Voicemeeter） | HIGH |

> **可 fork 性（本会话已核实 LICENSE 文件）**: Doppelvoice = **MIT**（[LICENSE](https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/LICENSE)）；TransEcho = **MIT**（[LICENSE](https://raw.githubusercontent.com/wxkingstar/TransEcho/main/LICENSE)）；sokuji = **AGPL-3.0**（网络服务条款传染，直接抄代码须开源我方全部源码；仅借鉴协议思路则不受限）。

### 5.2 新增调研产品

| 产品 | 厂商 | ASR | MT | TTS | E2E S2S | 音色克隆 | 延迟口径 | 证据 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|
| **Microsoft Azure Speech Translation / Teams Live Interpreter** | Microsoft | Azure Speech STT 实时连续识别，支持 100+ 源语；可自动源语检测+切换 | Azure Translator（Text Translation，$10/M 字符） | Azure Neural TTS（100+ 语音，HD/OpenAI 分档） | ✅ **Live Interpreter**：低延迟 S2S；BYO voice + Personal Voice 个人语音多语会话 | ✅ "Bring your own voice" Personal Voice 官方文档明确支持；Personal Voice + Professional Voice 需 apply | "low latency"（具体毫秒未公开）；STT $1.00/h（Standard S1 流式） + 翻译按字符计；Fast Transcription $0.36/h，Batch $0.18/h | [Azure Speech Translation 文档](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation) · [Live Interpreter with Personal Voice](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-translate-speech#using-live-interpreter-for-real-time-speech-to-speech-translation-with-personal-voice) | **HIGH** |
| **Google Translate（app/Meet 实时字幕/Pixel Live Translate）** | Google | Google Cloud STT / Android on-device（Pixel 设备端 ASR；具体模型未公开） | Google Translation（NMT/Google Neural Machine Translation） | Google Cloud TTS / WaveNet；Pixel 设备端 TTS | ✅ Translate 双向对话 + Meet 实时字幕 + Pixel 系统级 Live Translate | ❌ **未公开**（官方未在 primary 文档中声明 zero-shot 音色克隆；Meet/Translate 仅做 TTS 输出，非说话人音色克隆） | **未公开**（具体毫秒未公开） | [support.google.com/translate/answer/9714727](https://support.google.com/translate/answer/9714727) + [cloud.google.com/translate/docs](https://cloud.google.com/translate/docs) + [workspace.google.com/solutions/ai/](https://workspace.google.com/solutions/ai/)（Google 主 URL 本次 sandbox 受限；建议二次核验） | **MEDIUM** |
| **iFLYTEK 双屏翻译机 / Smart Translator / AI Interpreta / Multilingual Meeting Room** | 科大讯飞 | 自研多语 ASR + 4 麦阵列 + 讯飞降噪；Multilingual Recognition & Translation；硬件 MTK 6762 八核 | 自研 NMT（Simultaneous Speech Interpretation + LLM-Driven Meeting Minutes） | 自研多语 TTS（Voice Synthesis & Broadcasting） | ✅ AI Interpreta 实时转写 + 多语字幕 + 语音合成广播 + 会议全程录音；Multilingual Meeting Room 同传；Smart Translator 60 语对话 + 50 语 OCR 拍照 + 离线翻译 | ⚠️ Voiceprint Recognition 用于会议签到与说话人区分（产品页明确）；**未见 zero-shot 音色克隆宣传** | 实时（具体毫秒未公开）；覆盖 50+ 国家 / 420K+ 会议 / 4 亿用户 | [Smart Translator](https://www.iflytek.com/en/products/translator/smart-translator.html) · [AI Interpreta](https://www.iflytek.com/en/businessproducts/ai-office/ai-interpreta.html) · [Multilingual Meeting Room](https://www.iflytek.com/en/businessproducts/ai-office/multilingual-meeting-room.html) | **HIGH** |
| **Timekettle WT2 Plus / W4 Pro / X1**（翻译耳機 / Interpreter Hub） | Timekettle | **未公开**（官方仅称 HybridComm™ 架构、"collaborates with top AI companies"；第三方报道/历史产品普遍使用 iFlytek + Timekettle 混合栈） | 未公开（HybridComm 3.0 通过 14 个全球高速服务器调度多语 MT） | 未公开（设备端 TTS 输出） | ✅ WT2 Plus 双向对话翻译 + 双向同传模式；X1 多人多语同传 + 演示模式；W4 Pro 通话 / 视频 / 媒体翻译 + 离线 13 对语言 | ❌ 官方未声明 zero-shot 音色克隆 | 用户实测 "less than a second"（非官方基准） | [WT2 Plus 产品页](https://www.timekettle.co/products/wt2-plus) · [timekettle.co](https://www.timekettle.co/) | **MEDIUM** |
| **Camb.ai MARS（TTS / Live Dubbing / Realtime S2S）** | Camb.ai | Camb.ai 自研 ASR（Live Transcription Beta、Realtime S2S pipeline 一部分） | Camb.ai 自研 Neural Translation（BOLI，"preserves meaning, tone, intent"） | MARS8 家族：MARS-Flash（600M、低延迟多语 TTS for Conversational AI）、MARS-Pro、MARS-Instruct、MARS-Nano（"first family of production-grade TTS models"） | ✅ Realtime Speech-to-Speech（Beta，[docs.camb.ai/tutorials/realtime-translation-with-sdk](https://docs.camb.ai/tutorials/realtime-translation-with-sdk)）；Live Dubbing；On-Demand Dubbing；Studio.dub | ✅ Zero-shot voice cloning（[docs.camb.ai/tutorials/voice-cloning](https://docs.camb.ai/tutorials/voice-cloning)） | SRT → 3 个语种 **~312 ms**（首页公开标注） | [camb.ai](https://www.camb.ai) · [camb.ai/models/mars8](https://camb.ai/models/mars8) · [docs.camb.ai/introduction](https://docs.camb.ai/introduction) · [docs.camb.ai/models](https://docs.camb.ai/models) | **HIGH** |
| **Resemble AI Chatterbox（OSS / Pro 商用 TTS）** | Resemble AI | N/A（**纯 TTS，不内置 ASR/MT**） | N/A | Chatterbox-Turbo 350M（英文，本机 paralinguistic tags [laugh]/[cough]）；Chatterbox-Nano 110M（CPU 3× realtime）；Chatterbox-Multilingual V3 500M（23 语 + 6 Single Language Pack：zh-cmn / es-mx-latam / es-es / pt-br / pt-pt / hi）；Original Chatterbox 500M | ❌ 仅 TTS，不构成翻译 S2S pipeline | ✅ Zero-shot voice cloning（10 秒参考音频；每条输出嵌入 PerTh 不可感知水印；Resemble Detect 100% 识别） | Turbo 75ms on GPU，6× faster than realtime；Pro 商用服务 sub 200ms；OSS MIT | [chatterbox](https://www.resemble.ai/learn/models/chatterbox) · [chatterbox-turbo](https://www.resemble.ai/learn/models/chatterbox-turbo) · [chatterbox-multilingual](https://www.resemble.ai/learn/models/chatterbox-multilingual) · [github.com/resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox) | **HIGH** |

---

## 6. 开源可商用清单（license 安全 vs 红线）

### 6.1 ✅ 商用安全（Apache-2.0 / MIT / CC-BY）

| 模型 | License | 备注 |
|---|---|---|
| sherpa-onnx（引擎 + Zipformer/Paraformer/SenseVoice 模型） | Apache-2.0 | LibriSpeech 数据 CC-BY 4.0，README 保留 attribution 即可 |
| whisper.cpp / mlx-whisper（引擎） | MIT | Whisper 权重归 OpenAI，商用已开放 |
| FunASR + SenseVoice | MIT | Fun-ASR-Nano 含 Qwen3（Apache-2.0，需归功） |
| Opus-MT en-zh | Apache-2.0 | zh-en 为 CC-BY-4.0（归功） |
| m2m100_418M | MIT | |
| google/madlad400-3b-mt | Apache-2.0（HF card YAML 明示） | 450+ 语言；卡片自注"research models, not assessed for production"——license 允许商用，质量风险自担 |
| OpenAI Whisper 权重（配合 whisper.cpp / mlx-whisper） | MIT（openai/whisper 仓库） | |
| Qwen2.5 / Qwen3 开源权重（可本地 MT） | Apache-2.0 | Qwen-MT 本身是 DashScope 闭源 API（商用付费），非开源权重 |
| CosyVoice 1/2/3 | Apache-2.0 | |
| GPT-SoVITS | MIT | |
| Kokoro-82M | Apache-2.0（代码+权重） | 8 语 54 音色含中文（lang_code 'z'）；M 系 MPS 加速有文档；**无零样本克隆** |
| Chatterbox（**resemble-ai/chatterbox**） | MIT（代码+HF 权重 verbatim 核实） | 零样本克隆 ~10s 参考音频；Multilingual V3 0.5B 支持 23+ 语含 **zh-cmn 专用微调**；另有 Turbo(350M)/Nano(110M) 英文版 |
| CjangCjengh/vits（中文 VITS） | MIT | |
| Qwen2.5-Omni / Kimi-Audio / Step-Audio | （待 Agent B 核实 LICENSE 文件） | |

### 6.2 ❌ 商用红线 / ⚠️ 有条件

| 模型 | License | 红线原因 |
|---|---|---|
| **NLLB-200 distilled** | CC-BY-NC-4.0 | 明确 "research model, not for production deployment" |
| **F5-TTS 预训练权重** | CC-BY-NC | Emilia 训练数据限制（代码 MIT 但权重不可商用） |
| **SeamlessStreaming** | （待核 CC-BY-NC 4.0） | Meta 非商用研究模型 |
| **SeamlessM4T v2** | （待核 CC-BY-NC 4.0） | 同上 |
| **ChatTTS** | 代码 **AGPL-3.0** + 权重 **CC-BY-NC 4.0**（README："should not be used for any commercial or illegal purposes"） | ❌ 商用禁用（已核实） |
| **Piper（现行 OHF-Voice/piper1-gpl）** | **GPL-3.0**（rhasspy/piper 已 2025-10 归档，原 MIT 版不再维护）；官方语音包 MODEL_CARD 限 "personal use and text to speech research only" | ⚠️ GPL 传染 + 语音包授权限制 → 商业闭源产品不宜直接打包；开源 AGPL/GPL 产品可合规使用 |
| **StyleTTS 2 预训练权重** | MIT 代码 + 附加条款 | 商用需内嵌"合成音"声明 |
| **Edge-TTS（rany2 库）** | 库 **LGPL-3.0** + 仅封装 Edge 在线 TTS 端点（微软已封自定义 SSML） | ⚠️ 无官方商用授权，ToS 灰区，端点随时可能失效 |
| **Apple Speech.framework** | Apple SDK | 不能转售为 SaaS 后端，仅 Apple 平台 |
| **TowerInstruct-7B** | CC-BY-NC + Llama 2 Community | 双重非商用 |
| **mBART-50 many-to-many-mmt** | **无任何 LICENSE 文件**（已核实 [mbart-large-50](https://hf-mirror.com/facebook/mbart-large-50) 与 [mmt 仓库](https://hf-mirror.com/facebook/mbart-large-50-many-to-many-mmt) 均 404） | 无授权 = 默认版权保留，**商用禁用** |
| **Moshi（Kyutai）权重** | （待核：预期 CC-BY-NC 4.0） | 待 Agent B 确认 |

---

## 7. 选型建议：v0 / v1 / v2

> 与 T20（混合架构）结论对齐：T20 已验证配置 A（全云）强可行、配置 B 不可行（S2S 不接受外部 ASR 文本）、配置 C 半可行、配置 D 仅最小模型可行。本节给出**模型级**选型。

### v0 — 全 Doubao 云端（PoC / MVP，最快上线）

| 环节 | 选型 | 单价 | 理由 |
|---|---|---|---|
| R3 出方向（译音+克隆） | **Doubao 同传 2.0 S2S**（speaker_id 留空=零样本） | 输入 ¥80/M + 输出文本 ¥80/M + 输出音频 ¥300/M ≈ **¥14.6/h 后付费 / ~¥5/h 资源包** | 唯一 zh-en 母语 pair 的 E2E 产品级 API；零样本克隆内置；与金喜标准版同栈 |
| R4 入方向（双语字幕） | **同传 2.0 s2t 模式** | ~¥1.1/h | 一次出双语字幕（事件 650-655）；质量 BLEURT 64.9/62.0 SOTA |
| 客户端参考 | Doppelvoice（Python）/ TransEcho（Rust/Tauri）/ sokuji（TS） | — | 三个开源 Doubao AST 2.0 客户端均可直接借鉴协议层 |
| 低配降级 | **豆包流式语音识别 2.0（¥1/h）+ 豆包机器翻译（¥1.8/5.4 per M）+ 豆包语音合成 2.0（¥3/万字符）** 级联 | ~¥2-3/h | 官方计费 PDF 一手核实的便宜级联路径（对应金喜轻量云端版思路） |

**代价**: 首音 2.5-3s（金喜口径 1.3s 含其客户端优化）；音频过云；单价依赖火山控制台。

### v1 — 混合（本地 ASR + 云端 MT + 本地/云 TTS；离线可降级）

| 环节 | 选型 | 成本 | 理由 |
|---|---|---|---|
| 本地流式 ASR | **sherpa-onnx streaming-zipformer-bilingual-zh-en int8**（~190MB） | ¥0 | 唯一真流式 + 中英双语 + Apache-2.0 + 热词；partial ~200ms；跨平台（未来 Win/Linux 零成本） |
| 本地 ASR 备选（多语/远场） | whisper.cpp distil-large-v3 + CoreML（Q5 ~1GB） | ¥0 | WER 上限更高，非流式但 `--step` 模拟可用 |
| 云端 MT | **Doubao 同传 s2t**（~¥1.1/h）；更便宜可选 **doubao-seed-1.6-flash**（输入 ¥0.15/M）或 Qwen-MT-Lite（¥0.6/1.6 per M） | ~¥0.1-1.1/h | 字幕质量优先选 s2t；成本优先选 flash 级 |
| 本地 TTS（克隆） | **CosyVoice 3**（Apache-2.0，零样本+跨语种）；备选 GPT-SoVITS（MIT，5s zero-shot） | ¥0 | M2 CPU RTF 需实测（官方只给 GPU 150ms）；加载峰值 ~2-3GB |
| 云端低延迟 TTS（不克隆/英文播报） | Cartesia Sonic ~90ms / Rime Mist 37ms / ElevenLabs Flash 75ms | ¥1.3-2.2/h | 仅当需要 ≤1.3s 首音且接受非克隆音色 |
| 离线降级 | 云不可达 → 本地 opus-mt（CTranslate2 int8）+ Piper/预设音色 | ¥0 | 质量降级但可用 |

**综合成本 ~¥1.2/h 后付费**（T20 §配置 C），与金喜旗舰本地版 0.7-1 元/小时量级一致；M2 16GB RAM 压力 ~2.5GB。

### v2 — 全本地（离线/隐私版，质量妥协）

| 环节 | 首选 | 备选 | 红线提醒 |
|---|---|---|---|
| ASR | sherpa-onnx Zipformer 双语/英语 | whisper.cpp small+CoreML（250ms partial） | — |
| MT | opus-mt-zh-en + opus-mt-en-zh（CTranslate2 int8，~¥0） | Qwen2.5-1.5B-Instruct GGUF q4（token 级流式）；MadLAD-400-3B（Apache-2.0，450 语） | ❌ 勿用 NLLB-200 distilled（CC-BY-NC）；❌ 勿用 mBART-50（无 LICENSE） |
| TTS（克隆） | **CosyVoice 3**（唯一全本地可商用零样本克隆） | GPT-SoVITS（MIT） | ❌ F5-TTS 权重 CC-BY-NC；⚠️ ChatTTS/Piper license 见 §6 |
| TTS（无克隆、极速） | **Kokoro-82M**（Apache-2.0，含中文，82M CPU 实时级） | Piper（更快但 **GPL-3.0** + 官方语音包限 personal/research——仅当产品整体 GPL 兼容且接受语音包条款） | 零样本克隆缺失是 v2 硬天花板；若要克隆走 CosyVoice 3 / Chatterbox(MIT) |
| E2E 本地（探索） | Qwen2.5-Omni-7B（Apache-2.0，语音进/出） | Step-Audio 2 / Kimi-Audio（license 待核） | 均为对话型音频模型，**同传翻译模式需自工程化**；M2 16GB 跑 7B 音频模型内存紧张 |

**成本 ¥0/h**；首音 ~1.5-2.5s；克隆音质与翻译质量全面低于云端（T20 结论：Piper 无克隆 = 最大短板）。

### 跨栈风险对冲（行业视角）

- **单一供应商风险**：v0/v1 深度绑定火山引擎。对冲候选 = Qwen 全家桶（Paraformer ASR + Qwen-MT + CosyVoice TTS，全 Apache-2.0 可自托管）——**这是本横评发现的最完整非字节替代栈**。
- **海外网络场景**：Deepgram/Azure/Google 云 ASR + GPT-4o Realtime / Gemini Live 是海外等效路径，但无 zh-en 同传专用优化，成本更高（详见 §1.2/§4）。
- **开源 E2E S2S 商用安全候选目前稀缺**：SeamlessStreaming/SeamlessM4T 均非商用；Moshi 权重预期非商用（待核）；Qwen2.5-Omni 是目前唯一 Apache-2.0 的语音进/出大模型。

---

## 8. Known gaps（未填补 / 需实测）

1. ~~Doubao 同传 2.0 / bigtts 单价~~ → **已核实**（官方计费 PDF：同传 输入¥80/输出文本¥80/输出音频¥300 per M token；bigtts ¥3/万字符；流式 ASR ¥1–4.5/h）。剩余：控制台实时折扣价。
2. 所有云 ASR / LLM-MT 的**实测** TTFT（四家 LLM 均不公开）— 需 CN 出口实测。
3. CosyVoice 3 / GPT-SoVITS / Chatterbox 在 M2 上的 RTF 实测（官方只给 GPU / M4 / 8 核 CPU 数字）。
4. 跨语种音色克隆（中→英）口音残留 — 所有厂商均无量化，需 PoC A/B。
5. Google Cloud Translation 价格在会话内未能从 Google 一手源验证。
6. ~~mBART-50 / MadLAD-400 license~~ → **已核实**：mBART-50 两仓库均无 LICENSE 文件（商用禁用）；MadLAD-400-3B-MT HF card YAML 明示 Apache-2.0。
7. doubao-seed-1.6-flash 输出价区间 — 官方价目页快照只见输入 ¥0.15/M，输出价需控制台确认。

---

## 9. Citation map（本文件新增一级源）

> 下列 URL 均为本次会话 **直接 fetch 成功** 的一手源（vendor 定价页 / 官方 docs / GitHub LICENSE / arXiv 论文）。跨节复用按 "× 节" 标注。

### 9.1 模型仓库 / LICENSE / README

- whisper.cpp — [README](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md) · [LICENSE](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/LICENSE) · [issue #89](https://github.com/ggml-org/whisper.cpp/issues/89) [§1.1]
- mlx-whisper — [README](https://raw.githubusercontent.com/ml-explore/mlx-examples/main/whisper/README.md) [§1.1]
- sherpa-onnx Zipformer — [k2-fsa/icefall RESULTS](https://raw.githubusercontent.com/k2-fsa/icefall/master/egs/librispeech/ASR/RESULTS.md) · [Zipformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html) [§1.1, §1.3]
- sherpa-onnx Paraformer — [Paraformer docs](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-paraformer/paraformer-models.html) [§1.1]
- SenseVoice — [arXiv 2407.04051](https://arxiv.org/abs/2407.04051) [§1.1]
- FunASR — [README](https://raw.githubusercontent.com/modelscope/FunASR/main/README.md) [§1.1]
- **Vosk** — [alphacep/vosk-api README](https://raw.githubusercontent.com/alphacep/vosk-api/master/README.md) · [alphacephei.com/vosk](https://alphacephei.com/vosk/) · [Vosk Models](https://alphacephei.com/vosk/models) [§1.1, §1.3, §3.1]
- Apple Speech.framework — [SFSpeechRecognizer docs](https://developer.apple.com/tutorials/data/documentation/speech/sfspeechrecognizer.json) [§1.1]
- CosyVoice 3 — [README](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/README.md) · [LICENSE](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/LICENSE) [§3.1]
- GPT-SoVITS v2 ProPlus — [README](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/README.md) [§3.1]
- F5-TTS — [README](https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md) [§3.1, §6.2]
- StyleTTS 2 — [README](https://raw.githubusercontent.com/yl4579/StyleTTS2/main/README.md) [§3.1, §6.2]
- **Piper (OHF-Voice/piper1-gpl)** — [README](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/README.md) · [GitHub API repo metadata (spdx_id GPL-3.0)](https://api.github.com/repos/OHF-Voice/piper1-gpl) · [VOICES.md](https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/VOICES.md) · [BUILDING.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/BUILDING.md) · [TRAINING.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/TRAINING.md) [§3.1, §3.3, §6.1, §6.2]
- CjangCjengh/vits-Chinese — [github.com/CjangCjengh/vits-Chinese](https://github.com/CjangCjengh/vits-Chinese) ⚠️ 本次 404（仓库可用性需重核） [§3.1, §3.3]
- **ChatTTS** — [2noise/ChatTTS README](https://raw.githubusercontent.com/2noise/ChatTTS/main/README.md) · [LICENSE (AGPLv3+)](https://github.com/2noise/ChatTTS/blob/main/LICENSE) [§3.1, §3.3, §6.2]
- **Kokoro-82M** — [hexgrad/Kokoro-82M HF model card](https://huggingface.co/hexgrad/Kokoro-82M) · [hexgrad/kokoro README](https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md) · [GitHub API repo metadata (spdx_id Apache-2.0)](https://api.github.com/repos/hexgrad/kokoro) [§3.1, §3.3, §6.1]
- **Chatterbox** — [resemble-ai/chatterbox README](https://raw.githubusercontent.com/resemble-ai/chatterbox/main/README.md) · [GitHub API repo metadata (spdx_id MIT)](https://api.github.com/repos/resemble-ai/chatterbox) · [Resemble Chatterbox docs](https://www.resemble.ai/learn/models/chatterbox) · [Chatterbox-Turbo docs](https://www.resemble.ai/learn/models/chatterbox-turbo) · [Chatterbox Multilingual docs](https://www.resemble.ai/learn/models/chatterbox-multilingual) [§3.1, §3.3, §5.2, §6.1]
- **Edge-TTS** — [rany2/edge-tts README](https://raw.githubusercontent.com/rany2/edge-tts/master/README.md) · [LICENSE (LGPL-3.0)](https://raw.githubusercontent.com/rany2/edge-tts/master/LICENSE) [§3.3, §6.2]
- **MiniMax Speech** — [platform.minimaxi.com 按量计费](https://platform.minimaxi.com/docs/guides/pricing-paygo) · [音色快速复刻](https://platform.minimaxi.com/docs/guides/speech-voice-clone) · [语音资源包](https://platform.minimaxi.com/docs/guides/pricing-speech) · [系统音色列表](https://platform.minimaxi.com/docs/faq/system-voice-id) [§3.2, §3.3]
- **Azure TTS** — [Learn text-to-speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) · [language-support?tabs=tts](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) · [批量合成延迟](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-synthesis) · [pricing](https://azure.microsoft.com/en-us/pricing/details/speech-services/)（JS SPA 数字未抓到） [§3.3, §5.2]
- **Helsinki-NLP/opus-mt-en-zh** — [HF card](https://hf-mirror.com/Helsinki-NLP/opus-mt-en-zh/raw/main/README.md) (Apache-2.0) [§2.2, §6.1]
- **Helsinki-NLP/opus-mt-zh-en** — [HF card](https://hf-mirror.com/Helsinki-NLP/opus-mt-zh-en/raw/main/README.md) (CC-BY-4.0) [§2.2, §6.1]
- facebook/m2m100_418M — HF card (MIT) [§2.2, §6.1]
- **facebook/nllb-200-distilled-600M** — [HF card](https://hf-mirror.com/facebook/nllb-200-distilled-600M/raw/main/README.md)（CC-BY-NC-4.0，研究模型，**商用禁用**） [§2.2, §6.2]
- google/madlad400-3b-mt — HF card YAML（Apache-2.0；自注 research） [§6.1]
- mBART-50 many-to-many-mmt — [mbart-large-50](https://hf-mirror.com/facebook/mbart-large-50) · [mbart-large-50-many-to-many-mmt](https://hf-mirror.com/facebook/mbart-large-50-many-to-many-mmt)（**无 LICENSE 文件**） [§6.2, §8]
- **Qwen2.5-1.5B-Instruct** — [LICENSE](https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct/raw/main/LICENSE) (Apache-2.0) [§2.2, §6.1]
- **Hunyuan-MT-7B** — [GitHub Tencent-Hunyuan/Hunyuan-MT](https://github.com/Tencent-Hunyuan/Hunyuan-MT) · [License.txt](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan-MT/main/License.txt) (Tencent Hunyuan Community License; <1 亿 MAU；EU/UK/韩国除外) [§2.2]
- **TranslateGemma 4B/12B/27B** — [HF google/translategemma-4b-it](https://hf-mirror.com/google/translategemma-4b-it) (Gemma license) [§2.2]
- **Qwen2.5-Omni** — [GitHub QwenLM/Qwen2.5-Omni](https://github.com/QwenLM/Qwen2.5-Omni) · [LICENSE (Apache-2.0)](https://raw.githubusercontent.com/QwenLM/Qwen2.5-Omni/main/LICENSE) · [HF Qwen/Qwen2.5-Omni-7B](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) · [arXiv 2503.20215](https://arxiv.org/abs/2503.20215) [§4, §6.1]
- **Step-Audio** — [GitHub stepfun-ai/Step-Audio](https://github.com/stepfun-ai/Step-Audio) · [README](https://raw.githubusercontent.com/stepfun-ai/Step-Audio/main/README.md) · [arXiv 2502.11946](https://arxiv.org/abs/2502.11946) · [Step-Audio-Chat HF gated](https://huggingface.co/stepfun-ai/Step-Audio-Chat) [§4, §6.1]
- **Step-Audio 2 mini** — [GitHub stepfun-ai/Step-Audio2](https://github.com/stepfun-ai/Step-Audio2) · [LICENSE (Apache-2.0)](https://github.com/stepfun-ai/Step-Audio2/blob/main/LICENSE) · [HF Step-Audio-2-mini](https://huggingface.co/stepfun-ai/Step-Audio-2-mini) · [arXiv 2507.16632](https://arxiv.org/abs/2507.16632) [§4, §6.1]
- **Kimi-Audio** — [GitHub MoonshotAI/Kimi-Audio](https://github.com/MoonshotAI/Kimi-Audio) · [HF moonshotai/Kimi-Audio-7B-Instruct](https://huggingface.co/moonshotai/Kimi-Audio-7B-Instruct) · [arXiv 2504.12202](https://arxiv.org/abs/2504.12202) (license 路径待二次核验) [§4, §6.1]
- **SeamlessM4T v2 / SeamlessStreaming / SeamlessExpressive** — [GitHub facebookresearch/seamless_communication](https://github.com/facebookresearch/seamless_communication) · [README](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/README.md) · [LICENSE (CC-BY-NC-4.0)](https://raw.githubusercontent.com/facebookresearch/seamless_communication/main/LICENSE) · [HF facebook/seamless-m4t-v2-large](https://huggingface.co/facebook/seamless-m4t-v2-large) · [metrics zip](https://dl.fbaipublicfiles.com/seamless/metrics/seamlessM4T_large_v2.zip) · [arXiv 2403.05530](https://arxiv.org/abs/2403.05530) (M4T v2) · [arXiv 2406.07413](https://arxiv.org/abs/2406.07413) (Streaming) · [arXiv 2312.05187](https://arxiv.org/abs/2312.05187) (Seamless) [§2.2, §4, §6.2]
- **Translatotron 3** — [arXiv 2311.00277](https://arxiv.org/abs/2311.00277) · [Google Research blog](https://research.google/pubs/translatotron-3/) (research-only, 无商用 API) [§4]
- **Moshi** — [GitHub kyutai-labs/moshi](https://github.com/kyutai-labs/moshi) · [README (license verbatim)](https://raw.githubusercontent.com/kyutai-labs/moshi/main/README.md) · [moshi.chat demo](https://moshi.chat) · [arXiv 2410.00037](https://arxiv.org/abs/2410.00037) · [HF moshika / moshiko](https://huggingface.co/kyutai) [§4, §6.1]
- Kyutai Hibiki — [GitHub kyutai-labs/hibiki](https://github.com/kyutai-labs/hibiki)（同 CC-BY 4.0）[§4]
- Doppelvoice — [GitHub Tianqi-Bu/Doppelvoice](https://github.com/Tianqi-Bu/Doppelvoice) · [LICENSE (MIT)](https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/LICENSE) [§5.1]
- TransEcho — [GitHub wxkingstar/TransEcho](https://github.com/wxkingstar/TransEcho) · [LICENSE (MIT)](https://raw.githubusercontent.com/wxkingstar/TransEcho/main/LICENSE) [§5.1]
- sokuji — [GitHub kizuna-ai-lab/sokuji](https://github.com/kizuna-ai-lab/sokuji) · [sokuji README](https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/README.md) (AGPL-3.0) [§5.1]

### 9.2 商用云 API（厂商一手定价 / 产品页 / 文档）

- 火山引擎豆包语音 — [豆包语音_产品计费 PDF](https://eps-common-private-online.tos-cn-beijing.volces.com/cloud-doc/eps-doc-center-pdf/%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3_%E4%BA%A7%E5%93%81%E8%AE%A1%E8%B4%B9_1787232335.pdf) · [火山方舟模型价格](https://www.volcengine.com/docs/82379/1544106) · [计费文档](https://www.volcengine.com/docs/6492/1544808) · [火山机器翻译大模型](https://www.volcengine.com/docs/6561/2306735) [§1.2, §2.1, §3.2, §4]
- **Doubao Seed LiveInterpret 2.0** — [arXiv 2507.17527](https://arxiv.org/abs/2507.17527) + 上述计费 PDF [§3.2, §4]
- **Deepgram Nova-3** — [deepgram.com/pricing](https://deepgram.com/pricing) · [developers.deepgram.com/docs/models-languages-overview](https://developers.deepgram.com/docs/models-languages-overview) · [deepgram.com/terms](https://deepgram.com/terms) [§1.2]
- **Azure AI Speech** — [azure.microsoft.com/en-us/pricing/details/speech/](https://azure.microsoft.com/en-us/pricing/details/speech/) · [azure.microsoft.com/en-us/free/](https://azure.microsoft.com/en-us/free/) · [learn.microsoft.com Speech-to-Text](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text) · [batch transcription](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription) · Retail API `https://prices.azure.com/api/retail/prices?$filter=contains(productName,'Speech')` [§1.2, §3.2, §5.2]
- **Google Cloud Speech-to-Text v2** — https://cloud.google.com/speech-to-text/pricing ⚠️ 本次 sandbox 无法获取（建议投产前控制台核实）[§1.2, §8]
- **阿里云智能语音 ISI** — [alibabacloud.com/help/en/isi/product-overview/pricing](https://www.alibabacloud.com/help/en/isi/product-overview/pricing) · [product page](https://www.alibabacloud.com/en/product/intelligent-speech-interaction) [§1.2]
- **科大讯飞 RTASR/LFASR/IAT** — [xfyun.cn/services/rtasr](https://www.xfyun.cn/services/rtasr) · [xfyun.cn/services/lfasr](https://www.xfyun.cn/services/lfasr) · [xfyun.cn/services/voicedictation](https://www.xfyun.cn/services/voicedictation) · [用户服务协议](https://www.xfyun.cn/doc/policy/agreement.html) [§1.2]
- **Azure Translator v3** — [azure.microsoft.com/en-us/pricing/details/translator/](https://azure.microsoft.com/en-us/pricing/details/translator/) ($10/M chars) [§2.2]
- **Google Cloud Translation Basic v2 / Advanced v3** — https://cloud.google.com/translate/pricing ⚠️ T18 gap #7 仍未从一手源核实 [§2.2]
- **DeepL API Pro** — [deepl.com/en/pro#api](https://www.deepl.com/en/pro#api) [§2.2]
- **OpenAI GPT-4o Realtime** — [platform.openai.com/docs/guides/realtime](https://platform.openai.com/docs/guides/realtime) · [openai.com/api/pricing/](https://openai.com/api/pricing/) · [platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) [§4]
- **Google Gemini Live** — [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live) · [ai.google.dev/pricing](https://ai.google.dev/pricing) [§4]
- **Aliyun Model Studio Qwen-MT** — [help.aliyun.com/zh/model-studio/billing](https://help.aliyun.com/zh/model-studio/billing) · [model-pricing](https://help.aliyun.com/zh/model-studio/model-pricing) [§2.1]
- **DeepSeek V4-Flash** — [api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing) [§2.1]
- **Azure OpenAI pricing** — [azure.microsoft.com/en-us/pricing/details/azure-openai/](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) [§2.1]
- **Claude pricing** — [claude.com/pricing#api](https://claude.com/pricing#api) [§2.1]
- **ElevenLabs Flash/Turbo** — [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api) [§3.2]
- **Cartesia Sonic 3.5/3.6** — [cartesia.ai/pricing](https://www.cartesia.ai/pricing) [§3.2]
- **Rime Mist v3 / Coda** — [rime.ai/pricing](https://www.rime.ai/pricing) [§3.2]

### 9.3 产品 / 行业研究（§5 新增）

- **Azure Live Interpreter / Teams Interpreter** — [learn.microsoft.com Speech Translation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation) · [Live Interpreter with Personal Voice](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-translate-speech#using-live-interpreter-for-real-time-speech-to-speech-translation-with-personal-voice) [§5.2]
- **Google Translate / Pixel Live Translate / Meet** — [support.google.com/translate/answer/9714727](https://support.google.com/translate/answer/9714727) · [cloud.google.com/translate/docs](https://cloud.google.com/translate/docs) · [workspace.google.com/solutions/ai/](https://workspace.google.com/solutions/ai/) ⚠️ 本次 sandbox 部分 fetch 受限 [§5.2]
- **iFlytek 产品矩阵** — [Smart Translator](https://www.iflytek.com/en/products/translator/smart-translator.html) · [AI Interpreta](https://www.iflytek.com/en/businessproducts/ai-office/ai-interpreta.html) · [Multilingual Meeting Room](https://www.iflytek.com/en/businessproducts/ai-office/multilingual-meeting-room.html) [§5.2]
- **Timekettle** — [WT2 Plus product page](https://www.timekettle.co/products/wt2-plus) · [timekettle.co](https://www.timekettle.co/) [§5.2]
- **Camb.ai MARS / MARS8** — [camb.ai](https://www.camb.ai) · [camb.ai/models/mars8](https://camb.ai/models/mars8) · [docs.camb.ai/introduction](https://docs.camb.ai/introduction) · [docs.camb.ai/models](https://docs.camb.ai/models) · [docs.camb.ai/tutorials/voice-cloning](https://docs.camb.ai/tutorials/voice-cloning) · [Realtime Translation SDK](https://docs.camb.ai/tutorials/realtime-translation-with-sdk) [§5.2]
- **Resemble AI Chatterbox** — [chatterbox](https://www.resemble.ai/learn/models/chatterbox) · [chatterbox-turbo](https://www.resemble.ai/learn/models/chatterbox-turbo) · [chatterbox-multilingual](https://www.resemble.ai/learn/models/chatterbox-multilingual) [§3.1, §3.3, §5.2]

### 9.4 已知 sandbox 限制 / 未从一手源核实（**建议投产前补验**）

- **Google Cloud Speech-to-Text v2 / Cloud Translation pricing** — sandbox `fetch failed`；T18 gap #7 同；请现场查 control panel。
- **OpenAI docs 域** — sandbox 被 Cloudflare 拦截（403）；GPT-4o Realtime 价格经 OpenAI 官方 pricing 镜像页核实但建议对照 [platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) 官方页。
- **Azure Speech pricing 每 1M 字符** — [pricing/details/speech-services](https://azure.microsoft.com/en-us/pricing/details/speech-services/) 为 JS SPA，fetch 仅取到导航骨架；建议从 Azure Portal / Quote 工具核 Neural / HD / Personal Voice 各档。
- **Kimi-Audio LICENSE 路径** — GitHub main 分支 root 未直接显式 LICENSE 文件；repo README 自述"open-source"，具体 LICENSE 文件路径需在仓库内 `git log -- LICENSE` 二次核验。
- **iFLYTEK 服务限定中国大陆**（ToS §13.4） — 国际部署须走 [global.xfyun.cn](https://global.xfyun.cn/)。
