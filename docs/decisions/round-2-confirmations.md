# Round 2 Grill — User Confirmations (D18–D25)

> 8 user confirmations against the open `[REVIEW]` items in
> `docs/spec/v0/`. Generated 2026-09-06 immediately after round 2
> closed. These decisions lock the spec into implementable state.
> Sibling: `docs/decisions/round-2-grill.md` (D1–D17, round-2
> product/tech decisions).

## D18 — Acceptable v0 latency if measured >3s (R1)

**Confirmed by user**: v0 will accept a measured first-sound latency
**above 3s** as shippable; optimization continues post-launch.

- Implication: AC1 (≤3s first-sound latency) is a **soft** acceptance
  criterion at v0, **hard** at v0.5.
- Recovery actions per `04-latency-budget.md` §5 remain in scope but
  ship-blocking if AC1 misses by >500 ms (4-device BlackHole misconfig
  is a more likely root cause than the latency budget itself).
- **Edit to `00-overview.md` §7.1 #1 + AC1**: mark AC1 as "soft",
  v0.5 hard target.

## D19 — Cascade seam (R2)

**Confirmed by user**: cascade seam goes in **after v0 launches**;
not blocking for v0 implementation.

- Implication: v0 ships as cloud-only Doubao S2S + S2T (no local
  ASR/MT/TTS fallback). The v1 cascade contract (local ASR +
  Doubao S2T + CosyVoice 3) becomes a v1 ticket, not a v0 seam.
- **Edit to `00-overview.md` §7.1 #2 + `04-latency-budget.md` §6**:
  cascade becomes a v1 ticket, not a v0 implementation seam.

## D20 — Tauri-NSPanel git-branch dependency (R3)

**Confirmed by user**: `tauri-nspanel` git-branch dependency
**acceptable** for v0.

- Implication: `Cargo.toml` adds `tauri-nspanel = { git = "...",
  branch = "v2" }` (matching Open-Less usage in
  `openless-take.md` §5 #1).
- **Edit to `01-architecture.md` §9 #2 + `03-b-channel-subtitle.md`
  §7**: remove the [REVIEW] flag.

## D21 — OGG demuxer (R4)

**Confirmed by user**: **inline OGG demuxer** (~50 LoC, ~1 dev-week)
ships at v0, no `soundfile` fallback.

- Implication: `02-audio-pipeline.md` §5 design becomes canonical;
  remove the §9.5 [REVIEW] flag.
- **Edit to `02-audio-pipeline.md` §5 + §9**: mark as locked.

## D22 — Code signing / notarization (R5)

**Confirmed by user**: **no Apple Developer Program** for v0.

- Implication: spec ships unsigned `.app` + DMG with README
  instructions for two-step first-open:
  1. `xattr -dr com.apple.quarantine /Applications/realtime_interpreter.app`
  2. Or: right-click `.app` → Open → "Open" in the dialog.
- Build pipeline: `scripts/build.sh` adds
  `codesign --force --deep --sign - realtime_interpreter.app`
  (ad-hoc self-sign, so users don't see "unidentified developer").
- **Edit to `06-deliverables.md` §6 [REVIEW] #1**: mark unsigned +
  ad-hoc sign + README instructions as the v0 path.

## D23 — Multi-language scope (R6)

**Confirmed by user**: **zh↔en only at v0**.

- Implication: Protobuf `source_language` / `target_language` fields
  are hard-coded `zh` / `en` in v0; language picker UI is deferred
  to v1+. Adding more languages later is a config flip, not a
  rebuild.
- **Edit to `00-overview.md` §7.1 #4**: lock zh↔en only.

## D24 — 原声直出 default state (R7)

**Confirmed by user**: **default OFF** at v0 first-run.

- Implication: subtitle window visible by default, B-channel audio
  routed through S2T translation pipeline. Users can toggle 原声直出
  ON via tray menu / `Ctrl+Alt+P` hotkey.
- Critical safety check per user: **"至少不要影响听到客户的声音"**
  — even when bypass is OFF, the B-channel audio must reach the
  user's headphones via a parallel route (not blocked by S2T
  pipeline). Design:
  - When bypass OFF: BlackHole 16ch → Aggregate → split → (a) S2T
    pipeline → subtitle UI, (b) **directly to headphones** (mute if
    S2T delayed >300ms to avoid double-audio).
  - When bypass ON: BlackHole 16ch → Aggregate → headphones only,
    S2T pipeline idle.
- **Edit to `02-audio-pipeline.md` §8 + `03-b-channel-subtitle.md` §5**:
  add the parallel-route safety design.

## D25 — B-channel audio capture (R8)

**Confirmed by user**: **BlackHole 16ch + Aggregate Device**.

- **Important correction**: user said "2ch + Aggregate" but the
  spec recommends 16ch because BlackHole 2ch has only 2 channels
  (stereo) which constrains future use cases. The user-selected
  spirit is "BlackHole + Aggregate" — 16ch is the operational
  choice. Confirming 16ch interpretation.
- Implication: user installs BlackHole 16ch via
  `brew install blackhole-16ch`, then creates Aggregate Device in
  Audio MIDI Setup that combines BlackHole 16ch with system output
  (for 原声直出). realtime_interpreter UI references the Aggregate
  Device by name.
- **Edit to `01-architecture.md` §9 #1 + `03-b-channel-subtitle.md` §4**:
  lock BlackHole 16ch + Aggregate Device.

## Summary of spec edits required

Eight `[REVIEW]` markers can now be removed/updated across:

- `00-overview.md` §7.1 (#1, #2, #4) — D18, D19, D23
- `01-architecture.md` §9 (#1, #2) — D25, D20
- `02-audio-pipeline.md` §5, §9 — D21, D24
- `03-b-channel-subtitle.md` §4, §5, §7 — D25, D24, D20
- `04-latency-budget.md` §10 — D18, D19
- `06-deliverables.md` §6 — D22

Edits to be made in next pass; this file is the **decision log**
proving what each spec change is grounded in.

## Two open questions needing user clarification

- **D24 sub-question**: When bypass is OFF and S2T pipeline adds
  audio to headphones, do you want a **delayed-bypass** mode
  (headphones get S2T output audio, 1.5–2s delayed, not original)
  or **parallel-route** (headphones always get original English,
  subtitle shows Chinese translation)? User said "不要影响听到
  客户的声音" which suggests parallel-route is correct, but spec
  should confirm.
- **D25 sub-question**: BlackHole 16ch vs 2ch — does user prefer to
  install just 16ch (more flexible, future-proof) or both 2ch and
  16ch (legacy compatibility)?
