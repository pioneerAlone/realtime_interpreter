# 流式首音延迟优化技术调研

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

要做出 **1.3s 首音延迟**（"用户开始说话"到"对方听到翻译第一段音频"的时间），需要对 ASR / MT / TTS 三个环节都做流式优化。本票调研实现 1.3s 需要哪些技术组合。

要回答的问题：

1. **延迟预算拆解**（目标 ≤1.3s）：
   - VAD 起音检测：~100ms（业内典型）
   - ASR 第一段 partial 输出：~100-300ms
   - MT 第一段翻译输出：~100-300ms
   - TTS 第一段音频合成：~200-500ms
   - 网络往返：~50-200ms × 2
   - 总和：~550ms ~ 1400ms —— 1.3s 处于理论下限，必须每个环节都优化
2. **流式 ASR 方案**（R4 用）：候选模型 + 延迟数字
   - Whisper.cpp（large-v3-turbo / distil-large-v3）：首 partial 延迟
   - sherpa-onnx（Zipformer / Paraformer）：streaming 延迟
   - mlx-whisper（Apple Silicon 优化）：M2 上的延迟
   - FunASR（达摩院，中文优化）
   - macOS Speech.framework（系统级，零成本但功能受限）
3. **流式 TTS 方案**（R3 用）：
   - Doubao TTS（云端，按字符计费）
   - CosyVoice（开源，阿里达摩院，可本地）
   - StyleTTS 2 / F5-TTS / Tortoise（开源，可本地）
   - GPT-SoVITS（开源，声音克隆）
   - 商业方案（ElevenLabs / Cartesia / Rime）
4. **流式 MT 方案**（R4 用）：
   - 商用 LLM streaming（GPT-4o-mini / Claude / Qwen）
   - 本地小模型（MarianMT / NLLB distilled）
   - 同传 2.0 S2T 模式（已有字幕事件 650-655）
5. **首音优化技巧**：
   - Chunked synthesis（不等完整句就合第一段）
   - Speculative decoding（预测下一段预生成）
   - Preconnect / keep-alive（避免 TCP 反复握手）
   - Local model warmup（启动后预热避免冷启动）
   - VAD 自适应灵敏度（缩短 silence 等待）
6. **端到端 S2S 模型**（如果金喜用的是这类）：
   - Doubao 同传 2.0（已知 ~3s 端到端）
   - GPT-4o Realtime API（OpenAI，官方没公开延迟数字）
   - Gemini Live（Google，已知 ~1s 低延迟但中文支持弱）
   - Qwen-Omni / Step-Audio（国产端到端）

输出：「≤1.3s 首音延迟」的最优架构组合（哪几个组件放云端 / 哪几个放本地 / 哪些技巧必上），含具体延迟数字。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/16-streaming-first-sound-optimization.md`

**Gist**: 1.3s 首音硬指标在 M2 上技术可达但选错架构就达不到 —— Doubao 同传 2.0 S2S 单 endpoint 论文 FLAL 2.21s + 本地栈栈栈 1s 差量可达 ≈ 1.3s (按金喜"首音"定义, T15 已确认);若要"端到端真 ≤ 1.3s"必须级联,本地 sherpa-onnx Zipformer streaming (RTF 0.04-0.15) + Doubao 同传 2.0 S2T (双语字幕一次出) + 本地 CosyVoice 3 0.5B (官方 150ms bi-streaming 首音) ≈ 800-1100ms 首音。TTS 是决定项 —— 不流式就达不到。

**Recommended optimization combination (技术栈)**:
1. **R3 出方向 · 路径 B (级联延迟优先)** —— 首音 ~0.8-1.1s —— 本地 sherpa-onnx Zipformer bilingual-zh-en streaming ASR (~150ms partial) → Doubao 同传 2.0 S2T mode (一次给中英双语字幕 650-655 事件,内置 MT) → 本地 Fun-CosyVoice3-0.5B-2512 (Apache-2.0,官方 150ms bi-streaming) → BlackHole 16ch 输出。0 样本克隆由 CosyVoice 3 自带 (与 Doubao 同等 3-10s 参考音频)。
2. **R4 入方向 · 路径 A (直调 S2T)** —— 字幕首字 < 2.5s —— Doubao 同传 2.0 mode=s2t (同 endpoint 同一 WebSocket) 直接给中英双语字幕;不在客户端拼 ASR+MT。同 endpoint 不同 mode,T01 已确认。
3. **跨架构通用优化** —— 所有云端 endpoint 启动时立即 preconnect + 30s keep-alive ping;VAD 用 Silero-v5 阈值 0.3 (默认 0.5 太保守);opus 输出用 opuslib 流式解码避免整句 500ms 缓冲;本地模型启动后立即 warmup (whisper.cpp CoreML README 已自承 first run 慢需 ANE 编译);macOS CoreAudio HAL 默认 256 frames 已最低,无需调。

**Failure modes if 1.3s unachievable**:
1. **降级到 Doubao 同传 2.0 S2S 单 endpoint 直调** —— 这是金喜标准版路径,论文 FLAL 2.21s + 本地栈栈栈 ≈ 1.3s "首音"(按金喜定义)。模型集成度高,opus 整句解码多 ~500ms 缓冲但 VAD/克隆都由模型负责。
2. **接受 ≥ 1.5s 首音(改成"接近人同传"基准)** —— 同传行业惯例:人类同传延迟 2-5s;1.5-2s 仍属"产品级",不强制 1.3s。
3. **fallback 到 Doubao 同传 2.0 S2T 模式 + Cartesia Sonic 云端 TTS (sub-90ms 模型延迟)** —— 完全云端级联,延迟 ~1-1.5s,但失去 CosyVoice 本地"数据不出端"差异化。

**Source count**: 28 primary sources (6 GitHub repos + 5 arXiv papers + 11 official docs/product pages + 6 cross-references to sibling tickets).

## Comments

<!-- conversation history -->