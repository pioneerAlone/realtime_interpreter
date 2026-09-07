# Round 3 Confirmations — D26–D29

> 4 user-confirmed decisions on 2026-09-07 from `/ask-matt` review of
> the v0 architecture diagram (`docs/architecture/v0-architecture.html`).
> D30 (voice-clone management) is pending a `/research` agent — see
> `docs/decisions/round-3-research-pending.md` for the open question.

## D26 — Architecture region label correction

**Problem raised by user**: `docs/architecture/v0-architecture.html`
shows the user-device region as "用户设备：Mac Studio M5 Max", but
the user's **primary dev/primary hardware is a MacBook Air M2**
(macOS 14.4.1). The spec drafts consistently say M2 MacBook Air
(`docs/spec/v0/00-overview.md` §2.1 F5, AC1, AC2, AC6, §3.2, §4.5
etc.) — only the architecture diagram was wrong.

**Confirmed by user**: label = "用户设备：MacBook Air M2 (dev/primary)".

- Mac Studio M5 Max (128 GB RAM, per `USER.md` runtime memory) is a
  future / secondary machine the user has purchased but is not the
  current development machine.
- All acceptance criteria (AC1–AC8) continue to be measured on M2 Air
  per existing spec text — no change to AC.
- **Edits**:
  - `docs/architecture/v0-architecture.json`: region label updated
  - `docs/architecture/v0-architecture.html`: re-render after JSON
    update via `archify deliver`

## D27 — Virtual sound card strategy: BlackHole 16ch + Aggregate Device

**Problem raised by user**: User asked why spec uses
"BlackHole 16ch + Aggregate" instead of the gold-标准 "BlackHole 2ch
+ VB-Cable" split-device approach.

**Confirmed by user**: stick with **BlackHole 16ch + Aggregate**.

Rationale per existing `docs/spec/v0/02-audio-pipeline.md`
Appendix A (committed in commit `6b8f281`):

1. **Aggregate Device channel上限 = sum of components**: a 2ch
   component caps the Aggregate at 2 channels; future 5.1/7.1
   meeting software is blocked.
2. **CoreAudio HAL internal buffer is 16/32ch native**: 2ch devices
   pay an extra SRC step adding 5-20 ms jitter.
3. **CPU/RAM delta < 1%** between 2ch and 16ch on M2 Air.
4. **One device, one install**: `brew install blackhole-16ch`
   once, never re-install. Aggregate Device is created via
   `/Applications/Utilities/Audio MIDI Setup` (UI step in
   `02-audio-pipeline.md` Appendix A.5).

- **Edits**: none required (spec already documents this; the
  user-confirmed answer is recorded here for traceability).

## D28 — Output sample rate: 48 kHz

**Problem raised by user**: Is 48 kHz playback to BlackHole the
mainstream choice?

**Confirmed by user**: 48 kHz is correct.

Rationale:

- macOS CoreAudio default sample rate is 48 kHz (matches USB audio
  interfaces and consumer DACs); this is the **macOS mainstream**.
- BlackHole's native rate is 48 kHz — playing at 48 kHz avoids an
  internal SRC step (which would add 5-20 ms jitter).
- Meeting software (Zoom/Teams/腾讯会议) auto-downsamples to
  16 kHz narrowband or 24 kHz wideband Opus — the parent project's
  playback rate does not need to match meeting software's internal
  rate.
- 44.1 kHz (CD red book) is the pro-audio standard but would force
  BlackHole to resample, wasting latency budget.

- **Edits**:
  - `docs/spec/v0/02-audio-pipeline.md` §7 (Sample rate handling):
    add explicit "Why 48 kHz" paragraph citing the above.
  - `docs/spec/v0/04-latency-budget.md` stage 9 row already cites
    "BlackHole 48 kHz native — avoid internal resample" — no change.
  - `docs/architecture/v0-architecture.json`: `bh_2ch` tag updated
    to call out the 48 kHz rationale.

## D29 — 原声直出 output device: user-configurable, default = physical headphones

**Problem raised by user**: 原声直出 currently hardcodes "physical
headphones" in the spec. User wants this configurable.

**Confirmed by user**: **default = physical headphones**, plus UI
dropdown listing all `cpal` enumerated output devices.

- The UI affordance (per existing `02-audio-pipeline.md` §8.3) is a
  tray menu toggle "原声直出 (Bypass)" with keyboard shortcut
  `Ctrl+Alt+P`. **Add a sub-dropdown** listing cpal output devices
  (headphones, MacBook speakers, virtual sound cards, etc.).
- Default selection: the system default output device at first
  install (typically physical headphones).
- Persisted across launches via `tauri-plugin-store` (already in
  `02-audio-pipeline.md` §3 dependencies).
- "Mute" option: present in the dropdown so users can choose to
  see subtitles without any audio output.

- **Edits**:
  - `docs/spec/v0/02-audio-pipeline.md` §8.3: add "Output device
    dropdown" paragraph.
  - `docs/spec/v0/03-b-channel-subtitle.md` §5.1: add "原声直出
    output device picker" reference.
  - `docs/architecture/v0-architecture.json`: `headphones` component
    updated to "原声直出端 (可配)" with tag explaining the picker.

## D30 — Voice-clone management strategy (PENDING RESEARCH)

**Problem raised by user**: "我想知道主流的音色 clone 方案是什么"

**Status**: pending a `/research` agent that investigates:

- Doubao 同传 2.0 zero-sample clone behavior (existing
  `poc-docs-take.md` §2.3 row "Zero-sample cloning with speaker_id=''")
- 4 mainstream voice-clone strategies used in production
  realtime-interp products (金喜, Doppelvoice, TransEcho, sokuji):
  cross-session persistence, per-session extract, speaker
  enrollment, voiceprint caching
- Reconnect stability per `poc-docs-take.md` §4.5 "重连漂移" risk
- Whether Doppelvoice's `speaker_id` cache approach (if any) is
  MIT-compatible
- v0 trade-offs: simplicity (per-session) vs UX (persistent)

The user wants to know the mainstream option before deciding. The
`/research` result will be written to
`docs/research/voice-clone-strategies.md` and D30 will be added to
this file once the user confirms.

## Summary of edit batch (4 confirmed + 1 pending)

| Decision | Edits applied |
|---|---|
| D26 region label | `docs/architecture/v0-architecture.json` + re-render HTML |
| D27 BH 16ch + Aggregate | none (already in spec) |
| D28 48 kHz rationale | `02-audio-pipeline.md` §7 + arch JSON |
| D29 bypass output device picker | `02-audio-pipeline.md` §8.3 + `03-b-channel-subtitle.md` §5.1 + arch JSON |
| D30 voice clone | pending `/research` |
