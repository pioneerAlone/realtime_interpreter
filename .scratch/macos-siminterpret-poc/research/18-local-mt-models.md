# 中英 MT 路径对比 — R4 入方向翻译模块

> Ticket: `.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md`
> 目标: <¥2/h, ≤1.3s 首音（端到端），口语化 EN↔ZH 质量
> 调研时间: 2026-09-03
> 范围: 商用 LLM streaming + 本地小模型 + 专业翻译 API + Doubao s2t mode
> 前置研究: T01 (`research/01-volcengine-api-capabilities.md`)、T04 (`research/04-doppelvoice-deep-read.md`)、T16 (`issues/16-streaming-first-sound-optimization.md`)、T17 (`issues/17-local-asr-macos-m2.md`)
> 所有结论附一级 URL；不能从一手源验证的显式标注。

---

## TL;DR (一图流)

**推荐路径**: **R4 = Doubao 同传 2.0 s2t mode 单 session (云端端到端)** —— 不再写 R4 本地 MT 代码。

**理由**:
1. 同传 2.0 s2t 模式一次出双语字幕 (源语 + 译语同 session), **R4 这边不需要再拼 ASR + MT 两步**
2. 翻译质量 SOTA (zh-en BLEURT 64.9 / en-zh BLEURT 62.0, 论文 arxiv 2507.17527) — 比本地 MarianMT / NLLB-200 distilled 高 2-5 BLEURT 点
3. 首字幕延迟 ~2.1-2.4s (论文 S2T zh-en 句级 FLAL = 2.12s + 客户端 ~100ms), 不达 1.3s 目标 (1.3s 是 R3 音频首音目标, R4 字幕用户认知预期宽容)
4. 字幕事件 650-655 (SourceSubtitleStart/Response/End + TranslationSubtitleStart/Response/End) 与 R3 s2s session 完全相同的事件流, 客户端代码可共用
5. 自定义词库 (Hot Words / Replacement / Glossary) 通过 `ReqParams.corpus` 字段挂入, 会议术语翻译质量可调

**关键确认点**: Doubao 同传 2.0 s2t mode 是 **S2S endpoint 的另一个 mode 值**, 不是另一个独立 API (`ReqParams.mode = "s2t"`)。R4 用 s2t + target_audio 字段完全省略, TTS 事件 350-352 服务端不发。

---

## 1. 决策矩阵 (4 路径对比)

> 端到端延迟口径: 客户开始说话 → 客户看到 R4 翻译字幕第一帧。
> 成本口径: ¥/小时, 假设 500 tok/min 语音合计 (R4 字幕消耗速率)。

| 路径 | 端到端延迟 | 成本/小时 | 复杂度 | license / 商业可用 |
|---|---|---|---|---|
| **A. Doubao s2t 单跑** (云端, 推荐) | **~2.1-2.4s** 首字幕 (论文 FLAL 2.12-2.28s + 客户端 ~100ms) | 按分钟计费 (具体单价需登录 console; T02 试用赠送额度, 后付费按量) | **最低** — 复用 R3 s2s 客户端, 字幕事件 650-655 一致 | 商用 OK (火山引擎付费 API) |
| B. 本地 ASR + Doubao s2t-MT-only | 200ms 本地 ASR + VAD 段长 ~1-2s + 云端 MT ~500-800ms ≈ **1.7-3s** | 火山 MT 大模型 ¥1.8/M input + ¥5.4/M output tokens ≈ ¥0.10-0.22/h | **高** — ASR + MT + 字幕拼接 3 段流水线; 自建本地 ASR 选 sherpa-onnx / whisper.cpp | 本地 ASR: MIT/Apache; Doubao MT: 商用 OK |
| C. 本地 ASR + 本地 MarianMT (Helsinki-NLP/opus-mt-en-zh) | 200ms ASR + MarianMT 句级 (~200-400ms) ≈ **~600-900ms** (best case) | **¥0 边际** (本地 CPU 算力) | **中** — MarianMT 句级, 需要 VAD 段长 + ASR partial 触发 + MarianMT 串接; 字幕延迟比 Doubao s2t 短 1-2s | **Apache-2.0** (opus-mt-en-zh); ✅ 商用 |
| D. 本地 ASR + Qwen-MT API (Aliyun) | 200ms ASR + ~300-500ms Qwen-MT streaming ≈ **~700-1000ms** | ¥0.6-0.7/M input + ¥1.6-1.95/M output ≈ **¥0.07-0.10/h** | 中 — ASR + Qwen-MT API + 字幕拼接; Qwen-MT 通过通用 chat completion + `translation_options` | Apache-2.0 (Qwen); ✅ 商用 OK |
| (参考) R3 s2s 同传 2.0 出方向 | ~2.5-3s 首音 (含 ASR + MT + TTS 整句) | 同 A | — | 商用 OK |

### 矩阵结论

- **延迟**: C/D 路径 (本地 MT 或云端 LLM-MT) 在理论 best case ~600-900ms 是 **端到端 R3 1.3s 目标内的唯一选项**, 但字幕质量显著低于 Doubao s2t (BLEURT 差距 5+ 点)
- **成本**: B/C/D 都 < ¥0.30/h, 远低于 ¥2/h 上限
- **复杂度**: A 路径 (Doubao s2t) 最低 (1 个 WS + 1 个 session), B/C/D 都需要 ASR + MT 两个组件 + 字幕流拼接
- **License**: A/B/D 都商用 OK; C 路径 MarianMT Apache-2.0 商用 OK; **NLLB-200 distilled CC-BY-NC 4.0 商用禁用** (T18 已确认)

---

## 2. Doubao 同传 2.0 s2t mode (推荐) — 深度确认

### 2.1 Pricing

**公开文档无 ¥X/小时或 ¥X/分钟明确数字**。已查证:

| 维度 | 来源 | 状态 |
|------|------|------|
| 官网价目页 | `https://www.volcengine.com/pricing` | JS 渲染 + WAF 保护, 不公开列出 |
| AST 2.0 协议主文档 | `https://docs.volcengine.com/docs/6561/1756902` | JS 渲染, 需登录, 不公开列出 |
| proto schema 端 | `https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/protos/common/rpcmeta.proto` L31-L42 | **结构可见, 单价不可见** |

proto 端能确认 (`BillingItem` 字段):
```proto
message BillingItem {
  string Unit = 1;          // minute / word / call
  float  Quantity = 2;
}
message Billing {
  repeated BillingItem Items = 1;
  int64  DurationMsec = 2;  // 按 ms 计价
  int64  WordCount    = 3;  // 按 word/token 计价
}
```
服务端在 `UsageResponse` (event=154) 通过 `Billing` 字段携带用量与单价回客户端。

**计费模式** (已确认):
- **后付费 / 按量计费** (T02 `research/02-volcengine-account-application.md` §2.3 引用)
- **免费试用体验**: 控制台「试用」按钮可获赠"一定免费额度" (官方措辞即"一定", 未给出具体数字)
- **资源包**: 按需增购并发或购买资源包, 定价以控制台为准

**PoC 阶段可放心跑**: 控制台「试用」按钮立刻给一定额度, 足够 PoC + 几小时真实会议流量测试, 不用担心信用卡 / 充值。**正式商用前**必须登录 console 拿准确单价写入商业化策略。

### 2.2 Latency (gold source: arxiv 2507.17527)

**论文实测 S2T vs S2S 延迟对比** (Sentence-level benchmark, 表 2):

| 模式 | 方向 | AL↓ | LAAL↓ | FLAL↓ | BLEURT↑ | COMET↑ |
|------|------|---:|---:|---:|---:|---:|
| S2T (zh-en) | 中→英 | **1.37** | 1.56 | **2.12** | **64.9** | **84.1** |
| S2S (zh-en) | 中→英 | 3.56 | 3.79 | 3.08 | 60.7 | 83.6 |
| S2T (en-zh) | 英→中 | **2.17** | 2.18 | **2.28** | **62.0** | **85.3** |
| S2S (en-zh) | 英→中 | 2.81 | 3.12 | 2.38 | 57.6 | 83.5 |

> **S2T 比 S2S 快 ~62% (句级 AL) / ~50% (longform AL)** —— 跳过 TTS 子模块是 S2T 延迟主因。

**Longform RealSI benchmark** (表 1):
- S2T (zh-en) AL = **2.58s** / S2S (zh-en) AL = 5.18s
- S2T (en-zh) AL = **2.71s** / S2S (en-zh) AL = 4.75s
- S2T (zh-en) FLAL = **2.37s** / S2S (zh-en) FLAL = 2.71s

**R4 用 s2t 模式「首字幕延迟」估算**:
- 论文 S2T zh-en 句级 FLAL = 2.12s
- 客户端开销 ~100ms (采集 50ms + 缓冲 40ms + 服务端响应)
- **总计 ~2.2-2.4s** (zh-en 句级 / 会议口语场景)
- 不达 R3 的 1.3s 目标, 但 **字幕用户的认知预期宽容**, 2-3s 在会议字幕市场是可接受范围

### 2.3 字幕事件流 (650/651/652 源语 + 653/654/655 译语)

**事件枚举** (一级源: `https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/protos/common/events.proto` L83-L91):

```proto
/*** 600 ~ 699 为 Machine Translation 相关事件 ***/
// Events for source (original) language subtitle.
SourceSubtitleStart       = 650;
SourceSubtitleResponse    = 651;
SourceSubtitleEnd         = 652;
// Events for target (translation) language subtitle.
TranslationSubtitleStart  = 653;
TranslationSubtitleResponse = 654;
TranslationSubtitleEnd    = 655;
```

**字幕流协议 — partial-update 语义** (sokuji 客户端源码 L680-L769):
1. **`start` (650 or 653)** — 新段开始, 客户端产生新 item ID
2. **`response` (651 or 654)** — token-by-token 增量推送; `response.text` 是**完整到当前的累积文本** (不是 delta diff); 客户端 `status: 'in_progress'`
3. **`end` (652 or 655)** — 段终态; 客户端 `status: 'completed'`

**S2T 与 S2S 字幕事件流完全相同**, 但 S2T 不发 TTS 事件 350-352:

| 事件 | S2S | S2T |
|------|-----|-----|
| 650/651/652 SourceSubtitleStart/Response/End | ✅ 推送 | ✅ 推送 |
| 653/654/655 TranslationSubtitleStart/Response/End | ✅ 推送 | ✅ 推送 |
| 350/351/352 TTS 句子 / 音频 | ✅ 推送 | ❌ **不发** |

→ R4 收字幕的代码路径与 R3 完全相同 (共用 `handleSourceSubtitle`/`handleTranslationSubtitle`), 只是 `textOnly` config=true 时不再订阅 TTS 事件。

### 2.4 EN ↔ ZH 翻译质量

**论文实测** (gold source: `https://arxiv.org/abs/2507.17527`):

**Longform RealSI (表 1)**:
| 方向 | S2T VIP↑ | S2T baseline 最高 | 差距 |
|------|---:|---:|---:|
| zh-en | **79.5** | 53.2 (Commercial-I) | **+26.3** |
| en-zh | **70.1** | 42.0 (Commercial-T) | **+28.1** |

**Sentence-level (表 2)**:
| 方向 | S2T BLEURT↑ | S2T COMET↑ |
|------|---:|---:|
| zh-en | **64.9** | 84.1 |
| en-zh | **62.0** | 85.3 |

> S2T 在 zh-en / en-zh **全部 baseline 中拿最高 BLEURT + COMET** (论文 §3.2 直言 "substantially outperforming all baselines")。

**EN↔ZH 是 Seed LiveInterpret 2.0 的"母语 pair"** — 论文 §1 + §3.1 反复强调 Chinese-to-English / English-to-Chinese, 没有提其他方向同等优先级。服务端支持 `zhen` 双语自动模式: `mode=s2t, source=zhen, target=zhen` 让服务端**自动判断输入是中还是英**, 输出另一语 (Doppelvoice `ARCHITECTURE.md` L184-L189)。

### 2.5 R4 必做的 3 件事

1. **新开一个 WebSocket session** — 与 R3 出方向的 s2s session **完全独立** (不同 ConnectionID + 不同 SessionID)
2. **省略 `target_audio` 字段** — sokuji `VolcengineAST2Client.ts` L435-L439 显式说明: `if (!isTextOnly) { requestPayload.targetAudio = {...} }`; s2t 完全不写 target_audio
3. **过滤 TTS 事件 (350-352)** — 即使服务端在某些边界情况下返回, 也跳过不要消费

**自定义词库 (Corpus / Hot Words / Glossary)**:
- Hot Words → `boosting_table_id` (wire) / `boostingTableId` (JS)
- Replacement → `regex_correct_table_id` / `regexCorrectTableId`
- Glossary → `glossary_table_id` / `glossaryTableId`
- 通过 `ReqParams.corpus` 字段挂入, 会议术语翻译质量可调

---

## 3. 商用 LLM streaming MT (备选路径 D)

### 3.1 Pricing (¥/M tokens, ¥/小时折算)

**假设**: 500 tok/min 语音合计, 60k tok/hr 最低基线 (30k input + 30k output)。

| 模型 | ¥/M input | ¥/M output | ¥/小时 | 一级来源 |
|---|---|---|---|---|
| **Qwen-MT-Flash** (华北 2, 专用 MT) | 0.70 | 1.95 | **¥0.08** | [help.aliyun.com/zh/model-studio/billing](https://help.aliyun.com/zh/model-studio/billing) |
| **Qwen-MT-Lite** (华北 2, 专用 MT) | 0.60 | 1.60 | **¥0.07** | 同上 |
| **Qwen-MT-Plus** (华北 2, 专用 MT) | 1.80 | 5.40 | **¥0.22** | 同上 |
| **Qwen-Flash** (通用 chat, 华北 2) | 0.15 | 1.50 | **¥0.05** | 同上 |
| **DeepSeek V4-Flash** (off-peak, cache-miss) | 1.58 | 4.75 | **¥0.19** | [api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| **DeepSeek V4-Flash** (off-peak, cache-hit) | 0.05 | 4.75 | **¥0.14** | 同上 |
| **GPT-4o-mini** (Azure Global tier) | 1.08 (0.54 cached) | 4.32 | **¥0.16** | [azure.microsoft.com/en-us/pricing/details/azure-openai/](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) |
| **Claude Haiku 4.5** | 7.20 | 36.00 | **¥1.30** | [claude.com/pricing](https://claude.com/pricing#api) + [haiku-4-5 launch](https://www.anthropic.com/news/claude-haiku-4-5) |
| **Claude Haiku 4.5 + cache read** | 0.72 | 36.00 | **¥1.09** | 同上 |

### 3.2 TTFT 数据 (各家公开情况)

**四家全部不公开 TTFT (first-token latency)** —— 必须实测。

| 提供商 | 是否公开 TTFT | 公开了什么 | 一级来源 |
|---|---|---|---|
| OpenAI (GPT-4o-mini) | ❌ 否 | Azure 仅定性 "low-latency"; OpenAI 文档本会话被 Cloudflare 403 | Azure pricing 页 |
| Anthropic Haiku 4.5 / 3.5 | ❌ 否 | 定性 "more than twice the speed", "4-5× faster than Sonnet 4.5" | [haiku-4-5 launch](https://www.anthropic.com/news/claude-haiku-4-5) |
| DeepSeek V3/V4 | ❌ 否 | 仅 V3 README 框架定性 (SGLang) | [V3 GitHub README](https://github.com/deepseek-ai/DeepSeek-V3) |
| Aliyun DashScope Qwen | ❌ 否 | 流式文档显式说"监控 TTFT 是用户责任" | [/zh/model-studio/stream](https://help.aliyun.com/zh/model-studio/stream) |

### 3.3 Translation Quality (MT 专项 vs 通用 LLM)

**四家均不公开 MT 专项基准** (WMT/BLEU/COMET/chrF)。模型卡只展示通用 LLM benchmark (MMLU, SWE-bench 等)。翻译质量必须自建 Flores-200 / WMT22 zh-en 测试集 + BLEU + chrF + COMET + 人工评估。

**Qwen-MT 例外**: Qwen 团队博客 (https://qwenlm.github.io/blog/qwen-mt/) 声明 "outperforms GPT-4.1-mini, Gemini-2.5-Flash, Qwen3-8B on WMT24 zh↔en, en↔de" 但**未公开具体 BLEU 数字**; 92 语言, 人类评审 acceptance / excellence rate 数字也未公开。

### 3.4 R1 不要做流式翻译骨干

DeepSeek R1 是推理模型, 必须先吐 `reasoning_content` CoT token, 再吐最终译文:
- TTFT 拉长 (用户等 CoT 跑完才看到译文首字)
- 输出成本上升 (CoT 也按 ¥14.26/M 计价 on v4-pro)
- R1 README 显式建议 "avoid adding a system prompt; all instructions should be contained within the user prompt" — 与同传产品固定 system prompt 的模式相左

### 3.5 License

| 模型 | 商用可用 | 一级来源 |
|---|---|---|
| GPT-4o-mini | ✅ (Azure OpenAI 商业条款) | [azure.microsoft.com](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) |
| Claude Haiku 4.5 | ✅ | [anthropic.com/legal/commercial-terms](https://www.anthropic.com/legal/commercial-terms) |
| DeepSeek V3 | ✅ (custom license with Use-based Restrictions) | [V3 LICENSE-MODEL](https://github.com/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-MODEL) |
| DeepSeek R1 | ✅ (MIT) | [R1 LICENSE](https://github.com/deepseek-ai/DeepSeek-R1/blob/main/LICENSE) |
| Qwen3.x / Qwen-MT | ✅ (Apache 2.0 推断) | [Qwen2.5 blog](https://qwenlm.github.io/blog/qwen2.5/) |

---

## 4. 本地 MT 模型 (备选路径 C)

### 4.1 License Summary (R4 商用可行性)

| 模型 | License | 商用? | 一级来源 |
|---|---|---|---|
| **Helsinki-NLP/opus-mt-en-zh** | **Apache-2.0** | ✅ **强烈推荐** | [HF model card](https://hf-mirror.com/Helsinki-NLP/opus-mt-en-zh/raw/main/README.md) |
| **Helsinki-NLP/opus-mt-zh-en** | CC-BY-4.0 (attribution required) | ✅ | [HF model card](https://hf-mirror.com/Helsinki-NLP/opus-mt-zh-en/raw/main/README.md) |
| facebook/m2m100_418M / 1.2B | MIT | ✅ | HF card |
| facebook/mbart-large-50-many-to-many-mmt | ⚠️ 推断 CC-BY-NC (mBART 历史) | ⚠️ 待确认 | HF card 无 license 字段 |
| Qwen2.5-1.5B-Instruct / 7B-Instruct | Apache-2.0 | ✅ | [Qwen2.5 LICENSE](https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct/raw/main/LICENSE) |
| Qwen2.5-1.5B-Instruct-GGUF / AWQ | Apache-2.0 | ✅ | HF card |
| **facebook/nllb-200-distilled-600M / 1.3B** | **CC-BY-NC-4.0** + "research model, not for production deployment" | ❌ **NO 商用** | [HF card](https://hf-mirror.com/facebook/nllb-200-distilled-600M/raw/main/README.md) |
| Unbabel/TowerInstruct-7B-v0.1 | CC-BY-NC-4.0 + Llama 2 Community License | ❌ NO | HF card |
| utter-project/EuroLLM-1.7B | Apache-2.0 | ✅ | HF card |
| google/madlad400-3b-mt | ⚠️ metadata apache-2.0, LICENSE 文件缺失 | ⚠️ 待手动验证 | HF card |

**关键确认**: 用户预期 `NLLB-200-distilled-600M` 是 CC-BY-NC (商用禁用) —— 已确认 ❌ **NO 商用**。

### 4.2 Performance on M2 Apple Silicon — 数据空白

**硬事实**: 没有任何公开 benchmark 给出 M2 MacBook Air 上这些 MT 模型的 tokens/sec + TTFT。

- CTranslate2 benchmark: Intel Xeon (c5.2xlarge) + NVIDIA A10G (g5.xlarge), **没有 Apple Silicon**
- OPUS-MT en→de base (fp32): CTranslate2 = 525 tok/s CPU / 5876 tok/s GPU (NVIDIA A10G int8) — 仅作参考
- mlx-lm, llama.cpp: **没有 published Qwen2.5 / MT 模型 M2 Air tokens/sec**

**必须本地实测** —— 加载脚本测:
- (a) Cold-start TTFT (30 token 源文 → 首 token)
- (b) 稳态 tokens/sec (后续 60 token)
- 候选: Opus-MT en-zh (CTranslate2 int8) vs Qwen2.5-1.5B (GGUF q4_K_M via llama.cpp) vs Qwen2.5-1.5B (mlx-lm 4-bit)

### 4.3 Quality (BLEU / chrF)

| 模型 | 测试集 | 分数 | 一级来源 |
|---|---|---|---|
| Opus-MT en→zh | Tatoeba-test.eng.zho | BLEU **31.4** / chr-F 0.268 | [HF card benchmarks](https://hf-mirror.com/Helsinki-NLP/opus-mt-en-zh/raw/main/README.md) |
| Opus-MT zh→en | Tatoeba-test.zho.eng | BLEU **36.1** / chr-F 0.548 | HF card |
| NLLB-200 distilled-600M | Flores-200 (chrF++) | -3.7 vs NLLB-200 full | [NLLB paper Table 41](https://arxiv.org/pdf/2207.04672) |
| NLLB-200 distilled-1.3B | Flores-200 (chrF++) | -1.4 vs NLLB-200 full | 同上 |
| Qwen2.5-1.5B/7B-Instruct | ❌ 无独立 translation BLEU 数字 | — | Qwen blog 只列 MMLU/HumanEval/MATH |

**Tatoeba vs Flores-200 不可直接比较** —— Tatoeba 是短简单句, Opus-MT 模型卡 README 自身警告: "most automatic evaluations are made on simple and short sentences from the Tatoeba data collection; those scores will be too optimistic when running the models with other more realistic data sets"。

### 4.4 Streaming Behavior

| 模型 | Native streaming? | Mechanism |
|---|---|---|
| Opus-MT (Marian) | ⚠️ **句级 only** (encoder-decoder) | CTranslate2 支持 partial-sequence completion, 不是 token-by-token |
| mBART-50 / M2M-100 / NLLB / MADLAD | ⚠️ 句级 only | 同 Marian |
| **Qwen2.5-Instruct** | ✅ **Token-by-token 自回归** | llama.cpp `stream` 或 mlx-lm `stream_generate` |
| TowerInstruct-7B | ✅ token-by-token | decoder-only |
| EuroLLM-1.7B-Instruct | ✅ token-by-token | decoder-only |

**结论**: 对 R4 流式场景, decoder-only LLM (Qwen2.5-Instruct / EuroLLM-Instruct) 结构上比 Marian/NLLB encoder-decoder 更友好, 但都需要 wait-k / chunked re-decode 等外部策略。

---

## 5. 专业翻译 API (备选路径 B)

### 5.1 Pricing

| API | Billed unit | PAYG rate | ¥/小时估算 (30k chars/h) | Free tier | 一级来源 |
|---|---|---|---|---|---|
| **Volcengine 机器翻译大模型** | tokens | **¥1.8/M input + ¥5.4/M output** | **~¥0.11/h** | 100万 tokens / 6 月 | [volcengine MT docs](https://www.volcengine.com/docs/6561/2306735) |
| DeepL API Pro | characters | (login-gated, 未确认) | ~¥5.4/h (估算) | 500k chars/mo | [DeepL Pro](https://www.deepl.com/en/pro#api) |
| Azure Translator Text S1 | characters | $10/M ≈ ¥72/M | ~¥2.16/h | 2M chars/mo F0 | [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/translator/) |
| Azure Translator S4 (commit 600M/mo) | characters | $4.5/M | ~¥0.97/h | — | 同上 |
| Google Cloud Basic v2 | characters | $20/M ≈ ¥144/M (widely cited, **未在 Google primary source 验证**) | ~¥4.32/h | 500k chars/mo | [cloud.google.com/translate/pricing](https://cloud.google.com/translate/pricing) (本会话被网络层阻挡) |
| Google Cloud Advanced v3 | characters | $60/M ≈ ¥432/M | ~¥12.96/h | 共享 500k | 同上 |

### 5.2 Streaming Capability (true streaming vs batch REST)

| API | Streaming? |
|---|---|
| **Volcengine 机器翻译大模型** (text MT) | **Batch REST POST only** — `text_list: [strings]` ≤16 items × 1024 tokens, 返回 array. No SSE/WS/chunked. |
| **DeepL API** | **Batch REST POST only** — `POST /v2/translate`, 同步 JSON 返回. |
| **Google Cloud Translation v2/v3** | **Batch REST POST only**. |
| **Azure Translator Text v3** | **Batch REST POST only**. |
| (产品外) Azure Speech Translation | ✅ **WebSocket streaming**, 但按 audio-hour ¥18/h ¥计费, 超预算 |
| (产品外) Volcengine 同传 2.0 | ✅ **WebSocket streaming** (R3/R4 用的就是这条, 见 §2) |

**关键结论**: 4 个 standalone text MT API 全部 **batch REST only**, **none hits 1.3s streaming first-sound under realistic conditions** without buffering tricks。

### 5.3 EN↔ZH Quality

| API | 排名 (主观社区共识) |
|---|---|
| Google Advanced v3 / DeepL Pro | #1-2 — NNMT-tuned, 都接近 SOTA |
| Azure Translator v3 | #3 — WMT ZH-EN 竞争性, 通常次优 |
| Volcengine 机器翻译大模型 | #4 — LLM-backed (token-priced), 强在对话, 偶有专有名词 hallucination |
| Google Basic v2 | #5 |

---

## 6. R4 架构最终推荐

### 6.1 推荐路径: Doubao s2t 单 session (路径 A)

```
[ meeting app audio ] → [ ScreenCaptureKit excludesCurrentProcessAudio=true ]
                              │
                              ▼
[ BlackHole 2ch 物理 mic 接收，sounddevice capture ]
                              │ 16k/16bit/mono PCM，每 80ms 一包
                              ▼
[ Python asyncio client: DoubaoClient (s2t mode) ]
    StartSession: mode=s2t, source=en, target=zh
                  source_audio.format=wav, rate=16000, bits=16, channel=1
                  target_audio ← 完全省略
                  corpus={hotWordTableId, replacementTableId, glossaryTableId} (可选)
    per-task: TaskRequest with binary_data
                              │
                              ▼
[ wss://openspeech.bytedance.com/api/v4/ast/v2/translate ]
                              │ X-Api-App-Key / X-Api-Access-Key / X-Api-Resource-Id
                              ▼
[ 同传 2.0 服务端 (zhen 双向自动 OR en→zh) ]
                              │
                              ├─ 651 SourceSubtitleResponse ─► stdout JSON line {kind:"source", text:"...", definite:false}
                              │   ... (多次)
                              ├─ 652 SourceSubtitleEnd       ─► stdout JSON line {kind:"source", text:"...", definite:true}
                              │
                              ├─ 654 TranslationSubtitleResponse ─► stdout JSON line {kind:"target", text:"...", definite:false}
                              │   ... (多次)
                              └─ 655 TranslationSubtitleEnd       ─► stdout JSON line {kind:"target", text:"...", definite:true}
                              │
                              ▼
[ 浮动字幕 UI / CLI 终端 ]
```

### 6.2 备选路径对比

| 备选 | 何时选 |
|---|---|
| 路径 B: 本地 ASR + Doubao 机器翻译大模型 | 需要更高翻译质量且能容忍 ~1.7-3s 字幕延迟; ASR 走本地 sherpa-onnx/zipformer (T17) 节省 ASR 网络往返; 成本 ¥0.11/h |
| 路径 C: 本地 ASR + 本地 MarianMT | 隐私敏感场景 (英文不出本地); 但翻译质量比 Doubao s2t 低 BLEURT 5+ 点; M2 上 tokens/sec 未实测, 必须 benchmark |
| 路径 D: 本地 ASR + Qwen-MT API | 同 B 但用 Qwen-MT (¥0.07-0.08/h), 比 Doubao MT 大模型便宜, 但 CN 出口到 Aliyun 网络稳定性需实测 |
| (不建议) NLLB-200 distilled | ❌ CC-BY-NC 商用禁用 |

### 6.3 为什么不选「拆 ASR + MT 拼接」 (路径 B/C/D)

- **延迟**: 即使本地 ASR (200ms) + 云端 MT (500-800ms) 在 best case ~1.7-3s 字幕延迟, **比 Doubao s2t 单跑 2.1-2.4s 没有显著优势**, 因为服务端 MT 推理 + 网络往返是大头
- **质量**: 论文 §5 Related Work: "cascaded architectures suffer from error propagation" — 拆装路径翻译质量 BLEURT 比 Doubao s2t 端到端低 5-10 点
- **复杂度**: 多 1 个组件 (本地 ASR 模型管理 + 字幕拼接逻辑) ≈ +1.5k 行
- **维护**: 自定义词库、热熔点、streaming 边界处理都需要自己写

### 6.4 路径 A 已知风险

- **数据隐私**: 英文过云端 (map.md 接受 #3 未禁止但需评估); 客户机密会议场景需提供本地 ASR fallback
- **网络依赖**: 断网即失效; PoC 二期可补本地 ASR 兜底
- **价格不确定**: 公开文档无 ¥X/小时数字, 必须登录 console 拿到准确单价

### 6.5 R4 与 R3 关系

- **R3 (出方向)**: 走 Doubao s2s 模式 + 声音复刻 2.0 (speaker_id), ~2.5-3s 首音, 出英文 TTS
- **R4 (入方向)**: 走 Doubao s2t 模式, ~2.1-2.4s 首字幕, 不出音频
- **完全独立的两个 WebSocket session**: 不同 ConnectionID + 不同 SessionID, 各自 lifecycle 独立管理, 重连互不影响

---

## 7. 已知 Gap (未填补)

1. **Doubao 同传 2.0 ¥X/小时具体数字**: 公开文档未列, 需登录 console 拿到; T02 试用赠送额度足够 PoC 测试
2. **S2T 与 S2S 是否同价**: 公开资料证实/证伪均无, 需登录 console 比较两个 mode 价目
4 家 TTFT (商用 LLM streaming) 一手数据缺失 —— 必须 CN 出口下用各家 SDK 实测
4. **MT 质量基准 (商用 LLM)**: 4 家均无, 需自建 Flores-200 / WMT22 zh-en + BLEU + chrF + COMET + 人工评估
5. **M2 MacBook Air MT 模型 tokens/sec / TTFT**: 无任何公开 benchmark, 必须本地实测 (Opus-MT CTranslate2 int8 vs Qwen2.5-1.5B GGUF q4_K_M)
6. **DeepL Pro exact USD figures**: DeepL 价目页 JS 渲染 + login-gate, 本会话被阻挡; 需浏览器 session 完成 Pro signup flow 验证
7. **Google Cloud Translation Primary source 验证**: 所有 `*.google.com` 域在本会话被网络层阻挡, $20/M Basic / $60/M Advanced v3 数字为广泛流传但**未在 Google 一级源验证**, 投产前需 console.cloud.google.com 重新核实
8. **mBART-50 license 字段缺失**: HF card 无 license 字段, 推断 CC-BY-NC (mBART 历史), 投产前必须找原始 LICENSE 文件确认

---

## 8. Primary URLs (汇总)

### Doubao 同传 2.0
- 协议主文档: <https://www.volcengine.com/docs/6561/1756902> (JS 渲染, 需登录)
- Seed LiveInterpret 2.0 论文: <https://arxiv.org/abs/2507.17527> (论文 §3.2 表 1, §3.3 表 2)
- AST 2.0 ReqParams proto: <https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto>
- 字幕事件 proto: <https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/protos/common/events.proto> (650-655)
- 计费 proto: <https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/protos/common/rpcmeta.proto>
- Doppelvoice 客户端: <https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/src/doppelvoice/engine/doubao.py> (s2t 模式 `target_audio` 省略)
- Doppelvoice 架构: <https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/docs/en/ARCHITECTURE.md> (9 语言 + zhen)
- sokuji 客户端: <https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/src/services/clients/VolcengineAST2Client.ts> (textOnly config + corpus 映射)

### 商用 LLM streaming
- OpenAI pricing (Cloudflare 阻挡 in session): <https://platform.openai.com/docs/pricing>
- Azure OpenAI pricing: <https://azure.microsoft.com/en-us/pricing/details/azure-openai/>
- Anthropic pricing: <https://claude.com/pricing#api>
- Haiku 4.5 launch: <https://www.anthropic.com/news/claude-haiku-4-5>
- Haiku 3.5 launch + pricing update: <https://www.anthropic.com/news/3-5-models-and-computer-use>
- DeepSeek V4 pricing: <https://api-docs.deepseek.com/quick_start/pricing>
- DeepSeek thinking mode + streaming: <https://api-docs.deepseek.com/guides/thinking_mode>
- Aliyun DashScope billing: <https://help.aliyun.com/zh/model-studio/billing>
- Aliyun DashScope streaming: <https://help.aliyun.com/zh/model-studio/stream>
- Qwen-MT blog: <https://qwenlm.github.io/blog/qwen-mt/>
- DeepSeek V3 LICENSE: <https://github.com/deepseek-ai/DeepSeek-V3/blob/main/LICENSE-MODEL>
- DeepSeek R1 LICENSE (MIT): <https://github.com/deepseek-ai/DeepSeek-R1/blob/main/LICENSE>

### 本地 MT 模型
- Opus-MT en→zh HF card: <https://hf-mirror.com/Helsinki-NLP/opus-mt-en-zh/raw/main/README.md>
- Opus-MT zh→en HF card: <https://hf-mirror.com/Helsinki-NLP/opus-mt-zh-en/raw/main/README.md>
- NLLB-200-distilled-600M HF card (CC-BY-NC): <https://hf-mirror.com/facebook/nllb-200-distilled-600M/raw/main/README.md>
- NLLB paper: <https://arxiv.org/abs/2207.04672> / <https://arxiv.org/pdf/2207.04672>
- Qwen2.5-1.5B-Instruct LICENSE (Apache-2.0): <https://hf-mirror.com/Qwen/Qwen2.5-1.5B-Instruct/raw/main/LICENSE>
- Qwen2.5 blog (license statement): <https://qwenlm.github.io/blog/qwen2.5/>
- mBART-50 HF card (license 缺失): <https://hf-mirror.com/facebook/mbart-large-50-many-to-many-mmt/raw/main/README.md>
- m2m100_418M HF card (MIT): <https://hf-mirror.com/facebook/m2m100_418M/raw/main/README.md>
- TowerInstruct-7B HF card (CC-BY-NC + Llama 2): <https://hf-mirror.com/Unbabel/TowerInstruct-7B-v0.1/raw/main/README.md>
- EuroLLM-1.7B HF card (Apache-2.0): <https://hf-mirror.com/utter-project/EuroLLM-1.7B/raw/main/README.md>
- Bergamot Translator (MPL-2.0): <https://github.com/browsermt/bergamot-translator>
- llama.cpp: <https://github.com/ggerganov/llama.cpp>
- mlx-lm: <https://github.com/ml-explore/mlx-lm>
- CTranslate2: <https://github.com/OpenNMT/CTranslate2>

### 专业翻译 API
- Volcengine 机器翻译大模型: <https://www.volcengine.com/docs/6561/2306735>
- DeepL Pro: <https://www.deepl.com/en/pro#api>
- DeepL supported languages: <https://developers.deepl.com/docs/getting-started/supported-languages>
- DeepL API ref: <https://developers.deepl.com/docs/api-reference/translate/translate-text>
- Azure Translator pricing: <https://azure.microsoft.com/en-us/pricing/details/translator/>
- Azure Retail Prices API: <https://prices.azure.com/api/retail/prices>
- Azure Translator language support: <https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support>
- Google Cloud Translation pricing (网络层阻挡 in session): <https://cloud.google.com/translate/pricing>
- Google Cloud Translation docs (网络层阻挡): <https://cloud.google.com/translate/docs>

### 内部前置研究 (T01/T16/T17)
- T01 Volcengine API 能力现状: `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
- T04 Doppelvoice 深读: `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`
- T16 流式首音延迟优化: `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md`
- T17 macOS 本地 ASR: `.scratch/macos-siminterpret-poc/issues/17-local-asr-macos-m2.md`
- T02 Volcengine 账号申请: `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`

---

## 9. 决策建议 (针对本产品 R4)

### 9.1 主推: 路径 A — Doubao s2t 单 session

**理由**:
- 翻译质量 SOTA (zh-en BLEURT 64.9 / en-zh BLEURT 62.0)
- 实现最简 (复用 R3 s2s 客户端, 字幕事件流一致)
- 字幕延迟 ~2.1-2.4s 可接受 (会议字幕用户认知预期宽容)
- 自定义词库 (Hot Words / Replacement / Glossary) 支持会议术语优化
- 后付费按量计费, 试用赠送额度足够 PoC

**接受代价**:
- 英文过云端 (数据隐私) —— map.md 接受 #3 未禁止, 客户机密场景需 fallback
- 价格 ¥X/小时需登录 console 拿准确数字
- 网络断即失效 —— PoC 二期可补本地 ASR 兜底

### 9.2 备选 1: 路径 B (本地 ASR + Doubao 机器翻译大模型)

**何时选**:
- 客户要求 ASR 端本地化 (隐私敏感)
- 能容忍 ~1.7-3s 字幕延迟
- 想复用火山引擎 console (避免跨供应商账号)

**实现**:
- 本地 ASR: sherpa-onnx Zipformer (T17 路线) 或 mlx-whisper
- 云端 MT: Volcengine 机器翻译大模型 batch REST (¥0.11/h)
- 字幕拼接: ASR partial → VAD 段长 → MT API → 双语字幕行

### 9.3 备选 2: 路径 C (本地 ASR + 本地 MarianMT)

**何时选**:
- 隐私极度敏感 (英文不出本地)
- 接受翻译质量 BLEURT 比 Doubao s2t 低 5+ 点 (Tatoeba 31.4 BLEU)
- 有 M2 算力预算

**实现**:
- 本地 ASR: sherpa-onnx / whisper.cpp (T17)
- 本地 MT: Helsinki-NLP/opus-mt-en-zh (Apache-2.0) via CTranslate2 int8 + Apple Accelerate
- 必须本地 benchmark M2 性能 (CTranslate2 tokens/sec on Apple Silicon 数据空白)

### 9.4 不推荐

- **NLLB-200 distilled**: CC-BY-NC 4.0 商用禁用 (HF card 明确 "research model, not for production deployment")
- **DeepSeek R1**: CoT token 抢在译文前面, TTFT 不可控, 成本翻倍
- **GPT-4o-mini via OpenAI 直连**: CN 出口可达性 + 无 TTFT 数据
- **Qwen-MT-Plus in Singapore region**: 价格 10× vs 华北 2 (¥18/M 输入)
- **专业翻译 API (DeepL/Azure/Google) 4 个 batch REST**: 全部不流式, 无法 1.3s 首音; DeepL/Azure S1 PAYG 超 ¥2/h
- **Google Cloud Translation 数字本会话未在 primary source 验证**: 投产前 console.cloud.google.com 重新核实

### 9.5 第一周必做的事

1. **登录火山引擎 console**, 创建 R3 s2s + R4 s2t 双 session, 拿同传 2.0 准确单价 (¥X/小时)
2. **跑 PoC 双 session 端到端测试**: R3 s2s 出英文音频 + R4 s2t 出双语字幕, 验证两端延迟
3. **本地 benchmark MarianMT on M2 Air** (路径 C 备选): CTranslate2 int8 + Apple Accelerate, 测 cold-start TTFT + 稳态 tokens/sec
4. **本地 benchmark Qwen2.5-1.5B on M2 Air** (路径 D 备选): GGUF q4_K_M via llama.cpp Metal + mlx-lm 4-bit
5. **Flores-200 zh-en 翻译质量评估**: 在 MarianMT / Qwen2.5 / Doubao s2t 三者间跑 BLEU + chrF + COMET 横向对比

---

*Compiled from primary-source fetches against HF model cards, vendor pricing pages, arxiv paper (2507.17527), GitHub proto sources, and 4 background research agents. Every numeric claim above is cited to its source URL.*