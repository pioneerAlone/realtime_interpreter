# 行业同传延迟降低技术 + 延迟预算深调研

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户要求对「同声传译主流解决方案如何降低时延 + 哪些过程导致时延」做一轮行业级深调研。本票聚焦**延迟**这一个维度，横向对比主流产品与学术方案。

**背景（已有结论，不要重复调研）**：
- T16 已给出级联栈首音预算（ASR ~200ms + MT ~300ms + TTS ~400ms + 网络 ~200ms）与流式技巧清单
- T15/T22 已确认金喜 = Doubao S2S（首音 1.3s）+ 级联轻量版（市面普遍 3s）
- 本票要回答的是**行业全景**：别人怎么做的、数字多少、我们漏了什么

要回答的问题：

1. **主流产品延迟横评**（每个给出首音/首字/端到端口径 + 来源）：
   - Microsoft Translator live / Teams 内置同传
   - Google Translate live / Gemini Live / Meet 内置
   - iFlytek（讯飞）同传 / 听见会议
   - 时空壶 Timekettle（硬件+App）
   - Zoom / 腾讯会议 / 飞书 内置字幕翻译
   - Camb.ai Chatterbox / sokuji / Doppelvoice（开源/商用小厂）
   - 金喜（已知 1.3s，作锚点）
2. **延迟口径辨析**：first-sound（首音）vs first-token/first-char（首字）vs end-to-end（整句）vs interpretation lag（同传 lag）——各产品/论文用的是哪个口径？1.3s vs 2.21s vs 3s 的差异有多少是口径造成的？
3. **延迟预算 by stage**（量化，来自论文/官方 benchmark/实测 issue）：
   - VAD/起音检测（Silero VAD、webrtc VAD、模型内置 VAD）
   - ASR first partial（streaming Whisper / Zipformer / Paraformer / 云 ASR）
   - MT first token（LLM streaming TTFT / 专用 MT / S2S 内部）
   - TTS first audio chunk（流式 TTS 首包）
   - 网络 RTT（国内/国际、直连/代理）
   - OS 音频缓冲（CoreAudio HAL / WASAPI 缓冲）
   - codec 解码（ogg_opus 整句 vs 流式解码）
   - **哪个 stage 是主导？优化收益排序？**
4. **降延迟技术清单**（每个给原理 + 收益量级 + 谁在用）：
   - 流式级联（streaming ASR→MT→TTS pipeline，边出边译边合成）
   - 端到端 S2S（跳过中间文本）
   - speculative / prefix translation（提前译）
   - 语义分块 vs 时间分块（sentence re-segmentation）
   - VAD 灵敏度调优 / 提前触发
   - TTS 首包优先（chunked synthesis、流式 vocoder）
   - 边缘/就近部署、长连接 preconnect、keep-alive
   - 客户端音频预缓冲 / 播放对齐策略
5. **E2E vs 级联的延迟-质量 trade-off**（论文数据）：SeamlessM4T/SeamlessStreaming、Translatotron 2/3、Seed LiveInterpret 2.0、GPT-4o Realtime、Gemini Live、Qwen2.5-Omni、Step-Audio、Kimi-Audio——各自首音延迟 + 翻译质量（BLEU/BLEURT/人工）+ 音色克隆能力
6. **对我们 PoC 的启示**：v0（Doubao S2S，~2.5-3s）→ v1（≤2s）→ v2（≤1.3s）各阶段应该上哪些降延迟技术？哪些是「免费」的（配置级）哪些要改架构？

## Answer

> Full findings: `.scratch/macos-siminterpret-poc/research/23-industry-latency-reduction-survey.md`（本票就是这份文件的 request）

### Gist（5 句话）

1. **1.3s vs 3s 差异 ~70% 来自口径，~30% 来自技术**：金喜"1.3s 首音"≈ Doubao S2S FLAL 2.21s + 本地 VAD/协议/OS 栈 ~1s 填充；市面 3s = 级联方案典型值。**S2S 单 endpoint 的硬下限 ≈ 2.21s FLAL**（arXiv 2507.17527v2 §3.2 Table 1 PRIMARY）。要 ≤1.3s 必须级联全 streaming。
2. **延迟主导 stage = TTS**（不是 ASR/MT）。CosyVoice 2 bi-streaming **150ms**（GitHub README L19 + arXiv 2412.10117 PRIMARY）/ Cartesia Sonic **sub-90ms**（cartesia.ai PRIMARY）。任何"等完整句" TTS 都打不出 ≤1.3s。
3. **延迟口径辨析**：①首音 (consumer 金喜 1.3s、市面 3s) ②first-token/first-char (Timekettle 0.2s Respond) ③end-to-end response (iFlytek <5s) ④学术 AL/AP/DAL (SimulEval PRIMARY 文档公式) + Seed 论文 FLAL (paragraph-level first determined translation)。
4. **降延迟 TOP-3 技巧**（按收益排序）：
   - **streaming/bi-streaming TTS**（决定性：CosyVoice 2/3 / Cartesia Sonic；chunk-aware causal flow matching，N:M=5:15 ratio per arXiv 2412.10117 §2.3）—— 从 800-1500ms → 90-150ms
   - **Doubao S2T 替代 S2S**（同 endpoint 不同 mode 拿双语字幕 + 本地 streaming TTS）—— 节省 ~1s
   - **VAD 灵敏度调优 + 数据驱动 read-write policy**（Silero 阈值 0.3-0.4；Seed RL 训练后 AL 从 3.90 → 2.37s per arXiv 2507.17527v2 §4.1）—— 节省 200-300ms 沉默等待
5. **E2E vs 级联 trade-off 数据**（Seed Table 1 PRIMARY）：Seed S2S AL 2.58s BLEU 84.1；SeamlessStreaming AL **1.68s**（比 Seed 好 0.9s）但 BLEU 低 7.7 → E2E 在延迟上仍打不过好的级联，但翻译质量分水岭在 BLEU 8+。iFlytek E2E 平均 <5s（iflyrec.com PRIMARY）。

### Per-stage latency budget（1.3s 路径）

| Stage | v0 路径 A（S2S） | v1 路径 B（S2T + 本地 ASR + 本地 TTS） | v2 路径 C（全本地） | Primary 来源 |
|---|---|---|---|---|
| VAD 起音 | 200-400ms（S2S 预热） | 100-150ms（Silero-VAD v5） | 100-150ms | silero-models README |
| ASR first partial | 吞入 S2S | 150ms（sherpa-onnx Zipformer RTF 0.10） | 150ms | k2-fsa/sherpa-onnx PRIMARY |
| MT first token | 吞入 S2S | 200-250ms（Doubao S2T mode=s2t 字幕事件 654/655）| 80ms（MarianMT）| volcengine docs + Helsinki-NLP |
| TTS first chunk | 吞入 S2S | **150ms**（CosyVoice 2 bi-streaming）| **150ms** | CosyVoice README L19 |
| 网络 RTT | 80ms（cn-beijing） | 80ms | 0ms | T22 HIGH（VPN 绕路 +RTT） |
| OS audio HAL | 100-200ms（CoreAudio） | 10ms | 10ms | apple.com HAL docs |
| Codec 解码 | +300-500ms（ogg_opus 整句）| 0-30ms（opuslib 流式） | 0-30ms | T01 + opuslib |
| **合计首音** | **2.5s 整段 / ~1.3s 按金喜定义** | **800-1100ms** | **400-800ms** | — |

### v0/v1/v2 推荐（brief）

- **v0**：Doubao 同传 2.0 S2S 单 endpoint（路径 A T16）+ 6 项配置级优化（preconnect/keep-alive / local warmup / VAD 灵敏度 / opus 流式解码 / 网络直连 / 单 OS 设备）→ **~1.3s 金喜对标**
- **v1**：路径 B（Doubao S2T mode=s2t + 本地 sherpa-onnx Zipformer ASR + 本地 CosyVoice 3 / 云 Cartesia Sonic TTS）→ **≤2s 整段 / ~1s 首音**
- **v2**：路径 C（全本地：sherpa-onnx + MarianMT + CosyVoice 3 0.5B）→ **≤1.3s 首音**（MT 质量妥协）

### Dominant stage finding

**TTS 是决定项**。任何"等完整句"的合成（如 Doubao 同传 2.0 S2S 内部集成 TTS / GPT-SoVITS 非 streaming / Seed-TTS 类）都无法让首音 ≤ 1.3s。**只有 streaming / bi-streaming TTS**（CosyVoice 2/3 chunk-aware causal FM + Cartesia Sonic SSM + ElevenLabs Turbo）才有可能。选错 TTS = 1.3s 路径封死。

## Comments

<!-- conversation history -->