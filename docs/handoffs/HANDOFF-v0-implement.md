# Handoff: v0 Implementation Start

> Generated 2026-09-07 at the phase boundary between
> `/grill-with-docs` + `/to-spec` + `/to-tickets` (all complete)
> and `/implement` (starting next session).
>
> **Purpose**: This file is a fresh-context entry point for the next
> session to begin `/implement #2` (Tauri 2 skeleton) without
> needing to re-load the spec / decision / research history.

## TL;DR for the next agent

You are about to implement the **Tauri 2 skeleton** for the v0 dual-channel
realtime zh↔en interpreter at `pioneerAlone/realtime_interpreter`. All
spec / decision / research work is **already committed and pushed**.
Your job is to write the first batch of code following the ticket.

## Mandatory reads (in this order)

1. **Issue body**: `gh issue view 2` — the ticket you are implementing.
   - Title: `[v0 ticket 02] Tauri 2 骨架（IPC + Zustand + 多窗口 + 系统托盘）`
   - Contains Goal / Acceptance criteria / Implementation notes / Test plan / Dependencies / Out of scope.
2. **Spec overview**: `docs/spec/v0/00-overview.md` — AC1-AC8 (8 acceptance criteria) you will eventually verify.
3. **Architecture spec**: `docs/spec/v0/01-architecture.md` — module layout, IPC surface (~20 commands), process/thread model.
4. **Audio pipeline spec**: `docs/spec/v0/02-audio-pipeline.md` — R3 + R4 pipelines (relevant for skeleton: §4 ring buffer, §7 sample rate, §8.3 原声直出 picker UI).
5. **Subtitle UI spec**: `docs/spec/v0/03-b-channel-subtitle.md` — §2 floating NSPanel window (relevant for skeleton: Tauri multi-window).
6. **Latency budget**: `docs/spec/v0/04-latency-budget.md` — Appendix D (7-test plan).
7. **Decision log**: `docs/decisions/round-2-grill.md` + `docs/decisions/round-2-confirmations.md` + `docs/decisions/round-3-confirmations.md` — 30 locked decisions (D1-D30).

## 30 locked decisions (1-line summary)

### Round 2 (D1-D17, initial grill)

- **D1** dual-channel v0 (R3 s2s + R4 s2t subtitle).
- **D2** macOS-first, Windows deferred to v1+.
- **D3** B-channel output = subtitle only (no 翻译回灌).
- **D4** GUI = Tauri 2 + React 18 + TS 5.6 + Vite 6.
- **D5** State = Zustand (departing from Open-Less's plain Context).
- **D6** Open-Less architecture-and-patterns only, no code (AGPL).
- **D7** Rust-heavy + TS-light.
- **D8** ≤3s first-sound target (D18 makes AC1 soft at v0).
- **D9** inline OGG demuxer (~50 LoC, no soundfile fallback).
- **D10** AST 2.0 S2S ~2200 ms hard ceiling (D19 → v1 cascade).
- **D11** `cpal 0.15` for capture + playback.
- **D12** 2-header auth only (`X-Api-Key` + `X-Api-Resource-Id`).
- **D13** BlackHole 16ch + Aggregate Device for B-channel.
- **D14** BlackHole 48 kHz native (avoid SRC).
- **D15** Subtitle language pair: en→zh.
- **D16** Buffering strategy from PoC (`bytearray` ring + 120ms 蓄能 → Rust crossbeam).
- **D17** Subtitle schema (id, timestamp_ms, speaker, source_text, translation_text, is_final).

### Round 2 confirmations (D18-D25)

- **D18** AC1 soft at v0, hard at v0.5 (latency can exceed 3s).
- **D19** cascade seam is a v1 ticket (not v0 implementation seam).
- **D20** `tauri-nspanel` git-branch dependency acceptable.
- **D21** OGG demuxer v0 inline (no fallback).
- **D22** no Apple Developer Program; ad-hoc self-sign + README.
- **D23** zh↔en only at v0.
- **D24** 原声直出 default OFF; parallel-route safety (headphones always get original English, never gated by S2T).
- **D25** BlackHole 16ch + Aggregate Device (vs 2ch; Aggregate explained in 02-audio-pipeline.md Appendix A).

### Round 3 (D26-D30, architecture review)

- **D26** Architecture region label: "MacBook Air M2 (dev/primary)".
- **D27** BH 16ch + Aggregate Device (confirmed; rationale in 02-audio-pipeline.md Appendix A).
- **D28** 48 kHz playback (rationale in 02-audio-pipeline.md §7).
- **D29** 原声直出 output device picker (UI dropdown of cpal output devices, default = physical headphones, includes "Mute").
- **D30** Voice-clone: Strategy 1 only (`speaker_id=""` per-session zero-sample). denoise=false, no UI toggle. Reconnect: Strategy A (10s replay ring) + Strategy F (exponential backoff 1s/2s/4s, max 3 retries, reset on SessionStarted).

## Issue #2 implementation checklist

**Ticket**: `pioneerAlone/realtime_interpreter#2` — Tauri 2 skeleton

**Acceptance criteria** (from issue body):
- `cargo tauri dev` runs without panic on M2 MacBook Air (macOS 14.4.1)
- `pnpm tauri dev` (or `npm run tauri dev`) opens the main window
- Main window renders 4-device wiring UI (4 slots per 金喜 screenshot)
- Subtitle capsule window opens (NSPanel per D20; `tauri-nspanel` git branch `v2`)
- System tray icon appears (per Open-Less pattern; lib.rs L781-810 reference)
- Global hotkeys register: `Ctrl+Alt+P` (原声直出 toggle), `Ctrl+Alt+H` (subtitle hide), `Right Option` (subtitle show)
- Zustand stores empty but functional (session, devices, subtitles, topology, config)
- IPC barrel `src/lib/ipc/{shared,index}.ts` implements `isTauri` + `requireBackendReady` + `invokeOrMock` per Open-Less pattern (architecture only, no code copy)
- Strict CSP set in `tauri.conf.json` (`connect-src 'self' ipc: ws://localhost:1420`)
- Build pipeline runs `codesign --force --deep --sign -` (per D22)

**Test command (from `04-latency-budget.md` Appendix D test 1, skeleton-only)**:
- `cargo build --manifest-path src-tauri/Cargo.toml` — must compile clean
- `pnpm install && pnpm build` — frontend must bundle without errors
- `pnpm tauri build --debug` — must produce a `.app` bundle

**Dependencies** (must be resolved before /implement #2):
- None — this is the foundation ticket.

**Out of scope** for this ticket (later tickets fill these in):
- Real audio capture / playback (issue #3 R3 audio)
- Doubao WebSocket client (issue #10 protobuf)
- Topology check logic (issue #6)
- OGG demuxer (issue #8)
- Audio authentication probe (issue #9)

## Open [REVIEW] items (track during implement, do not block)

These remain open per `00-overview.md` §7 + spec drafts. They have
recommended defaults; revisit if implement reveals a contradiction.

1. **Capture frame size**: 20 ms (recommended per `02-audio-pipeline.md` §3) vs 40 ms (safer on wifi).
2. **Opus decode frame matching**: verify `TTSResponse(352)` chunks arrive at 20 ms cadence (server-side).
3. **Ring buffer size**: 40 ms initial 蓄能 vs 60 ms.
4. **Hot-plug recovery policy**: hard fail + manual restart (A, recommended).
5. **原声直出 UI affordance placement**: tray submenu (recommended per `02-audio-pipeline.md` §8.3) vs settings page.
6. **IPC count**: 20 commands (lean, recommended) vs ~50 (Open-Less granularity).
7. **Stage 7 jitter buffer initial fill**: 40 ms (tighter, click risk on wifi) vs 60 ms (safer).
8. **Subtitle window default position**: center / last-saved / menu-bar.
9. **Subtitle auto-fade vs persistent scroll**: 3-line rolling + clear-on-2s-silence (PoC's proven pattern per `01_技术可行性报告.md` L390).
10. **Release cadence**: `v0.0.1` minimal vs `v0.1.0` AC-passing.
11. **AC gating**: ship v0.0.1 with must-pass AC4-AC8 + document soft AC1-AC3 as known limitations.

## External references (for the implement session to read)

- **Open-Less reference** (architecture only, no code copy): `/tmp/openless-research/openless-all/` — local clone from `/archify` research. Read these files for pattern inspiration:
  - `app/src-tauri/tauri.conf.json` — multi-window with macOS titleBarStyle/trafficLightPosition/transparent
  - `app/src-tauri/src/lib.rs` L178, L411 — `generate_handler![...]` blocks
  - `app/src-tauri/src/lib.rs` L539-614 — NSPanel conversion
  - `app/src-tauri/src/lib.rs` L781-810 — tray icon setup
  - `app/src/lib/ipc/shared.ts` — `isTauri` detection + `requireBackendReady` + `invokeOrMock`
  - `app/src/components/Capsule.tsx` L319-360 — AudioBars 5-envelope level meter
  - `docs/linux-egui-backend-contract.md` — F01-F24 acceptance matrix (the "why" behind framework-independent core split)
- **PoC reference** (local, git-ignored per AGENTS.md): `/Users/wangbo/proj/realtime_interpreter/realtime_interpreter_Minimal_Implementation/`
  - `src/mac_ast2_s2s_v2.py` — A-channel s2s implementation reference (READ ONLY, do not copy)
  - `src/auth_test.py` — auth probe pattern reference
  - `src/opus_decoder.py` — current decoder (to be replaced by `opus` crate stream decode)
  - `docs/01_技术可行性报告.md` L274 — Doubao AST 2.0 S2S FLAL 2.53s

## Boundary rules (from AGENTS.md "Local-only reference")

- **NO code copied from Open-Less or PoC** — patterns and architectures only.
- Reference file paths and symbol names; do NOT paste code blocks.
- Cite every claim with a parenthetical: `(spec/v0/00-overview.md §3 AC1)` or `(round-3-confirmations.md D30-Q3)` etc.

## Startup commands (next session)

```bash
cd /Users/wangbo/proj/realtime_interpreter
git pull  # sync latest
gh issue view 2  # re-read ticket
cat docs/handoffs/HANDOFF-v0-implement.md  # this file
cat docs/spec/v0/00-overview.md  # 8 AC
cat docs/spec/v0/01-architecture.md  # module layout + IPC

# Then load /implement skill and start work
```

## Verification before claiming "implement #2 done"

Per `/code-review` skill's "Standards + Spec" axes:

- **Standards**: code follows the documented coding standards (Rust 2021 idioms, TS strict mode, ESLint config, Prettier formatting).
- **Spec**: ticket acceptance criteria all met + test commands pass.

Self-check before claiming done:

```bash
cargo build --manifest-path src-tauri/Cargo.toml
pnpm install
pnpm tauri build --debug
# All must succeed before claiming ticket closed.
```

Then `gh issue comment 2 --body-file closing-summary.md` with the diff summary, AC verification, and test results. Mark ticket ready for review by removing `ready-for-agent` and adding the standard close label (if your team uses one; otherwise leave the close-comment trail as the audit record).

## What if /implement #2 runs into blockers?

Common blocker categories and the right escalation:

- **Build/dependency errors**: edit Cargo.toml / package.json; verify versions per `openless-take.md` §3 (tauri = "2.11" exact, cpal = "0.15" exact, etc.)
- **Spec contradicts ticket**: re-read issue body + spec drafts; if real conflict, surface to user (do NOT silently pick one)
- **Open-Less architecture unclear**: re-read `/tmp/openless-research/openless-all/docs/linux-egui-backend-contract.md` F01-F24
- **PoC behaviour unclear**: re-read `docs/research/poc-docs-take.md` for distilled findings (do NOT re-read PoC source — agent `f23090a7` already did that work)
- **API key / Doubao endpoint unreachable**: check `poc-docs-take.md` §3 — endpoint is `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, Resource ID `volc.service_type.10053`

If the blocker is a domain question (not a code error), surface to user via `/ask-matt`. Do NOT invent answers.

## Final state summary

- 30 decisions locked (D1-D30 in `docs/decisions/round-{2,3}-*.md`)
- 13 GitHub issues created (all `ready-for-agent`)
- 27 blocked_by edges wired on GitHub (native issue dependencies)
- Architecture diagram rendered (`docs/architecture/v0-architecture.html`, 9/9 standard checks pass)
- Spec drafts 8 files + BlackHole 16ch appendix in `docs/spec/v0/`
- Research 4 files in `docs/research/` (PoC take + Open-Less take + latency budget + voice-clone strategies = 1173 lines)
- All committed to `main` and pushed to `pioneerAlone/realtime_interpreter`
