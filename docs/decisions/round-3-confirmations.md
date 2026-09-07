# Round 3 Confirmations — D26–D29 + D30 (FINAL)

> User-confirmed decisions from `/ask-matt` review of the v0
> architecture diagram (`docs/architecture/v0-architecture.html`)
> on 2026-09-07. All decisions now LOCKED.

## D26 — Architecture region label correction (LOCKED)

**Problem**: arch JSON said "Mac Studio M5 Max"; spec drafts said
M2 MacBook Air. User-confirmed label: "MacBook Air M2 (dev/primary)".

- All AC1–AC8 remain measured on M2 Air per existing spec text.
- **Edits applied**: `docs/architecture/v0-architecture.json` +
  re-render HTML (commits `741f1d8` + `89a76b0`).

## D27 — Virtual sound card: BlackHole 16ch + Aggregate Device (LOCKED)

**Confirmed**: stick with BH 16ch + Aggregate. Rationale in
`02-audio-pipeline.md` Appendix A.

- **No spec edits** (already documented).

## D28 — Output sample rate: 48 kHz (LOCKED)

**Confirmed**: 48 kHz. New "Why 48 kHz (vs 44.1 / 16)" paragraph in
`02-audio-pipeline.md` §7 (commit `741f1d8`).

## D29 — 原声直出 output device picker (LOCKED)

**Confirmed**: default = physical headphones, UI dropdown lists all
cpal output devices including "Mute". New paragraph in
`02-audio-pipeline.md` §8.3 + 4th bullet in `03-b-channel-subtitle.md`
§5.1 (commit `741f1d8`).

## D30 — Voice-clone management (LOCKED)

### D30-Q1: Strategy 1 only (zero-sample per-session)

**Confirmed**: v0 ships **Strategy 1 only**. `speaker_id=""` per
session, Doubao zero-sample clone from last 10s audio. No preset
flag, no user enrollment, no persistent voice_id.

- Rationale: matches industry de-facto (Doppelvoice MIT, sokuji AGPL,
  金喜 standard tier). 0 new lines vs PoC code path. Cross-session
  voice drift accepted as known issue (Doppelvoice CHANGELOG v0.2.2
  documents it). User voice identity in single sessions stable.
- **Edits**: spec already consistent (PoC design + ADR-0003).

### D30-Q2: denoise=false, no UI toggle (LOCKED — no spec edits)

**Confirmed**: v0 always sends `denoise=false` server-side. No UI
toggle. Zero-sample cloning quality > ambient noise reduction.

### D30-Q3: Reconnect strategy A + F (10s replay ring + exponential backoff)

**Confirmed**: ship **Strategy A + Strategy F together**.

- **Strategy A** (10s replay ring): crossbeam SPSC ring buffer holds
  last 10s of user audio; on reconnect, replay to API so it can
  re-extract voice profile from continuous audio. ~80-120 LoC Rust.
- **Strategy F** (exponential-backoff WS reconnect): 1s/2s/4s, max
  3 retries, reset counter on SessionStarted (avoids Doppelvoice
  30s lockout bug per CHANGELOG v0.2.2).
- **Acceptance criterion** (slots into `04-latency-budget.md`
  Appendix D test 7 network-drop variant): reconnect completes
  within ≤7s, next TTSResponse cosine voice-embedding similarity
  ≥0.85 to chunk emitted 5s before drop, no audio frames between
  drop and first post-reconnect chunk.
- **Strategy C (persistent voice_id cache)** verification: ≤1
  dev-day probe to grep `SessionStarted(150)` response for stable
  UUID; if present, C strictly beats A and should be promoted to
  v0.1.
- **Strategy D (parallel WS handoff)** and **E (full enrollment)**
  deferred to v1+.
- **Edits**: `04-latency-budget.md` Appendix D test 7 + issue #7
  test plan + issue #9 (#7 is latency-probe; #12 is self-meeting
  test which runs the AC7 reconnect variant).

### D30-Q4: README full privacy disclosure (LOCKED)

**Confirmed**: README has explicit "What data leaves your machine"
section:
- Your voice (R3 input audio) → Volcengine AST 2.0 servers, real-time
- 对方 voice (R4 input audio via BlackHole 16ch loopback) → same
- API key is the only credential sent (no device IDs, no analytics)
- No audio is stored to disk by realtime_interpreter (per issue #30)

- **Edits**: README to add the section (issue #30 / issue #22 task
  list).

## Edit batch summary (8 confirmed, 0 pending)

| Decision | Status | Edits |
|---|---|---|
| D26 region label | ✅ applied | arch JSON + HTML re-render |
| D27 BH 16ch | ✅ no edit needed | already in spec |
| D28 48 kHz | ✅ applied | 02-audio-pipeline.md §7 |
| D29 bypass picker | ✅ applied | 02-audio-pipeline.md §8.3 + 03-b-channel-subtitle.md §5.1 |
| D30-Q1 strategy | ✅ locked | spec already consistent |
| D30-Q2 denoise | ✅ locked | spec already consistent |
| D30-Q3 reconnect A+F | ✅ locked | 04-latency-budget.md Appendix D test 7 update |
| D30-Q4 privacy | ✅ locked | README "What data leaves your machine" |

## Lock state summary

**Round 1 (early):** none
**Round 2 (initial grill):** D1–D17 (17 product/tech decisions)
**Round 2 confirmations:** D18–D25 (8 follow-ups)
**Round 3 (architecture review):** D26–D30 (5 decisions, all locked)

**Total: 30 decisions locked** across 3 review rounds.
