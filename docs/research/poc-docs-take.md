# PoC Docs Take — `realtime_interpreter_Minimal_Implementation/`

> Scope: distil the three PoC docs (`01_技术可行性报告.md`, `02_项目架构与技术栈.md`, `03_性能与成本分析.md`) plus `README.md` into a take the parent project can plan against.
> Source paths in this file are **git-ignored local reference** per `AGENTS.md` §"Local-only reference" — no code is copied, only file paths and module/symbol names.

---

## 1. PoC scope and what it actually proves

### 1.1 What the PoC validates end-to-end

The PoC delivers **only 阶段1: Mac A通道（中→英语音输出）** and explicitly flags the rest as ⏳ 待开发 in its `当前状态` table. The README's table is reproduced verbatim below.

> | 阶段 | 状态 | 说明 |
> |------|------|------|
> | 阶段1: Mac A通道（中→英语音输出） | 🔄 验证中 | 鉴权已通过，翻译链路已跑通，播放端采样率问题调试中 |
> | 阶段2: Mac B通道（英→中字幕） | ⏳ 待开发 | 系统音频回采 + 悬浮字幕窗 |
> | 阶段3: Windows 适配 | ⏳ 待开发 | VB-Cable + WASAPI |
> | 阶段4: Electron 桌面应用 | ⏳ 待开发 | GUI + 会议纪要 + 配置管理 |

(README 当前状态 table)

The "🔄 验证中" qualifier on 阶段1 is itself significant: per `01_技术可行性报告.md` 附录 (L363–410, "附录: 实测进展更新 (2026-09-06)"), the A-通道链路 is **proved through to "翻译链路已跑通"** end-to-end, but the **playback sample-rate problem is still being debugged** (the same appendix describes the playback module being rewritten per Doppelvoice's `RawOutputStream` + bytearray 环形缓冲 + 蓄能机制 + `latency=low` 模式 — see `01_技术可行性报告.md` line 386, the "已优化/已修复" row "播放端音质浑浊"). So the PoC empirically proves (per the appendix's "已验证通过" table at L367–381):

- 新版 `X-Api-Key` (2-header) 鉴权 works against 语音控制台 (not 方舟控制台)
- WebSocket connection to `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`
- Protobuf binary framing (no JSON wrapper)
- `StartSession` → `SessionStarted(150)` flow
- Mic capture on MacBook Air 16kHz
- Streaming `SourceSubtitleResponse` + `TranslationSubtitleResponse`
- TTS pipeline `TTSSentenceStart` → `TTSResponse(ogg_opus 分片)` → `TTSSentenceEnd`
- Whole-sentence ogg_opus decode via `soundfile` to 48000Hz PCM
- Zero-sample cloning with `speaker_id=""` (API auto-extracts from input audio)
- `volc.service_type.10053` as Resource ID

It does **not** prove first-sound latency on M-series hardware — that number is borrowed from 豆包's official paper (FLAL 2.21s / S2S 2.53s, `01_技术可行性报告.md` L274) and Doppelvoice's README, **not measured by the PoC** (see §4 below).

### 1.2 What's still hypothetical (per the docs)

- **A-通道 v0 first-sound latency**: 2.6–2.9s claimed (`03_性能与成本分析.md` L42), decomposed in §4; the PoC itself never re-measures end-to-end latency on M-series hardware.
- **Zero-sample cloning consistency across reconnects / long sessions**: documented as a known risk (`01_技术可行性报告.md` L326 — "零样本克隆音色漂移" risk row at "中等" with mitigation "重连后自动重新采样音色"; appendix L275 — "重连后可能出现音色漂移"); not validated by the PoC.
- **B-通道 / Windows / Electron GUI / 会议纪要 / 术语库 / 多会议软件兼容**: all explicitly ⏳ 待开发 in the README table.
- **DeepFilterNet integration**: not done — verification phase leaves `denoise=false` server-side (the appendix column at `01_技术可行性报告.md` L400 reads "降噪 | 未集成（服务端denoise=false）").
- **Production Opus decoder (`pyogg` / `opuslib`)**: not migrated — still on `soundfile` (appendix L397, "Opus解码 | soundfile (libsndfile) | pyogg (libogg+libopus) 或 opuslib+自研OGG解析").
- **PCM-streaming output format**: not honored by API — `01_技术可行性报告.md` L408 admits "PCM 输出格式 API 目前不生效: 必须用 ogg_opus, Doppelvoice 已知限制" and `02_项目架构与技术栈.md` L254 confirms `target_audio.format=ogg_opus` is the only working path.
- **Acceptance metrics vs. measurements**: `01_技术可行性报告.md` L268–278 lists 验收标准 (BLEU ≥85%, 音色相似度 ≥3.5/5, 降噪 SNR ≥10dB, CPU ≤20%, 内存 ≤300MB, 网络 ≤256kbps, A 通道延迟 ≤3.5s, B 通道字幕 ≤2.5s) — **none of these are measured or reported** by the PoC.

---

## 2. Architecture summary

The PoC's committed stack (mapping every choice to the file that embodies it):

| Layer | PoC choice | PoC file embodying it |
|---|---|---|
| Audio I/O library | `sounddevice` (PortAudio) on Python — playback uses `sounddevice.RawOutputStream` + `bytearray` 环形缓冲 + 蓄能 + `threading.Lock` (queue.Queue → bytearray+锁 as final scheme per `01_技术可行性报告.md` L387 row "播放队列线程安全") | `realtime_interpreter_Minimal_Implementation/src/mac_ast2_s2s_v2.py` |
| Protobuf binding source | Imported from Doppelvoice (MIT, "从 Doppelvoice 移植" per README L56) — encodes/decodes `TranslateRequest`/`TranslateResponse` | `realtime_interpreter_Minimal_Implementation/src/ast_proto/` (subpkgs `common`, `products`; `__init__.py` is the entry) |
| Virtual-audio-card strategy | macOS **BlackHole 2ch** as translation-output device (会议软件 mic = BlackHole 2ch per `README.md` L17 architecture diagram + L106); B-通道 ⏳待开发 with planned BlackHole 16ch + Multi-Output Device | `README.md` L17 + `02_项目架构与技术栈.md` L497–524 (BlackHole install steps + Multi-Output Device creation) |
| WebSocket framing | Python `websockets` library, binary frames only (no JSON), one WS per A-通道 session; protocol event codes handled: 100 StartSession / 200 TaskRequest / 150 SessionStarted / 352 TTSResponse / 351 TTSSentenceEnd / 211 SourceSubtitle / 221 TranslationSubtitle / 999 Error | `realtime_interpreter_Minimal_Implementation/src/mac_ast2_s2s_v2.py` (see §3 event-codes row) |
| Threading model | Two-thread Python: capture thread (mic input ring → TaskRequest 80ms frames at 16kHz) + playback thread (`RawOutputStream` callback pulling from `bytearray+锁` ring with 120ms 蓄能). VAD: 静音 2 秒自动清空字幕 + 播放缓冲 (`01_技术可行性报告.md` L390) | `mac_ast2_s2s_v2.py`; playback-buffer rewrite row L386 + queue-safety row L387 |
| Output format / decoding | `ogg_opus` 48000Hz server-side (`format=pcm` **doesn't work** — Doppelvoice known limit per `01_技术可行性报告.md` L408). Decoded locally with `soundfile`/`libsndfile` to 48000Hz PCM, then written to `RawOutputStream` | `realtime_interpreter_Minimal_Implementation/src/opus_decoder.py` |
| Auth scheme | **NEW** `X-Api-Key` + `X-Api-Resource-Id` only (2 headers, recommended). Old `X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id` still listed in `02_项目架构与技术栈.md` L267-269 but appendix L405-406 flags it as superseded | `realtime_interpreter_Minimal_Implementation/src/auth_test.py` probes both schemes |
| Mic / VAD / 电平 | RMS-based电平 (`int16` normalized to 0–1 per `01_技术可行性报告.md` L389); RMS 阈值 VAD for 静音 2 秒清空; `numpy` for level calc | `mac_ast2_s2s_v2.py`; level-fix row L389 |

The PoC explicitly does **not** commit to Electron, React, Native Addon, DeepFilterNet, SQLite, IPC channels, L2 services, log sanitization, or AI纪要 — these are "production phase (recommended)" rows in `02_项目架构与技术栈.md` table at L218–230 ("验证阶段 vs 生产阶段技术栈差异"). They are aspirational, not implemented.

**Key module/symbols in `mac_ast2_s2s_v2.py` worth flagging for the parent project**:

- The two-thread split (capture thread + playback thread) is the pattern to copy; the `bytearray+threading.Lock` ring + 120ms 蓄能 is the proven-correct Python pattern (per `01_技术可行性报告.md` L387 row "播放队列线程安全" showing 3 prior failed approaches: asyncio.Queue → queue.Queue → bytearray+锁 as **final scheme**)
- The `TTSResponse(352)` → accumulate → `TTSSentenceEnd(351)` → whole-sentence opus decode → write to ring pattern (per `01_技术可行性报告.md` L407 row "ogg_opus 是句末解码: TTSResponse 分片累积到 TTSSentenceEnd 后一次性解码, 增加约 200~500ms 延迟") is the **single biggest latency cost the parent project can eliminate** by switching to `pyogg` stream decode
- The VAD "静音 2 秒自动清空" pattern (`01_技术可行性报告.md` L390 fix row "静音时持续输出上一句 — 加静音检测, 静音2秒后自动清空字幕和播放缓冲") — this is a bug fix, not a feature; parent must replicate the bug-avoidance logic
- The mic电平 `int16` RMS normalize (per L389 fix row "麦克风电平显示 — int16 RMS 归一化到 0~1") — trivial but worth porting as a small util

**Key module/symbols in `auth_test.py` worth flagging**:

- The auth-probe iterates over **all combinations** of `X-Api-Key` / `X-Api-App-Key`+`X-Api-Access-Key` × 语音控制台 / 方舟控制台 to find the working pair. The conclusion ("only 2-header + 语音控制台 works") is the PoC's #1 reusable empirical contribution (per `01_技术可行性报告.md` L405–406)
- The probe must be runnable as a **standalone CLI** (per `README.md` L151 `python auth_test.py`) — the parent project's port should keep this property for diagnostics

**Key module/symbols in `opus_decoder.py` worth flagging**:

- The current PoC decoder uses `soundfile.read()` which loads the entire accumulated buffer into memory before decoding — this is the structural reason for the 200–500ms latency (decode happens at `TTSSentenceEnd`, not streaming). The parent project should NOT port this; it should reimplement using `pyogg.OggOpusFile` or `opuslib.Decoder` per `02_项目架构与技术栈.md` L185–207

---

## 3. Tech-stack decisions

Concrete selections hard-coded in the PoC code/docs (vs merely recommended):

| Decision | Concrete value | Where documented |
|---|---|---|
| Doubao endpoint URL | `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` | `README.md` L156; `02_项目架构与技术栈.md` L263 |
| Doubao resource ID | `volc.service_type.10053` (固定值, per `02_项目架构与技术栈.md` L128) | `README.md` L146; `02_项目架构与技术栈.md` L264 |
| Auth scheme | **NEW 2-header** `X-Api-Key` + `X-Api-Resource-Id` only; old `X-Api-App-Key` + `X-Api-Access-Key` kept for fallback. **API Key must come from 语音控制台** (console.volcengine.com/speech/new/setting/apikeys), **not 方舟控制台** (else 401 per `01_技术可行性报告.md` L405) | `README.md` L137–152; `01_技术可行性报告.md` L405–406 + appendix rows L368–380 |
| A-通道 mode | `s2s` (`source_language=zh`, `target_language=en`); `speaker_id=""` triggers zero-sample clone; `denoise=false` (本地未集成降噪, 保留音色细节 per `02_项目架构与技术栈.md` L115) | `02_项目架构与技术栈.md` L115, L247–258 |
| Audio input spec | 16000Hz / 16bit / mono PCM; 80ms frames = 2560 bytes; `format="wav"` | `README.md` L158; `02_项目架构与技术栈.md` L258 |
| Audio output spec | ogg_opus 48000Hz server-side (PCM not honored); decoded to 48000Hz PCM locally; played to BlackHole (which resamples to BlackHole's native rate, the actual debug subject per README L183) | `01_技术可行性报告.md` L408–409; `02_项目架构与技术栈.md` L180 |
| Opus decoder (PoC) | `soundfile` (libsndfile indirect); OGG 分片累积到 TTSSentenceEnd 后一次性解码 (adds 200–500ms per `01_技术可行性报告.md` L407); `loguru` 残留已修 (L388) | `realtime_interpreter_Minimal_Implementation/src/opus_decoder.py` |
| Python audio library | `sounddevice` (PortAudio); `soundfile` for wav I/O; `numpy` for level calc (int16 RMS normalized to 0–1) | `01_技术可行性报告.md` L393; `requirements.txt` (referenced in README L93) |
| Python version | 3.9 – 3.12 only (3.13+ 不支持 — `sounddevice` no prebuilt wheel) | `README.md` L71; `01_技术可行性报告.md` L409 |
| Config style | Hardcoded constants in `mac_ast2_s2s_v2.py` (no JSON / no electron-store) — `API_KEY`, `MIC_DEVICE_ID`, `OUTPUT_DEVICE_ID`; verified config lives in `config/config.example.py` | `README.md` L96–107; `realtime_interpreter_Minimal_Implementation/config/config.example.py` |
| Event codes the PoC handles | StartSession=100, TaskRequest=200, FinishSession=102/900, SessionStarted=150, TTSResponse=352, TTSSentenceEnd=351, SourceSubtitle=211, TranslationSubtitle=221, error=999 | `README.md` L161; `02_项目架构与技术栈.md` L272–288 |
| Output device (PoC default) | Device 2 = BlackHole 2ch (Device 0 = 显示器扬声器 per `01_技术可行性报告.md` L391 fix row "输出设备ID标注错误") | `README.md` L106; `01_技术可行性报告.md` L391 |
| Mic device (PoC default) | Device 3 = MacBook Air 麦克风 | `README.md` L105 |
| Buffer strategy | `bytearray` 环形缓冲 + `threading.Lock` + 蓄能 120ms (anti-underrun); 缓冲上限 30 秒（超上限丢最早数据防漂移） | `01_技术可行性报告.md` L386–387; `02_项目架构与技术栈.md` L213–216 |
| 静音处理 | VAD 静音 2 秒自动清空字幕 + 播放缓冲; 同时也防止"静音时持续输出上一句"（L390 已修复） | `01_技术可行性报告.md` L390 |

**Notable internal inconsistency** between PoC docs on auth: `02_项目架构与技术栈.md` L128 still lists the **3-header** auth scheme (`X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id`) as if canonical, but the appendix in `01_技术可行性报告.md` L405–406 says the new 2-header scheme is what actually works. The README L137–147 also lists both. The parent project should treat the **2-header scheme** as canonical per the verification results, and ignore the stale 3-header doc row at `02_项目架构与技术栈.md` L128.

---

## 4. Latency / cost analysis (claims vs admitted unknowns)

### 4.1 v0 first-sound latency budget (claimed)

`03_性能与成本分析.md` line 42 declares **A-通道端到端 2600–2900ms total**, decomposed as the waterfall at L11–28 and the per-stage table at L30–42:

| Stage | ms | PoC status | Notes |
|---|---|---|---|
| 1. Capture buffer (half of 80ms frame) | 40 | `sounddevice.RawInputStream` (PoC-verified) | Can drop to 20ms in WASAPI Exclusive / CoreAudio Low Latency |
| 2. VAD / 静音开关 | ~0 | Software switch (PoC-verified) | No optimization |
| 3. DeepFilterNet 降噪 + AGC | 100 | **NOT integrated in PoC** (server-side `denoise=false` per appendix L400) | Can drop to 50ms by skipping denoise, but degrades voice cloning |
| 4. Network uplink | 80 | Measured assumption (cn-north region) | Can drop to 50ms on wired net |
| 5. **AST 2.0 s2s inference (key path)** | **~2200** | **85% of total**; flagged as "物理极限" at `01_技术可行性报告.md` L274; official paper FLAL 2.53s | **Cannot be reduced via engineering** — only model upgrade (AST 3.0) |
| 6. Network downlink | 60 | Measured assumption | Can drop to 40ms on wired |
| 7. Jitter Buffer | 40–80 (adaptive) | `mac_ast2_s2s_v2.py` playback thread; appendix L399 specifies 蓄能 120ms (initial fill) then 40–80ms adaptive | Drops to 20ms possible but jitter risk |
| 8. Virtual sound card playback | 40 | BlackHole driver + 会议软件 capture buffer | Drops to 20ms on low-latency driver settings |
| **Total** | **2600–2900** | | "非推理环节已压缩到 ~400ms, 接近理论最优" (L42) |

(`03_性能与成本分析.md` L30–42)

**Critical caveat**: the 100ms "DeepFilterNet+AGC" stage is **budgeted but not implemented** — when the PoC runs today, that line is replaced by a no-op (server `denoise=false`), and the ogg_opus whole-sentence decode adds 200–500ms on top. So the **actual measured PoC latency is closer to 3.0–3.7s, not 2.6–2.9s**. The PoC explicitly quantifies this trade-off at `03_性能与成本分析.md` L78–79 row 1 ("输出格式：ogg_opus → PCM | 3.0~3.7s → 2.6~2.9s | 300~800ms"). The 2.6–2.9s target assumes a hypothetical PCM-streaming path that the PoC docs themselves say **the API currently doesn't honor** (`01_技术可行性报告.md` L408: "PCM 输出格式 API 目前不生效: 必须用 ogg_opus, Doppelvoice 已知限制").

### 4.2 B-通道 latency claim

B-通道 (英→中字幕) is claimed at **~1.5s end-to-end** (`03_性能与成本分析.md` L69) because s2t mode skips TTS. The decomposition (L62–69): meeting software playback + virtual-sound-card loopback 100ms + resample 10ms + network uplink 80ms + AST 2.0 s2t inference ~1200ms (official S2T FLAL 2.21s, 流式 ~1.2s) + network下行 + UI渲染 50ms = ~1.5s. **This number is entirely hypothetical** — the B-通道 code does not exist in the PoC (README 当前状态 table flags it ⏳ 待开发). The s2t mode is referenced in `02_项目架构与技术栈.md` L116 with mode=`s2t` and the `Subtitle` interface definition at L714–722, but no implementation file.

### 4.3 Cost analysis (claimed, with explicit deferral on real pricing)

`03_性能与成本分析.md` L155–162 cost pie: 同传 API ~85% + 零样本音色克隆 ~10% (含在 s2s 单价中 or 单独计费 — L177 admits uncertainty) + AI 会议纪要 ~3% (用户自付) + 其他 ~2%.

Per-hour cost table at L200–209 lists ~30 minutes A-channel usage + ~30 minutes B-channel usage, then explicitly punts: "**具体单价请以火山引擎方舟控制台「Doubao 同声传译大模型」最新定价为准**" (L211). Same deferral at L13–15: "s2s（含语音输出）通常高于 s2t（仅字幕）。本方案通过 VAD 静音检测、按需开启 B 通道、静音按钮、快停暂停等策略，可有效降低实际费用 30–50%". **No actual RMB/hour number is given for s2s or s2t.** Cost-optimization strategies enumerated at L233–242 (VAD 30–50%, 快停暂停, B 通道按需开启 ~50%, 原声直出 100%) are strategy-level, not measurement-level.

**What the PoC does give on cost**: monthly usage scenarios (L217–221) — 轻度 (每天0.5h, ~15h/月, 低成本) / 中度 (每天1h, ~30h/月, 中) / 重度 (每天2h+, ~60h+/月, 较高). The pivot point where "重度 may exceed 金喜 月费" is at ~2h/day (L221). The PoC recommends "重度使用考虑商用成品" without quantifying the crossover. **AI 纪要 token estimate**: L188 gives "输入为会议全文（双语对照，约5000~10000 tokens/小时），输出为纪要（约1000~2000 tokens）" and L189 "单次成本：约 0.1~0.5 元/次" — this is the only concrete number anywhere in the cost analysis.

**A 通道上行带宽**：L195 estimates "~32kbps" (16kHz × 16bit = 256kbps raw, but compressed PCM after 80ms framing averages to ~32kbps per the PoC's envelope calculation); **A 通道下行**：~768kbps at 24kHz/16bit raw PCM (or less if ogg_opus compressed); **B 通道上行**：~32kbps; **B 通道下行**：少量字幕 JSON. Total bidirectional ≤128kbps per L195 budget.

### 4.4 Stability claims (largely design, not measurement)

`03_性能与成本分析.md` L89–105 describes Jitter Buffer adaptive algorithm (40–80ms based on jitter detection < 20ms / 20–50ms / > 50ms), RTT monitoring (every second, sliding avg over last 5), packet-loss tracking via sequence gaps, 预警 thresholds (RTT > 200ms 黄色 / > 500ms 红色, 丢包率 > 5% / > 10%). None of these are measured by the PoC — they are design goals.

Reconnect strategy L122–129: exponential backoff 1s/2s/4s, max 3 retries, then "异常" state requiring manual reconnect. Reconnect-side behaviour L131–137: 10s audio ring buffer cache, output静音 during reconnect, 音色重采样 after reconnect ("最近10s的用户语音"). **The 10s cache + "重新采样音色" mechanism is design-only, not validated in PoC.**

`01_技术可行性报告.md` L329 risk row "网络不稳定导致断连" maps to: 指数退避最多3次 + 音频缓存 (最多10s) + 恢复后补发 + 网络质量监控和预警. PoC implementation: none.

### 4.5 What the PoC admits as unknown

- **Actual measured first-sound latency on M-series hardware** — never re-measured end-to-end by the PoC; the 2.6–2.9s is quoted from Doppelvoice + official paper, not M2 Air benchmark. Per map.md L121: "PDF §3 says ~3s end-to-end, but actual measurement on M2 + 豆包 may differ; we don't know until T13".
- **Whether `format=pcm` can ever work** — appendix L408 says "目前不生效" but doesn't rule out future API changes; the 2.6–2.9s budget depends on it.
- **Whether zero-sample cloning stays consistent across one long session** — `01_技术可行性报告.md` L274–275 admits "重连后可能出现音色漂移" as a known risk; per map.md L120, "Doppelvoice CHANGELOG 自承「重连后零样本音色突变」, PoC 单 session 内是否有此问题未知".
- **Whether the 120ms playback 蓄能 + 40–80ms jitter buffer is the right calibration on M-series** — Doppelvoice-tuned, not M2-tuned (BlackHole native sample rate may differ from Doppelvoice's Windows VB-Cable calibration; the README L183 acknowledges "播放声音变调/杂音" as the active debug issue).
- **Real cost numbers**: `03_性能与成本分析.md` L211 explicitly defers to 方舟控制台 pricing.
- **Quality metrics** (SNR, BLEU, cosine similarity, 音色相似度 subjective score) — `01_技术可行性报告.md` L268–282 lists 验收标准 but the PoC does not report any measured result against them.

---

## 5. Open questions the PoC docs raise (未验证 / 待实现 / 内部矛盾)

| # | Question raised by PoC docs | PoC's own framing |
|---|---|---|
| Q1 | Will the playback sample-rate problem actually clear after the Doppelvoice-style rewrite? | README 当前状态 table says "播放端采样率问题调试中" (调试中); appendix L386 calls it "✅ 已优化" but the README was not updated to remove the 验证中 flag — there is **internal inconsistency** between the two documents on whether playback is done |
| Q2 | Should the production Opus decoder be `pyogg` (libogg+libopus) or `opuslib` + 自研 OGG 解析? | `02_项目架构与技术栈.md` L185–207 lists all 5 options with tradeoffs (soundfile 5ms/句一般 / pyogg 1ms/句好 / opuslib 0.06ms/包最好 / ruopus 0.1ms/包好 / ffmpeg 10ms/句最好但子进程); no decision recorded. "极致优化" path costs dev time for ~60μs/包 gain |
| Q3 | Will 0-sample cloning stay stable across one long meeting (not just reconnects)? | `01_技术可行性报告.md` L274–275 + L326 flag 重连漂移 as risk; not empirically tested |
| Q4 | What is the actual v0 first-sound latency on M-series hardware? | `03_性能与成本分析.md` L42 / L79 quotes 2.6–2.9s / 3.0–3.7s depending on output format; never re-measured by PoC |
| Q5 | What is the actual s2s / s2t per-hour pricing? | `03_性能与成本分析.md` L211 explicitly says "以火山实际单价为准"; only mentions "30–50% VAD savings" as strategy |
| Q6 | How should the parent project structure dual-WS sessions (R3 outbound + R4 inbound) — same process, same client lib, or split? | PoC only runs one A-通道 session; `02_项目架构与技术栈.md` L114–115 shows 2 separate `ChannelA` / `ChannelB` configs but no implementation, and the protocol event codes for s2t (650–655 per `.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md`) are not in the PoC's `02_项目架构与技术栈.md` L272–288 table |
| Q7 | Should 阶段1 production PoC run on macOS-first or Windows-first? | `01_技术可行性报告.md` L345 ("**先 Windows 后 Mac**：用户主要使用 Windows") and `02_项目架构与技术栈.md` L566 ("开发策略 … 先 Windows 后 Mac") BOTH recommend Windows-first but the actual PoC code is macOS-only. Per `.scratch/macos-siminterpret-poc/map.md` L47 the destination is "M2 MacBook Air" — Mac-only |
| Q8 | Which L2 services get the API Key 加密存储 (electron `safeStorage`) & 日志脱敏 (no audio content / translation text in logs)? | `02_项目架构与技术栈.md` L92 (`ConfigManager` `safeStorage`) and L94 (`Logger` 脱敏) list them as L2 services but no implementation in PoC |
| Q9 | Should the parent project use a `queue.Queue` + lock bytearray ring (PoC approach, thread-safe but Python GIL-bound) or a Node.js Native Addon (production goal from `02_项目架构与技术栈.md` L162) for playback? | Both listed; PoC proves the Python approach works (`01_技术可行性报告.md` L386–387) |
| Q10 | Which event code schema is canonical — the PoC's 100/200/150/352/351/211/221/999, or the additional 210/212/220/222/230/900/901 listed in `02_项目架构与技术栈.md` L272–288? | The PoC source handles a subset; the 02 doc lists the full superset but no source file handles 210 SourceSubtitleStart, 212 SourceSubtitleComplete, 220 TranslationSubtitleStart, 222 TranslationSubtitleComplete, 230 TargetAudio, 900 FinishSession, 901 SessionFinished. The two docs disagree on which codes the client actually processes |
| Q11 | Does the 120ms playback 蓄能 plus 30s 上限 buffer cap interact correctly with adaptive 40–80ms Jitter Buffer on Mac? | Two separate numbers in two separate doc sections (`02_项目架构与技术栈.md` L213 "Jitter Buffer 100-150ms" vs L215 "缓冲上限30秒" vs L399 "蓄能120ms"). No source-code reference confirms whether they compose or conflict |
| Q12 | Should the docs' "PCM format = broken" finding be retried periodically, or assumed permanent? | `01_技术可行性报告.md` L408 says "目前不生效"; no commitment on re-checking cadence |
| Q13 | Which `Subtitle` schema does the parent project commit to for B-通道? | `02_项目架构与技术栈.md` L714–722 defines `Subtitle { id, timestamp, speaker: 'client'\|'unknown', sourceText, translationText, isFinal }`. The .scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md notes that s2t mode emits 650/651/652 + 653/654/655 events (SourceSubtitle / TranslationSubtitle start/complete) on the SAME WebSocket session as s2s — different from the PoC's `01_技术可行性报告.md` event code table at L275–284 (211/212/221/222). The two sources use different event-code numbering. Parent must reconcile |
| Q14 | Does the Jitter Buffer's 120ms initial 蓄能 (`01_技术可行性报告.md` L399) compose with the documented 40–80ms adaptive size (`02_项目架构与技术栈.md` L93 / `03_性能与成本分析.md` L41)? | PoC describes both — 120ms initial fill to avoid startup underrun, then drop to 40–80ms adaptive. No source confirms whether the actual implementation switches modes or holds 120ms forever |
| Q15 | Should `speaker_id` ever be set to a non-empty value (preset 音色), or always "" for zero-sample clone? | PoC verifies "" works (L379 "speaker_id 留空，API 自动从输入音频提取音色"). `02_项目架构与技术栈.md` L313 says AST 2.0's 指定音色模式 only supports 2 公版音色 (`zh_female_vv_uranus_bigtts` / `zh_male_jingqiangkanye_emo_mars_bigtts`) — but the parent product needs "user's own voice" so empty-string is canonical. Worth confirming whether the 2 公版音色 option should be offered as a "我音色未就绪时的 fallback" |
| Q16 | Should `denoise` always be `false` server-side, or expose it as a user-toggleable setting? | `02_项目架构与技术栈.md` L115 mandates `denoise=false` for A-通道 to preserve 音色细节 (since local DeepFilterNet handles it). For B-通道 L116 says "denoise=true（可选，服务端降噪）". PoC always sets `false` (since no local denoise integrated). Parent's spec should codify: A-通道=always false, B-通道=user-toggle |
| Q17 | Does `format="wav"` actually need to be set in the request, or is it the default? | `02_项目架构与技术栈.md` L253 says "source_audio.format=wav, rate=16000, bits=16, channel=1" for both A and B. README L158 same. Not tested whether omitting it still works |

---

## 6. Reusable artefacts in the PoC

File-by-file inventory of what the parent project can re-import, port, or rewrite:

| PoC path | What it is | Re-use mode for parent project |
|---|---|---|
| `realtime_interpreter_Minimal_Implementation/src/ast_proto/` (subpkgs `common`, `products`, with `__init__.py`) | Protobuf Python bindings **ported from Doppelvoice (MIT)** — encodes/decodes `TranslateRequest` / `TranslateResponse` (binary, no JSON) | **Re-import or rewrite** — Doppelvoice is MIT so re-use is allowed with copyright preserved. The parent project will likely prefer to **re-emit `.proto` and regenerate bindings in its target language** (TypeScript via `ts-proto`, Rust via `prost`, Go via `protoc-gen-go`) because (a) the binding is Python-only, (b) the docs say "纯 Protobuf 二进制, 无 JSON 包装" (README L157) so binary framing must be preserved |
| `realtime_interpreter_Minimal_Implementation/src/auth_test.py` | Auto-tests all auth-header combinations against the endpoint; key empirical finding: **API Key must come from 语音控制台, not 方舟控制台**, and **2-header `X-Api-Key` + `X-Api-Resource-Id` is sufficient** (L405–406) | **Port logic** — every parent project port needs an equivalent auth probe before code-gen; the "2-header only" + "语音控制台 not 方舟控制台" discoveries are the PoC's #1 reusable empirical contribution |
| `realtime_interpreter_Minimal_Implementation/src/test_record.py` | Mic capture sanity test (5-second recording) — used to verify device + permission before running the full pipeline | **Port logic** as a self-test, not a dependency; useful as a smoke test in parent project's pre-flight check |
| `realtime_interpreter_Minimal_Implementation/src/opus_decoder.py` | Ogg/Opus stream decoder using `soundfile`/`libsndfile`; appends `TTSResponse(352)` chunks until `TTSSentenceEnd(351)` then whole-sentence decodes (200–500ms cost — explicitly called out as production-blocker at `01_技术可行性报告.md` L407) | **Rewrite** — production path is `pyogg` or `opuslib` + 自研 OGG 解析 per `02_项目架构与技术栈.md` L185–190. The soundfile-based PoC decoder is verification-only |
| `realtime_interpreter_Minimal_Implementation/src/resample.py` | PCM resampler utility (likely scipy/numpy-based) | **Re-import logic as-is** for 48k→16k (B-通道 system audio loopback at `02_项目架构与技术栈.md` L104) |
| `realtime_interpreter_Minimal_Implementation/src/mac_ast2_s2s_v2.py` | Main A-通道 s2s loop: mic capture (16kHz mono) → 80ms frames (2560B) → WebSocket `StartSession(100)` → `TaskRequest(200)` loop → `TTSResponse(352)` accumulate → ogg_opus decode (via `opus_decoder.py`) → bytearray ring (with 120ms 蓄能 + lock) → `sounddevice.RawOutputStream` playback (latency=low); VAD 静音 2 秒清空字幕 + 缓冲 | **Reference implementation** — the parent's production loop must replicate the same event flow (`StartSession` / `TaskRequest` / `TTSResponse` / `TTSSentenceEnd`) but in target language. Two proven patterns to lift: (a) `bytearray` + `threading.Lock` + 蓄能 120ms anti-underrun (`01_技术可行性报告.md` L399); (b) VAD 静音 2 秒自动清空字幕 + 播放缓冲 (L390). Also `--list-devices` flag pattern (README L113) |
| `realtime_interpreter_Minimal_Implementation/config/config.example.py` | Hardcoded config example: `API_KEY`, `MIC_DEVICE_ID`, `OUTPUT_DEVICE_ID` | **Rewrite** as JSON / electron-store (`02_项目架构与技术栈.md` L166) — production must not ship hardcoded constants |
| `realtime_interpreter_Minimal_Implementation/scripts/run_mac_verify.sh` | macOS bootstrap: Python version check (3.9–3.12 gate) → `.venv` → `pip install sounddevice numpy websockets protobuf soundfile` → protobuf binding verify (`python -c "import ast_proto"`) | **Reference for CI bootstrap**; will need extension for Node.js/Electron, BlackHole install (`brew install blackhole-2ch`), code-signing, notarization |

The PoC's `requirements.txt` (README L93) lists `sounddevice, numpy, websockets, protobuf, soundfile` — **verification-only dependencies; none of these will be the parent's runtime stack**.

What the PoC **does not** contain that the parent project will have to invent:
- The `.proto` source file itself (the Python bindings are pre-compiled; regenerating requires the original `.proto` which is not in the PoC repo — parent must obtain from Doppelvoice source)
- Any unit tests
- Any CI config
- Any README/CONTRIBUTING/CHANGELOG beyond the single README.md
- Any `.gitignore` (per parent AGENTS.md the PoC is git-ignored at the parent level)

---

## 7. Gaps vs. destination

The PoC delivers only the **A-通道 single-channel Mac** "verification script" described in `01_技术可行性报告.md` L313 (阶段1: "1\~2天可跑通, 最小验证:A通道(s2s中→英)+PCM流式+DeepFilterNet降噪+VB-Cable+延迟测量"). Even that is only partially met (DeepFilterNet not integrated; PCM output format not honored by API; first-sound latency not re-measured).

vs. the destination in `.scratch/macos-siminterpret-poc/map.md` L12 ("A macOS-first open-source product that competes with 金喜同声传译双通道版"), the following v0 features are **absent from the PoC** and must be built fresh:

| Missing v0 feature (per map.md) | PoC provides | Notes |
|---|---|---|
| R4 B-通道 (英→中字幕, mode=s2t) | Nothing | PoC explicitly ⏳待开发; needed s2t mode + system audio loopback (per map.md T06: ScreenCaptureKit `excludesCurrentProcessAudio=true`) |
| Dual-channel self-meeting test ("自开会议跑通, 无反馈环") | Single-channel only | PoC's BlackHole install + device IDs in `mac_ast2_s2s_v2.py` cover A-side wiring only |
| File-based regression test ("pre-recorded CN audio → file output") | Not in PoC | map.md L117 flags as "likely yes, deferred to T13" |
| Pre-flight topology checker (analogous to `check_voicemeeter.py` from `ricardobing/realtime-voice-translator`) | Not in PoC | map.md L122 explicitly flags as PoC requirement; PoC has only `--list-devices` (`README.md` L113) |
| First-sound latency measurement on M-series hardware | Not measured; quoted from external sources | map.md L121 — "we don't know until T13" |
| 0-sample cloning stability across 30-min session (not just across reconnects) | Not measured | map.md L120 — Doppelvoice CHANGELOG warns about reconnect drift |
| BlackHole-specific bus-topology validation (which inputs feed which outputs on macOS 14.4.1) | Not validated | map.md L116 — pending T12 |
| 3-误区 self-check (translation-output VAC ≠ other-input VAC; 会议 mic = translation-output VAC, not real mic; 对方翻译输出走真实耳机) | Not in PoC | map.md L124–128 — added per T21 dachengzionly wiki research |
| Cascading path scaffolding for v1 (local ASR + Doubao S2T + 本地 TTS) | Not in PoC | map.md L24 explicitly requires "代码里预留 v1 cascade 接口" |
| Configurable per-second / per-hour cost display | Not in PoC | `03_性能与成本分析.md` L309 budgets it but doesn't build it |
| DeepFilterNet 降噪 ONNX integration | Not in PoC | L400 column "未集成" |
| `pyogg` / `opuslib` stream decode | Not in PoC | L397 |
| Electron + React + Tailwind GUI | Not in PoC | L401 |
| BlackHole Multi-Output Device 一键创建 (AppleScript) | Not in PoC | `02_项目架构与技术栈.md` L542 mentions as design goal |
| Anti-feedback 拓扑校验 ("②翻译输出 ≠ ③对方声音输入") | Not in PoC | `02_项目架构与技术栈.md` L547 |
| L2 应用服务层 (SessionManager, DeviceManager, HotkeyManager, RecorderManager, ConfigManager, Logger) | Not in PoC | All 6 services flagged as L2 in `02_项目架构与技术栈.md` L83–94 |
| SQLite-based 双语原文存储 (`better-sqlite3`) | Not in PoC | `02_项目架构与技术栈.md` L92 |
| AI纪要 (OpenAI-compatible configurable API key) | Not in PoC | `02_项目架构与技术栈.md` L131 |
| 日志脱敏 + 分级日志 (`electron-log`) | Not in PoC | `02_项目架构与技术栈.md` L94 |
| IPC interface (`session:start`, `device:list`, etc.) | Not in PoC | `02_项目架构与技术栈.md` L640–658 |
| `electron-localshortcut` global hotkeys (Ctrl+Alt+M 静音我方 / N 静音对方 / 空格 快停 / H 字幕窗显示) | Not in PoC | `03_性能与成本分析.md` L246–249 enumerates them as user recommendations |
| 自动重连 (指数退避, 1s→2s→4s, 最多 3 次) | Not in PoC | `02_项目架构与技术栈.md` L120 lists it as ReconnectManager design |
| 4-设备 wiring diagram (麦克风 / 翻译输出 / 对方声音输入 / 对方翻译输出) on Mac | Single-device only | `02_项目架构与技术栈.md` L201–211 design describes it but PoC only wires 2 of 4 |
| `ws` 8+ Node.js WebSocket client with binary frame support | Python `websockets` only | `02_项目架构与技术栈.md` L164 — production needs Node-side equivalent |
| 4 通道电平表 (mic / 翻译输出 / 对方输入 / 耳机输出) | Single mic电平 (per `01_技术可行性报告.md` L389 fix row) | `02_项目架构与技术栈.md` L79 specifies 4-channel RMS @10ms refresh |
| 悬浮字幕窗 (半透明 70% / 可拖拽 / 可缩放 / Ctrl+Alt+H 隐藏 / 字号可调 / 3 显示模式) | Not in PoC | `02_项目架构与技术栈.md` L77 |
| 系统托盘常驻 + 托盘菜单 (开始/停止/设置/退出) + 状态图标 (未连接/已连接/异常) | Not in PoC | `02_项目架构与技术栈.md` L76 |
| 设备热插拔监听 (Native Addon device-changed callback) | Not in PoC | `02_项目架构与技术栈.md` L145 + L546 |
| Mac 多输出设备 AppleScript 一键创建 | Not in PoC | `02_项目架构与技术栈.md` L543 |
| Windows "侦听此设备" PowerShell/注册表 一键开启 | Not in PoC | `02_项目架构与技术栈.md` L544 |
| 会议软件配置图文引导 (Zoom/Teams/腾讯会议/钉钉/飞书/Meet/OBS) | Not in PoC | `02_项目架构与技术栈.md` L526–536 |
| Spk_chg 说话人识别 + 双语原文 spk_chg-driven split | PoC likely ignores | `02_项目架构与技术栈.md` L241 mentions; B-通道 interface L718 has `speaker: 'client'\|'unknown'` but PoC doesn't bind |
| 实时费用监控 + 阈值告警 (默认 10 元) | Not in PoC | `02_项目架构与技术栈.md` L320 |
| Crash recovery + Electron `crashReporter` + 上次配置恢复 | Not in PoC | `02_项目架构与技术栈.md` L150 |
| 原声直出开关 (绕过同传) | Not in PoC | `02_项目架构与技术栈.md` L66 + `03_性能与成本分析.md` L241 |
| 多轮翻译次数计数 (TranslationSubtitleComplete event count) | Not in PoC | `02_项目架构与技术栈.md` L79 |
| `electron-updater` 自动更新 + DMG/NSIS 打包 | Not in PoC | `02_项目架构与技术栈.md` L173–174 |
| Mac notarization + Win 代码签名 (EV recommended) | Not in PoC | `02_项目架构与技术栈.md` L562 |
| 术语库 (`corpus.boosting_table_id` 热词表 + `corpus.regex_correct_table_id` 正则替换) | Not in PoC | `02_项目架构与技术栈.md` L130 + L257 |
| AGC (target -16dBFS, attack 5ms release 100ms, limiter -3dBFS) | Not in PoC | `02_项目架构与技术栈.md` L118 |
| 中文翻译 TTS 播报到耳机 (B-通道 enableTts 默认 false) | Not in PoC | `02_项目架构与技术栈.md` L105 + L710 |
| 8 个 验收标准 measurement: BLEU / 音色相似度 / SNR / CPU / RAM / 带宽 / 稳定性 / 重连恢复 | None measured | `01_技术可行性报告.md` L268–278 + `03_性能与成本分析.md` L267–282 |

The single largest gap is that the PoC is a **single-process Python script**, while the destination is a **dual-WS (s2s + s2t) Electron app with anti-loopback topology check + pre-measured latency + open-source README/CI** — none of those things have a starting point in the PoC.

### 7.1 What the PoC explicitly says is the next step (and how that maps to destination gaps)

`01_技术可行性报告.md` L413–419 ("下一步（阶段1已完成，进入生产开发）") names the PoC's own view of what comes next:

1. 阶段1验证完成 — implies the team considers A-通道 s2s done
2. 生产环境Opus解码迁移 — **exactly addresses** the 200–500ms gap noted in §4.1
3. B通道开发 — **exactly addresses** the R4 gap
4. 本地降噪集成 — **exactly addresses** the DeepFilterNet gap
5. Electron桌面应用开发 — **exactly addresses** the GUI gap
6. 会议纪要功能 — **exactly addresses** the AI纪要 gap
7. Windows平台适配 — **NOT** a v0 destination item (per map.md L47 Mac-only)

Notably absent from the PoC's "next step" list:
- Pre-flight topology checker (map.md L122)
- File-based regression test (map.md L117)
- 0-sample cloning long-session stability test (map.md L120)
- M2 hardware latency measurement (map.md L121)
- 3-误区 self-check (map.md L124–128)
- v1 cascade path scaffolding (map.md L24)

These are the destination-specific gaps the PoC docs did not anticipate — i.e. the destination's most safety-critical additions come from the new T06/T15–T20 research, not from the PoC's own self-listed gaps.

---

## Open decisions for /grill-with-docs

The following are **new** questions the docs themselves raise, distinct from Q1/Q2/Q3 in earlier sessions (R3 vs R4 / delay target / GUI stack). These need user decisions before spec-writing starts.

1. **PoC docs contradict themselves on playback-status completion**: README 当前状态 table says "播放端采样率问题调试中" (调试中), but `01_技术可行性报告.md` appendix L386 calls playback rewriting "✅ 已优化". Should the parent project treat A-通道 playback as solved-from-PoC, or as still-to-debug (and so budget time for re-tuning on the parent's M2 hardware before locking the playback module)?

2. **Auth scheme documentation is internally inconsistent**: `02_项目架构与技术栈.md` L128 still documents the 3-header `X-Api-App-Key` + `X-Api-Access-Key` scheme as if it were canonical, while `01_技术可行性报告.md` appendix L405–406 and README L137–147 say the 2-header `X-Api-Key` scheme is what works. Which version of the auth scheme should the parent's spec codify — and should we also probe whether the old scheme still works as fallback (since `02_项目架构与技术栈.md` L267–269 suggests it does)?

3. **PoC playback budget claims a 2.6–2.9s target that depends on a PCM-streaming output format the API doesn't honor**: `01_技术可行性报告.md` L408 admits `format=pcm` is broken, yet `03_性能与成本分析.md` L42 / L79 both bake the 2.6–2.9s number into a budget that only applies if PCM works. Should the parent project's spec declare 3.0–3.7s (ogg_opus path, what the PoC actually delivers today) or 2.6–2.9s (PCM path, hypothetical) as v0 first-sound target — and is the user willing to file a 火山引擎 feature request to enable `format=pcm`?

4. **PoC recommends "先 Windows 后 Mac" but the parent project is Mac-only** (`01_技术可行性报告.md` L345; `02_项目架构与技术栈.md` L566; map.md L47 = M2 MacBook Air, sole user hardware). Which platform-first recommendation does the parent's spec follow — PoC's Windows-first or destination's Mac-first — and does the parent still need Windows at v0 or only v1+?

5. **`pyogg` vs `opuslib`+自研 OGG 解析 for production Opus decode**: `02_项目架构与技术栈.md` L185–207 lists all 5 options including the "极致优化" opuslib path that costs ~60μs/包 vs pyogg's ~1ms/句. With the ogg_opus whole-sentence decode adding 200–500ms to the critical path (the PoC's #2 latency cost after model inference per `01_技术可行性报告.md` L407), does the parent project invest dev time in stream-decoding Opus packets now (path = faster first-sound, higher dev cost), or ship the simpler `pyogg` whole-sentence path and chase the 200–500ms later (path = simpler v0, deferred optimization)?

6. **Event-code schema divergence**: PoC source handles a subset (100/150/200/211/221/351/352/999), while `02_项目架构与技术栈.md` L272–288 documents the full superset (210/212/220/222/230/900/901), and the `.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md` notes an even larger set for s2t mode (650–655). Should the parent's spec commit to the PoC's handled subset first, the full `02_项目架构与技术栈.md` superset, or the per-mode superset from T01?

7. **B-通道 transport choice**: B-通道 latency (~1.5s claimed) depends on s2t mode + system audio loopback, but `02_项目架构与技术栈.md` L107 lists Mac loopback as "ScreenCaptureKit (12.0+) / 多输出设备+BlackHole" without committing to either, while `.scratch/macos-siminterpret-poc/map.md` T06 recommends ScreenCaptureKit with `excludesCurrentProcessAudio=true`. Does the parent's spec use ScreenCaptureKit from the start (modern, one tool), Multi-Output Device + BlackHole (proven in PoC's BlackHole install steps at `02_项目架构与技术栈.md` L497–524), or both with a runtime fallback?
