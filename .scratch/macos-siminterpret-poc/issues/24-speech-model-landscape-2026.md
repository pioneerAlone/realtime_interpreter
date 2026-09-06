# 主流技术栈 + 语音模型 inventory（2026 横评）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户要求对「主流技术栈 + 涉及哪些语音模型」做行业级深调研。本票产出一张**模型 × 维度**横评表，作为我们 v0/v1/v2 选型的弹药库。

**背景（已有，不重复）**：T17 本地 ASR（sherpa-onnx 首选）、T18 本地 MT（s2t mode 首选）、T19 TTS（Doubao S2S 首选 / CosyVoice 3 备选）。本票要**更全的行业 inventory**，包括我们没覆盖的商用 API 与 E2E 模型。

要回答的问题（每个模型给：首音/首字延迟、质量指标、license、跨平台、成本、音色克隆支持、来源）：

1. **ASR inventory**：
   - 本地：whisper.cpp（large-v3-turbo/distil）、mlx-whisper、sherpa-onnx（Zipformer/Paraformer/SenseVoice）、FunASR、Vosk、Apple Speech.framework
   - 云端流式：Deepgram、Azure Speech、Google STT、火山 ASR、阿里 Paraformer 云端、讯飞
2. **MT inventory**：
   - LLM streaming：GPT-4o/4o-mini、Claude Haiku、Qwen-MT、DeepSeek、豆包 LLM
   - 专用：SeamlessM4T、NLLB-200（license 警告）、Opus-MT、火山翻译、DeepL、Google Translate API
3. **TTS inventory**：
   - 本地：CosyVoice 1/2/3、GPT-SoVITS、F5-TTS、StyleTTS 2、Piper、VITS、ChatTTS
   - 云端：Doubao TTS/bigtts、ElevenLabs、Cartesia Sonic、Rime、MiniMax Speech、Azure TTS、Edge-TTS（免费档）
4. **E2E S2S inventory**：GPT-4o Realtime、Gemini Live、Doubao Seed LiveInterpret 2.0、Qwen2.5-Omni、Step-Audio、Kimi-Audio、SeamlessStreaming、Translatotron 3、Moshi（Kyutai）
5. **谁在用谁**（产品→栈映射）：Microsoft / Google / iFlytek / Timekettle / Camb.ai / 金喜 / Doppelvoice / TransEcho / sokuji / Chatterbox 各自的技术栈（公开证据）
6. **开源可商用清单**：哪些模型 license 允许商业产品（Apache-2.0/MIT vs CC-BY-NC/GPL 警告）
7. **选型建议**：v0（全 Doubao）/ v1（本地 ASR + 云 MT/TTS 混合）/ v2（全本地）三档分别用哪些模型，给出理由

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->