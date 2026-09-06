# 中英本地 MT 模型对比

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

R4 入方向如果本地 ASR 给出英文文本，需要 MT 翻成中文（显示双语字幕）。候选：

1. **商用 LLM streaming**
   - GPT-4o-mini（OpenAI）
   - Claude Haiku（Anthropic）
   - Qwen-Turbo / Qwen-Plus（阿里云 dashscope）
   - DeepSeek V3 / R1
   - 延迟 / 成本 / 翻译质量对比
2. **本地小模型**
   - MarianMT（Helsinki-NLP/Opus-MT，Apache-2.0）
   - NLLB-200 distilled（Meta，CC-BY-NC 4.0 —— **商业禁用**）
   - mBART-50
   - Qwen 1.5B / 7B 翻译量化版
3. **专业翻译模型**
   - 火山翻译（火山引擎自家，可能比豆包便宜）
   - DeepL API
   - Google Cloud Translation
4. **Doubao 同传 2.0 S2T 模式**（已含字幕事件 650-655，**已包含翻译**！）

要回答的问题：

1. **延迟**：商用 LLM streaming 首 token 延迟 vs 本地小模型首词延迟
2. **质量**：中英互译的 BLEU / 人工评估对比
3. **成本**：每 1k token 价格（BYO key）vs 本地推理电费
4. **License**：商用可行性
5. **特殊考虑**：同传场景要求"听得懂 + 听得自然"——比通用翻译多一层口语化 / 流畅度要求

特别关注：**Doubao 同传 2.0 S2T 模式**（T01 已确认）—— 已经包含翻译，且延迟 ~2.5-3s（含 ASR + MT 一步到位）。如果走这条路，**R4 不需要单独的 MT 环节**，直接用 s2t mode 即可。这是最大简化路径。

最终交付：「R4 翻译模块的最优路径 + 备选」，含延迟 / 质量 / 成本 / license 对照表，明确推荐"走 s2t mode 简化掉 MT"vs"拆 ASR + MT 拼接"二选一。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/18-local-mt-models.md`

R4 应直接走 Doubao s2t mode (一个 session 一次出双语字幕, 内置 ASR + MT 一步到位, 跳过单独 MT 拆装) — 翻译质量 SOTA (zh-en BLEURT 64.9 / en-zh BLEURT 62.0, 论文 arxiv 2507.17527), 字幕延迟 ~2.1-2.4s, 比拆 ASR + 本地 MarianMT 路径字幕延迟相当或更短, 且代码量 -1.5k 行; s2t 不达 R3 的 1.3s 音频首音目标, 但 2-3s 字幕延迟在会议字幕市场可接受。商用 LLM streaming (Qwen-MT-Flash ¥0.08/h) 和本地 MarianMT (Apache-2.0) 作为备选保留; **NLLB-200 distilled CC-BY-NC 4.0 商用禁用** 已确认。

Decision matrix (R4 走哪条路):

| 路径 | 端到端延迟 | 成本/小时 | 复杂度 | license |
|---|---|---|---|---|
| Doubao s2t 单跑 | ~2.1-2.4s (论文 S2T zh-en 句级 FLAL 2.12s + 客户端 ~100ms) | 按量计费 (具体单价需登录 console; T02 试用赠送额度) | **最低** (复用 R3 s2s 客户端, 字幕事件 650-655 一致) | 商用 OK (火山付费 API) |
| 本地 ASR + Doubao s2t-MT-only | ~1.7-3s (本地 ASR 200ms + VAD 段长 + 云端 MT 500-800ms) | ~¥0.10-0.22/h (Volcengine MT 大模型 ¥1.8/M input + ¥5.4/M output) | 高 (ASR + MT + 字幕拼接 3 段流水线) | 本地 ASR Apache/MIT; 云端 MT 商用 OK |
| 本地 ASR + 本地 MarianMT | ~600-900ms best case (本地 ASR + MarianMT 句级) | **¥0 边际** (本地 CPU 算力) | 中 (VAD 段长 + ASR partial 触发 + MarianMT 串接) | **Apache-2.0** (opus-mt-en-zh) — 商用 OK |
| 本地 ASR + Qwen-MT API | ~700-1000ms (本地 ASR + Qwen-MT streaming) | ¥0.07-0.10/h (Qwen-MT-Flash/Lite ¥0.6-0.7/M input) | 中 (ASR + Qwen-MT API + 字幕拼接) | Apache-2.0 (Qwen); 商用 OK |

Recommendation: **路径 A — Doubao 同传 2.0 s2t mode 单 session** (云端, 不写 R4 本地 MT 代码)。优先实现: R4 = 1 个 WS + 1 个 session, mode=s2t, source=en, target=zh, 省略 target_audio 字段, 过滤 TTS 事件 350-352。翻译质量 SOTA, 实现最简, 自定义词库支持会议术语优化; 数据过云端 + 价格不透明是已知代价 (T02 试用额度足够 PoC)。备选: 路径 B (本地 ASR + Doubao MT 大模型) 用于隐私敏感场景; 路径 C (本地 MarianMT Apache-2.0) 用于极端隐私; 但拆装路径翻译质量比 s2t 端到端 BLEURT 低 5-10 点 (论文 §5 Related Work 已确认), 必须本地 benchmark M2 性能才能定。

## Comments

<!-- conversation history -->