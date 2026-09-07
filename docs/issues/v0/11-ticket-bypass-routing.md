## Goal

Land the 原声直出 (raw-passthrough) audio routing with the **parallel-route safety design** — even when bypass is OFF, the user's headphones always receive the original English directly from BlackHole 16ch → Aggregate Device, not gated by the S2T pipeline (per D24) — so that toggling bypass never delays or blocks the user from hearing the other party.

## Acceptance criteria

- **D24 default state**: 原声直出 is **OFF** at first launch. Subtitle window visible by default; B-channel audio routed through S2T translation pipeline. Users can toggle 原声直出 ON via tray menu / `Ctrl+Alt+P` hotkey / floating subtitle window button.
- **Parallel-route safety** (the load-bearing D24 requirement): when bypass is OFF, BlackHole 16ch → Aggregate Device splits into (a) **directly to headphones** (no S2T delay) and (b) S2T pipeline → subtitle window (Chinese translation). The S2T pipeline does NOT gate the audio to headphones. If S2T output audio is >300 ms ahead of the original, mute path (a) to avoid double-audio echo.
- **Bypass ON routing**: BlackHole 16ch → Aggregate Device → headphones only; S2T pipeline idle. 0 ms latency to headphones (BlackHole + CoreAudio HAL ~20 ms, no network). 100% API cost saved (per `03_性能与成本分析.md` L241).
- **3 toggle surfaces** all stay in sync (per `03-b-channel-subtitle.md` §5.1): (a) tray menu item "原声直出 (Bypass) [Ctrl+Alt+P]"; (b) floating subtitle window small button; (c) settings window checkbox. Toggling any one updates all three via the Zustand `bypass` boolean + Tauri `bypass:changed` event.
- **Subtitle window banner**: when bypass is ON, a prominent banner "原声直出 ON · 未翻译" appears (red or yellow background, high contrast).
- **AC5 — Self-meeting test passes**: 60 s dual-channel conversation with no feedback loop, both channels produce expected output. Critical: bypass toggle during the test must not cause a single glitch or feedback moment.

## Implementation notes

- **Modules to be built**: `src-tauri/src/audio/playback.rs::route_loopback_passthrough` (cpal passthrough stream at ~20 ms, no network); `src-tauri/src/ipc/config.rs` (extend with `bypass` boolean persisted in JSON config); the Zustand `config` store on the frontend gets a `bypass: boolean` slice; tray menu wiring per `01-architecture.md` §2 IPC handlers.
- **Routing logic** (per `02-audio-pipeline.md` §8.2 table + `03-b-channel-subtitle.md` §5.3):
  - **Bypass OFF (v0 default)**: BlackHole 16ch → Aggregate Device → split → (a) directly to headphones (no S2T delay) + (b) S2T pipeline → subtitle window. Optional mute path (a) if S2T audio is >300 ms ahead to avoid echo — but the v0 implementation defaults to never muting path (a) because the user's requirement is "不要影响听到客户的声音" (do not affect hearing the customer's voice).
  - **Bypass ON**: BlackHole 16ch → Aggregate Device → headphones only; S2T WS cleanly closed; no `TaskRequest` frames sent.
  - **Toggle OFF → ON**: Rust stops sending `TaskRequest` frames; closes the S2T WS; routes BlackHole 16ch → Aggregate → headphones only.
  - **Toggle ON → OFF**: Rust opens a fresh S2T WS; parallel route from BlackHole 16ch → Aggregate → headphones is **already active** (no audio interruption).
- **Tray menu** (per `01-architecture.md` §2): menu item rebuilds on toggle via `bypass:changed` event; checkmark shown when ON.
- **Hotkey**: `Ctrl+Alt+P` registered via `global-hotkey` crate (per `openless-take.md` §5 #2 — pattern only); fires `bypass::toggle` IPC command; updates Zustand + tray menu + subtitle window button.
- **Reference decisions**: D24 (default OFF + parallel-route safety), D25 (BlackHole 16ch + Aggregate Device).
- **Spec cross-refs**: `02-audio-pipeline.md` §8 (原声直出 definition + routing table + safety requirement); `03-b-channel-subtitle.md` §5 (3 toggle surfaces + subtitle window banner + audio routing on toggle); `01-architecture.md` §2 (tray menu pattern).
- **Do NOT copy code** from Open-Less or the PoC; the routing logic is derived from D24 + `02-audio-pipeline.md` §8.2 + `03-b-channel-subtitle.md` §5.3.

## Test plan

Single acceptance seam. Verified by:
- Manual smoke at default (bypass OFF): speak English into a fake meeting (or use the self-meeting test), hear the original in headphones with no perceptible delay (~20 ms), see Chinese subtitles in the floating window with ~1.5 s translation lag.
- Toggle ON via tray: hear the original in headphones; subtitle window shows the "原声直出 ON · 未翻译" banner; S2T WS closes cleanly (no orphan frames).
- Toggle OFF via hotkey: subtitle resumes; audio continues uninterrupted (parallel route never breaks).
- Toggle from all 3 surfaces — verify Zustand state and tray checkmark + subtitle banner all reflect the new state.
- Self-meeting test (ticket #12) passes with bypass toggled mid-test — no feedback loop, no audio glitch.

## Dependencies

- **Blocked by #02** (Tauri shell + tray + hotkey wiring + Zustand skeleton).
- **Blocked by #04** (R4 B-channel audio pipeline) — bypass toggles the S2T-side behavior; without R4 assembled, the toggle has no observable effect.
- **Blocked by #05** (floating subtitle window UI) — surface #2 (small button in subtitle window) lives there; surfaces #1 (tray) and #3 (settings) also depend on the Tauri shell.
- **Blocked by #06** (pre-flight topology check) — bypass depends on BlackHole 16ch + Aggregate Device being correctly wired; topology check is the gate.

## Out of scope for this ticket

- **Delayed-bypass mode** (headphones get S2T output delayed 1.5–2 s, not original) — explicitly rejected per D24; parallel-route is the only design that satisfies "不要影响听到客户的声音".
- **Per-speaker bypass** (some voices translated, some raw) — single global toggle at v0; per-speaker is v1+ if ever needed.
- **Bypass during R3 (A-channel)** — R3 is output-only; there is no "raw" version of your own translated voice. The toggle is B-channel only.
- **Settings window UI for bypass** — surface #3 is a checkbox; the full settings window is v0.1 follow-up, v0 supports the toggle without a dedicated settings UI.
