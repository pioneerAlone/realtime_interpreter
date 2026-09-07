# 04 · Latency Budget — v0 10-Stage Waterfall (≤3s first-sound)

> **Status**: DRAFT (round 2 of /grill-with-docs, 2026-09-06). Not committed to git yet.
> **Scope**: The locked v0 first-sound latency budget for the A-channel (R3) s2s path. Verbatim waterfall from `docs/research/latency-budget-v0.md` §2 with stage-by-stage Rust crate commitments (Appendix C), risk register (§4), recovery actions (Appendix B), v1 ≤2s cascade notes (§5), and integration test plan (Appendix D).
>
> All claims cite `docs/research/latency-budget-v0.md` and the upstream PoC docs / LiveInterpret 2.0 paper it pulls from. Items still requiring user confirmation are marked **[REVIEW]**.

---

## 1. v0 first-sound target

**Target**: **≤ 3000 ms** end-to-end on the A-channel s2s path (R3 outbound → my speaker), measured as the median of 5 runs on M2 Air wired cn-north network, **per user decision Q3.1-B on 2026-09-06** (`latency-budget-v0.md` §1.1).

This is **tighter** than the original `.scratch/macos-siminterpret-poc/map.md` L16 "v0 PoC ≤ 4 秒首音" because the user explicitly tightened it after the round-2 review. It is **looser** than the v1 ≤2 s target (`map.md` L17) and the v2 ≤1.3 s target (`map.md` L18) — both deferred.

**Soft at v0, hard at v0.5 (locked per decisions/round-2-confirmations.md D18)**: v0 ships even if the measured first-sound latency exceeds 3000 ms; the AC1 ≤ 3000 ms criterion is a **soft** acceptance criterion at v0, **hard** at v0.5. Recovery actions per §5 remain in scope but are ship-blocking only if AC1 misses by > 500 ms (the 4-device BlackHole misconfig is a more likely root cause than the latency budget itself). Optimization continues post-launch.

### 1.1 Why ≤3s for v0 (rationale)

Per `latency-budget-v0.md` §1.1: 金喜同声传译双通道版 (the closed-source competitor) reports ~1.3 s user-visible first-sound on the same 字节跳动 Seed LiveInterpret 2.0 / Doubao 同传 2.0 S2S backend (see `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md` §1; `15-jinxi-architecture-reverse.md` L70 cites "官方 2.21s 首字延迟 + ~1s 本地栈差量"). A 3.0–3.7 s v0 (the PoC's measurable baseline per `poc-docs-take.md` §4.1) is **non-competitive if shipped**, so the user tightened v0 to ≤3s to keep the door open for v1 to chase ≤2s (`latency-budget-v0.md` §1.1).

---

## 2. 10-stage waterfall

Verbatim from `latency-budget-v0.md` §2 (all citations and rationales from that document).

| # | Stage | Current (PoC) | v0 target | Δ (saved / added) | Optimization method | Risk if missed | Citation |
|---|---|---|---|---|---|---|---|
| 1 | Mic capture buffer (half of frame) | 40 ms (80 ms frame, `poc-docs-take.md` §3) | **10 ms** | −30 ms | `cpal` with `frame_size=960` samples @ 48 kHz = 20 ms frames (verify version at implementation time; `openless-take.md` L32 confirms `cpal 0.15`); capture on the Audio WorkQueue / CoreAudio HAL with 256-frame buffer. We send half the frame = 10 ms queuing delay | First-sound slips 30 ms and we can't recover. Mitigation: keep 40 ms frames as fallback if CoreAudio dropouts appear | `poc-docs-take.md` §3 ("Audio input spec") + §4.1 stage 1 |
| 2 | VAD / silence detect | ~0 ms (`poc-docs-take.md` §4.1 stage 2) | **0 ms** | 0 ms | `cpal` RMS tap + Silero-v5 with threshold 0.3 (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61). No queuing — VAD is a tap on the same stream, not a separate stage | none — PoC verified | `poc-docs-take.md` §4.1 stage 2 |
| 3 | Pre-processing (DN + AGC) | 0 ms (DN off, `poc-docs-take.md` §4.1 stage 3) | **5 ms** AGC only (DN off) | +5 ms | RNNoise via `rnnoise-rs` crate or simple peak-tracking AGC inline; skip DeepFilterNet at v0 (DeepFilterNet 100 ms cost not justified for `denoise=false` server-side). AGC: target −16 dBFS, attack 5 ms / release 100 ms, limiter −3 dBFS per `02_项目架构与技术栈.md` L118 | 0-sample cloning quality degrades if AGC over-clamps. Mitigation: limiter ceiling −3 dBFS, fall back to no AGC on first session | `poc-docs-take.md` §4.1 stage 3; `02_项目架构与技术栈.md` L118 |
| 4 | WebSocket uplink | 80 ms assumed (`poc-docs-take.md` §4.1 stage 4) | **50 ms** | −30 ms | `tokio-tungstenite` over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` (`poc-docs-take.md` §3 endpoint URL row); send binary Protobuf frames (no JSON); preconnect at app start + 30s keep-alive ping (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61) | cn-north region is the wired-net assumption; on wifi adds 20–50 ms. Mitigation: detect RTT > 200 ms (yellow) / > 500 ms (red) per `03_性能与成本分析.md` L100–102 and warn user | `poc-docs-take.md` §3 ("Doubao endpoint URL") + §4.1 stage 4 |
| 5 | **Doubao AST 2.0 S2S inference** | **2200 ms** (`poc-docs-take.md` §4.1 stage 5; `01_技术可行性报告.md` L274; official paper FLAL 2.53s, first-sound 2.21s) | **2100 ms** | −100 ms (model-side only) | Cannot reduce via engineering. The 100 ms comes from observing published FLAL 2.21s (`15-jinxi-architecture-reverse.md` L33) — use that as the optimistic floor. Risk: server can regress to 2400+ ms under load | **HARD CEILING.** If this exceeds 2400 ms, the entire ≤3s target is mathematically unreachable. Mitigation: v0 ships at 2400 ms = total 2.94s; v1 cascades (local ASR + S2T + local TTS) to break the ceiling | `poc-docs-take.md` §4.1 stage 5; `01_技术可行性报告.md` L274; `arXiv:2410.00037` (LiveInterpret 2.0 paper, FLAL row in §5 Table 9) |
| 6 | WebSocket downlink | 60 ms assumed (`poc-docs-take.md` §4.1 stage 6) | **40 ms** | −20 ms | Same `tokio-tungstenite` connection; first TTSResponse(352) chunk emits as soon as server has it — this is the *start* of audio, not the full sentence | Same risk as stage 4 (wifi adds 20–50 ms). Mitigation: shared RTT monitor across both directions | `poc-docs-take.md` §4.1 stage 6 |
| 7 | Jitter buffer + 蓄能 | 120 ms initial + 40–80 ms adaptive (`poc-docs-take.md` §4.1 stage 7; `01_技术可行性报告.md` L399) | **40 ms** initial + 20–40 ms adaptive | −40 to −60 ms | `cpal::Stream` callback pulls from `Arc<Mutex<VecDeque<i16>>>` ring; 40 ms initial fill avoids startup underrun, then drop to 20 ms and let adaptive algorithm expand to 40 ms when jitter > 20 ms detected (per `03_性能与成本分析.md` L89–105 design, adapted to Rust) | If 40 ms is too tight on M2 Air wifi, we get underrun clicks. Mitigation: bump initial to 60 ms (= 3000 ms total still holds because stages 1+8 dropped) | `poc-docs-take.md` §4.1 stage 7; `01_技术可行性报告.md` L399 |
| 8 | Opus stream decode | 200–500 ms (whole-sentence `soundfile`, `poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L407) | **5 ms** total (per-chunk, streaming) | −195 to −495 ms | `opus` crate (verify version at implementation time; current stable ≈ 0.3 — confirm at impl) with `Decoder::new(48000, Channel::Stereo)`; feed each TTSResponse(352) ogg_opus chunk immediately, do NOT wait for TTSSentenceEnd(351). OGG container parser: tiny inline (~50 LoC) using `ogg` crate or hand-rolled per Opus spec. Per-chunk decode is **the single biggest v0 savings**, ≈ 200–500 ms | **HIGHEST RISK.** If we can't parse ogg_opus chunks inline, fall back to `pyogg`-equivalent (`ogg` + `opus` crates reading whole OGG stream) and ship 200 ms extra — total still 3000 ms if stages 1+7 are tight | `poc-docs-take.md` §4.1 stage 8 + §6 "opus_decoder.py" row; `01_技术可行性报告.md` L407 |
| 9 | Virtual sound card playback | 40 ms BlackHole (`poc-docs-take.md` §4.1 stage 9) | **20 ms** | −20 ms | BlackHole 2ch R3 + Multi-Output Device (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44). Set BlackHole to 48 kHz native to avoid internal resample. `cpal::Stream::play` with buffer size = 256 frames = 5.3 ms; total playback latency = device buffer + CoreAudio HAL ≈ 20 ms | If BlackHole drops or driver latency regresses (BlackHole #793 per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44), must fall back to 40 ms. Mitigation: pre-flight topology check at app start (per `poc-docs-take.md` §7 "Pre-flight topology checker") | `poc-docs-take.md` §4.1 stage 9; `06-macos-audio-routing-options.md` L42, L44 |
| 10 | **End-to-end v0 total** | **3000–3700 ms** measured (`poc-docs-take.md` §4.1, ogg_opus path) | **≤ 3000 ms** | **0 to −700 ms** | Sum of stages 1–9 with stage 5 = 2100 ms | See stage 5 risk — it's the load-bearing assumption | `poc-docs-take.md` §4.1 |

### 2.1 v0 waterfall sum

Per `latency-budget-v0.md` §2.1: summing v0 targets: 10 + 0 + 5 + 50 + 2100 + 40 + 40 + 5 + 20 = **2270 ms** for the floor (best case). With stage 5 at its **load-bearing value of 2400 ms** (a realistic operating point for AST 2.0 under load): 10 + 0 + 5 + 50 + 2400 + 40 + 40 + 5 + 20 = **2570 ms**. **Both are ≤ 3000 ms with ~430–730 ms of margin.**

### 2.2 Stage-5 sensitivity

Per `latency-budget-v0.md` §2.2:

| Stage-5 value | Total | Headroom |
|---|---|---|
| 2100 ms (optimistic FLAL) | 2270 ms | 730 ms |
| 2200 ms (declared ceiling) | 2470 ms | 530 ms |
| 2400 ms (realistic under load) | 2570 ms | 430 ms |
| 2600 ms (bad day on cn-north) | 2770 ms | 230 ms — still under |
| **2730 ms** (first scenario that misses 3000) | 3000 ms | 0 ms — above any FLAL citation, but plausible under heavy load |

**Recovery options if stage 5 ever measures > 2400 ms in production** (per `latency-budget-v0.md` §2.2, none get more than ~50 ms back; the only structural fix is v1's cascade):

1. Drop capture frame from 20 ms → 40 ms — saves nothing, but cpal's larger buffer may be more stable.
2. Drop jitter buffer initial from 40 ms → 20 ms — saves 20 ms at risk of clicks.
3. Ship a v0.1 patch that uses server-side `denoise=true` (saves nothing but unblocks the user).

---

## 3. Risk register R1–R5

Verbatim from `latency-budget-v0.md` §4:

| # | Risk | Probability | Impact on budget | Mitigation |
|---|---|---|---|---|
| **R1** | **Stage 5 (S2S inference) regresses to ≥2730 ms** — the only stage that can mathematically blow the ≤3s budget. Server can hit cold-start, GC, or burst load. | Medium | +300 ms → total 3000 ms (no margin) | (a) Warmup probe at app start (saves ~100 ms cold-start — see stage 5); (b) display real-time RTT + "翻译端延迟" badge so user sees when it's bad; (c) auto-reconnect with fresh session if S2S p99 > 2400 ms; (d) **v1 cascade** (local ASR + S2T + local TTS) is the structural fix — see §5 |
| **R2** | **WiFi vs wired net** — stage 4+6 assume 50+40 ms (90 ms total cn-north); on home wifi RTT can be 100–200 ms | High in real deployments | +50–150 ms → may push total over 3000 ms | (a) Pre-flight RTT check at app start, warn if RTT > 150 ms; (b) compress TTSResponse payloads server-side (it's already ogg_opus, no win there) — mitigation is informational only at v0; (c) document "wired recommended" in user-facing setup guide |
| **R3** | **OGG demuxer for streaming TTSResponse chunks is custom Rust code** — the PoC used soundfile which handles OGG internally. If the demuxer is buggy (e.g. drops a packet or mis-splits a chunk), audio glitches force fallback to whole-sentence decode (+200 ms) | Medium | +200 ms → total ~2770 ms still ≤ 3000 ms but no margin | (a) Pre-flight: synthesize a 1s known-pattern ogg_opus stream from a local encoder and assert decoder output matches; (b) keep the soundfile whole-sentence fallback **compiled in** behind a feature flag; (c) integration test = play 1000 sentences and check no glitches |
| **R4** | **ScreenCaptureKit / BlackHole driver latency on M2 Air** — if BlackHole #793 (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44) regresses, stage 9 jumps from 20 ms to 40+ ms | Low–Medium | +20 ms → total still ≤ 3000 ms | (a) Pre-flight topology check rejects M-series where BlackHole doesn't enumerate (per `06-macos-audio-routing-options.md` L44 risk point); (b) document BlackHole 2ch v0.7.1+ requirement; (c) for v1: Process Tap (macOS 14.2+) or direct AVAudioEngine as alternative output |
| **R5** | **0-sample cloning "音色漂移" over a long session** — flagged by `01_技术可行性报告.md` L274–275 (cited `poc-docs-take.md` §1.2, §4.5). Not a latency risk per se, but if it triggers an auto-reconnect the new session's first ~200 ms is silence | Medium in ≥30-min sessions | +200 ms after reconnect | (a) Re-send the most recent 10s of user audio on reconnect (per `02_项目架构与技术栈.md` L131); (b) if reconnect happens, accept 300 ms first-sound on that one sentence; (c) instrument sessions to log drift so we can decide whether v1 needs to lock to a `speaker_id` early |

---

## 4. Per-stage Rust crate choices

Verbatim from `latency-budget-v0.md` Appendix C (all "verify version at impl" notes preserved):

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

---

## 5. Recovery actions if v0 measures > 3000 ms

Verbatim from `latency-budget-v0.md` Appendix B (in order of preference — saves the most ms per risk taken):

1. **If stage 5 is the culprit** (>2400 ms measured): no engineering recovery. Ship v0 with a "wired network recommended" warning; schedule v1 cascade.
2. **If stage 8 is the culprit** (OGG demuxer falls back to whole-sentence): ship v0 with `soundfile` fallback and accept 3200 ms target as v0.1; fix demuxer for v0.2.
3. **If stage 4+6 RTT is the culprit** (wifi too slow): ship v0 with a "网络延迟" indicator and recommend wired; pre-flight RTT > 150 ms → show banner.
4. **If stage 9 is the culprit** (BlackHole regression): bump to 40 ms, accept 3030 ms — over budget by 30 ms, schedule BlackHole investigation.
5. **Last resort**: drop capture frame from 20 ms to 10 ms (saves 5 ms — not worth the WS overhead), or drop jitter buffer to 20 ms initial (saves 20 ms — at risk of clicks).

---

## 6. v1 ≤2s path notes

Verbatim from `latency-budget-v0.md` §5. The ≤3s v0 budget is built on the assumption that **stage 5 (Doubao AST 2.0 S2S) is unbreakable**. v1's ≤2s target (`.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L56) requires breaking that ceiling by replacing the S2S single endpoint with a **cascade**:

- **Local ASR streaming** — `sherpa-onnx` Zipformer streaming (RTF 0.04–0.15 on M2, per `17-local-asr-macos-m2.md` referenced from `16-streaming-first-sound-optimization.md` L56) emits partial transcripts every ~300 ms.
- **Doubao AST 2.0 S2T** (R4 mode, ~1200 ms FLAL vs S2S's ~2200 ms — per `15-jinxi-architecture-reverse.md` L59) translates text-to-text, returning bilingual subtitles incrementally.
- **Local TTS** — CosyVoice 3 0.5B "150ms bi-streaming 首音" (per `16-streaming-first-sound-optimization.md` L56) speaks the translation to the meeting. No network round-trip for TTS output.

The cascade's first-sound = local ASR partial (~300 ms) + S2T inference (~1200 ms) + local TTS first-frame (~150 ms) ≈ **1650 ms worst case**, well under 2s. **Locked (per decisions/round-2-confirmations.md D19)**: the cascade is a **v1 ticket, not a v0 implementation seam**. v0 ships as cloud-only Doubao S2S + S2T (no local ASR/MT/TTS fallback at v0). The "v1 cascade interface seam" mentioned in `.scratch/macos-siminterpret-poc/map.md` L24 is deferred — v0 does not need to leave capture-frame-chunk / subtitle-stream / TTS-command interfaces specifically designed for cascade swap-in. The structural fix to break the S2S 2200 ms ceiling is v1's work.

---

## 7. Integration test plan

Verbatim from `latency-budget-v0.md` Appendix D. To prove each stage hits its v0 target, the following test plan is required (each test is one binary or one Cargo test):

1. **Stage 1 + 2 capture test**: feed a 1 kHz sine wave into the mic input (or `cpal` loopback), assert captured frames arrive in ≤12 ms wall-clock from synthesis.
2. **Stage 3 AGC test**: input a −30 dBFS sine wave, assert output is within ±1 dB of −16 dBFS after 200 ms.
3. **Stage 4+6 WS roundtrip test**: against a local `websocat` echo, measure RTT p50/p99 over 1000 pings.
4. **Stage 7 jitter test**: inject 5 simulated TTSResponse chunks with controlled timing, assert playback is glitch-free under the 40 ms initial fill.
5. **Stage 8 opus decode test**: encode 1s of test speech locally, send through the demuxer + `opus` decoder, assert PCM output matches the original within SNR > 40 dB. This is the **highest-risk test** because the demuxer is custom.
6. **Stage 9 playback test**: render a 1s 1 kHz tone through BlackHole, capture with ScreenCaptureKit (or a second `cpal` device), measure latency between synthesis and capture.
7. **End-to-end integration test**: play a 30s CN speech file → measure time from audio-out to first audible TTS in BlackHole. Assert ≤3000 ms on the wired cn-north network. **This is the canary.**

Per `poc-docs-take.md` §7 "Missing v0 feature: File-based regression test", this 7-test plan addresses a gap the PoC explicitly left open.

---

## 7.1 Stage-by-stage optimization rationale (excerpted from `latency-budget-v0.md` §3)

This subsection preserves the load-bearing rationale for each stage's optimization choice — pulled from `latency-budget-v0.md` §3 so the spec stands alone.

### Stage 1 — Mic capture (40 ms → 10 ms)

Use `cpal 0.15` (verified in `openless-take.md` L32) on the CoreAudio host. Configure `StreamConfig { channels: 1, sample_rate: 48000, buffer_size: cpal::BufferSize::Fixed(256) }` (256 frames @ 48 kHz = 5.3 ms hardware buffer). Send frames in 20 ms chunks (960 samples) over the WS; the queuing delay is half the frame = 10 ms. We deliberately do not use 10 ms frames because Opus packet loss / WS frame overhead starts to dominate below 20 ms. Rationale for 48 kHz capture (vs 16 kHz PoC): resampling at 16 kHz adds 1–2 ms and forces an extra step; Doubao accepts 16/24/48 kHz input per `02_项目架构与技术栈.md` L253 (rate is set in `source_audio`), so we send the rate header as 16000 and let the server resample. Decision is reversible — verify jitter impact at integration time.

### Stage 5 — Doubao AST 2.0 S2S inference (2200 ms → 2100 ms optimistic)

**Cannot engineer this lower.** The 2100 ms assumes the S2S endpoint delivers first TTS audio at FLAL 2.21s (per the published LiveInterpret 2.0 paper — `15-jinxi-architecture-reverse.md` L33 cites "字节 Seed 官方数据：S2S 首字延迟 2.21s"). We do NOT use `format=pcm` because the API doesn't honor it (`poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L408). **Mitigation**: at app start, send a 1-second "warmup probe" (synthetic audio + drop the response) so the S2S endpoint is warm by the time real speech arrives — this has helped other 金喜-derivative projects per `15-jinxi-architecture-reverse.md` L70 by ~100 ms.

### Stage 8 — Opus stream decode (200–500 ms → 5 ms)

**The v0 single biggest win.** Use the `opus` crate (verify version at impl; `opus` 0.3.x is current). `let mut dec = opus::Decoder::new(48000, opus::Channels::Stereo)?;` Feed each TTSResponse(352) ogg_opus chunk: strip the 2-byte `OpusHead` from the first packet of each sentence, then for each subsequent packet call `dec.decode(&packet, &mut pcm, false)` and push to the jitter buffer. Decode cost: ~0.06 ms per 20 ms packet (per `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61 citing `opuslib` 0.06ms/包 from `02_项目架构与技术栈.md` L185–207). Total per sentence: 5 chunks × 0.06 ms ≈ 0.3 ms; budgeted 5 ms for OGG demuxer overhead and first-packet warmup. **We do NOT use `soundfile`, `pyogg`, or any whole-sentence decoder.** `poc-docs-take.md` §4.1 + §6 row `opus_decoder.py` say the soundfile path adds 200–500 ms — eliminated at v0.

### Stage 9 — Virtual sound card playback (40 ms → 20 ms)

BlackHole 2ch R3 + Multi-Output Device (per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44). Configure BlackHole at **48 kHz native** to avoid internal resample (the PoC's playback sample-rate bug per `poc-docs-take.md` §1 was partly a 44.1/48 mismatch issue). `cpal::Stream::play` with `buffer_size: BufferSize::Fixed(256)` = 5.3 ms device buffer; total = device buffer + CoreAudio HAL latency ≈ 20 ms. **Pre-flight topology check** at app start (per `poc-docs-take.md` §7 "Pre-flight topology checker" gap) validates the BlackHole bus before user starts talking.

---

## 8. Where we have headroom vs where we're tight

Verbatim from `latency-budget-v0.md` §2.3:

- **Big headroom**: stage 8 (saved 195–495 ms — this is the single biggest v0 win). Stage 7 (saved 40–60 ms). Stage 1 (saved 30 ms).
- **Tight**: stage 5 (any regression > 300 ms misses the budget). Stage 4 (assumes wired cn-north; wifi can blow it).
- **Already at theoretical floor**: stage 2 (0 ms). Stage 9 (~20 ms is BlackHole's published floor).

---

## 9. Cumulative budget envelope

Verbatim from `latency-budget-v0.md` §1.5:

| Envelope | ms | Note |
|---|---|---|
| Hard ceiling (stage 5) | 2200 | cannot reduce via engineering at v0 |
| Engineering headroom (stages 1–4, 6–9) | ≤ 800 | everything not stage 5 must fit in 800 ms |
| **v0 total target** | **≤ 3000** | user decision 2026-09-06 |
| Engineering floor (theoretical) | ~200 | see `poc-docs-take.md` §4.1 quote "非推理环节已压缩到 ~400ms, 接近理论最优"; the 200 ms is the absolute lower bound across all 8 non-inference stages |

---

## 10. [REVIEW] decisions for this section

1. **Accept the 430–730 ms margin** at v0 (recommended: yes — both floor and realistic fit comfortably). Trade-off: accepting margin means we are not chasing the 1.3 s 金喜 target at v0 (deferred to v1/v2 per `map.md` L17–18).
2. **Commit to inline OGG demuxer (~1 dev-week, ~50 LoC)** at v0 vs shipping with the `pyogg`-equivalent whole-sentence decode path at v0.1 and adding the demuxer in v0.2 (per `latency-budget-v0.md` Appendix E decision 4). Recommended: ship with inline demuxer; fallback compiled in behind a feature flag per R3 mitigation.
3. **Commit to 48 kHz native BlackHole** (saves a resample step per `latency-budget-v0.md` §3 stage 9) — **requires the user to reinstall BlackHole at 48 kHz native** if their existing install is at a different rate. Verify this in the pre-flight topology checker.
4. **Pre-flight network check policy**: how aggressive? Options: (a) hard fail if RTT > 200 ms (yellow per `03_性能与成本分析.md` L100–102); (b) warn only; (c) user-configurable threshold. Recommended: (b) warn with banner + accept (do not block).
5. **Capture rate: 48 kHz vs 16 kHz** (per `latency-budget-v0.md` Appendix E decision 1). 48 kHz saves a resample step but sends `rate=16000` in Protobuf header — verify server accepts at integration time.

---

## Sources cited in this document

- `docs/research/latency-budget-v0.md` §1.1, §1.3, §1.4, §1.5, §2 (waterfall), §2.1 (sum), §2.2 (sensitivity), §3 (per-stage optimization), §4 (R1–R5), §5 (v1 path), Appendix B (recovery), Appendix C (Rust crates), Appendix D (test plan), Appendix E (decisions)
- `docs/research/poc-docs-take.md` §3, §4.1, §6 (ast_proto row, opus_decoder.py row), §7
- `docs/research/openless-take.md` L32, L148 (cpal 0.15)
- `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44 (BlackHole)
- `.scratch/macos-siminterpret-poc/issues/15-jinxi-architecture-reverse.md` L33, L59, L70 (FLAL 2.21s)
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L56, L61, L64 (per-stage optimizations + CosyVoice 3 150ms bi-streaming)
- `.scratch/macos-siminterpret-poc/issues/17-local-asr-macos-m2.md` (sherpa-onnx Zipformer)
- `.scratch/macos-siminterpret-poc/map.md` L16–18 (v0/v1/v2 latency targets), L24 ("代码里预留 v1 cascade 接口")
- Local-only reference: `01_技术可行性报告.md` L274–275, L399, L407; `02_项目架构与技术栈.md` L118, L131, L164; `03_性能与成本分析.md` L89–105, L100–102. Per `AGENTS.md` §"Local-only reference", paths only — no code copied.
- `arXiv:2410.00037` (LiveInterpret 2.0 paper, FLAL row in §5 Table 9 — cited via `.scratch/macos-siminterpret-poc/research/materials/24-s2s/`).
