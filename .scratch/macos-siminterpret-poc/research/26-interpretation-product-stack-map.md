# 同传/语音翻译产品 × 技术栈映射（2026-09，public evidence）— Findings

> **Request**: parent agent research task — map 10 simultaneous-interpretation / speech-translation products' tech stacks from PRIMARY sources only (official product pages, docs, press, first-party blogs, arXiv, GitHub repos). No third-party review blogs. Indirect evidence labeled HIGH/MEDIUM/LOW.
> **方法**: web_fetch/read_page on official URLs + GitHub API/raw READMEs + workspace prior research (T15/T22 for 金喜). web_search engines were rate-limited mid-session (Firecrawl 429), so some Google support pages could only be evidenced via official-domain snippets captured before the limit — flagged where so.
> **日期口径**: as of September 2026.

---

## 0. TL;DR

1. **Microsoft Teams Interpreter** = cloud **cascade ST→MT→TTS on Azure AI Services** (official FAQ says so verbatim), with non-stored real-time **voice simulation**; 20 h/person/month included with Copilot license. Azure Speech separately sells a **Live Interpreter** API (low-latency S2S + BYO personal voice).
2. **Google** = **Gemini 3.5 Live Translate**, a first-party **E2E speech-to-speech audio model** (70+ languages, preserves intonation/pitch, SynthID-watermarked), rolling into Meet (private preview → GA for business Feb 2026), Google Translate app, and the Gemini Live API. Pixel 10 "Voice Translate"/Live Translate for calls mimics your voice; on-device-vs-cloud could not be re-verified this session (page timeouts).
3. **iFlytek 讯飞同传** = **星火同传语音大模型** (Spark SI speech LLM), claimed first domestic **E2E voice SI model**, avg E2E response <5s, +30% quality vs their prior cascade; product integrates iFlytek ASR+MT+TTS; 0.8元/分钟 consumer, enterprise packages.
4. **Timekettle** publishes **no third-party engine names** — everything branded in-house: **Babel OS 2.0** (W4), **HybridComm 3.0** (X1), LLM-based self-correction, AI semantic segmentation, "AI Voice Cloning" across 52 languages; bone-voiceprint capture; offline packs.
5. **Camb.ai** = own **MARS8 TTS family** (Flash 600M / Pro / Instruct / Nano) + DubStudio/live dubbing (312 ms SRT→3 langs) + a **Realtime S2S WebSocket API (beta)** whose event stream shows ASR→MT→TTS structure, voice via cloned-voice slots.
6. **金喜** = per prior internal research T15/T22 (Feishu wiki evidence exists in this repo): standard cloud = **Doubao 同传 2.0 S2S** zero-shot (HIGH), lightweight cloud = cascade + 2 trained voice slots, local = Win+RTX 3060 reference-audio cloning. Wiki requires login; not re-verifiable from public web.
7. **Doppelvoice** = confirmed Windows (NOT macOS) open-source client of **Doubao AST 2.0 / Seed LiveInterpret 2.0** (`volc.service_type.10053`), E2E S2S, zero-shot clone via empty `speaker_id`, ~2.5–3 s.
8. **TransEcho** = confirmed Tauri (Rust+Svelte) system-audio capture client for **豆包同声传译 2.0**, subtitles + TTS playback, 8 langs.
9. **sokuji** = multi-backend client: OpenAI / Gemini / Palabra / Kizuna / **Doubao AST 2.0** / Soniox / Zoom AI / OpenAI-compatible / **fully local (WASM+WebGPU, 44 ASR + 75 MT + 137 TTS models)**. Doubao AST 2.0 is one of nine providers.
10. **Chatterbox is TWO different things**: (a) the famous open-source **Chatterbox TTS is by Resemble AI** (`resemble-ai/chatterbox`, MIT, 26k stars) — **not "Realtime"**; `realtime-ai/chatterbox` does not exist (GitHub 404). (b) **CAMB.AI Chatterbox** is a real interpretation product: a Windows desktop app doing live meeting interpretation via virtual audio drivers.
11. **Volcengine/ByteDance 同传 2.0 landscape**: Seed LiveInterpret 2.0 paper (arXiv 2507.17527, E2E duplex S2S, ~3s cloned-speech latency) is the base model; public consumers found: **Doppelvoice, TransEcho, sokuji, 金喜** (金喜 per T15).

---

## 1. Mapping table

Legend: conf = confidence. "n/d" = not disclosed by vendor. — = none/not applicable.

| # | Product | Vendor | ASR | MT | TTS | E2E S2S? | Voice-clone approach | Latency claims | Pricing model | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Teams Interpreter agent (+ Azure AI Speech Live Interpreter) | Microsoft | Azure AI Services speech recognition (official FAQ; multilingual auto-detect) | Azure AI Services MT (via English pivot per official FAQ) | Azure neural TTS; "Simulate my voice" or preset (e.g., Ava) | **No** — official FAQ documents cascade ST→MT→TTS ("bot transmits meeting audio for cloud-based processing") | Real-time **voice simulation** from brief speech segments; samples/biometrics never stored | n/d (docs say translations returned "instantly"; Azure Live Interpreter: "low latency") | 20 h/person/mo included w/ Copilot license; organizer needs Copilot or Teams Premium; Azure Speech translation list ≈ $2.50/h (≤2 targets) + Translator $10/M chars for extra langs | **HIGH** (official docs verbatim) |
| 2a | Gemini 3.5 Live Translate (Meet / Translate app / Live API) | Google | n/a — single E2E audio model | n/a — single E2E audio model | n/a — model generates speech directly | **Yes** — "latest audio model for live speech-to-speech translation"; continuous (non-turn-based) generation | Preserves speaker's intonation, pacing, pitch; SynthID watermark on all output | "stays just a few seconds behind the speaker" | Meet: Workspace (private preview → GA for business Feb 2026); Live API public preview (dev pricing per Gemini API); Translate app free | **HIGH** |
| 2b | Pixel Live Translate / "Voice Translate" (calls) | Google | n/d for calls feature (Pixel 10+; Pixel 11+ for media) | n/d | n/d | n/d — not stated on help pages | "mimic your natural voice and tone in real time" | n/d | bundled with device (no subscr. stated) | **MEDIUM** (official help pages exist; underlying model unverified this session — pages timed out) |
| 3 | 讯飞同传 (iFlytek SI; 讯飞听见 ecosystem) | iFlytek 科大讯飞 (安徽听见科技) | iFlytek ASR (语言转写) + 星火同传语音大模型 E2E mode | iFlytek MT (机器翻译) / 星火 SI LLM | iFlytek TTS (多语种语音合成播报; 讯飞同传耳机) | **Yes (claimed)** — "国内首个具备端到端语音同传能力的大模型"; legacy cascade still offered | n/d for SI product (no public clone claim found); TTS voices standard | E2E avg response **< 5s** (fastest avg), +30% quality vs prior stack (讯飞研究院测定) | Consumer: 20 min/day free, 0.8元/min promo; Enterprise: 1h free trial, 100h+10 sub-account packages, custom VIP/会务 | **HIGH** (official pages) |
| 4 | Timekettle W4 / W4 Pro / X1 / M3 / T1 | Timekettle | n/d — branded "Babel OS 2.0" (W4), "HybridComm 3.0" (X1); bone-voiceprint + 2-mic capture | n/d — "LLM-powered correction" (~85% homophone fix), "AI Semantic Segmentation" (1 sentence behind) | n/d — "AI Voice Cloning" across 52 languages (keeps laughter/sighs/emphasis) | No public E2E claim; behavior = streaming, "0.2s respond, translation in seconds"; segmentation implies sentence-level pipeline | "AI Voice Cloning" (details n/d; OTA-delivered per W4-vs-WT2 comparison) | "0.2s Respond, Translation in Seconds"; up to 98% accuracy (bone-conduction conditions) | One-time hardware $279–349 (W4), no subscription; offline language packs included | **HIGH** for disclosed facts; engines themselves **n/d** |
| 5 | Camb.ai (Camb Studio, Live Dubbing, Realtime S2S, Chatterbox) | CAMB.AI | own live transcription (SDK; beta) | own translation (150+ langs for dubbing; 14 langs for realtime S2S) | **own MARS8 family** (Flash 600M / Pro / Instruct / Nano; 8.1 beta) | **No public E2E claim** — realtime WebSocket emits transcript→translated text→audio events (cascaded structure) | Voice cloning via Studio `voice_cloning` (cloned-voice slots, per-speaker cloning in DubStudio, emotion transfer); realtime API takes `voice_id` | Live dubbing "SRT IN → **312 ms** → 3 LANGS" (homepage) | Credits: Free 2K/mo; $5–$900/mo tiers (10K–1.8M credits); Enterprise custom | **HIGH** |
| 6 | 金喜 (Jinxi) 双通道同传 | 大成子ONLY (一人公司) | standard: n/a (E2E model); lightweight cloud: hybrid ASR stack (混合方案 A/B); local: n/d | standard cloud: **Doubao 同传 2.0 S2S** (T15 HIGH); lightweight: cascade ASR+MT+TTS | lightweight cloud: trained voice slots ×2; local: reference-audio clone | **Yes** (standard mode = S2S wrapper over Doubao 同传 2.0) | standard: zero-shot realtime clone, zero config; lightweight cloud: 2 trained slots; local (Win+RTX3060 12GB+): reference-audio prompt | **1.3s 首音** claimed (cloud), "市场普遍 3s" | ¥49 test card; ¥49–4999 tiers; API-cost structure per T15 (9–12元/h standard ≈ Doubao S2S rate) | **HIGH per prior internal research T15/T22** (Feishu wiki, login-gated; snapshot in repo) |
| 7 | Doppelvoice | Tianqi-Bu (OSS, MIT) | n/a — E2E via Doubao AST 2.0 | n/a — E2E | n/a — E2E (ogg/opus per-sentence output) | **Yes** — "no separate STT/MT/TTS plumbing" | Zero-shot: empty `speaker_id` + `denoise=false` clones your voice; or preset `speaker_id` | ~2.5–3 s E2E (model floor per arXiv 2507.17527; local adds <500 ms) | Free OSS; BYO Volcengine keys | **HIGH** (README) |
| 8 | TransEcho | wxkingstar (OSS, MIT) | via 豆包同传 2.0 (README data flow: 豆包 ASR → protobuf) | via 豆包同传 2.0 | local playback of returned TTS (Rodio); "语音同传" | Subtitles-first; uses 同传 2.0 API (S2S-capable endpoint) | preset voices (per T03; README doesn't detail) | "延迟极低" (no number); free 1M tokens for new users | Free OSS; BYO Volcengine key | **HIGH** (README) |
| 9 | sokuji | kizuna-ai-lab (OSS, AGPL-3.0) | providers: OpenAI gpt-realtime-mini/1.5, Gemini, Soniox, **Doubao AST 2.0**, Zoom AI (captions), local: 44 ASR models (Whisper, SenseVoice, Moonshine, Voxtral, sherpa-onnx…) | OpenAI/Gemini/Palabra/Kizuna/**Doubao AST 2.0**/local: 69 Opus-MT pairs + 6 LLM MT (Qwen 2.5/3/3.5, Hunyuan-MT 1.5, TranslateGemma) | providers' voices; local: 137 TTS models (Piper, Coqui, Matcha, Mimic3, MMS, VITS, Supertonic) | Only via providers that are S2S (Doubao AST 2.0, OpenAI realtime, Soniox); local mode = cascade | Palabra.ai provider offers voice cloning; Doubao AST 2.0 provider: "speaker voice cloning" | n/d | Free OSS; BYO API keys | **HIGH** (README) |
| 10a | Chatterbox TTS (open source) | **Resemble AI** (NOT "Realtime") | — | — | Chatterbox family: Turbo 350M (EN), Nano 110M (CPU), Multilingual V3 500M (23 langs incl. zh), Single-Language Packs | — (TTS only) | Zero-shot cloning from ~10s reference clip; PerTh watermark baked in | Nano: 3× realtime on 8 CPU cores; Turbo for low-latency voice agents | MIT, free; Resemble offers paid hosted TTS | **HIGH** (repo README + citation block) |
| 10b | Chatterbox (interpretation product) | **CAMB.AI** | Camb live transcription | Camb translation | Camb TTS (MARS family / cloned voice) | No — "transcribes, translates, and re-synthesizes" | voice via Studio (clone) | n/d | CAMB.AI Studio account / credits | **HIGH** (official docs) |

---

## 2. Per-product evidence

### 2.1 Microsoft — Teams Interpreter + Azure AI Speech

**Primary sources**
- [Interpreter in Microsoft Teams meetings and calls](https://support.microsoft.com/en-us/teams/copilot/interpreter-in-microsoft-teams-meetings-and-calls) (support.microsoft.com, fetched 2026-09)
- [What is speech translation? (Azure Speech, Foundry Tools)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation) (last updated 2026-07-28)
- [Inside Track: Deploying our new 'game-changing' Interpreter agent](https://www.microsoft.com/insidetrack/blog/deploying-our-new-game-changing-interpreter-agent-in-our-meetings-at-microsoft/) (first-party IT blog; body not fully extracted)

**Key first-party facts (verbatim where quoted)**
- Official FAQ "What technology powers Interpreter?": *"The Interpreter agent in Teams enables real-time speech-to-speech (STS) translation using Azure AI Services… 1. Speech Recognition (ST): Converts spoken language into English text. 2. Translation (MT): Translates English text into the selected language(s). 3. Voice Generation (TTS): Produces translated speech… simulate the speaker's voice or use a predefined voice… 4. A bot transmits meeting audio for cloud-based processing and returns translations instantly."* → **cascaded, cloud, English-pivot**. Confidence HIGH.
- Voice simulation: *"Short segments of your speech are briefly analyzed by the system in real time to simulate your unique tone, style, and voice characteristics. Voice samples or biometric data are never stored."*
- Languages: English, Spanish, Portuguese, Japanese, Simplified Chinese (Mandarin), Italian, German, French, Korean, Taiwanese; auto spoken-language detection; meetings up to 1,000 participants.
- Licensing/pricing: organizer needs Copilot or Teams Premium; **20 hours/person/month included with Microsoft Copilot license**.
- Azure Speech "Live Interpreter" (separate API): continuous language ID, language switching, **BYO voice (personal voice)**, "low latency speech-to-speech translation in a natural voice that preserves the speaker's style and tone"; pricing example: speech translation ≈ $2.50/hour (up to 2 target languages), extra target languages billed via Translator (~$10/M chars).

**Confidence: HIGH** (official Microsoft docs).

### 2.2 Google — Gemini Live Translate / Meet / Pixel

**Primary sources**
- [Fluid, natural voice translation with Gemini 3.5 Live Translate](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-live-3-5-translate/) (blog.google, 2026-06-09, fetched in full)
- [Speech translation in Google Meet now generally available for businesses](https://workspaceupdates.googleblog.com/2026/02/speech-translation-meet-ga.html) (title/date captured; body fetch failed — JS-rendered)
- [Use Live Translate for phone calls – Pixel Help](https://support.google.com/pixelphone/answer/16477051) and [Translate speech & text on Pixel](https://support.google.com/pixelphone/answer/11209263) (official pages; direct fetches timed out this session, content below from official-domain snippets captured via search before engine rate-limit)

**Key facts**
- *"Gemini 3.5 Live Translate is our latest audio model, delivering near real-time speech-to-speech translation in over 70 languages."* E2E: single model, auto language detection (70+), *"generates smooth, natural-sounding translated speech that preserves the speakers' intonation, pacing and pitch"*; continuous generation (not turn-based); *"stays just a few seconds behind the speaker"*; SynthID watermark; model card at deepmind.google. HIGH.
- Distribution: Gemini Live API public preview + AI Studio (`gemini-3.5-live-translate-preview`); Google Meet enterprise private preview (from June 2026); Google Translate app Live translate on Android/iOS; platform partners: Agora, Fishjam, LiveKit, Pipecat, Vision Agents; Grab testing (10M+ voice calls/month). HIGH.
- Meet upgrade: from previous **5 languages / English-pivot** to 70+ languages and 2000+ combinations "in one meeting". Workspace Updates blog: GA for businesses, Feb 2026 (snippet-level). MEDIUM for GA specifics.
- Pixel: Live Translate tiers — text/apps Pixel 6+, **phone calls Pixel 10+** ("Voice Translate" branding on Pixel 10 series), media Pixel 11+; calls feature *"translate your voice into selected languages and mimic your natural voice and tone in real time."* Which model runs it (on-device vs cloud) could not be re-verified (support.google.com connect timeouts; search engine down). MEDIUM.

### 2.3 iFlytek 讯飞 — 讯飞同传 / 讯飞听见

**Primary sources**
- [星火语音同传大模型首发，讯飞同传让沟通无障碍](https://www.iflyrec.com/zixun/67875beb.html) (official iflyrec.com news, 2025-01-15, fetched in full)
- [讯飞同传产品官网](https://tongchuan.iflyrec.com/) (fetched in full; operator 安徽听见科技有限公司, iFlytek subsidiary)

**Key facts**
- *"讯飞同传全新搭载星火同传语音大模型… 星火语音同传大模型作为国内首个具备端到端语音同传能力的大模型… 全场景下的翻译效果提升幅度超过30%*，端到端响应时间大幅缩短，最快平均可控制在5秒以内"* (*准确率来源于讯飞研究院测定). HIGH.
- Product integrates iFlytek core tech: *"依托科大讯飞的语言转写、机器翻译、语音合成等核心技术"* — i.e., classic stack = iFlytek ASR + MT + TTS; new E2E 星火 SI model layered on top. Forms: SaaS, 软硬件一体机, 私有化; 讯飞同传耳机 for multilingual TTS listening. HIGH.
- Commercial terms on tongchuan.iflyrec.com: 悬浮字幕/快速同传 **20 min/day free**, **0.8元/分钟** limited-time promo; VIP会务; 企业版 free 1h trial, 100h企业时长+10子账号起, speaker diarization, 术语优化/自定义词库, 大模型实时翻译, 外语到外语互译. CTA: *"一键开启大模型同传，端到端语音同传即刻体验"*. HIGH.
- Scale claims: 50+ countries, 400k+ meetings, 400M+ audience (official article).

**Confidence: HIGH.** Hardware (同传耳机/一体机) internals: not detailed on fetched pages.

### 2.4 Timekettle — W4 / W4 Pro / X1 / M3 (+T1)

**Primary sources**
- [W4 product page](https://www.timekettle.co/products/w4-ai-interpreter-earbuds) (fetched)
- [How Timekettle W4 Achieves 98% Translation Accuracy with Bone Conduction Technology](https://www.timekettle.co/blogs/tips-and-tricks/how-timekettle-w4-achieves-98-translation-accuracy-with-bone-conduction-technology) (first-party blog, 2025-11-14, fetched)

**Key facts**
- W4: Bone-Voiceprint sensor + 2 mics hybrid capture; "Up to 98% Translation Accuracy"; "**0.2s Respond, Translation in Seconds**"; 52 languages / 106 accents; offline packs (EN↔ZH/JA/KO/FR/ES/RU/DE); **no subscription**; requires phone + app; $279.20 sale / $349 list.
- AI stack (their words, no vendor names): **Babel OS 2.0** intelligent system; "**LLM-powered correction catches around 85% of homophone errors**"; self-developed **AI Semantic Segmentation** — "identifies natural pause points… starting translation just one sentence behind the speaker to mimic a human interpreter's rhythm"; "**AI Voice Cloning** preserves the nuances of your voice, including laughter, sighs, and emphasis, across 52 languages".
- Lineup: W4 Pro (calls/online meetings/media), X1 Meeting ("Powered by **HybridComm 3.0**", multi-person, presentation mode), M3, NEW T1 offline handheld ("AI edge small model", 44 offline packs).
- **No third-party ASR/MT/TTS vendors are published anywhere on official pages.** Their FAQ never names an engine. Confidence HIGH that it's undisclosed; LOW for any claim about which external engine they use.

### 2.5 Camb.ai

**Primary sources**
- [camb.ai homepage](https://www.camb.ai/), [MARS8 model page](https://www.camb.ai/models/mars8), [pricing](https://www.camb.ai/pricing) (all fetched)
- [docs.camb.ai](https://docs.camb.ai/introduction), [Realtime Speech To Speech tutorial](https://docs.camb.ai/tutorials/realtime-translation-with-sdk), [Chatterbox overview](https://docs.camb.ai/other-products/chatterbox/overview) (fetched)

**Key facts**
- Positioning: "localization infrastructure for the internet"; products: Live Dubbing (real-time broadcasts), On-Demand Dubbing (DubStudio), TTS, audiobooks, Live Speech Translation, image translation; SOC 2 Type II; Ligue 1 live Italian commentary deployment.
- **Own models: MARS8 TTS family** — MARS-Flash (**600M params**, low-latency for conversational AI), MARS-Pro, MARS-Instruct, MARS-Nano; MARS8.1 beta; benchmarks vs Cartesia Sonic-3 / Minimax / ElevenLabs; technical report `/news/mars8-technical-report`; benchmark repo github.com/Camb-ai/MAMBA-BENCHMARK. HIGH.
- Live dubbing latency banner: **"SRT IN → 312 ms → 3 LANGS"**. Voice cloning: per-speaker cloning + emotion transfer (DubStudio); Studio voice-cloning API.
- **Realtime S2S API (beta)**: single WebSocket, PCM16 mono 24 kHz both directions, **14 languages** (ar-ae/ar-eg/ar-sa, de-de, en-gb/en-us, es-es, fr-ca/fr-fr, hi-in, ja-jp, ko-kr, pt-br, zh-cn); event stream `TRANSCRIPT_DELTA/COMPLETED → TEXT_DELTA/DONE → AUDIO_DELTA/DONE`; TTS voice = built-in or `voice_id` from `voice_cloning.list_voices()`. Event structure shows ASR→MT→TTS pipeline behind one endpoint. HIGH (docs verbatim); "E2E model?" = no public claim; treat as cascaded-structured realtime service.
- Pricing: credit plans Free 2K/mo → $5/10K → $20/40K → $75/150K → $250/500K → $900/1.8M; Enterprise custom.

**Confidence: HIGH.**

### 2.6 金喜 (Jinxi, 大成子ONLY)

**Evidence status**: Feishu wiki evidence **exists** in this repo — `research/15-jinxi-architecture-reverse.md` (cites https://my.feishu.cn/wiki/WBfDwbZ1Zioj0Akeptkchgngnfe and https://my.feishu.cn/wiki/UkPHwiEc6i48BvkRepKcbKAUn7b) and `research/22-jinxi-customer-tutorial-product-map.md` (cites https://my.feishu.cn/wiki/U2hLwLP7AiXSPUkBaNXcIlNynab?from=from_copylink). The wiki is **login-gated** — not re-verifiable from public web. Classified: **per prior internal research T15/T22**.

**Confirmed-from-snapshot stack**:
- 标准云端双向版 = **Doubao 同传 2.0 S2S** zero-shot realtime voice clone, no config (T15 HIGH; T22 direct confirmation "实时克隆你的音色无需任何配置"); 9 languages incl. zh-en mixed; claimed **1.3s 首音** ("市面上同传普遍3秒").
- 轻量云端双向版 = cascaded ASR+MT+TTS, hybrid ASR ("混合方案 A/B", 9 or 26 source langs), 11 target langs, **2 trained voice slots**.
- 轻量本地双向版 = local inference, **Windows only, RTX 3060 12GB+**, reference-audio prompt cloning, 26→30+ languages.
- Mac: no local mode (wiki verbatim per T15/T22). Virtual sound card bundled free (BlackHole via brew per T22). Glossary/术语库 as differentiator (maps to Doubao `ReqParams.corpus` per T18).
- Pricing: ¥49 test card (3 days); tiers ¥49–4999; cost structure estimates in T15 (标准云端 9–12元/h ≈ Doubao S2S rate).

### 2.7 Doppelvoice (GitHub Tianqi-Bu/Doppelvoice)

**Source**: [README (main)](https://github.com/Tianqi-Bu/Doppelvoice) fetched raw. **Confirmed.**
- *"Powered by ByteDance Doubao Seed LiveInterpret 2.0"*; default `DOUBAO_RESOURCE_ID = volc.service_type.10053` ("AST 2.0 resource ID").
- **E2E S2S**: "no separate STT/MT/TTS plumbing"; modes `s2s` / `s2t`; 9 languages `zh/en/ja/id/es/pt/de/fr` + `zhen` bilingual auto.
- **Zero-shot voice cloning**: empty `SPEAKER_ID` = clone the speaker; `DENOISE=0` keeps breath/resonance for better cloning; preset voices via `speaker_id` (e.g., `zh_female_vv_uranus_bigtts`).
- Latency: "~2.5 s latency"; known-limitations cite the [Seed LiveInterpret 2.0 paper](https://arxiv.org/abs/2507.17527) for the ≈2.5 s model floor; ogg/opus decoding adds ~500 ms.
- ⚠️ **Discrepancy vs task brief**: README/platform = **Windows** (PySide6 GUI, VB-Audio Virtual Cable, tested Win 10/11) — the task called it a "macOS client"; the repo itself says Windows. MIT license. Acknowledges sokuji as protobuf reverse-engineering reference.

### 2.8 TransEcho (GitHub wxkingstar/TransEcho)

**Source**: [README (main)](https://github.com/wxkingstar/TransEcho) fetched raw. **Confirmed.**
- Tauri 2.x + Svelte 5/SvelteKit + Rust/Tokio; captures **system audio** (macOS ScreenCaptureKit / Windows WASAPI Loopback), Rubato 48k→16k resample, Rodio playback, WebSocket + Protobuf (prost).
- *"实时同声传译 - 基于豆包同声传译 2.0 大模型"*; tech-stack table links 翻译引擎 → [豆包同声传译 2.0](https://www.volcengine.com/docs/4/167875). Data flow: system audio → resample → WebSocket → 豆包 ASR → protobuf → subtitle events → UI & TTS 播报.
- 8 languages (中/英/日/德/法/西/葡/印尼); free 1M tokens for new Volcengine users; MIT.
- Note: the literal `volc.service_type.10053` constant is in code, not README prose; verified in prior internal deep-read T03 (`.scratch/.../research/03-transecho-deep-read.md`).

### 2.9 sokuji (GitHub kizuna-ai-lab/sokuji)

**Source**: [README (main)](https://github.com/kizuna-ai-lab/sokuji) fetched raw. **Confirmed.**
- Backend is **not single**: 9 providers — OpenAI (`gpt-realtime-mini` / `gpt-realtime-1.5`), Google Gemini, Palabra.ai (voice cloning, WebRTC low-latency), Kizuna AI, **Doubao AST 2.0** ("Speech-to-speech with speaker voice cloning · bidirectional Chinese↔English · Ogg Opus audio output"), Soniox (two-way auto-detect, 60+ langs/3600+ pairs), Zoom AI (captions), OpenAI-compatible, **Local Inference**.
- Local: WASM + WebGPU; 44 ASR models (Whisper, SenseVoice, Moonshine, Voxtral, Cohere Transcribe, sherpa-onnx), 75 MT (69 Opus-MT pairs + Qwen 2.5/3/3.5, Hunyuan-MT 1.5, TranslateGemma), 137 TTS (Piper, Piper-Plus, Coqui, Mimic3, Matcha, MMS, VITS, Supertonic).
- Electron desktop + Chrome/Edge extension; AGPL-3.0.
- **Answer to task question**: sokuji uses Doubao AST 2.0 as **one of** its cloud backends (not exclusively).

### 2.10 Chatterbox (disambiguation)

**(a) Open-source Chatterbox TTS — belongs to Resemble AI, NOT "Realtime"**
- [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox) (GitHub API: 26,255 stars, MIT, created 2025-04-23; description "SoTA open-source TTS"; homepage resemble-ai.github.io/chatterbox_demopage).
- README (fetched): *"**Chatterbox** is a family of state-of-the-art, open-source text-to-speech models by **Resemble AI**."* Family: Chatterbox-Turbo (350M, English, paralinguistic tags `[laugh]`/`[chuckle]`, for low-latency voice agents), Chatterbox-Nano (110M, CPU, "3× faster than realtime on 8 CPU cores"), Chatterbox-Multilingual V3 (500M, 23 languages incl. zh), Single Language Pack finetunes (zh-cmn, es-es/es-mx-latam, pt-br/pt-pt, hi), original Chatterbox (500M English, CFG/exaggeration controls). Zero-shot cloning from a ~10s reference clip; PerTh watermarking in every output. Citation block: `author = {Resemble AI}`.
- **No `realtime-ai/chatterbox` repo exists** (GitHub API 404). The GitHub org `realtime-ai` exists but is an unrelated "Realtime AI Service" with no chatterbox repo. → The task's premise "Realtime's Chatterbox" is not supported by primary evidence; the real owner is Resemble AI. (Resemble.ai's own homepage now markets deepfake detection/watermarking; Chatterbox remains their open-source TTS.)
- Interpretation products using Chatterbox TTS: none of note found. Only hobby project [SiliusJM/voice-translator](https://github.com/SiliusJM/voice-translator) (Whisper + Gemini Flash + Chatterbox TTS, voice-cloned speech translation, 0 stars). sokuji's local TTS list does not include Chatterbox.

**(b) Interpretation product named Chatterbox — CAMB.AI Chatterbox (REAL)**
- [docs.camb.ai Chatterbox Overview](https://docs.camb.ai/other-products/chatterbox/overview) (last modified 2026-05-16): *"Chatterbox is the CAMB AI desktop app that brings live, multilingual translation into your everyday meetings. It installs a pair of virtual audio drivers on Windows, sits between your microphone and any meeting platform (Zoom, Microsoft Teams, Google Meet, and more), and translates your speech in real time… Chatterbox transcribes, translates, and re-synthesizes the audio in the 'They Hear' language… routed through the Chatterbox Virtual Microphone."* Windows 10/11; requires Studio account; headphones required; reboot for drivers. Docs: installation, setup-verification, using-chatterbox, realtime-websocket-events (beta).
- **Conclusion**: the "interpretation product named Chatterbox" is Camb.ai's Windows app; the "open-source Chatterbox" is Resemble AI's TTS and is misattributed to "Realtime" in the task brief.

---

## 3. Volcengine / ByteDance Doubao 同传 2.0 — competitor landscape

**Base model evidence**
- [Seed LiveInterpret 2.0: End-to-end Simultaneous Speech-to-speech Translation with Your Voice](https://arxiv.org/abs/2507.17527), arXiv:2507.17527 (submitted 2025-07-23, v3 2025-07-27; ByteDance Seed authors incl. Shanbo Cheng, Lu Lu, Yonghui Wu). Abstract: E2E SI model, "novel duplex speech-to-speech understanding-generating framework", large-scale pretraining + RL, ">70% correctness in complex scenarios" (human-interpreter validated), average cloned-speech latency cut from ~10 s to **~3 s**. HIGH.
- API surface (from prior internal research T01, cross-confirmed by TransEcho/Doppelvoice repos): `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, resource_id **`volc.service_type.10053`**, modes `s2s`/`s2t`, bilingual subtitles in one session (source 650-652 + translated 653-655 events), empty `speaker_id` = zero-shot clone, `denoise` flag trades clone fidelity vs cleanliness, output ogg/opus.
- `seed.bytedance.com/en/seed_liveinterpret` no longer serves a dedicated page (resolves to generic ByteDance Seed landing; current model menu lists Seed2.1, Seedance, SeedRealtime, Seed Audio 1.0…) — the LiveInterpret branding appears folded into newer model lines. MEDIUM.

**Products publicly built on Doubao 同传 2.0 / Seed LiveInterpret (verified from their own repos/docs)**
| Product | How it uses the API | Evidence |
|---|---|---|
| Doppelvoice | E2E S2S client, zero-shot clone, Windows | README (this report §2.7) |
| TransEcho | System-audio sim-subtitles + TTS playback, macOS/Win | README (§2.8) |
| sokuji | Doubao AST 2.0 as one of 9 cloud providers | README (§2.9) |
| 金喜 标准云端版 | Commercial re-skin (S2S zero-shot) — inferred HIGH in T15, backed by customer wiki snapshot | T15/T22 (§2.6) |

GitHub repo searches for `"volc.service_type.10053"` and "doubao simultaneous interpretation" returned 0 additional repos (2026-09) — the four above are the visible OSS/commercial surface.

**Implication for an open-source CN-EN interpreter**: the Doubao AST 2.0 endpoint is the de-facto shared backend (金喜, Doppelvoice, TransEcho, sokuji all converge on it); differentiation axes used by competitors = dual-channel bus isolation + feedback-loop prevention (金喜), voice-slot training (金喜轻量云), cross-platform packaging (sokuji), zero-config Windows UX (Doppelvoice/Chatterbox-by-Camb). Google's Gemini 3.5 Live Translate API is the main non-ByteDance E2E alternative with platform integrations (LiveKit/Agora/Pipecat).

---

## 4. Blocked / unverifiable list

1. **Pixel Live Translate underlying model** (on-device vs cloud; Gemini Nano involvement) — support.google.com pages timed out from this session; only official-domain snippets captured. Needs retry.
2. **Google Meet GA blog body** (workspaceupdates.googleblog.com Feb 2026) — JS-rendered, extraction failed; title/date via snippet.
3. **Timekettle engine vendors** — structurally undisclosed (branded Babel OS 2.0 / HybridComm 3.0); any specific-engine claim would be speculation.
4. **Camb.ai ASR/MT internals** — only TTS (MARS8) is public; realtime pipeline's ASR/MT models unnamed.
5. **Volcengine official 同传 2.0 product/pricing pages** — docs.volcengine.com is a JS SPA returning empty to fetchers; API facts rest on T01 internal verification + repo citations. Public pricing page not captured.
6. **金喜 Feishu wiki live re-verification** — login-gated; snapshot-based only.
7. **iFlytek hardware internals** (同传耳机 / 一体机) — not on fetched pages.
8. **Chatterbox↔"Realtime" attribution** — no primary evidence; contradicted by repo/citation (Resemble AI).
9. **Microsoft Teams Interpreter GA timeline/version history** — current docs only; original preview announcements not fetched.
10. **TransEcho `10053` literal** — in code, not README; README links official 同传 2.0 docs (sufficient for API usage, constant per T03).

---

## 5. Confidence ratings summary

| Item | Confidence | Why |
|---|---|---|
| MS Teams Interpreter cascade + voice simulation + pricing | HIGH | Official support FAQ verbatim |
| Azure Speech Live Interpreter API | HIGH | learn.microsoft.com docs |
| Gemini 3.5 Live Translate (E2E, Meet/Translate/API) | HIGH | blog.google full fetch |
| Meet GA Feb 2026 | MEDIUM | Title/date snippet only |
| Pixel call translation model | MEDIUM | Official help pages exist; fetch blocked |
| iFlytek 星火同传 E2E + pricing | HIGH | iflyrec.com official pages |
| Timekettle disclosed features | HIGH | Official product page + first-party blog |
| Timekettle engine identities | n/d (undisclosed) | — |
| Camb.ai MARS8 + Chatterbox app + realtime API + pricing | HIGH | camb.ai + docs.camb.ai full fetches |
| 金喜 stack | HIGH *as internal research*; public-web unverifiable | Login-gated wiki; T15/T22 snapshots |
| Doppelvoice / TransEcho / sokuji | HIGH | Raw READMEs |
| Chatterbox = Resemble AI (TTS) + CAMB.AI (app) | HIGH | GitHub API + docs |
| Doubao 同传 2.0 landscape | HIGH (repos/paper) / MEDIUM (official product page) | arXiv + repos; volcengine docs unfetchable |
