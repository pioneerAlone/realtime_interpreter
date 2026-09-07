## Goal

Land the dual-channel self-meeting acceptance test — a Cargo integration test that spins up a fake "meeting" (cpal input → cpal output through BlackHole 2ch for R3; pre-recorded EN audio source via BlackHole 16ch loopback for R4), runs R3 + R4 concurrently for 60 s, and asserts all 5 acceptance checks pass — so that AC5 is verifiable in CI on every PR with no human in the loop.

## Acceptance criteria

- **AC5 — Dual-channel self-meeting test passes**: a 60 s automated dual-channel run with no audible feedback loop, both channels produce expected output, both channels within their latency budgets. Per `00-overview.md` §3 AC5 + `06-deliverables.md` §3.3.
- **AC2 — B-channel first-subtitle ≤ 2500 ms** (asserted in the same test): the R4 side emits subtitle events 650/651/652 + 653/654/655 within 1.5 s of speech start (with 1 s headroom for test-environment jitter).
- **AC8 — Network resilience** (asserted in an extended variant): after a forced 3-second WS drop (via `pfctl` rule or local proxy), the session auto-reconnects within ≤ 3 s of recovery and the voice re-clones on the next sentence (no manual restart).
- **Feedback-loop invariant**: during the 60 s test, the R3 output (BlackHole 2ch) is **never** captured into the R4 input (BlackHole 16ch). Asserted by the test setup: BlackHole 2ch and BlackHole 16ch are wired as distinct VACs; the test verifies the topology-check (ticket #06) returns green for this configuration.

## Implementation notes

- **Modules to be built**: `src-tauri/tests/self_meeting.rs` (Cargo integration test — runs via `cargo test --test self_meeting`); helper modules under `src-tauri/tests/common/` to spin up the fake meeting + capture devices + orchestrate R3 + R4 sessions programmatically.
- **Fake meeting** (per `06-deliverables.md` §3.3): a `cpal` input → `cpal` output loop through BlackHole 2ch simulates a meeting app that takes R3 audio as its mic input. A separate path uses BlackHole 16ch to play a pre-recorded EN file (the "other party") so the R4 loopback has something to translate. Both must run concurrently in the same test process.
- **5 acceptance assertions** (per `06-deliverables.md` §3.3 enumeration):
  1. R3 produces English audio on BlackHole 2ch within 3 s of CN input starting.
  2. R4 emits subtitle events 650/651/652 (SourceSubtitle) + 653/654/655 (TranslationSubtitle) within 1.5 s of EN input starting.
  3. R3 output captured from BlackHole 2ch contains English audio (not silence).
  4. R4 output (subtitle text via Zustand store hook) contains non-empty Chinese translation text.
  5. No feedback observable: a feedback detector (sum of R3 output level over the test window / R4 input level over the same window) stays below a threshold (or, more robustly: the BlackHole 16ch input during R3-only segments is at noise floor).
- **Network resilience variant**: `src-tauri/tests/self_meeting_network_drop.rs` (separate test) injects a 3 s pause in the WS traffic (via a `tokio::time::sleep` in the test's mock Doubao client, OR via a real `pfctl` rule if running locally with sudo), then resumes and asserts the session auto-reconnects + re-sends voice clone.
- **CI integration**: GitHub Actions job on `macos-latest` runner runs both tests; test output is logged (informational, not gating) because CI runners are not M2 Air with wired cn-north. Locally on M2 Air, the test is gating for release.
- **Reference decisions**: D3 (subtitle-only B-channel output, no R4 TTS 回灌), D8 (≤ 3 s first-sound target), D24 (parallel-route safety — the test must verify headphones can hear original English without delay when bypass is OFF).
- **Spec cross-refs**: `06-deliverables.md` §3.3 (Self-meeting acceptance test description + 5 assertions + CI integration); `00-overview.md` §3 AC5 (dual-channel self-meeting) + §3.2 (per-AC measurement protocol); `00-overview.md` §6 R6 (audio device changes mid-session — covered by hot-plug smoke in ticket #06, not duplicated here).

## Test plan

This ticket IS the test. Single acceptance seam. Verification path:
- Local on M2 Air: `cargo test --test self_meeting -- --ignored` (the `--ignored` flag because the test requires real BlackHole devices + a wired cn-north network to be meaningful; CI runs it but reports results informatively).
- CI on `macos-latest`: runs on every PR; logs the test output but does not gate merge (because the runner is not M2 Air).
- The network-drop variant: `cargo test --test self_meeting_network_drop -- --ignored` locally; CI may skip (it requires sudo or a mock Doubao client).
- Pre-flight check (ticket #06) must return green before this test starts; the test helper asserts `topology::check()` is green at setup.

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml + `cpal`/`tokio-tungstenite` test deps).
- **Blocked by #03** (R3 audio pipeline complete — the test exercises the assembled R3 path).
- **Blocked by #04** (R4 audio pipeline complete — the test exercises the assembled R4 path).
- **Blocked by #06** (pre-flight topology check — test setup asserts topology is green).
- **Blocked by #08** (inline OGG demuxer — without it R3 won't decode in streaming mode).
- **Blocked by #09** (2-header auth — test must authenticate against Doubao, or use a mock Doubao client that accepts the same 2-header handshake).
- **Blocked by #10** (protobuf bindings — test sends/receives typed frames).
- **Blocked by #11** (bypass routing — test verifies bypass toggle mid-test doesn't break the dual-channel invariant).

## Out of scope for this ticket

- **Single-channel latency measurement** — ticket #07 (latency-probe binary) handles AC1 / AC2 individually; this ticket handles the dual-channel feedback + concurrent behavior.
- **Topology-check binary** — ticket #06.
- **Long-running (30-min) stability test** (AC7) — a separate extended script, not part of this integration test (CI timeout concerns).
- **User-judgement voice similarity pass** (AC3 subjective) — not automatable; the self-meeting test only verifies presence of English audio, not that it sounds like the user.
- **Per-AC measurement scripts** in `00-overview.md` §3.2 — those are operational runbooks for the user, not automated tests.
