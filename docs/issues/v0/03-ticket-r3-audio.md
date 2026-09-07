## Goal

Land the A-channel (R3) realtime s2s pipeline end-to-end on macOS — mic capture through Doubao AST 2.0 s2s inference to BlackHole 2ch playback in user's own voice — so that speaking Chinese produces English audio on BlackHole 2ch within the v0 latency budget.

## Acceptance criteria

- **AC1 — A-channel first-sound ≤ 3000 ms median** (soft at v0 per D18, hard at v0.5). Verified by `latency-probe` binary (ticket #07) playing a 30 s CN speech file through R3 and measuring audio-out arrival on BlackHole 2ch over 5 runs.
- **AC3 — Zero-sample voice cloning works without pre-enrollment** (`speaker_id=""` per D14 / ADR-0004 doctrine). Verified by the same self-meeting test (ticket #12): the captured R3 output should be English in a voice audibly similar to the input Chinese (subjective pass; CI does not assert voice similarity, just presence of English audio).
- **AC6 — Resource ceiling during 30-min run**: CPU ≤ 30% avg, RAM ≤ 400 MB. Verified by `top -pid $(pgrep realtime-interpreter)` over a 30-min sample run.
- **AC7 — Latency stability**: first vs last 5-minute window median drift ≤ 500 ms over a 30-min run. Verified by extended `latency-probe` run (per `00-overview.md` §3.2).
- **AC8 — Network resilience**: after a forced 3-second WS drop, the session auto-reconnects within ≤ 3 s of recovery and re-sends last 10 s of user audio as `speaker_id=""` warmup. Verified by `pfctl -e` rule + self-meeting test (ticket #12).

## Implementation notes

- **Modules to be built**: `src-tauri/src/audio/{capture,vad,agc,ring}.rs` (shared with R4 — same AGC/VAD module is reused), `src-tauri/src/audio/playback.rs` (R3 sink to BlackHole 2ch), `src-tauri/src/doubao/{client,s2s,event}.rs`, plus integration into the existing `ipc/session.rs` (`session::start_s2s` and `session::stop_s2s`).
- **Per-stage waterfall** (per `04-latency-budget.md` §2, owned modules named for each stage): stage 1 (capture, 10 ms, `cpal::Stream` with `BufferSize::Fixed(256)` at 48 kHz mono), stage 2 (VAD tap, 0 ms — Silero-v5 via `vad-rs` or inline RMS, threshold 0.3), stage 3 (AGC, 5 ms — inline peak tracker target −16 dBFS / attack 5 ms / release 100 ms / limiter −3 dBFS), stage 4 (uplink, 50 ms — `tokio-tungstenite` over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, binary Protobuf, 30 s keep-alive ping, preconnect at app start), stage 5 (cloud S2S inference, 2100 ms floor — no engineering control, only mitigation is 1 s warmup probe at app start), stage 6 (downlink, 40 ms — read `TTSResponse(352)` chunks as they arrive, do not wait for `TTSSentenceEnd(351)`), stage 7 (jitter ring, 40 ms initial 蓄能 + 20–40 ms adaptive — `Arc<tokio::sync::Mutex<VecDeque<i16>>>`), stage 8 (Opus stream decode, 5 ms — `opus` crate from ticket #08), stage 9 (playback, 20 ms — `cpal::Stream::play` to BlackHole 2ch at 48 kHz native, `BufferSize::Fixed(256)`).
- **Warmup probe at app start** (per `04-latency-budget.md` §3 stage 5): send a 1 s synthetic audio + drop the response so the S2S endpoint is warm before real speech arrives; saves ~100 ms cold-start per `15-jinxi-architecture-reverse.md` L70.
- **Auth headers** (2-header only per D12 / ADR-0003): `X-Api-Key` + `X-Api-Resource-Id`, sourced from macOS Keychain via the `config` module from ticket #09. Reject startup if API key is missing.
- **Reconnect logic** (AC8): exponential backoff 1 s / 2 s / 4 s, max 3 retries (per `poc-docs-take.md` §4.4). On reconnect, re-send cached last 10 s of user audio as `speaker_id=""` warmup (per `02_项目架构与技术栈.md` L131 cited `poc-docs-take.md` §4.5). Emit `device:lost` if BlackHole 2ch unplugged; pause and surface a banner — do NOT auto-recover (per `02-audio-pipeline.md` §6.1).
- **Reference decisions**: D8 (≤3 s target), D9 (inline OGG demuxer + `opus` crate, NOT `soundfile` — ticket #08 owns the demuxer), D10 (stage 5 hard ceiling), D11 (`cpal 0.15`), D12 (2-header auth), D14 (playback verified pattern), D17 (BlackHole 48 kHz native), D21 (inline demuxer canonical).
- **Spec cross-refs**: `02-audio-pipeline.md` §1 (R3 pipeline diagram + per-stage notes), `04-latency-budget.md` §2 (waterfall) + §3 (per-stage optimization rationale) + §4 (R1–R5 risks) + Appendix C (Rust crate choices), `01-architecture.md` §2 (process/thread model — cpal + tokio separation), §6 (IPC surface — `session::start_s2s` / `stop_s2s`).
- **Do NOT copy code** from `realtime_interpreter_Minimal_Implementation/` (git-ignored per AGENTS.md); only architectural patterns from `poc-docs-take.md` §3 (endpoint, auth, format, frame sizes).

## Test plan

Single acceptance seam. Per `04-latency-budget.md` Appendix D, the relevant tests are:
- Test #5 (opus decode SNR > 40 dB) — depended on by ticket #08 but verified again with the R3 stack assembled.
- Test #7 (end-to-end first-sound ≤ 3000 ms median over 5 runs) — primary acceptance for AC1.
- AC3 verified subjectively by the user's self-meeting test (ticket #12) pass.
- AC6, AC7 verified by a 30-min continuous sample run on M2 Air wired cn-north.
- AC8 verified by `pfctl -e` rule interrupting the WS for 3 s and observing auto-reconnect within 3 s + voice re-clone on next sentence.

## Dependencies

- **Blocked by #02** (Tauri shell + IPC barrel + Cargo.toml pinning + state.rs) — needs the Tauri builder + Zustand subtitle store skeleton + capability config.
- **Blocked by #08** (inline OGG demuxer) — stage 8 of the R3 waterfall needs the demuxer to feed `TTSResponse(352)` chunks into the `opus` decoder. This is the single biggest v0 win (D9) and the highest-risk integration test (Appendix D test #5).
- **Blocked by #09** (2-header auth) — without the auth module, R3 cannot open the Doubao WS.
- **Blocked by #10** (protobuf regeneration) — without typed Protobuf bindings for `TaskRequest(200)` / `TTSResponse(352)`, R3 cannot construct outbound frames or parse inbound events.
- **Blocked by #06** (pre-flight topology check) — by AC4 / R6 (device hot-swap), R3 must not start until topology is green.

## Out of scope for this ticket

- **B-channel (R4) s2t pipeline** — ticket #04.
- **Subtitle window UI / floating NSPanel UX** — ticket #05.
- **Topology check implementation details** — ticket #06 provides the binary; this ticket only consumes `topology::get_status`.
- **Standalone latency-probe binary** — ticket #07 wraps the A-channel pipeline into a CI-runnable binary.
- **Build pipeline + DMG + codesign** — ticket #13.
- **原声直出 (B-channel passthrough)** — ticket #11.
