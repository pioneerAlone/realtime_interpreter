# Latency Waterfall — v0 Re-Budget (≤3s first-sound target)

> Scope: re-budget the per-stage latency waterfall for the parent project (`realtime_interpreter`), targeting **first-sound ≤ 3000 ms** end-to-end on the A-通道 s2s path (R3 outbound → my speaker). The PoC measured 3.0–3.7 s with `soundfile` whole-sentence opus decode and no local denoise (`poc-docs-take.md` §4.1). The parent project's Rust stack (`cpal` + `opus` crate stream decode + `tokio-tungstenite`) opens real headroom on stages 1, 4, 6, 7, 8, 9. Stage 5 (Doubao AST 2.0 S2S inference) is a **hard ceiling** at ~2200 ms per `poc-docs-take.md` §4.1 stage 5 and `01_技术可行性报告.md` L274 — it cannot be reduced by engineering alone.
>
> Citations use the form `poc-docs-take.md §X.Y` (the PoC take document this repo owns) and `01/02/03_*.md §X` (the underlying PoC docs, referenced via the take). External cites use a URL or `arXiv:NNNN.NNNNN`.

---

## 1. Background and constraints

### 1.1 Why ≤3s for v0 (user decision, 2026-09-06)

The destination product competes with 金喜同传双通道版, whose user-visible first-sound latency is ~1.3s end-to-end on the same 字节跳动 Seed LiveInterpret 2.0 / Doubao-同声传译 2.0 S2S backend (see `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md` §1; `15-jinxi-architecture-reverse.md` L70 cites "官方 2.21s 首字延迟 + ~1s 本地栈差量"). A 3.0–3.7s v0 is **non-competitive** if shipped, so the user tightened v0 to ≤3s on 2026-09-06 to keep the door open for v1 to chase ≤2s (see §5 below).

### 1.2 PoC measured baseline: 3.0–3.7s

`poc-docs-take.md` §4.1 cites `03_性能与成本分析.md` L78–79 row 1: "输出格式：ogg_opus → PCM | 3.0~3.7s → 2.6~2.9s | 300~800ms". The **2.6–2.9s number depends on `format=pcm`, which the API does not honor today** (per `01_技术可行性报告.md` L408: "PCM 输出格式 API 目前不生效: 必须用 ogg_opus, Doppelvoice 已知限制", cited in `poc-docs-take.md` §4.1). So the PoC's *measurable* baseline is **3.0–3.7s with `soundfile` whole-sentence opus decode + 120 ms 蓄能**, not 2.6–2.9s.

The 2.6–2.9s "budget" (`03_性能与成本分析.md` L30–42, reproduced verbatim in `poc-docs-take.md` §4.1 table) breaks down as: capture 40 + VAD 0 + DN+AGC 100 + uplink 80 + inference 2200 + downlink 60 + jitter 40–80 + BlackHole 40 = **2560–2620 ms claimed**. It is design-level, not measured, and three of those numbers are not what the PoC actually does in practice (DN=not integrated, opus decode=200–500 ms not 0 ms, jitter=120 ms initial not 40 ms). Net real cost: ~3.0–3.7s as above.

### 1.3 What changes between PoC and parent project (and why this budget is tighter)

| Item | PoC | Parent project v0 | Effect |
|---|---|---|---|
| Mic capture | `sounddevice` Python, PortAudio | `cpal 0.15` Rust (per `openless-take.md` L32, L148) | capture latency floor ↓ from ~80 ms → ~20 ms (CoreAudio HAL default 256 frames @ 48k = 5.3 ms — see `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61) |
| Frame size | 80 ms (2560 B @ 16 kHz, `poc-docs-take.md` §3 row "Audio input spec") | 20 ms (960 samples @ 48 kHz, or 320 @ 16 kHz) | per-frame queuing delay ↓ from 40 ms → 10 ms (half of frame) |
| Opus decode | `soundfile` whole-sentence, 200–500 ms (`poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L407) | `opus` crate stream decode, ~1 ms per chunk | stage 8 ↓ from 200–500 ms → ~5 ms total (multiple chunks per sentence) |
| WebSocket | Python `websockets` lib | `tokio-tungstenite` | head-of-line blocking avoided; uplink/downlink target ↓ 30 ms each |
| Jitter buffer | 120 ms 蓄能 + 40–80 ms adaptive (`poc-docs-take.md` §4.1 stage 7) | 40 ms initial + 20–40 ms adaptive | jitter ↓ 80–100 ms total |
| DN/AGC | not integrated (server `denoise=false` per `01_技术可行性报告.md` L400 + appendix, cited `poc-docs-take.md` §4.1) | DN off, AGC on (target −16 dBFS, `02_项目架构与技术栈.md` L118) | adds ~5 ms AGC, no DN cost |
| Virtual sound card | BlackHole 2ch (PoC-verified) | BlackHole 2ch R3 + Multi-Output Device (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44) | BlackHole is the bottleneck; can halve to ~20 ms with low-latency driver settings |

### 1.4 Hard constraint — Doubao AST 2.0 S2S inference ~2200 ms

`poc-docs-take.md` §4.1 stage 5 says the AST 2.0 s2s inference is "85% of total; flagged as '物理极限' at `01_技术可行性报告.md` L274; official paper FLAL 2.53s; **Cannot be reduced via engineering — only model upgrade (AST 3.0)**". The 2200 ms is **first-token-of-TTS-audio** measured at the S2S endpoint, *not* end-to-end (end-to-end first-sound is FLAL 2.21s + decode + playback). v0 must budget ≥2100 ms for stage 5; any headroom below that is wishful. The only structural way to break this ceiling is to **cascade** (local ASR + Doubao S2T + local TTS) — that's v1's job (see §5).

### 1.5 Cumulative budget envelope

| Envelope | ms | Note |
|---|---|---|
| Hard ceiling (stage 5) | 2200 | cannot reduce via engineering at v0 |
| Engineering headroom (stages 1–4, 6–9) | ≤ 800 | everything not stage 5 must fit in 800 ms |
| **v0 total target** | **≤ 3000** | user decision 2026-09-06 |
| Engineering floor (theoretical) | ~200 | see `poc-docs-take.md` §4.1 quote "非推理环节已压缩到 ~400ms, 接近理论最优"; the 200 ms is the absolute lower bound across all 8 non-inference stages |

---

## 2. Latency waterfall — v0 budget per stage

Columns: stage | current (PoC) | v0 target | delta | optimization method | risk if missed | citation.

| # | Stage | Current (PoC) | v0 target | Δ (saved / added) | Optimization method | Risk if missed | Citation |
|---|---|---|---|---|---|---|---|
| 1 | Mic capture buffer (half of frame) | 40 ms (80 ms frame, `poc-docs-take.md` §3) | **10 ms** | −30 ms | `cpal` with `frame_size=960` samples @ 48 kHz = 20 ms frames (verify version at implementation time; `openless-take.md` L32 confirms `cpal 0.15`); capture on the Audio WorkQueue / CoreAudio HAL with 256-frame buffer. We send half the frame = 10 ms queuing delay | First-sound slips 30 ms and we can't recover. Mitigation: keep 40 ms frames as fallback if CoreAudio dropouts appear | `poc-docs-take.md` §3 ("Audio input spec") + §4.1 stage 1 |
| 2 | VAD / silence detect | ~0 ms (`poc-docs-take.md` §4.1 stage 2) | **0 ms** | 0 ms | `cpal` RMS tap + Silero-v5 with threshold 0.3 (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61). No queuing — VAD is a tap on the same stream, not a separate stage | none — PoC verified | `poc-docs-take.md` §4.1 stage 2 |
| 3 | Pre-processing (DN + AGC) | 0 ms (DN off, `poc-docs-take.md` §4.1 stage 3) | **5 ms** AGC only (DN off) | +5 ms | RNNoise via `rnnoise-rs` crate or simple peak-tracking AGC inline; skip DeepFilterNet at v0 (DeepFilterNet 100 ms cost not justified for `denoise=false` server-side). AGC: target −16 dBFS, attack 5 ms / release 100 ms, limiter −3 dBFS per `02_项目架构与技术栈.md` L118 | 0-sample cloning quality degrades if AGC over-clamps. Mitigation: limiter ceiling −3 dBFS, fall back to no AGC on first session | `poc-docs-take.md` §4.1 stage 3; `02_项目架构与技术栈.md` L118 |
| 4 | WebSocket uplink | 80 ms assumed (`poc-docs-take.md` §4.1 stage 4) | **50 ms** | −30 ms | `tokio-tungstenite` over wss://openspeech.bytedance.com/api/v4/ast/v2/translate (`poc-docs-take.md` §3 endpoint URL row); send binary Protobuf frames (no JSON); preconnect at app start + 30s keep-alive ping (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61) | cn-north region is the wired-net assumption; on wifi adds 20–50 ms. Mitigation: detect RTT > 200 ms (yellow) / > 500 ms (red) per `03_性能与成本分析.md` L100–102 and warn user | `poc-docs-take.md` §3 ("Doubao endpoint URL") + §4.1 stage 4 |
| 5 | **Doubao AST 2.0 S2S inference** | **2200 ms** (`poc-docs-take.md` §4.1 stage 5; `01_技术可行性报告.md` L274; official paper FLAL 2.53s, first-sound 2.21s) | **2100 ms** | −100 ms (model-side only) | Cannot reduce via engineering. The 100 ms comes from observing published FLAL 2.21s (`15-jinxi-architecture-reverse.md` L33) — use that as the optimistic floor. Risk: server can regress to 2400+ ms under load | **HARD CEILING.** If this exceeds 2400 ms, the entire ≤3s target is mathematically unreachable. Mitigation: v0 ships at 2400 ms = total 2.94s; v1 cascades (local ASR + S2T + local TTS) to break the ceiling | `poc-docs-take.md` §4.1 stage 5; `01_技术可行性报告.md` L274; `arXiv:2410.00037` (LiveInterpret 2.0 paper, FLAL row in §5 Table 9) |
| 6 | WebSocket downlink | 60 ms assumed (`poc-docs-take.md` §4.1 stage 6) | **40 ms** | −20 ms | Same `tokio-tungstenite` connection; first TTSResponse(352) chunk emits as soon as server has it — this is the *start* of audio, not the full sentence | Same risk as stage 4 (wifi adds 20–50 ms). Mitigation: shared RTT monitor across both directions | `poc-docs-take.md` §4.1 stage 6 |
| 7 | Jitter buffer + 蓄能 | 120 ms initial + 40–80 ms adaptive (`poc-docs-take.md` §4.1 stage 7; `01_技术可行性报告.md` L399) | **40 ms** initial + 20–40 ms adaptive | −40 to −60 ms | `cpal::Stream` callback pulls from `Arc<Mutex<VecDeque<i16>>>` ring; 40 ms initial fill avoids startup underrun, then drop to 20 ms and let adaptive algorithm expand to 40 ms when jitter > 20 ms detected (per `03_性能与成本分析.md` L89–105 design, adapted to Rust) | If 40 ms is too tight on M2 Air wifi, we get underrun clicks. Mitigation: bump initial to 60 ms (= 3000 ms total still holds because stages 1+8 dropped) | `poc-docs-take.md` §4.1 stage 7; `01_技术可行性报告.md` L399 |
| 8 | Opus stream decode | 200–500 ms (whole-sentence `soundfile`, `poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L407) | **5 ms** total (per-chunk, streaming) | −195 to −495 ms | `opus` crate (verify version at implementation time; current stable ≈ 0.3 — confirm at impl) with `Decoder::new(48000, Channel::Stereo)`; feed each TTSResponse(352) ogg_opus chunk immediately, do NOT wait for TTSSentenceEnd(351). OGG container parser: tiny inline (~50 LoC) using `ogg` crate or hand-rolled per Opus spec. Per-chunk decode is **the single biggest v0 savings**, ≈ 200–500 ms | **HIGHEST RISK.** If we can't parse ogg_opus chunks inline, fall back to `pyogg`-equivalent (`ogg` + `opus` crates reading whole OGG stream) and ship 200 ms extra — total still 3000 ms if stages 1+7 are tight | `poc-docs-take.md` §4.1 stage 8 + §6 "opus_decoder.py" row; `01_技术可行性报告.md` L407 |
| 9 | Virtual sound card playback | 40 ms BlackHole (`poc-docs-take.md` §4.1 stage 9) | **20 ms** | −20 ms | BlackHole 2ch R3 + Multi-Output Device (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44). Set BlackHole to 48 kHz native to avoid internal resample. `cpal::Stream::play` with buffer size = 256 frames = 5.3 ms; total playback latency = device buffer + CoreAudio HAL ≈ 20 ms | If BlackHole drops or driver latency regresses (BlackHole #793 per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44), must fall back to 40 ms. Mitigation: pre-flight topology check at app start (per `poc-docs-take.md` §7 row "Pre-flight topology checker") | `poc-docs-take.md` §4.1 stage 9; `06-macos-audio-routing-options.md` L42, L44 |
| 10 | **End-to-end v0 total** | **3000–3700 ms** measured (`poc-docs-take.md` §4.1, ogg_opus path) | **≤ 3000 ms** | **0 to −700 ms** | Sum of stages 1–9 with stage 5 = 2100 ms | See stage 5 risk — it's the load-bearing assumption | `poc-docs-take.md` §4.1 |

### 2.1 v0 waterfall sum

Summing v0 targets: 10 + 0 + 5 + 50 + 2100 + 40 + 40 + 5 + 20 = **2270 ms** for the floor (best case), or with stage 5 at its **load-bearing value of 2400 ms** (a realistic operating point for AST 2.0 under load): 10 + 0 + 5 + 50 + 2400 + 40 + 40 + 5 + 20 = **2570 ms**. **Both are ≤ 3000 ms with ~430–730 ms of margin.**

### 2.2 Stage 5 sensitivity (the only stage that can blow the budget)

If stage 5 hits its **declared ceiling 2200 ms** (`poc-docs-take.md` §4.1 stage 5), total = 2470 ms (530 ms headroom). If it regresses to **2400 ms** (FLAL 2.21s + local overhead, observed by other 金喜-derivative projects per `15-jinxi-architecture-reverse.md` L70), total = 2570 ms (430 ms headroom). If it regresses to **2600 ms** (a bad day on cn-north region), total = 2770 ms (230 ms headroom) — still under. The **first scenario where we miss 3000 ms** is stage 5 ≥ 2730 ms, which is above any FLAL citation we have, but plausible under heavy load.

If stage 5 ever measures > 2400 ms in production, the recovery path is: (a) drop capture frame from 20 ms → 40 ms — saves nothing, but cpal's larger buffer may be more stable; (b) drop jitter buffer initial from 40 ms → 20 ms — saves 20 ms at risk of clicks; (c) ship a v0.1 patch that uses server-side denoise=true (saves nothing but unblocks the user). None of these gets us more than ~50 ms back. **The only structural fix is v1's cascade (§5).**

### 2.3 Where we have headroom vs. where we're tight

- **Big headroom**: stage 8 (saved 195–495 ms — this is the single biggest v0 win). Stage 7 (saved 40–60 ms). Stage 1 (saved 30 ms).
- **Tight**: stage 5 (any regression > 300 ms misses the budget). Stage 4 (assumes wired cn-north; wifi can blow it).
- **Already at theoretical floor**: stage 2 (0 ms). Stage 9 (~20 ms is BlackHole's published floor).

---

## 3. Stage-by-stage optimization choices for parent project

### Stage 1 — Mic capture (40 ms → 10 ms)
Use `cpal 0.15` (verified in `openless-take.md` L32) on the CoreAudio host. Configure `StreamConfig { channels: 1, sample_rate: 48000, buffer_size: cpal::BufferSize::Fixed(256) }` (256 frames @ 48 kHz = 5.3 ms hardware buffer). Send frames in 20 ms chunks (960 samples) over the WS; the queuing delay is half the frame = 10 ms. We deliberately do not use 10 ms frames because Opus packet loss / WS frame overhead starts to dominate below 20 ms. Rationale for 48 kHz capture (vs 16 kHz PoC): resampling at 16 kHz adds 1–2 ms and forces an extra step; Doubao accepts 16/24/48 kHz input per `02_项目架构与技术栈.md` L253 (rate is set in `source_audio`), so we send the rate header as 16000 and let the server resample. Decision is reversible — verify jitter impact at integration time.

### Stage 2 — VAD (0 ms — stays free)
Use Silero-v5 ONNX via `sherpa-onnx` Rust bindings with threshold 0.3 (lower than Silero default 0.5 to avoid cutting off soft speech — per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61). Run on the same `cpal` stream via `try_clone()` — no extra queuing. VAD controls **when we open/close mic frames** (静音 2 秒自动清空字幕 + 播放缓冲 per `01_技术可行性报告.md` L390, cited `poc-docs-take.md` §2) but does NOT add to first-sound latency when speech is present.

### Stage 3 — Pre-processing (0 ms → 5 ms AGC)
AGC only — server-side `denoise=false` (per `poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L400). We use a Rust port of WebRTC's gain controller (verify crate availability at impl; `webrtc-audio-processing` is the candidate) or a 30-line peak-tracking loop. Target −16 dBFS, attack 5 ms / release 100 ms, limiter at −3 dBFS — values from `02_项目架构与技术栈.md` L118. Cost: 5 ms on a 20 ms frame (single-pass, no lookahead). **Do not integrate DeepFilterNet at v0** — its 100 ms cost per `poc-docs-take.md` §4.1 stage 3 is unaffordable when stage 5 alone is 2100 ms.

### Stage 4 — Uplink (80 ms → 50 ms)
`tokio-tungstenite` (latest stable; verify at impl) over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` with **binary-only** Protobuf frames (no JSON wrapper) — endpoint per `poc-docs-take.md` §3 "Doubao endpoint URL". Two pre-flight optimizations from `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61: (a) preconnect the WS at Tauri app start, not on first user speech (saves the ~80 ms TLS handshake); (b) 30s keep-alive ping prevents the connection from going cold and getting reset by an LB. The remaining 50 ms is the cn-north wired-net RTT floor.

### Stage 5 — Doubao AST 2.0 S2S inference (2200 ms → 2100 ms optimistic)
**Cannot engineer this lower.** The 2100 ms assumes the S2S endpoint delivers first TTS audio at FLAL 2.21s (per the published LiveInterpret 2.0 paper — `15-jinxi-architecture-reverse.md` L33 cites "字节 Seed 官方数据：S2S 首字延迟 2.21s"). We do NOT use `format=pcm` because the API doesn't honor it (`poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L408). **Mitigation**: at app start, send a 1-second "warmup probe" (synthetic audio + drop the response) so the S2S endpoint is warm by the time real speech arrives — this has helped other 金喜-derivative projects per `15-jinxi-architecture-reverse.md` L70 by ~100 ms.

### Stage 6 — Downlink (60 ms → 40 ms)
Same `tokio-tungstenite` connection (shared RTT). We **read TTSResponse(352) chunks as they arrive** — we do NOT wait for TTSSentenceEnd(351) before feeding the decoder (this is the Stage 8 unlock). The 40 ms is the cn-north downlink RTT floor for the first packet.

### Stage 7 — Jitter buffer + 蓄能 (120 ms + 40–80 ms → 40 ms + 20–40 ms)
`cpal::Stream` output callback pulls from `Arc<tokio::sync::Mutex<VecDeque<i16>>>`. Initial fill = 40 ms (vs PoC's 120 ms per `01_技术可行性报告.md` L399, cited `poc-docs-take.md` §4.1). Adaptive: if RTT jitter > 20 ms expand to 40 ms; if jitter > 50 ms expand to 60 ms (per the algorithm in `03_性能与成本分析.md` L89–105). Rationale: stage 8 streams chunks every ~20 ms server-side, so we always have ~1 chunk ahead and 40 ms = 2 chunks of safety. The PoC's 120 ms was sized to absorb `soundfile` whole-sentence decode jitter — that jitter is gone in v0.

### Stage 8 — Opus stream decode (200–500 ms → 5 ms)
**The v0 single biggest win.** Use the `opus` crate (verify version at impl; `opus` 0.3.x is current). `let mut dec = opus::Decoder::new(48000, opus::Channels::Stereo)?;` Feed each TTSResponse(352) ogg_opus chunk: strip the 2-byte `OpusHead` from the first packet of each sentence, then for each subsequent packet call `dec.decode(&packet, &mut pcm, false)` and push to the jitter buffer. Decode cost: ~0.06 ms per 20 ms packet (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61 citing `opuslib` 0.06ms/包 from `02_项目架构与技术栈.md` L185–207). Total per sentence: 5 chunks × 0.06 ms ≈ 0.3 ms; budgeted 5 ms for OGG demuxer overhead and first-packet warmup. **We do NOT use `soundfile`, `pyogg`, or any whole-sentence decoder.** `poc-docs-take.md` §4.1 + §6 row `opus_decoder.py` say the soundfile path adds 200–500 ms — eliminated at v0.

### Stage 9 — Virtual sound card playback (40 ms → 20 ms)
BlackHole 2ch R3 + Multi-Output Device (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44). Configure BlackHole at **48 kHz native** to avoid internal resample (the PoC's playback sample-rate bug per `poc-docs-take.md` §1 was partly a 44.1/48 mismatch issue). `cpal::Stream::play` with `buffer_size: BufferSize::Fixed(256)` = 5.3 ms device buffer; total = device buffer + CoreAudio HAL latency ≈ 20 ms. **Pre-flight topology check** at app start (per `poc-docs-take.md` §7 "Pre-flight topology checker" gap) validates the BlackHole bus before user starts talking.

### Stage 10 — End-to-end
v0 ≤ 3000 ms with 230–730 ms of headroom over the 2100–2400 ms operating range of stage 5. The published 2.6–2.9s target (`poc-docs-take.md` §4.1) is met or beaten.

---

## 4. Open questions / risks

| # | Risk | Probability | Impact on budget | Mitigation |
|---|---|---|---|---|
| R1 | **Stage 5 (S2S inference) regresses to ≥2730 ms** — the only stage that can mathematically blow the ≤3s budget. Server can hit cold-start, GC, or burst load. | Medium | +300 ms → total 3000 ms (no margin) | (a) Warmup probe at app start (saves ~100 ms cold-start — see stage 5); (b) display real-time RTT + "翻译端延迟" badge so user sees when it's bad; (c) auto-reconnect with fresh session if S2S p99 > 2400 ms; (d) **v1 cascade** (local ASR + S2T + local TTS) is the structural fix — see §5 |
| R2 | **WiFi vs wired net** — stage 4+6 assume 50+40 ms (90 ms total cn-north); on home wifi RTT can be 100–200 ms | High in real deployments | +50–150 ms → may push total over 3000 ms | (a) Pre-flight RTT check at app start, warn if RTT > 150 ms; (b) compress TTSResponse payloads server-side (it's already ogg_opus, no win there) — mitigation is informational only at v0; (c) document "wired recommended" in user-facing setup guide |
| R3 | **OGG demuxer for streaming TTSResponse chunks is custom Rust code** — the PoC used soundfile which handles OGG internally. If the demuxer is buggy (e.g. drops a packet or mis-splits a chunk), audio glitches force fallback to whole-sentence decode (+200 ms) | Medium | +200 ms → total ~2770 ms still ≤ 3000 ms but no margin | (a) Pre-flight: synthesize a 1s known-pattern ogg_opus stream from a local encoder and assert decoder output matches; (b) keep the soundfile whole-sentence fallback **compiled in** behind a feature flag; (c) integration test = play 1000 sentences and check no glitches |
| R4 | **ScreenCaptureKit / BlackHole driver latency on M2 Air** — if BlackHole #793 (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44) regresses, stage 9 jumps from 20 ms to 40+ ms | Low–Medium | +20 ms → total still ≤ 3000 ms | (a) Pre-flight topology check rejects M-series where BlackHole doesn't enumerate (per `06-macos-audio-routing-options.md` L44 risk point); (b) document BlackHole 2ch v0.7.1+ requirement; (c) for v1: Process Tap (macOS 14.2+) or direct AVAudioEngine as alternative output |
| R5 | **0-sample cloning "音色漂移" over a long session** — flagged by `01_技术可行性报告.md` L274–275 (cited `poc-docs-take.md` §1.2, §4.5). Not a latency risk per se, but if it triggers an auto-reconnect the new session's first ~200 ms is silence | Medium in ≥30-min sessions | +200 ms after reconnect | (a) Re-send the most recent 10s of user audio on reconnect (per `02_项目架构与技术栈.md` L131); (b) if reconnect happens, accept 300 ms first-sound on that one sentence; (c) instrument sessions to log drift so we can decide whether v1 needs to lock to a `speaker_id` early |

---

## 5. v1 path notes (≤2s)

The ≤3s v0 budget is built on the assumption that **stage 5 (Doubao AST 2.0 S2S) is unbreakable**. v1's ≤2s target (`.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L56) requires breaking that ceiling by replacing the S2S single endpoint with a **cascade**:

- **Local ASR streaming** — `sherpa-onnx` Zipformer streaming (RTF 0.04–0.15 on M2, per `17-local-asr-macos-m2.md` referenced from `16-streaming-first-sound-optimization.md` L56) emits partial transcripts every ~300 ms.
- **Doubao AST 2.0 S2T** (R4 mode, ~1200 ms FLAL vs S2S's ~2200 ms — per `15-jinxi-architecture-reverse.md` L59) translates text-to-text, returning bilingual subtitles incrementally.
- **Local TTS** — CosyVoice 3 0.5B "150ms bi-streaming 首音" (per `16-streaming-first-sound-optimization.md` L56) speaks the translation to the meeting. No network round-trip for TTS output.

The cascade's first-sound = local ASR partial (~300 ms) + S2T inference (~1200 ms) + local TTS first-frame (~150 ms) ≈ **1650 ms worst case**, well under 2s. v0 must leave a **v1 cascade interface seam** in the architecture (capture frame chunk, subtitle stream, TTS command) per `.scratch/macos-siminterpret-poc/map.md` L24 ("代码里预留 v1 cascade 接口"). Detail deferred — this budget is v0 only.

---

## Appendix A — Sources cited in this budget

- `docs/research/poc-docs-take.md` — primary source; all § references are to this file
- `realtime_interpreter_Minimal_Implementation/01_技术可行性报告.md` — cited via `poc-docs-take.md`; key lines: L268–282 (验收标准), L274 (AST 物理极限), L326 (音色漂移 risk), L386–391 (playback buffer rewrite rows), L399 (蓄能 120ms), L407 (opus 整句解码 200–500ms), L408 (PCM 格式不生效), L413–419 (下一步)
- `realtime_interpreter_Minimal_Implementation/02_项目架构与技术栈.md` — cited via `poc-docs-take.md`; key lines: L92–94 (L2 services), L105 (B-通道 enableTts), L115–118 (A 通道 s2s + denoise=false + AGC), L128 (resource ID), L185–207 (5 Opus decoder options), L253 (audio format), L267–269 (auth headers), L272–288 (event codes), L313 (公版音色), L497–524 (BlackHole install)
- `realtime_interpreter_Minimal_Implementation/03_性能与成本分析.md` — cited via `poc-docs-take.md`; key lines: L11–42 (waterfall), L78–79 (ogg_opus vs PCM trade), L89–105 (Jitter Buffer adaptive algo), L100–102 (RTT 预警 thresholds), L122–129 (reconnect)
- `docs/research/openless-take.md` — Tauri/Rust stack reference; cpal 0.15 confirmed L32, L148
- `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44 — BlackHole + SCC recommendation
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L56, L61, L64 — 1.3s target architecture + per-stage optimizations
- `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md` L33, L59, L70 — published FLAL 2.21s + 金喜 architectural decomposition
- `arXiv:2410.00037` — LiveInterpret 2.0 paper (referenced via `.scratch/macos-siminterpret-poc/research/materials/24-s2s/`); FLAL 2.2s row in Table 9

## Appendix B — Recovery actions if v0 measures > 3000 ms

In order of preference (saves the most ms per risk taken):

1. **If stage 5 is the culprit** (>2400 ms measured): no engineering recovery. Ship v0 with a "wired network recommended" warning; schedule v1 cascade.
2. **If stage 8 is the culprit** (OGG demuxer falls back to whole-sentence): ship v0 with `soundfile` fallback and accept 3200 ms target as v0.1; fix demuxer for v0.2.
3. **If stage 4+6 RTT is the culprit** (wifi too slow): ship v0 with a "网络延迟" indicator and recommend wired; pre-flight RTT > 150 ms → show banner.
4. **If stage 9 is the culprit** (BlackHole regression): bump to 40 ms, accept 3030 ms — over budget by 30 ms, schedule BlackHole investigation.
5. **Last resort**: drop capture frame from 20 ms to 10 ms (saves 5 ms — not worth the WS overhead), or drop jitter buffer to 20 ms initial (saves 20 ms — at risk of clicks).

## Appendix C — Concrete Rust crate choices (verify versions at impl)

| Stage | Crate candidate | Why | Risk |
|---|---|---|---|
| 1 (capture) | `cpal 0.15` | Confirmed in `openless-take.md` L32, L148; cross-platform; supports CoreAudio on macOS | None — battle-tested |
| 2 (VAD) | `vad-rs` (Silero-v5 ONNX) or inline RMS via `cpal` tap | Per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61, Silero threshold 0.3 is the recommended config | Silero ONNX runtime adds ~30 MB binary; fallback to RMS if binary size matters |
| 3 (AGC) | Inline peak tracker OR `webrtc-audio-processing` Rust binding | WebRTC AGC is well-tuned; inline is ~30 LoC and zero-dep | WebRTC crate is not on crates.io as a first-class binding — verify at impl |
| 4+6 (WS) | `tokio-tungstenite 0.24.x` (verify at impl) | Tokio-native, binary frames, no JSON; same `tungstenite` library the PoC `02_项目架构与技术栈.md` L164 recommends for Node-side | None |
| 5 (S2S) | n/a — HTTP/WS only | This is a server-side model; no client crate | Server-side latency is uncontrollable |
| 7 (jitter ring) | `tokio::sync::Mutex<VecDeque<i16>>` wrapped in `Arc` | Standard Rust async pattern; PoC's `bytearray + threading.Lock` (Python, `poc-docs-take.md` §2) ports 1:1 to `VecDeque<i16> + Mutex` (Rust) | None |
| 8 (opus decode) | `opus 0.3.x` + `ogg 0.x` (verify at impl) | Pure Rust decode, ~0.06 ms per 20 ms packet per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61 | OGG demuxer is custom code; main risk |
| 9 (playback) | `cpal 0.15` (same crate as capture) | `cpal::Stream::play` to BlackHole 2ch device | BlackHole driver latency on M-series (R4 above) |
| Protobuf | `prost 0.13.x` + `tonic 0.12.x` (verify at impl) | PoC bindings are Python; parent needs to regenerate `.proto` → Rust (per `poc-docs-take.md` §6 "ast_proto/" row — "re-emit `.proto` and regenerate bindings in target language") | Requires the original `.proto` source from Doppelvoice (not in PoC repo per `poc-docs-take.md` §7 "What the PoC does not contain") |

## Appendix D — Integration test plan for stage budget validation

To prove each stage hits its v0 target, the following test plan is required (each test is one binary or one Cargo test):

1. **Stage 1 + 2 capture test**: feed a 1 kHz sine wave into the mic input (or `cpal` loopback), assert captured frames arrive in ≤12 ms wall-clock from synthesis.
2. **Stage 3 AGC test**: input a −30 dBFS sine wave, assert output is within ±1 dB of −16 dBFS after 200 ms.
3. **Stage 4+6 WS roundtrip test**: against a local `websocat` echo, measure RTT p50/p99 over 1000 pings.
4. **Stage 7 jitter test**: inject 5 simulated TTSResponse chunks with controlled timing, assert playback is glitch-free under the 40 ms initial fill.
5. **Stage 8 opus decode test**: encode 1s of test speech locally, send through the demuxer + `opus` decoder, assert PCM output matches the original within SNR > 40 dB. This is the **highest-risk test** because the demuxer is custom.
6. **Stage 9 playback test**: render a 1s 1 kHz tone through BlackHole, capture with ScreenCaptureKit (or a second `cpal` device), measure latency between synthesis and capture.
7. **End-to-end integration test**: play a 30s CN speech file → measure time from audio-out to first audible TTS in BlackHole. Assert ≤3000 ms on the wired cn-north network. **This is the canary.**

Per `poc-docs-take.md` §7 "Missing v0 feature: File-based regression test", this 7-test plan addresses a gap the PoC explicitly left open.

## Appendix E — Decisions that need user confirmation before locking v0

These are the open decisions surfaced by this budget that affect implementation start:

1. **Capture rate**: 48 kHz native (recommended in this budget, stage 1) vs 16 kHz direct (matches PoC `poc-docs-take.md` §3). 48 kHz saves a resample step but means we send `rate=16000` in the Protobuf header and let the server resample — verify server accepts this.
2. **OGG demuxer location**: inline (~50 LoC) vs separate `opus-ogg-demux` crate (verify availability at impl). Inline keeps binary lean; crate saves dev time. Cost of inline: ~2 dev days.
3. **Stage 7 initial fill 40 ms vs 60 ms**: 40 ms is tighter on click risk on wifi. 60 ms is safer but uses 20 ms of budget. The right answer depends on which market we ship to first (home wifi vs office wired).
4. **Whether to ship a v0.0.1 with `soundfile` fallback** if the OGG demuxer is not ready by integration-test deadline. Pros: faster ship, lower first-sound risk. Cons: 200 ms slower, makes the 3s budget tight.
5. **Whether the preconnect-at-app-start optimization** (stage 4) costs anything on the user-visible cold-start time of the Tauri app. It does — TLS handshake is ~80 ms but happens during splash screen so user doesn't notice. Confirm acceptable.

---

(End of document)
