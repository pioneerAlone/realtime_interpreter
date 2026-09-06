# Round 2 Grill Decisions — 2026-09-06

> Source of truth for the parent project's v0 spec. This file is the
> **input** to `/to-spec` and the **authority** if runtime memory is lost
> or the session is interrupted. Treat as a decision log (ADR-lite,
> pre-formal ADR).

## Why this file exists

Round 2 of `/grill-with-docs` produced 12 product/tech decisions over
4 sub-rounds. Runtime memory was full when I tried to persist them, so
this file is the durable backup. All round-2 spec drafts
(`docs/spec/v0/00-overview.md` through `06-deliverables.md`) MUST
align with these decisions; if you want to change one, edit this file
first, then update the spec section.

## The 12 decisions (locked 2026-09-06)

### Top-level product shape

- **D1. Dual-channel v0 (R3 + R4)** — A-channel s2s (you speak → 对方
  hears English) AND B-channel s2t subtitle (对方 speaks → you see
  bilingual). User-confirmed via screenshot showing 金喜's 4-device
  wiring model.
- **D2. macOS-first, Windows deferred to v1+** — primary hardware is
  Mac Studio M5 Max; PoC ran on M2 MacBook Air; user-confirmed.
- **D3. B-channel output = subtitle only** — 对方 hears their own
  English (via A-channel BlackHole 2ch route to meeting software),
  you see bilingual subtitle on screen. No "B-channel translation
  回灌" mode at v0 (deferred).

### GUI stack

- **D4. Tauri 2 + React 18 + TypeScript 5.6 + Vite 6** — cross-platform
  requirement (Windows v1+), Open-Less precedent (Tauri 2.11 + React
  18 + TS 5.6 + Vite 6), 195 IPC commands pattern. Reject Electron
  (memory overhead, NAPI bridge complexity), reject SwiftUI native
  (Windows deferral impossible).
- **D5. State management = Zustand** — Open-Less uses plain React
  Context which doesn't scale past 20 commands; parent will exceed 20
  IPC handlers from day one (session / device / subtitle / topology /
  config / diagnostics).
- **D6. Open-Less borrowing = architecture + patterns ONLY, NO code**
  — top-level LICENSE is MIT but `openless-all/app/src-tauri/Cargo.toml:4`
  and `openless-all/app/crates/openless-core/Cargo.toml:4` are
  `AGPL-3.0-only`. Copying code would AGPL-contaminate the parent.
  Patterns adopted: `lib/ipc/<domain>.ts` + `index.ts` barrel,
  `lib/ipc/shared.ts` isTauri detection, multi-window tauri.conf.json,
  AudioBars 5-envelope level meter (visualization only).

### Language split

- **D7. Rust heavy + TS light** — audio I/O (`cpal 0.15`), opus
  decode (`opus` crate stream), Doubao WebSocket (`tokio-tungstenite`),
  protobuf (`prost`) all in Rust. ~20 `#[tauri::command]` handlers in
  Rust. Frontend is React + Zustand only. This matches Open-Less's
  195-IPC pattern.

### Latency

- **D8. v0 first-sound target = ≤3 seconds** — tightened from
  `map.md` ≤4s. Per-stage waterfall: 10 + 0 + 5 + 50 + 2100 + 40 +
  40 + 5 + 20 = 2270 ms (best) / 2570 ms (realistic). 430-730 ms
  margin under 3000 ms.
- **D9. Opus decode = `opus` crate stream decode** — replaces PoC's
  `soundfile` whole-sentence decode, saves 195-495 ms (single biggest
  v0 win). Requires custom OGG demuxer, no off-the-shelf crate
  verified (~1 dev-week).
- **D10. AST 2.0 S2S inference is HARD CEILING ~2200 ms** — cannot
  reduce via engineering; every other stage's optimization exists to
  give stage 5 headroom. Cascade (local ASR + Doubao S2T + local TTS)
  is v1's path to ≤2s.

### Audio backend specifics

- **D11. Audio backend = `cpal 0.15`** — Open-Less precedent,
  cross-platform consideration (Windows v1+).
- **D12. Auth scheme = 2-header only (`X-Api-Key` + `X-Api-Resource-Id`)** —
  PoC verified `01_技术可行性报告.md` L405-406. The 3-header scheme in
  `02_项目架构与技术栈.md` L128 is stale; no fallback in parent.
- **D13. B-channel audio capture = BlackHole virtual sound card (NOT
  ScreenCaptureKit)** — user-confirmed via Q10. Reason: 4-device
  wiring model (mic + BlackHole 2ch R3-out + BlackHole 16ch R4-loopback
  + headphones) + 原声直出 path. ScreenCaptureKit would prevent 原声
  直出 toggle and require macOS 12.4+ screen recording permission.

### Internal PoC contradictions reconciled

These are decisions that were implicit in the round-2 answers but
called out separately for spec clarity:

- **D14. Playback module = "verified" per `01_技术可行性报告.md`
  appendix L386**, NOT "调试中" per README status table. PoC's own
  internal contradiction resolved in favor of the verification result.
- **D15. Platform priority = macOS-first**, NOT "先 Windows 后 Mac"
  per `01_技术可行性报告.md` L345 / `02_项目架构与技术栈.md` L566.
  PoC docs were written for general audience; parent project targets
  Mac-only v0 per user's hardware reality.
- **D16. Event code schema = FULL superset** — handle 100/150/200/
  211/212/220/222/230/351/352/650-655/900/901/999. PoC source only
  handled a subset; parent must handle full superset because R4 s2t
  mode emits 650-655 events on the same WebSocket session.
- **D17. Sample rate = BlackHole 48kHz native** — PoC's playback
  bug (变调/杂音 per README L183) was partly a 44.1/48 mismatch.
  Parent must require user install BlackHole 48kHz-native.

## What this file is NOT

- Not a formal ADR (those go in `docs/adr/0001-…` etc.). This is the
  round-2 input log; ADRs will be derived from it during `/to-spec`.
- Not the spec itself (`docs/spec/v0/00-overview.md` etc. are).
- Not immutable — if you change a decision, edit this file first.

## Source documents (in repo)

- `docs/research/poc-docs-take.md` — PoC distillation, 309 lines
- `docs/research/openless-take.md` — Open-Less GUI take, 218 lines
- `docs/research/latency-budget-v0.md` — 10-stage waterfall, 203 lines
- `docs/spec/v0/00-overview.md` … `06-deliverables.md` — round-2 outputs
- `.scratch/macos-siminterpret-poc/map.md` — wayfinder destination

## Provenance

Generated 2026-09-06 in session, immediately after round-2 grill closed.
Decisions D1-D17 each cite the round-2 user message or research agent
finding that locked them.
