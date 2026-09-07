## Problem Statement

The user runs realtime Chinese↔English interpretation on macOS for meetings with English-speaking counterparts. The dominant closed-source competitor (金喜同声传译双通道版, ¥49–¥4999 per year, see `.scratch/macos-siminterpret-poc/map.md` Notes session #2) ships two channels — the A-channel speaks your Chinese out as English in your own voice, and the B-channel brings the other party's English back as bilingual subtitles — at ~1.3 s user-visible first-sound latency. There is no open-source, MIT-licensed, macOS-first equivalent. v0 fills that gap by shipping **dual channels in one Tauri app**: A-channel (R3) realtime s2s (you speak Chinese → meeting hears English in your voice via zero-sample voice cloning on Doubao 同传 2.0) and B-channel (R4) realtime s2t (other party speaks English → you see bilingual subtitles in a floating panel), targeting **≤ 3000 ms first-sound median** on M2 Air, wired cn-north network. This is the first shipping cut — v0 is **not** a v1 cascade, **not** Windows, **not** offline, **not** multi-language, **not** AI 纪要, **not** 术语库 — see `docs/spec/v0/00-overview.md` §2.2.

## Solution

Tauri 2 + React 18 + TypeScript 5.6 + Vite 6 GUI (per `docs/spec/v0/05-tech-stack-decisions.md` ADR-0001) with a **Rust-heavy** backend owning audio I/O (`cpal 0.15`), Opus stream decode (the `opus` crate, with an inline ~50-LoC OGG demuxer), the Doubao WebSocket client (`tokio-tungstenite` over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, binary Protobuf), and `prost`-generated bindings. The frontend exposes typed IPC through a `lib/ipc/<domain>.ts` barrel mirroring the Open-Less pattern, holds state in **Zustand** (departing from Open-Less's plain Context — see ADR-0012 and `openless-take.md` §6 #2), and renders a settings window + system tray + floating subtitle window via `tauri-nspanel` for macOS full-Space windowing. Audio routing uses **BlackHole 16ch + Aggregate Device + BlackHole 2ch + headphones** (per D25; user-installed via `brew install blackhole-16ch`). **Open-Less borrowing is architecture and patterns only** — no code copied from `openless-all/app/src-tauri/` because that crate is AGPL-3.0-only and parent is MIT (ADR-0011).

## User Stories

1. As a Chinese-speaking meeting host, I want to speak Chinese into my Mac mic and have the meeting hear English in my own voice, so that I can lead bilingual meetings without sounding like a robot.
2. As a Chinese-speaking meeting host, I want the translation to begin within ~3 seconds of my first word, so that the meeting doesn't sit in awkward silence.
3. As a Chinese-speaking meeting host, I want the English the meeting hears to sound like me (not a stranger), so that the meeting doesn't feel like two different people are talking.
4. As a Chinese-speaking meeting host, I want the translated English to be sent to the meeting as my "microphone" input, so that any meeting software (Zoom/Teams/腾讯会议/钉钉/Meet) just works.
5. As a Chinese-speaking meeting host, I want pops/clicks/feedback loops to be impossible by default, so that I can trust the app in a live meeting.
6. As a Chinese-speaking meeting host, I want to see bilingual subtitles (English source + Chinese translation) on screen when the other party speaks English, so that I don't miss nuance in fast speech.
7. As a Chinese-speaking meeting host, I want the subtitle window to float above other apps' full-screen Spaces, so that I can read it while presenting or screen-sharing.
8. As a Chinese-speaking meeting host, I want to toggle "原声直出" (raw-passthrough) when the meeting drops to small talk, so that I save 100% of API cost and hear English with zero translation lag.
9. As a Chinese-speaking meeting host, I want the app to remember my device selections, so that I don't re-pick BlackHole 2ch/16ch every meeting.
10. As a Chinese-speaking meeting host, I want a tray icon with quick actions (start/stop session, 原声直出 toggle, hide/show subtitle), so that I can drive the meeting from the menu bar without alt-tabbing.
11. As a Chinese-speaking meeting host, I want a global hotkey to toggle the subtitle window visibility, so that I can hide it instantly during side conversations.
12. As a Chinese-speaking meeting host, I want the app to use my own Doubao API key from the 语音控制台 (not 方舟控制台), so that I'm in control of cost and quotas.
13. As a Chinese-speaking meeting host, I want the API key stored in macOS Keychain, so that it's not sitting in plaintext on disk.
14. As a Chinese-speaking meeting host, I want a pre-flight topology check that verifies my 4-device wiring is correct before I start a meeting, so that I don't discover misconfig mid-meeting.
15. As a Chinese-speaking meeting host, I want the pre-flight check to validate the 3 anti-pattern "误区" mistakes (R3-out VAC ≠ R4-in VAC, meeting mic = R3-out, 翻译输出 → headphones), so that I cannot accidentally create a feedback loop.
16. As a Chinese-speaking meeting host, I want the subtitle window to be draggable, resizable, semi-transparent, and font-size-adjustable, so that I can place it where it doesn't cover my screen-share.
17. As a Chinese-speaking meeting host, I want a 4-channel RMS level meter (mic / 翻译输出 / 对方输入 / 耳机输出), so that I can visually confirm audio is reaching the app.
18. As a Chinese-speaking meeting host, I want the app to survive a 3-second network drop and auto-reconnect within 3 seconds of recovery, so that brief wifi blips don't kill my session.
19. As a Chinese-speaking meeting host, I want the voice clone to re-apply automatically after a reconnect, so that the meeting still hears my voice after recovery.
20. As a Chinese-speaking meeting host, I want a "wired recommended" warning when my RTT is too high, so that I know to plug in before relying on ≤ 3 s first-sound.
21. As a Chinese-speaking meeting host, I want the app to refuse to start a session if the topology check is red, so that I cannot create a feedback loop by ignoring warnings.
22. As a first-time user, I want an `.app` bundle with a clear README explaining the two-step first-open (`xattr -dr com.apple.quarantine …` or right-click → Open) and BlackHole install, so that I can go from download to running in 10 minutes.
23. As a first-time user, I want all configuration (API key, device selection, window position, font size) to persist across launches, so that I don't re-configure every session.
24. As a curious open-source contributor, I want a clean module layout that mirrors the spec (`src-tauri/src/{audio,doubao,ipc,platform,state}/`), so that I can find code by domain.
25. As an open-source contributor, I want the codebase to carry no AGPL contamination (no code from Open-Less), so that the project stays MIT-compatible.
26. As a CI maintainer, I want integration tests that measure end-to-end first-sound latency over 5 runs and assert the median, so that regressions are caught before release.
27. As a CI maintainer, I want a self-meeting test that runs both R3 and R4 channels concurrently against a fake meeting (no human in the loop), so that the dual-channel claim is verifiable in CI.
28. As a CI maintainer, I want a topology-check binary that exits non-zero when the user's 4-device wiring is wrong, so that I can wire it into a `pnpm preflight` step.
29. As a Mac user, I want the floating subtitle window to be a non-activating NSPanel (not a regular Tauri window), so that it doesn't steal keyboard focus from the meeting.
30. As a Mac user, I want the app to bundle no analytics, no crash reporters, no telemetry, so that my meeting audio never leaves my machine except to Doubao.
31. As a Mac user, I want my audio to never be stored to disk (no audio logs), so that confidential meeting content is not persisted.
32. As a Mac user, I want the source tarball to be published alongside the `.app` on GitHub Releases, so that I can audit the build against what I run.
33. As a long-meeting user (30+ minutes), I want CPU ≤ 30% average and RAM ≤ 400 MB, so that the app doesn't compete with my screen-share or video render.
34. As a long-meeting user, I want first-sound latency not to drift more than 500 ms over a 30-minute run, so that the meeting experience is consistent from minute 1 to minute 30.
35. As a v0.5 implementer, I want a clearly-marked seam where a local ASR + S2T + TTS cascade can plug in (capture frame chunk / subtitle stream / TTS command), so that v1's ≤ 2 s target doesn't require a v0 rewrite.
36. As a v1+ planner, I want v0 to ship with v1 cascade deferred (not half-implemented), so that the v1 effort is additive, not corrective.
37. As a security reviewer, I want the strict CSP (`connect-src 'self' ipc: ws://localhost:1420`) to prevent the webview from making external network calls, so that all Doubao traffic goes through Rust and is auditable.
38. As an open-source user, I want the project to ship under MIT (app code) + Apache-2.0 (vendored Doppelvoice `.proto`), so that I can fork and relicense sensibly.

## Implementation Decisions

- **Modules to be built** — a `src-tauri/` Rust crate with submodules `audio/{capture,playback,loopback,resample,ring,vad,agc}.rs`, `doubao/{client,proto,auth,s2s,s2t,event}.rs`, `ipc/{session,device,subtitle,topology,config,diagnostics}.rs`, `platform/macos.rs`, `state.rs`, `error.rs`, `lib.rs` (Tauri builder + tray + hotkey + NSPanel), `main.rs`. A `src/` React 18 + TS 5.6 + Vite 6 frontend with submodules `lib/ipc/{shared,session,device,subtitle,topology,config,diagnostics}.ts` + `index.ts` (Open-Less barrel pattern, ADR-0011), `store/{session,devices,subtitles,topology,config}.ts` (Zustand, ADR-0005/D5), `views/{MainView,SubtitleView}.tsx`, `components/{DeviceSelector,SubtitleWindow,LatencyMeter,TopologyCheckPanel,SessionControls,StatusBadge}.tsx`.
- **Process / thread model** — one Tauri main thread (tray, hotkeys, NSPanel); one tokio runtime (R3 WS + R4 WS + device-poll + audio-session orchestration); one cpal audio thread per device (mic capture, BlackHole 2ch playback, BlackHole 16ch loopback); two webview processes (main window + floating subtitle capsule).
- **IPC surface** — ~20 `#[tauri::command]` handlers grouped under `ipc/session.rs` (5), `ipc/device.rs` (4), `ipc/subtitle.rs` (2), `ipc/topology.rs` (2), `ipc/config.rs` (3), `ipc/diagnostics.rs` (4). Every command has a typed `invokeOrMock` wrapper in `lib/ipc/<domain>.ts` and is re-exported through `lib/ipc/index.ts`.
- **Audio pipelines** — R3 = `cpal` capture → AGC (peak-tracker, −16 dBFS, attack 5 ms / release 100 ms, limiter −3 dBFS) → `tokio-tungstenite` WS (mode=s2s, `source_language=zh`, `target_language=en`, `speaker_id=""`, `denoise=false`, `format="ogg_opus"`) → inline OGG demuxer + `opus` crate stream decode → crossbeam-channel SPSC ring (40 ms initial 蓄能) → `cpal` playback to BlackHole 2ch @ 48 kHz native. R4 = `cpal` loopback from BlackHole 16ch → Rubato resample 48→16 kHz → `tokio-tungstenite` WS (mode=s2t, source=en, target=zh, `denoise=true` toggleable, `enableTts=false`) → Rust `doubao::event::Decoder` parses events 650–655 → `app.emit("subtitle:append", Subtitle)` → Zustand `subtitles` store → `SubtitleWindow` re-render.
- **Architectural decisions** (cross-reference D1–D25 + ADR-0001 through ADR-0012):
  - D1 dual-channel v0, D2 macOS-only, D3 subtitle-only B-channel output.
  - D4 Tauri 2 + React 18 + TS 5.6 + Vite 6 (ADR-0001).
  - D5 Zustand state (ADR-0012) — not Open-Less Context.
  - D6 Open-Less architecture-and-patterns only, no code copy (ADR-0011).
  - D7 Rust-heavy + TS-light (ADR-0002).
  - D8 ≤ 3 s first-sound target (ADR-0009); D18 makes AC1 soft at v0, hard at v0.5.
  - D9 inline OGG demuxer (~50 LoC, ~1 dev-week) — no `soundfile` fallback as canonical (D21).
  - D10 AST 2.0 S2S ~2200 ms hard ceiling (ADR-0009 risk); D19 makes v1 cascade seam a v1 ticket, not a v0 implementation seam.
  - D11 `cpal 0.15` for capture + playback (ADR-0005).
  - D12 2-header auth only (`X-Api-Key` + `X-Api-Resource-Id`), no 3-header fallback (ADR-0003); API key from 语音控制台, not 方舟控制台.
  - D13 BlackHole 16ch + Aggregate Device for B-channel (D25; ADR-0007); rejects ScreenCaptureKit at v0.
  - D17 BlackHole 48 kHz native — no 44.1/48 mismatch.
  - D20 `tauri-nspanel` git-branch dependency acceptable at v0.
  - D22 unsigned + ad-hoc `codesign --force --deep --sign -`; two-step first-open flow.
  - D23 zh↔en only at v0 (Protobuf `source_language`/`target_language` hard-coded).
  - D24 原声直出 default OFF; **parallel-route safety** so headphones always receive original English even when bypass is OFF (never gated by S2T pipeline).
- **Schema changes** — Subtitle struct (per `docs/spec/v0/03-b-channel-subtitle.md` §1) with `id`, `timestamp_ms`, `speaker` (`Client | Unknown`), `source_text`, `translation_text`, `is_final`. Doubao Protobuf bindings regenerated from Doppelvoice's `.proto` source (MIT — Apache-2.0 vendored) using `prost 0.13.x` + `tonic 0.12.x`.
- **API contracts** — IPC commands listed under §6 of `01-architecture.md`. Each command has a typed Rust signature (request + response), a typed `lib/ipc/<domain>.ts` wrapper with `invokeOrMock` 2.0 contract handshake (contract version `"1.0.0"`), and a Zustand subscriber for derived state.
- **Specific interactions**:
  - Tauri event `subtitle:append` carries a serialized `Subtitle`; both main + capsule webviews listen.
  - Tauri event `device:lost` emitted on BlackHole hot-unplug; UI pauses the session.
  - Tauri event `bypass:changed` propagates 原声直出 toggle across all 3 surfaces (tray / subtitle window / settings).
  - Global hotkey `Right Option` toggles the capsule window (matches Open-Less `USAGE.md:71` per `openless-take.md` §5 #2); `Ctrl+Alt+P` toggles 原声直出; `Ctrl+Alt+H` hides subtitle.
  - Tray menu: "Start R3 / Stop R3 / Start R4 / Stop R4 / 原声直出 / Show Subtitle / Quit".

## Testing Decisions

- **Single acceptance seam**: Rust integration tests under `src-tauri/tests/` + the three standalone binaries (`topology-check`, `latency-probe`, `self-meeting-test`). Per `docs/spec/v0/04-latency-budget.md` Appendix D's 7-test plan; per the seam decision (A in the brief), **no unit tests** and **no e2e (Playwright/Detox) at v0**.
- **What makes a good test here** — only test external behavior (binary exit codes, observable audio presence, IPC response shape, file presence). Do not test internal invariants like "ring buffer holds exactly N samples" — those would force implementation choices and burn on refactors.
- **Per-test coverage**:
  - Topology-check binary exit 0 on a correctly-wired machine, exit 1 with actionable error on misconfig.
  - Latency-probe binary runs the 30 s CN speech through R3 and reports median over 5 iterations; pass = median ≤ 3000 ms (per D18, soft at v0).
  - Self-meeting-test integration test asserts (a) R3 produces English audio on BlackHole 2ch within 3 s; (b) R4 emits subtitle events 650–655 within 1.5 s; (c) no feedback loop observable.
  - OGG-demuxer unit-by-integration: encode 1 s known-pattern ogg_opus, decode, assert SNR > 40 dB (the highest-risk test per `latency-budget-v0.md` Appendix D test 5).
  - Stage-by-stage waterfall tests per Appendix D tests 1–6 (capture frame arrival ≤ 12 ms; AGC ±1 dB; WS RTT p50/p99; jitter ring glitch-free; playback 1 kHz tone round-trip).
- **Prior art for tests** — `check_voicemeeter.py` from `ricardobing/realtime-voice-translator` (cited in `06-deliverables.md` §3.1) is the topology-check model. The 7-test waterfall plan in `04-latency-budget.md` Appendix D is the only test plan that exists for the A-channel pipeline.

## Out of Scope

The following 10 deferrals are explicit per `docs/spec/v0/00-overview.md` §2.2 + `06-deliverables.md` §5 and are NOT shipped at v0:

1. **Windows platform parity** — v0 = `tauri.macos-mlx.conf.json`-only (per `openless-take.md` §2 per-platform override pattern). WASAPI loopback + SmartScreen reputation work deferred to v1+.
2. **AI 纪要 (meeting minutes)** — cost ~0.1–0.5 元/次 but not built; v1+ ticket.
3. **Voice-clone library persistence across sessions** — Doppelvoice CHANGELOG admits reconnect drift (`poc-docs-take.md` §4.5); v0 re-sends last 10 s of user audio on reconnect instead of caching a persistent `speaker_id`. Pre-trained 声音复刻 2.0 enrollment is a v1 subcommand.
4. **术语库** (`corpus.boosting_table_id`, `corpus.regex_correct_table_id`) — Protobuf field exists; v0 ships without it; v1 may expose via settings window.
5. **Multi-conference-software adapters** (Zoom/Teams/腾讯会议/钉钉/飞书/Meet/OBS setup guides) — covered indirectly by topology check (F4/AC4) which validates device routing regardless of conference app.
6. **Auto-update + DMG/NSIS packaging** — GitHub Releases + manual download only at v0. `tauri-updater` deferred to v0.1.
7. **Apple Developer ID signing + notarization** — D22: no Apple Developer Program at v0; ad-hoc self-sign + two-step first-open. Real signing deferred to a v0.x that budgets enrollment.
8. **DeepFilterNet local denoise** — 100 ms cost per `poc-docs-take.md` §4.1 stage 3 is unaffordable when stage 5 alone is 2100 ms; server-side `denoise=false` is canonical at v0.
9. **Multi-language (zh↔ja/zh↔ko/en↔ja etc.)** — D23: zh↔en only at v0; Protobuf `source_language`/`target_language` hard-coded. Adding more is a config flip.
10. **Cascade seam implementation (v1 path)** — D19: cascade is a v1 ticket, not a v0 implementation seam. v0 ships as cloud-only Doubao S2S + S2T. The "v1 cascade interface seam" is acknowledged in `00-overview.md` §2.1 F12 but not implemented.

## Further Notes

This spec is broken into 12 implementation sub-issues (`02-ticket-skeleton.md` through `13-ticket-build-distribute.md`) under this directory. Read the spec drafts in `docs/spec/v0/` (especially `00-overview.md` §3 for AC1–AC8 and `04-latency-budget.md` for the 10-stage waterfall) before any ticket. The decision source-of-truth is `docs/decisions/round-2-grill.md` (D1–D17) + `docs/decisions/round-2-confirmations.md` (D18–D25); any spec change requires updating those files first. All 13 issues carry the `ready-for-agent` triage label; the 12 sub-issues also carry `wayfinder:task`; this spec issue carries `wayfinder:map`.
