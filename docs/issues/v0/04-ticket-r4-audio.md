## Goal

Land the B-channel (R4) realtime s2t pipeline end-to-end on macOS — BlackHole 16ch loopback capture through Doubao AST 2.0 s2t mode to bilingual subtitle events emitted over `app.emit("subtitle:append", …)` — so that English from the meeting arrives in the Zustand subtitle store within the B-channel latency budget.

## Acceptance criteria

- **AC2 — B-channel first-subtitle ≤ 2500 ms median** (per `00-overview.md` §3 + `06-deliverables.md` §3.4 AC8). Verified by the `latency-probe` binary (ticket #07) playing a pre-recorded 30 s EN file through R4 and measuring first-subtitle timestamp over 5 runs.
- **AC5 — Dual-channel self-meeting test passes**: R4 emits subtitle events 650/651/652 (SourceSubtitle) and 653/654/655 (TranslationSubtitle) concurrent with R3 producing English audio, with no feedback loop observable. Verified by self-meeting-test integration test (ticket #12).
- **No feedback loop on BlackHole wiring**: R4 input (BlackHole 16ch) is not the same VAC as R3 output (BlackHole 2ch). Verified by pre-flight topology check (ticket #06) at app start + on device-change event.

## Implementation notes

- **Modules to be built**: `src-tauri/src/audio/loopback.rs` (cpal loopback capture from BlackHole 16ch @ 48 kHz), `src-tauri/src/audio/resample.rs` (Rubato 48→16 kHz mono), `src-tauri/src/doubao/{s2t,event}.rs` (s2t-mode WS client + 650–655 event decoder), integration into `ipc/session.rs` (`session::start_s2t` / `session::stop_s2t`) and `ipc/subtitle.rs` (`subtitle::subscribe` registers webview listener for `subtitle:append`, `subtitle::get_recent` returns last N for capsule cold-start hydration).
- **Per-stage waterfall** (per `02-audio-pipeline.md` §2.2): stage 1 (B-channel capture, ~25 ms — cpal loopback + Rubato resample 48→16 kHz), stage 2 (AGC + VAD shared with R3, 5 ms), stage 3 (uplink, 50 ms — second `tokio-tungstenite` connection, same crate, mode=s2t, source=en, target=zh, `denoise=true` toggleable per `poc-docs-take.md` §5 Q16, `enableTts=false` per ADR-0008), stage 4 (Doubao S2T cloud inference, ~1200 ms FLAL per `15-jinxi-architecture-reverse.md` L59), stage 5 (downlink, 40 ms), stage 6 (Rust event decode, <1 ms — `doubao::event::Decoder` consumes the protobuf, correlates 650→651 and 653→654 by `id`), stage 7 (IPC emit, <5 ms — `app.emit("subtitle:append", &Subtitle)`), stage 8 (React re-render, <16 ms via Zustand ring append).
- **Event reconciliation** (per `03-b-channel-subtitle.md` §1.1 + D16): s2t emits 6 event types — 650 SourceSubtitleStart, 651 SourceSubtitleComplete, 652 SourceSubtitle (delta), 653 TranslationSubtitleStart, 654 TranslationSubtitleComplete, 655 TranslationSubtitle (delta). Same Rust process handles BOTH s2s events (100/150/200/351/352/999) AND s2t events (650–655) because R3 and R4 sessions run concurrently. Unknown events are logged, never silently dropped, never panicked (per D16).
- **Subtitle struct** (per `03-b-channel-subtitle.md` §1): `id: u64`, `timestamp_ms: i64`, `speaker: Speaker` (`Client | Unknown` only — v0 single-speaker assumption), `source_text: String`, `translation_text: String`, `is_final: bool`. Serialized directly by Tauri's event bus (no JSON wrapper).
- **Speaker ID**: all B-channel subtitles show `[Speaker]`; A-channel subtitles would show `[You]` but A-channel doesn't emit subtitle events in v0 (R3 is audio-only). No voiceprint identification at v0 (deferred to v1+ per `02_项目架构与技术栈.md` L241).
- **Reference decisions**: D1 (dual-channel), D3 (subtitle-only B-channel output, no R4 TTS 回灌), D8 (B-channel budget ≤ 2500 ms), D11 (`cpal 0.15`), D12 (2-header auth), D13 (BlackHole 16ch, NOT ScreenCaptureKit), D16 (event superset 100/150/200/351/352/650–655/999).
- **Spec cross-refs**: `02-audio-pipeline.md` §2 (R4 pipeline + per-stage notes + §4.1 BlackHole + Rubato precedent), `03-b-channel-subtitle.md` §1 (Subtitle schema) + §2 (window design, IPC contract) + §3 (subtitle streaming flow), `01-architecture.md` §5 (R4 data flow) + §6 (`ipc/subtitle.rs`).

## Test plan

Single acceptance seam. Per `04-latency-budget.md` Appendix D test 7 (end-to-end integration, adapted for B-channel first-subtitle) + `06-deliverables.md` §3.3 self-meeting acceptance test:
- AC2 verified by `latency-probe --mode s2t --iterations 5` over the pre-recorded 30 s EN file.
- AC5 verified by self-meeting-test (ticket #12): R4 emits subtitle events 650/651/652 + 653/654/655 within 1.5 s of speech start; no feedback loop observable.
- No-feedback-loop assertion: pre-flight topology check (ticket #06) returns green for BlackHole 16ch ≠ BlackHole 2ch.

## Dependencies

- **Blocked by #02** (Tauri shell + IPC barrel + Zustand subtitle store skeleton).
- **Blocked by #05** (subtitle window UI + NSPanel + Zustand subtitles store) — without the consumer of `subtitle:append`, R4 cannot demonstrate end-to-end behavior.
- **Blocked by #09** (2-header auth) — without the auth module, R4 cannot open the Doubao WS.
- **Blocked by #10** (protobuf regeneration) — without typed Protobuf bindings, R4 cannot parse events 650–655.
- **Blocked by #06** (pre-flight topology check) — AC4 / R6 (device hot-swap) requires topology check before R4 can start.

## Out of scope for this ticket

- **A-channel (R3) s2s pipeline** — ticket #03.
- **Subtitle window visual polish** (CSS, font size, 3 display modes) — ticket #05.
- **原声直出 toggle behavior + parallel-route safety design** — ticket #11.
- **Voiceprint-based speaker ID** — v1+ (out of scope per `02_项目架构与技术栈.md` L241).
