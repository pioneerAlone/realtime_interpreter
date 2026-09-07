# v0 UI Evolution Timeline

> Generated 2026-09-07 from `/ask-matt` review of the v0.0.1 scaffold.
> The scaffold is **intentionally minimal** (per spec D2 + ADR-0010).
> This document maps every UI element to the ticket that produces it,
> so you can see which ticket will fill which gap.

## Visual progression (Mermaid gantt)

```mermaid
gantt
  title v0 UI evolution across tickets
  dateFormat YYYY-MM-DD
  axisFormat %b-%d

  section Scaffold
  Tauri shell + handshake (issue #2)      :done, 2026-09-07, 1d
  System theme + brand icon (PR #14)       :done, 2026-09-07, 1d

  section UI gaps the scaffold leaves
  Settings window (API key + bypass prefs) : #9 + #11
  4-device wiring dropdown                : #6
  R3 / R4 session Start / Stop buttons     : #3 + #4
  4-channel RMS level meter                : #3
  Subtitle window (3 display modes, kbd)   : #5
  原声直出 (bypass) tray + UI integration : #11

  section Hardening
  Build + DMG + ad-hoc sign (#13)         :2026-09-20, 2d
  Self-meeting test (#12)                 :2026-09-22, 2d
```

## Per-ticket UI commitments

| Issue | UI surface it produces | When |
|---|---|---|
| **#2** (DONE) | Window shell + tray + IPC + Zustand empty stores + 3 cards (Backend handshake / Channels / Hotkeys) | v0.0.1 scaffold |
| **#3** | R3 "Start / Stop" button in main window + RMS level meter (mic / 翻译输出) | v0.0.2 |
| **#4** | R4 "Start / Stop" button + RMS level meter (对方输入 / 耳机输出) | v0.0.2 |
| **#5** | Subtitle window: 3 display modes (only-this / rolling-5 / all) + 字体滑块 + 拖拽 + Ctrl+Alt+H 隐藏 + Right Option 切换 | v0.0.2 |
| **#6** | Pre-flight topology check panel: red/amber/green, refuses to start if red. **Adds the 4-device wiring dropdown** the scaffold is missing | v0.0.2 |
| **#9** | Settings window — API key input (Keychain-backed) + "Test Connection" button + "from 语音控制台" hint | v0.0.3 |
| **#10** | (no UI; backend protobuf; unlocks #3/#4) | v0.0.2 |
| **#11** | 原声直出 bypass: tray submenu + settings dropdown for output device (per D29) | v0.0.3 |
| **#12** | (no UI; integration test) | v0.0.4 |
| **#13** | Build pipeline + DMG (no UI) | v0.0.4 |

## Mapping to your screenshot

Your screenshot of the v0.0.1 scaffold shows:

| Visible | Why it's there | Future ticket |
|---|---|---|
| Header "realtime_interpreter" + sound-wave icon + "v0 scaffold" chip | D4 / D6 (brand + theme) | stays as-is |
| "Backend handshake" card: ping: pong, Version: 0.0.1, IPC contract: 1.0.0 | D7 (Tauri builder + IPC) | stays as-is |
| "Channels" card: R3 idle / R4 idle | D1 + ADR-0002 (placeholder) | #3 + #4 add status + Start/Stop buttons |
| "Hotkeys" card: Right Option, ⌃⌥P, ⌃⌥H | D4 + D20 (system tray + hotkeys) | #5 adds per-hotkey live indicator |
| (absent) **4-device wiring dropdown** | not in #2 scope | **#6** |
| (absent) **Settings window** | not in #2 scope | **#9** (API key) + **#11** (bypass output device) |
| (absent) **Start R3 / Start R4 buttons** | not in #2 scope | **#3** + **#4** |
| (absent) **4-channel RMS level meter** | not in #2 scope | **#3** + **#4** |
| (absent) **Topology check red/amber/green panel** | not in #2 scope | **#6** |
| (absent) **Subtitle window 3 display modes + 字体滑块** | not in #2 scope | **#5** |

## "What about Settings window?" — gap acknowledgement

The #1 spec lists **F9 = "System tray + multi-window (settings, floating subtitle, level meter)"** as a single v0 feature. The current ticket decomposition splits F9 across:
- **Settings window content** → #9 (API key) + #11 (bypass) + #6 (device selection)
- **Floating subtitle** → #5
- **Level meter** → #3 + #4 (F8)

This is intentional: each ticket can be completed + smoke-tested independently, instead of one giant "settings window" ticket that requires every dependency. But the **integration moment is real** — the next PR after #11 should be a small "settings window UX" pass that consolidates the 3 sub-panels into one navigable Settings dialog with tabs.

**Trade-off acknowledged**: a 3-4 week schedule vs immediate polish.

## What you can do now (this PR #14)

- **Open the app** (`open /Applications/realtime_interpreter.app` after merge) and confirm the scaffold runs on your M2 Air
- **Grant Accessibility** so the global hotkeys register
- **Press Right Option** to see the floating subtitle window toggle (it's a default webview at v0 — no subtitles appear yet because R4 is wired in #4)

## Recommended next ticket

**#6 — Pre-flight 4-device topology check** (1-2 days)
- Pure Rust binary + IPC command + UI panel (red/amber/green)
- **No dependency on audio code** (cpal not yet added to Cargo.toml)
- Unblocks visible UI feature (the 4-device dropdown) without waiting for #3/#4 audio
- Demonstrates the "real product" feeling immediately

**Then #5 → #3/#4 → #9 → #11 → #13** in dependency order.

## If you want immediate UI richness

Two options:

1. **Add #2.1 ticket** (1-2 days): "Settings window UX consolidation"
   - Build the Settings dialog shell with tab navigation
   - Placeholder content for API key / devices / bypass
   - Tickets #9/#11 will fill the placeholders with real content
2. **Wait for #6** to ship (1-2 days, same ETA)
   - Gets you the 4-device dropdown without UI scaffolding overhead

Both produce a comparable UX surface; #2.1 is more scaffold-style polish, #6 is more functional.
