## Goal

Land the standalone Rust latency-probe binary (`cargo run --bin latency-probe -- --iterations 5`) that runs the A-channel (and B-channel) end-to-end pipeline against pre-recorded audio and reports median first-sound latency across 5 iterations — so that AC1 (and AC2) acceptance is verifiable in CI and locally on M2 Air.

## Acceptance criteria

- **AC1 — A-channel first-sound ≤ 3000 ms median** (soft at v0 per D18, hard at v0.5). Verified by `cargo run --bin latency-probe -- --channel r3 --iterations 5` returning exit 0 + median ≤ 3000 ms on a correctly-wired M2 Air.
- **AC2 — B-channel first-subtitle ≤ 2500 ms median**. Verified by `cargo run --bin latency-probe -- --channel r4 --iterations 5` returning exit 0 + median ≤ 2500 ms.
- **Report shape**: binary prints structured output (median, p50, p99, per-run durations) suitable for both human reading and CI parsing.
- **Pre-recorded fixtures**: 30 s CN file (for R3) and 30 s EN file (for R4) bundled with the repo at known paths so the probe runs reproducibly.
- **Pass/fail exit code**: 0 on pass, 1 on fail with stderr detail.

## Implementation notes

- **Modules to be built**: `src-tauri/src/bin/latency-probe.rs` (standalone binary; per `06-deliverables.md` §3.2 — "Standalone Rust binary that plays a 30 s pre-recorded CN speech file, measures time from audio-out to first audible TTS in BlackHole, runs 5 times and reports median"), `src-tauri/tests/fixtures/{cn_30s.wav,en_30s.wav}` (bundled test fixtures), helper modules to (a) trigger the R3 / R4 session programmatically via `ipc/session::start_s2s` and `start_s2t`, (b) capture from BlackHole 2ch (R3 verification) or subscribe to `subtitle:append` events (R4 verification) and timestamp arrival, (c) compute median over the N iteration durations.
- **5-iteration median algorithm** (per `04-latency-budget.md` Appendix D test 7): collect 5 durations per run (not per session — the binary runs 5 sessions to amortize first-call cost), sort ascending, report the middle value (median). Also report p50 and p99 for diagnostic visibility.
- **CLI shape**: `cargo run --bin latency-probe -- --channel r3|r4 --iterations 5 --fixture <path> --threshold-ms 3000`. Exit 0 if median ≤ threshold, exit 1 otherwise; stderr carries the diff.
- **Reference decisions**: D8 (≤ 3 s first-sound target), D18 (AC1 soft at v0, hard at v0.5 — binary still reports the median; the "ship anyway" decision is human-driven, not binary-driven).
- **Spec cross-refs**: `04-latency-budget.md` §1.1 (≤ 3 s target) + Appendix D test 7 (end-to-end integration, 30 s CN speech file → measure audio-out arrival on BlackHole capture); `06-deliverables.md` §3.2 (binary deliverable description); `00-overview.md` §3.2 (per-AC measurement protocol — AC1, AC2, AC7 pass criteria).

## Test plan

Single acceptance seam — this ticket IS one of the seam tests. Verification path:
- Local: on M2 Air with the real R3/R4 pipeline (tickets #03, #04 complete), `cargo run --bin latency-probe -- --channel r3 --iterations 5` exits 0 with median ≤ 3000 ms. Repeat for `--channel r4` with ≤ 2500 ms.
- CI: a GitHub Actions job (macos-latest runner) runs the binary; however note that the CI runner is not M2 Air and may not have wired cn-north network — the CI run is informational (logs the median), not gating, because AC1 is soft at v0 (D18).
- Diagnostic: latency-probe output includes enough per-stage breakdown to identify which waterfall stage is over budget, by computing deltas from the structured `Subtitle` / `TTSResponse(352)` event timestamps.
- **30-min stability run** (AC7): a wrapper script `cargo run --bin latency-probe -- --duration 30m --window 5m` (or documented as a manual step) splits the run into 6 × 5-min windows and asserts the first-window median minus last-window median ≤ 500 ms.

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml + cpal/tokio-tungstenite deps).
- **Blocked by #03** (R3 audio pipeline assembled — without R3 the probe has no producer for the audio it captures).
- **Blocked by #04** (R4 audio pipeline assembled — without R4 the probe has no subtitle events to timestamp).
- **Blocked by #06** (topology-check binary must exist and return green before the probe can run).
- **Blocked by #08** (inline OGG demuxer — without it, the R3 path uses `soundfile` whole-sentence fallback which adds 200–500 ms and breaks the AC1 budget).
- **Blocked by #09** (2-header auth — probe must authenticate to Doubao).
- **Blocked by #10** (protobuf — probe must construct outbound frames).

## Out of scope for this ticket

- **Topology check implementation** — ticket #06.
- **OGG demuxer implementation** — ticket #08.
- **Self-meeting test implementation** — ticket #12 (latency-probe is for the single-channel measurement; self-meeting-test is for the dual-channel feedback-loop check).
- **Production observability / metrics export** — v1+ (out of scope per `06-deliverables.md` §5 — no telemetry at v0).
- **Network drop simulation** (`pfctl -e` rule for AC8) — separate script, not part of this binary.
