# 同传/语音翻译产品 × 技术栈映射（10 个产品 + 行业 landscape）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户要求做行业级「主流同传解决方案」调研，并列出主流产品。T23 (industry latency survey) 失败后，本子票**T26 实际上替代了 T23 的「主流产品 latency 横评」+ 行业技术栈 landscape**——一张 10 个产品 × 技术栈横评表，把我们之前 T15/T22 的金喜反推扩展到整个行业。

调研问题：
1. 主流主流产品（10 个：Microsoft Teams Interpreter / Google Gemini Live Translate / iFlytek 讯飞同传 / Timekettle / Camb.ai / 金喜 / Doppelvoice / TransEcho / sokuji / Chatterbox）各自的 ASR/MT/TTS/E2E 栈与延迟数字
2. 谁在用什么（cascade vs E2E）+ 为什么
3. 金喜之外的同质化竞品有哪些、差异点在哪
4. 我们 PoC 的差异化机会点（开源、可改、BYO-key、成本、数据可控）

## Answer

通过 web_fetch/read_page/web_search 抓取 10 个产品的一手资料，整理成 220 行横评表。**核心发现**：

- **Microsoft Teams Interpreter** = 云端 cascade ST→MT→TTS on Azure AI Services（官方 FAQ 明文），无 E2E；含 20 h/人/月 Copilot license
- **Google Gemini 3.5 Live Translate** = **端到端 S2S 音频模型**（"first-party E2E speech-to-speech audio model"），70+ 语言，保留音调/节奏，SynthID 水印；GA 给 business（2026-02）+ Live API 公开 preview；Pixel 10/11 "Voice Translate" 通话模仿用户音色
- **iFlytek 讯飞同传** = **星火同传语音大模型**（国内首个端到端语音同传大模型）+ E2E avg response <5s；质量比自家旧级联 +30%；0.8元/分钟 consumer
- **Timekettle** = 自研栈（Babel OS 2.0 / HybridComm 3.0 / AI Voice Cloning 52 语言），硬件 + 软件
- **Camb.ai** = 自研 **MARS8 TTS family**（Flash 600M / Pro / Instruct / Nano 8.1 beta）+ Live dubbing 312 ms SRT→3 语言 + Realtime S2S WebSocket API (beta)
- **金喜** = T15/T22 已反推（标准云端 = Doubao 同传 2.0 S2S 零样本；轻量云端 = 级联 + 2 个训练音色卡槽；轻量本地 = Win+RTX3060）
- **Doppelvoice** = confirmed **Doubao AST 2.0** E2E S2S，零样本克隆，~2.5–3 s，**仅 Win**（README 数据）
- **TransEcho** = 豆包同传 2.0，subtitles-first，Tauri 跨平台
- **sokuji** = 多 backend 客户端：OpenAI / Gemini / Soniox / **Doubao AST 2.0** / Zoom AI / **完全本地 WASM+WebGPU (44 ASR + 75 MT + 137 TTS)**。AGPL-3.0
- **Chatterbox 是两个不同的东西**：(a) Resemble AI 的开源 Chatterbox TTS (MIT, 26k stars, **不是 realtime**)，(b) CAMB.AI Chatterbox 是 Windows 桌面同传 app

**对 PoC 的启示**：
- **主流 5 家中 4 家走 cascade + 商用云 API**，只有 Google + 讯飞 + Camb.ai 有 E2E 自研模型；金喜的"轻量云端=级联+训练音色"是行业最成熟模式（成本可控 + 质量可控 + 跨语种克隆）
- **doubao AST 2.0 是中文开源开源同传的事实标准**（金喜 / Doppelvoice / TransEcho / sokuji 都用它）——印证我们 v0 选 Doubao
- **跨平台差异**：Doppelvoice 确认仅 Win；sokuji 跨平台 + 完全本地是唯一开源多后端方案；金喜标准云端跨平台、本地版仅 Win
- **差异化机会**：开源 + BYO-key + 完全本地（数据可控）+ 自定义术语库（T22 已确认这是金喜自认的差异化点）
- **自研挑战**：Doubao 同传 2.0 这种 E2E 是字节字节自研，我们复制不了；只能靠级联 + 本地 TTS 优化

Findings 详 → [research/26](.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md)

## Comments

<!-- conversation history -->