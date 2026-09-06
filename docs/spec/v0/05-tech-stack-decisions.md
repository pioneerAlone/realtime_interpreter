# 05 · Tech-Stack Decisions (ADR-lite)

> **Status**: DRAFT (round 2 of /grill-with-docs, 2026-09-06). Not committed to git yet.
> **Scope**: Lightweight Architecture Decision Records (ADR) for the v0 stack. Each ADR follows: decision / date / context / consequences. One subsection per decision.
>
> All claims cite `docs/research/poc-docs-take.md`, `docs/research/openless-take.md`, `docs/research/latency-budget-v0.md`, or `.scratch/macos-siminterpret-poc/*` — see inline parentheticals. Items still requiring user confirmation are marked **[REVIEW]**.

---

## ADR-0001 — GUI framework = Tauri 2 + React 18 (NOT Electron, NOT SwiftUI native)

- **Date**: 2026-09-06 (round 2)
- **Status**: Accepted
- **Context**: Need a cross-platform desktop shell that is small, fast, and integrates with native macOS audio APIs (cpal, BlackHole, NSPanel). User decision Q2 (per round 2 lock): cross-platform requirement (Mac-first v0, Windows v1+ per Q4).
- **Decision**: **Tauri 2.11 + React 18.3 + TypeScript 5.6 + Vite 6** (`openless-take.md` L22–24 + L49).
- **Consequences**:
  - (+) Same shell pattern Open-Less uses (195 `#[tauri::command]` handlers — `openless-take.md` L139), battle-tested on macOS + Windows.
  - (+) Smaller bundle than Electron (no Chromium).
  - (+) React + TS frontend is the dominant desktop-app stack; hiring pool is wide.
  - (−) Tauri version pinning is paranoid (`openless-take.md` §2 "How the GUI + native split is structured") — `tauri ~2.11` is forced.
  - (−) Per-platform `tauri.conf.json` overrides required (`openless-take.md` §2 — 4 separate configs).
  - (−) `tauri-plugin-shell` has CRITICAL CVE — must pin to exactly `2.3.5` (`openless-take.md` §4 gotcha 8).
- **Rejected alternatives**: Electron (heavy bundle, Chromium duplication); SwiftUI native (kills cross-platform requirement, locks out Windows v1+).

---

## ADR-0002 — Backend language = Rust heavy + TypeScript light

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: Audio pipeline is performance-sensitive (20 ms frame budget; cpal callbacks; Opus decode). User decision Q8-A1: single-language stack principle.
- **Decision**: **Rust for all hot-path code** (audio, Doubao WS, Opus decode, ring buffer, AGC, VAD); **TypeScript only for UI + IPC wrappers** (`openless-take.md` §1 frontend stack).
- **Consequences**:
  - (+) One language for audio + IPC + business logic = no FFI boundary to debug.
  - (+) `openless-core` framework-agnostic Rust crate pattern (`openless-take.md` §6 pattern #1) lets us reuse business logic if we add a CLI or alternate shell later.
  - (−) Steeper learning curve for contributors coming from the Electron/JS world.
  - (−) Some libs are less mature than Node equivalents (e.g. `tokio-tungstenite` vs Node `ws` 8+ — per `poc-docs-take.md` §7 row "ws 8+ Node.js WebSocket client").
- **Rejected alternatives**: Python (PoC's choice — GIL-bound, slow); Node.js (audio pipeline suffers); C++ (no package ecosystem).

---

## ADR-0003 — Auth scheme = X-Api-Key + X-Api-Resource-Id (2-header only, NO fallback to 3-header)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: PoC verifies empirically that **2-header `X-Api-Key` + `X-Api-Resource-Id` works**, and **API Key must come from 语音控制台 (not 方舟控制台)** (`poc-docs-take.md` §3 row "Auth scheme" + `01_技术可行性报告.md` L405–406).
- **Decision**: v0 uses **only the 2-header scheme**. The 3-header scheme (`X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id`) is **explicitly NOT supported** — even though `02_项目架构与技术栈.md` L128 still lists it (a stale doc row that contradicts the appendix).
- **Consequences**:
  - (+) Single, proven auth path. No code complexity for a never-used fallback.
  - (+) Forces users to the right console (语音控制台), reducing onboarding friction.
  - (−) If 字节跳动 ever deprecates the 2-header scheme, we have a hard migration. Mitigation: code is small, change is local.
- **Document discrepancy resolved**: `02_项目架构与技术栈.md` L267–269 still lists the 3-header scheme as if canonical — per `poc-docs-take.md` §3, the appendix's verification result supersedes the stale row.

---

## ADR-0004 — Opus decode = `opus` crate stream decode (NOT `soundfile` whole-sentence)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: PoC's `opus_decoder.py` uses `soundfile` (`libsndfile`), accumulates `TTSResponse(352)` chunks until `TTSSentenceEnd(351)`, then whole-sentence decodes — adds 200–500 ms (`poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L407 row "Opus解码"). User decision Q8: stream decode.
- **Decision**: **Rust `opus` crate (verify 0.3.x at impl) with custom OGG demuxer** — per-chunk decode ≈ 0.06 ms / 20 ms packet (`latency-budget-v0.md` §3 stage 8 + `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61).
- **Consequences**:
  - (+) Saves **195–495 ms** vs the PoC's whole-sentence decode — the single biggest v0 win (`latency-budget-v0.md` §2.3).
  - (+) Custom OGG demuxer is ~50 LoC inline (~2 dev days) — small, contained risk (`latency-budget-v0.md` Appendix E decision 2).
  - (−) HIGHEST RISK per `latency-budget-v0.md` §4 R3 — custom Rust demuxer has no off-the-shelf equivalent. Mitigation: keep `soundfile`-equivalent whole-sentence path **compiled in behind a feature flag** for v0.1 fallback.
  - (−) OGG demuxer bugs would manifest as audio glitches → fallback to whole-sentence (+200 ms; still ≤3000 ms).

---

## ADR-0005 — Audio backend = `cpal 0.15` (NOT CoreAudio direct)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: Open-Less uses `cpal 0.15` successfully on macOS + Windows (`openless-take.md` L32, L148). Direct CoreAudio bindings would lock us out of Windows v1+.
- **Decision**: **`cpal 0.15`** for both mic capture (R3 source, R4 loopback) and playback (R3 sink to BlackHole).
- **Consequences**:
  - (+) Cross-platform; Windows v1+ requires zero audio code changes.
  - (+) Battle-tested in Open-Less production.
  - (−) B-channel system audio loopback on Windows v1+ needs WASAPI bindings (cpal does not provide this cross-platform — per `openless-take.md` §6 "Things to NOT copy" item 3). Deferred to v1.
  - (−) cpal does not provide per-device change callbacks on all platforms — `coreaudio-sys 0.2` direct binding needed for hot-plug (`openless-take.md` §4 gotcha 3). v0 adds this binding alongside cpal.
- **Rejected alternative**: CoreAudio direct via `coreaudio-rs` — locks us to macOS, blocks Windows v1+.

---

## ADR-0006 — Doubao protocol = `prost`-generated Rust (NOT `protobufjs` in TS)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: ADR-0002 commits to Rust-heavy stack. PoC uses Python bindings ported from Doppelvoice (MIT — per `poc-docs-take.md` §6 "ast_proto/" row).
- **Decision**: **`prost 0.13.x` + `tonic 0.12.x`** (verify versions at impl per `latency-budget-v0.md` Appendix C "Protobuf" row) — re-emit the `.proto` schema and regenerate bindings in Rust. The `.proto` source must be obtained from Doppelvoice (per `poc-docs-take.md` §7 "What the PoC does not contain").
- **Consequences**:
  - (+) Single-language binding — no FFI.
  - (+) `prost` is the de-facto Rust protobuf crate.
  - (−) Requires the original `.proto` file (not in the PoC repo per `poc-docs-take.md` §7). Action: obtain from Doppelvoice repo (MIT) or write from the Wire-compatible binary schema.
  - (−) License: Doppelvoice is MIT — we can copy the `.proto` source with copyright preserved (`poc-docs-take.md` §6 row).

---

## ADR-0007 — B-channel transport = BlackHole virtual sound card (NOT ScreenCaptureKit)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: User Q10 decision + screenshot (4-device wiring is the parent's UX model). TransEcho uses ScreenCaptureKit (`.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md`).
- **Decision**: **BlackHole 16ch as the meeting software's output device** + cpal loopback capture. Rejects ScreenCaptureKit for v0 (see `docs/spec/v0/03-b-channel-subtitle.md` §4.1 for rationale).
- **Consequences**:
  - (+) No TCC screen-recording permission prompts (ScreenCaptureKit requires them per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44).
  - (+) Topology is explicit and inspectable via Audio MIDI Setup — pre-flight checker can enumerate.
  - (+) 原声直出 is naturally a hardware bypass (Multi-Output Device).
  - (−) Requires BlackHole install step in onboarding (brew + restart CoreAudio daemon). Onboarding friction.
  - (−) BlackHole #793 (M3 + Sonoma 14.5 "不出现") per `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L44 — pre-flight checker must validate.

---

## ADR-0008 — B-channel output mode = subtitle only (NOT 翻译回灌 / R4 TTS)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: User Q12-A decision. `02_项目架构与技术栈.md` L105 + L710 mention `enableTts` default `false` for B-channel — i.e., R4 does NOT play translated audio back.
- **Decision**: **R4 outputs bilingual subtitles only** (no TTS audio back to the user). The user reads the other party's translated Chinese on the floating subtitle window.
- **Consequences**:
  - (+) Simplest possible R4 — no extra TTS path, no second BlackHole output device, no extra cost.
  - (+) Aligns with `.scratch/macos-siminterpret-poc/map.md` Not-yet-specified "R4 单字幕模式（无 TTS）明确被作者支持".
  - (−) User must read subtitles in real-time. Mitigated by the 半透明 70% / 可拖拽 / 3 显示模式 UX (per `docs/spec/v0/03-b-channel-subtitle.md` §2.3).
  - (−) If user prefers audio (e.g., eyes-busy scenarios), they must use 原声直出 (English passthrough) — this is acceptable per the user's product framing.

---

## ADR-0009 — Latency target v0 = ≤3s (NOT map.md original ≤4s)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: `.scratch/macos-siminterpret-poc/map.md` L16 originally said "v0 PoC ≤ 4 秒首音". User Q3.1-B tightened to ≤3s in round 2. Rationale: PoC already measures 3.0–3.7 s (`poc-docs-take.md` §4.1); tightening keeps the door open for v1 ≤2 s.
- **Decision**: **v0 target = ≤3000 ms first-sound** (median of 5 runs on M2 Air wired cn-north). See `docs/spec/v0/04-latency-budget.md` §1 for rationale.
- **Consequences**:
  - (+) Keeps competitive headroom over PoC's measured baseline.
  - (+) Stage-5 inference (2200 ms hard ceiling per `poc-docs-take.md` §4.1) plus ≤800 ms engineering headroom = 3000 ms envelope per `latency-budget-v0.md` §1.5.
  - (−) Cuts PoC's safety margin from ~700 ms to ~430 ms (per `latency-budget-v0.md` §2.1) — tighter on stage-5 regression.

---

## ADR-0010 — Platform priority = macOS-first (NOT Windows-first as PoC docs suggested)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: PoC docs (`01_技术可行性报告.md` L345 + `02_项目架构与技术栈.md` L566) recommend "先 Windows 后 Mac" — but the actual PoC code is macOS-only, and `.scratch/macos-siminterpret-poc/map.md` L47 names "M2 MacBook Air" as the sole user hardware.
- **Decision**: **macOS-first for v0**; Windows parity deferred to v1+. See `00-overview.md` §2.2 out-of-scope row "Windows platform parity".
- **Consequences**:
  - (+) Matches user's actual hardware (`.scratch/macos-siminterpret-poc/map.md` L47).
  - (+) Avoids the M2 MPS hard ceiling for local TTS (`.scratch/macos-siminterpret-poc/issues/25-macos-vs-windows-platform-diff.md`) — but v0 ships cloud TTS only anyway, so this is neutral for v0.
  - (−) Smaller initial audience. Acceptable — the product strategy is to ship a working Mac app first, validate, then port.

---

## ADR-0011 — Open-Less borrowing = architecture + patterns only (NOT code)

- **Date**: 2026-09-06
- **Status**: Accepted
- **Context**: Open-Less is **AGPL-3.0-only** for its Tauri source (`openless-take.md` L13: "`openless-all/app/src-tauri/Cargo.toml:4` is `AGPL-3.0-only`" + "`openless-all/app/crates/openless-core/Cargo.toml:4` is also `AGPL-3.0-only`"). Parent project is MIT (`map.md` Acceptance #5).
- **Decision**: **Copy architecture and patterns only** (`openless-take.md` §6 "Things to copy" list). Do NOT copy code from `src-tauri/src/` or `crates/openless-core/src/`. Patterns to copy: (1) `openless-core` framework-agnostic crate split (§6 pattern #1); (2) `invokeOrMock` + `requireBackendReady` handshake (§6 pattern #2); (3) per-domain `lib/ipc/<domain>.ts` barrel (§6 pattern #3); (4) capsule window as floating subtitle template (§6 pattern #4); (5) `framer-motion` scoped to one feature (§6 pattern #5); (6) CSP that pushes network calls to Rust (§6 pattern #6).
- **Consequences**:
  - (+) MIT posture preserved. No AGPL contamination.
  - (+) We get the architectural lessons (capsule + IPC barrel + core split) without license entanglement.
  - (−) Have to write our own IPC barrel, our own settings context, our own capsule. ~1 dev-week of pattern re-implementation.
  * **Critical DO-NOT list** (per `openless-take.md` §6 "Things to NOT copy"): AGPL code; no global state library for a 195-command surface (Open-Less uses plain React Context — see ADR-0012 for our choice).

---

## ADR-0012 — State management = Zustand (NOT plain React Context)

- **Date**: 2026-09-06
- **Status**: **[REVIEW]** — recommended, pending user confirmation
- **Context**: Open-Less uses plain React Context + `useState` (`openless-take.md` §3 + §6 "Things to NOT copy" item 2). Per `openless-take.md` §6 item 2: "With ~30 settings tabs, `framer-motion` chat panel, Q&A / Selection / Less Computer / Glow windows all sharing `HotkeySettingsProvider`, the context value is re-derived on every preference update and prop-drilled everywhere. The parent project should invest in **Zustand** (or Jotai) upfront once the command count exceeds ~20, not retrofit it after 100. The Open-Less pattern is fine for a focused app but does not scale to the interpreter's MT/ASR/TTS session lifecycle."
- **Decision**: **Zustand** for the B-channel subtitles store + the settings store. Plain React Context only for the IPC barrel + Tauri context (which is stable).
- **Consequences**:
  - (+) Scales to 100+ commands without prop-drilling.
  - (+) Selectors avoid re-renders of unrelated subscribers — important when subtitle events arrive at 60 Hz.
  * (−) Adds one dependency (Zustand ~1 KB gzipped — negligible).
  * (−) Different mental model than Open-Less — contributors porting patterns need to translate.
- **Rejected alternative**: Jotai (atom-based, more flexible but steeper learning curve); Redux Toolkit (heavier, more boilerplate).

---

## Sources cited in this document

- `docs/research/poc-docs-take.md` §3 (tech-stack decisions table), §4.1, §5, §6 (ast_proto row, opus_decoder.py row), §7 (gap inventory)
- `docs/research/openless-take.md` L13 (license), §1 (state mgmt + persistence), §2 (Tauri patterns), §3 (frontend stack), §4 gotchas, §6 patterns #1–#6 + "Things to NOT copy"
- `docs/research/latency-budget-v0.md` §1.1, §1.4, §1.5, §2.1, §2.3, §3 stage 8, §4 R1–R5, Appendix C, Appendix E
- `.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md` (ScreenCaptureKit precedent)
- `.scratch/macos-siminterpret-poc/issues/06-macos-audio-routing-options.md` L42, L44 (BlackHole + SCC)
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61 (opuslib 0.06ms/包)
- `.scratch/macos-siminterpret-poc/issues/25-macos-vs-windows-platform-diff.md`
- `.scratch/macos-siminterpret-poc/map.md` Acceptance #5 (MIT license), L16–18 (latency targets), L24 (v1 cascade seam), L47 (M2 MacBook Air), Notes (R4 doesn't need independent MT)
- Local-only reference: `01_技术可行性报告.md` L274–275, L345, L386, L399, L405–408; `02_项目架构与技术栈.md` L105, L115–118, L128, L145, L164, L166, L185–207, L253, L267–269, L313, L497–524, L542–547, L566, L710, L714–722; `03_性能与成本分析.md` L30–42, L89–105, L233–242. Per `AGENTS.md` §"Local-only reference", paths only — no code copied.
