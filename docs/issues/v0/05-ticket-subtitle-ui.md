## Goal

Land the floating bilingual subtitle window as a non-activating Tauri-NSPanel with full macOS full-Space behavior, wired to the Zustand subtitles store and the Tauri `subtitle:append` event bus, with 3 display modes and all UX affordances — so that R4 subtitles are visible during any meeting app's full-screen Space.

## Acceptance criteria

- **F9 (multi-window + tray)** in `00-overview.md` §2.1: floating subtitle window appears as a non-activating NSPanel (verified by activating a fullscreen meeting app and observing the subtitle remains on top).
- **AC5** (dual-channel self-meeting): subtitle window shows bilingual transcript in real time during the 60 s self-meeting (ticket #12).
- **Window defaults**: 720×220 (per `03-b-channel-subtitle.md` §2.1), `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false`, `titleBarStyle: Overlay`, `trafficLightPosition: { x: 12, y: 14 }`.
- **3 display modes**: (a) only this sentence, (b) rolling (last 5 lines), (c) all — selectable from subtitle window UI.
- **Position persistence**: window position saves on move/resize and restores on next launch; out-of-bounds snaps to default (center of primary display).
- **Interactivity**: draggable (`-webkit-app-region: drag` on text, `no-drag` on buttons), resizable (`resizable: true` + bottom-right handle), semi-transparent 70% (`opacity: 0.7`), font-size adjustable from settings.
- **Hotkeys**: `Ctrl+Alt+H` toggles subtitle visibility; `Right Option` (default per `openless-take.md` §5 #2) also toggles visibility per `02_项目架构与技术栈.md` §77.

## Implementation notes

- **Modules to be built**: `src-tauri/src/platform/macos.rs::convert_capsule_to_nspanel` (called once during `lib::run()` after the subtitle webview is built; uses `tauri-nspanel` git-branch `v2` per D20); `src/views/SubtitleView.tsx`; `src/components/SubtitleWindow.tsx`; `src/store/subtitles.ts` (Zustand slice with bounded ring, max 200 lines per `01-architecture.md` §5); CSS with `-webkit-app-region` rules.
- **IPC contract** (per `03-b-channel-subtitle.md` §1.2): Rust `app.emit("subtitle:append", &Subtitle)`. The same Tauri event-bus pattern as Open-Less's `microphone:level` (`openless-take.md` §6 pattern #2 — pattern only, no code copy). Both main + capsule webviews listen. No JSON wrapper; Tauri serializes the typed struct directly.
- **NSPanel flags**: `nonactivatingPanel = true`, `floating`, `becomesKeyOnlyOnClick`, `worksWhenModal`. Reference points (no code copied per ADR-0011): Open-Less uses `openless-all/app/src-tauri/src/lib.rs:539` for initial NSPanel conversion and `:614` for capsule-specific behavior.
- **Zustand store contract**: `useSubtitlesStore` exposes `entries: Subtitle[]` (capped at 200), `append(s: Subtitle)`, `clear()`, `mode: 'sentence' | 'rolling' | 'all'`. Selectors per-key so that adding an entry does NOT re-render components subscribed to unrelated slices.
- **Position persistence**: `appWindow.onMoved` and `appWindow.onResized` Tauri events → save to disk via `config` IPC command → restore on app start. If saved x/y is off-screen (external monitor disconnected), snap to primary display center.
- **Reference decisions**: D3 (subtitle-only output), D4 (Tauri 2), D5 (Zustand), D6 (Open-Less patterns only), D20 (`tauri-nspanel` git-branch acceptable), D24 (原声直出 default OFF — subtitle window visible by default).
- **Spec cross-refs**: `03-b-channel-subtitle.md` §2 (subtitle window design with all tauri.conf.json properties + NSPanel caveat) + §2.3 (interactivity table) + §2.4 (position persistence) + §5 (原声直出 UX integration, surface #2 — small button in corner); `01-architecture.md` §7 (macOS-specific patterns including NSPanel).

## Test plan

Single acceptance seam. Verified by:
- Manual smoke: launch app, start R4 session, speak English, observe bilingual subtitles appearing in the floating window within ≤ 2500 ms (per AC2 in ticket #04).
- Full-Space behavior smoke: activate any meeting app in fullscreen, confirm subtitle remains visible above it.
- Hotkey smoke: `Ctrl+Alt+H` toggles visibility; `Right Option` toggles visibility.
- Persistence smoke: move window to corner, resize, quit, relaunch — window restores at saved position/size (or snaps to default if off-screen).
- Display-mode smoke: cycle through sentence / rolling / all modes — observe expected rendering.
- Self-meeting test (ticket #12) passes — the subtitle window shows bilingual transcript in real time during the 60 s dual-channel run.

## Dependencies

- **Blocked by #02** (Tauri shell + multi-window `tauri.conf.json` + Zustand store skeleton + NSPanel conversion stub).
- **Blocked by #04** (B-channel R4 audio + `subtitle:append` emission) — without the producer of `subtitle:append`, this ticket cannot verify end-to-end flow.

## Out of scope for this ticket

- **R3 audio** — ticket #03.
- **原声直出 toggle wiring** — this ticket adds the small button in the subtitle window corner (surface #2 per `03-b-channel-subtitle.md` §5.1); the actual audio routing behavior when toggled is ticket #11.
- **Settings window UI** (font-size slider, display-mode selector persistence) — the README mentions settings; full settings window is a v0.1 follow-up, v0 in-window controls only.
- **Voiceprint-based speaker ID** — v1+ (`02_项目架构与技术栈.md` L241).
- **Subtitle injection into meeting software** (Zoom built-in caption API etc.) — out of scope per `06-deliverables.md` §5.
