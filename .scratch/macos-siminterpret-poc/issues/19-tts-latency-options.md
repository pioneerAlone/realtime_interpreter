# TTS 延迟优化 + 音色克隆方案

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

R3 出方向需要把"用户中文"翻译后合成"英文音频（用户音色）"。TTS 是延迟大头之一（典型 500ms-2s 首音延迟），且音色克隆是关键差异化。

要回答的问题：

1. **TTS 引擎对比**（延迟 / 音色克隆支持 / 成本）：

| 引擎 | 首音延迟 | 音色克隆 | License | API 成本 |
|---|---|---|---|---|
| Doubao TTS（云端） | ? | 内置（bigtts + 0 样本） | 商用 | 按字符 |
| Doubao 同传 2.0 S2S | 2.5-3s 整句 | 0 样本内置 | 商用 | 按分钟/字符 |
| CosyVoice（开源本地） | ? | 支持 | Apache-2.0 | 本地 0 边际 |
| GPT-SoVITS（开源本地） | ? | 强 | MIT（需确认） | 本地 0 边际 |
| StyleTTS 2 | ? | 一般 | MIT | 本地 0 边际 |
| F5-TTS | ? | 弱 | MIT | 本地 0 边际 |
| ElevenLabs API | <500ms 首音 | 强（Instant Clone） | 商用 | 按字符（贵） |
| Cartesia Sonic | <200ms 首音 | 强 | 商用 | 按字符 |
| Rime | ? | 一般 | 商用 | 按字符 |

2. **Doubao 同传 2.0 S2S 的 TTS 部分**是否能单独用？还是要和 ASR + MT 绑死？
3. **0 样本克隆**的可控性：能否指定"克隆音色强度"（强 / 弱）？能否事后调整？
4. **跨语种音色迁移**的"中文口音残留"程度（火山官方资料 + 第三方评测）
5. **本地 TTS + 0 样本克隆**的可行性（CosyVoice / GPT-SoVITS 是否能本地跑 + 0 样本）
6. **延迟 vs 成本 trade-off**：
   - Doubao 云端（最简单，可能 ~500-800ms TTS）
   - 本地开源（最自由，但 M2 上能否跑得动 + 1.3s 延迟达标？）
   - ElevenLabs（最低延迟，但 ¥？/小时成本）

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/19-tts-latency-options.md`

R3 应直接走 **Doubao 同传 2.0 S2S**（端到端 0 样本克隆 + 跨语种音色迁移内置，~2.5–3 s 整句延迟；商务同传节奏可接受）；≤1.3 s 硬目标方案需拼 **Cartesia Sonic (~90 ms) + 本地 MT**（MT 在另一 ticket 范围），云端三家目前都不能同时给"≤1.3 s + 0 样本跨语种克隆"。本地开源 CosyVoice 3 (Apache-2.0) 是备选但 M2 MPS RTF 未见 benchmark。

Comparison table (10 维度 × 9 引擎):

| 维度 | Doubao 同传 2.0 S2S | Doubao bigtts | CosyVoice 3 | GPT-SoVITS | StyleTTS 2 | F5-TTS | ElevenLabs Flash | Cartesia Sonic | Rime Mist v3 |
|---|---|---|---|---|---|---|---|---|---|
| First-sound latency | 2.5–3 s 整句（论文 + Doppelvoice）| 未量化 | 150 ms streaming（GPU；M2 未测）| M4 CPU RTF 0.526 | 未量化 | L20 253 ms avg | ~75 ms | ~90 ms TTFB | 37 ms P50 / 56 ms P90 |
| 0-sample clone | ✅ 内置（speaker_id 留空） | 需先训练声音复刻 2.0 | ✅ 跨语种 zero-shot | ✅ 5s zero-shot | ✅（英文基线）| ✅ ref_audio 引导 | ✅ Instant Clone | ✅ 10s Instant | ✅ Enterprise |
| Cross-lang transfer | ✅ 内置（zh → en 用 zh 音色）| ✅ 训练 speaker_id | ✅ 仓库明示 | ✅ en/ja/ko/yue/zh | 需多语种 PL-BERT | ⚠ Emilia ZH-EN，accent leakage 未量化 | ✅ Multilingual 70+ langs | ✅ 44 langs | ❌ Mist 不支持中文；Coda 支持 |
| License | 商用 | 商用 | Apache-2.0 | MIT | Code MIT / 模型须声明 | Code MIT / 模型 CC-BY-NC 非商用 | 商用 | 商用 | 商用 |
| Cost / 1k chars (CNY) | 待 T02 补 | 待 T02 补 | ¥0（仅电费）| ¥0 | ¥0 | ¥0（但非商用）| ¥0.36 ($0.05) | ~¥0.22 (~$0.03) | ¥0.22 ($0.03) |
| Cost / hour @ 100 chars/min | 待 T02 补（推 ~¥1–2）| 待 T02 补 | ~¥0.03 | ~¥0.03 | ~¥0.03 | N/A | ¥2.16 | ¥1.30 | ¥1.30 |
| Streaming | ✅ WSS+proto (350/351/352) | ✅ | ✅ Bi-Streaming | ⚠ 试验性 | ❌ 主分支无 | ✅ TRT-LLM | ✅ WebSocket | ✅ HTTP+WebSocket | ✅ HTTP+WebSocket |
| M2 本地可行 | N/A（云端）| N/A | ⚠ M2 MPS 未 benchmark | ⚠ CPU RTF ~0.5 | ⚠ CPU 可跑 | ⚠ 无 M2 基准 | N/A | N/A | ⚠ Enterprise 自托管 |
| Vendor / repo | volcengine docs + Doppelvoice | volcengine docs | FunAudioLLM/CosyVoice | RVC-Boss/GPT-SoVITS | yl4579/StyleTTS2 | SWivid/F5-TTS | elevenlabs.io | cartesia.ai | rime.ai |
| Source URLs | arXiv:2507.17527 / Doppelvoice | docs/6561 | README / LICENSE | README | README / arXiv:2306.07691 | README / arXiv:2410.06885 | elevenlabs.io/pricing/api | cartesia.ai/pricing / docs | rime.ai/pricing |

Recommendation: **Doubao 同传 2.0 S2S**（首选，0 样本克隆 + 跨语种音色内置 + 一站式） / **Cartesia Sonic + 本地 MT**（≤1.3 s 硬目标备选，MT 在另一 ticket）

Cost estimate at 100 chars/minute:
- 首选 Doubao 同传 2.0: **待 T02 补**，推测 ~¥1–2/h
- 备选 Cartesia Sonic + MT: **~¥1.30/h**（仅 TTS 段）
- CosyVoice 3 本地: **~¥0.03/h**（电费）

## Comments

<!-- conversation history -->