# Round 3 Confirmations — D26–D29 + partial D30

> User-confirmed decisions from `/ask-matt` review of the v0
> architecture diagram (`docs/architecture/v0-architecture.html`)
> on 2026-09-07. Updated 2026-09-07 with partial D30 lock.

## D26 — Architecture region label correction (LOCKED)

**Problem**: arch JSON said "Mac Studio M5 Max"; spec drafts said M2
MacBook Air. User-confirmed label: "MacBook Air M2 (dev/primary)".

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

## D30 — Voice-clone management (PARTIAL LOCK)

**Status on 2026-09-07**: research complete at
`docs/research/voice-clone-strategies.md` (3097 words, 4 strategies
taxonomy, 10+ primary sources). 4 sub-questions.

### D30-Q1: Strategy 1 only vs Strategy 1 + 3 CLI flag

**Not yet locked** — user asked: "我看有的方案支持音色卡槽，可以提前录制一段自己的音频呢，到底哪个方案好呢"

**Research needed**: detailed comparison of:
- Strategy 3 (preset `speaker_id` like `zh_female_vv_uranus_bigtts`)
- Strategy 4 (user-enrolled preset voice via 5-30s recording)
- Doubao AST 2.0 API capability for custom voice enrollment
- Industry products that ship Strategy 4 vs Strategy 1
- Cost / time / UX trade-offs

`/research` agent dispatched: see `docs/research/voice-clone-strategies.md`
for Strategy 1 vs 3 framing; pending extension covers Strategy 4.

### D30-Q2: denoise UI toggle — **LOCKED as default=false, UI not exposed**

**Confirmed**: v0 always sends `denoise=false` server-side; no UI
toggle. Reasoning: zero-sample cloning quality > ambient noise
reduction. Per `poc-docs-take.md` §3 row "Audio input spec" + ADR-0003.

- **Edits**: none required; this matches the existing spec.

### D30-Q3: Reconnect strategy — **PENDING RESEARCH**

**Not yet locked** — user asked: "有没有更好的方案"

**Research needed**: detailed comparison of:
- 10s replay ring buffer (per `poc-docs-take.md` §4.4 + §4.5)
- accept silence + re-sample (Doppelvoice current)
- partial-result continuation (server-side)
- seamless reconnect via parallel WS
- voiceprint caching strategies

`/research` agent dispatched to extend
`docs/research/voice-clone-strategies.md` with reconnect strategies
section.

### D30-Q4: Privacy disclosure — **LOCKED: full disclosure + "what data leaves your machine"**

**Confirmed**: README has explicit "What data leaves your machine"
section explaining that:
- Your voice (R3 input audio) → Volcengine AST 2.0 servers, real-time
- 对方 voice (R4 input audio via BlackHole 16ch loopback) → same
- API key is the only credential sent (no device IDs, no analytics)
- No audio is stored to disk by realtime_interpreter (per issue #30)
- Per `.scratch/macos-siminterpret-poc/issues/30-audio-privacy-defaults.md`

- **Edits**: `README.md` "What data leaves your machine" section
  (issue #30 / issue #22 task list).

## Edit batch summary (5 confirmed, 2 pending research)

| Decision | Status | Edits |
|---|---|---|
| D26 region label | ✅ applied | arch JSON + HTML re-render |
| D27 BH 16ch | ✅ no edit needed | already in spec |
| D28 48 kHz | ✅ applied | 02-audio-pipeline.md §7 |
| D29 bypass picker | ✅ applied | 02-audio-pipeline.md §8.3 + 03-b-channel-subtitle.md §5.1 |
| D30-Q2 denoise | ✅ no edit needed | already default=false |
| D30-Q4 privacy | ✅ applied (next pass) | README "What data leaves your machine" |
| D30-Q1 Strategy choice | ⏳ research | extension to voice-clone-strategies.md |
| D30-Q3 reconnect | ⏳ research | extension to voice-clone-strategies.md |
