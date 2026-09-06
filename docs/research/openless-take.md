# Open-Less — GUI Stack Take

> Scope: distil the Open-Less open-source project (https://github.com/Open-Less/openless.git) into a take the parent project at `/Users/wangbo/proj/realtime_interpreter` can plan against.
> Open-Less is a cross-platform (macOS / Windows, with a Linux egui in-progress branch) voice-input dictation tool — same problem family as the parent project (audio capture + ASR + LLM polish + text insertion at the cursor).
> Source paths in this file point to the cloned copy at `/tmp/openless-research/` (created via `git clone --depth 1 https://github.com/Open-Less/openless.git`). No code is copied, only file paths and symbol names.

## 1. Project identity

**Open-Less** ("Open-source voice input for macOS, Windows & Linux") is a local-first dictation app: hold a global hotkey, speak, and have AI-polished text stream straight to the cursor in any text field (ChatGPT, Claude, Cursor, Notion, etc.). It positions itself as an open-source alternative to Typeless / Wispr Flow / Lazy / Superwhisper.

- **Repo**: `https://github.com/Open-Less/openless` (mirror at `https://openless.top`)
- **Version under review**: `2.0.0-Beta.1` (per `openless-all/app/package.json:4` and `openless-all/app/src-tauri/Cargo.toml:3`)
- **License**: **`AGPL-3.0-only`** for the Tauri source (`openless-all/app/src-tauri/Cargo.toml:4`); top-level `LICENSE` is 34,523 bytes of MIT text — there is a real license split (see §6 "DO NOT copy").
- **Headline capability** (per `README.md:104`): the AI-prompt mode that turns free speech into a structured prompt, not just a word-for-word transcript.
- **Distribution channel**: GitHub Releases with two tag schemes — `v*-tauri` (stable/beta Tauri builds) for macOS arm64/x64 + Windows x64, and `release-linux-egui.yml` runs `workflow_dispatch` only until real Ubuntu evidence is recorded (see `.github/workflows/release-linux-egui.yml:1-18` and `docs/linux-egui-backend-contract.md` §1).

### Tech stack summary

| Layer | Choice | Where to look |
|---|---|---|
| Shell GUI framework | **Tauri 2.11** (desktop macOS/Windows) | `openless-all/app/src-tauri/Cargo.toml:27` |
| Alternate GUI shell | **egui + eframe** (Linux only, in-progress) | `openless-all/app/linux-egui/Cargo.toml` + `openless-all/app/linux-egui/src/main.rs` |
| Frontend framework | **React 18.3.1 + TypeScript 5.6** | `openless-all/app/package.json:52-53,67` |
| Build tool | **Vite 6.4.3** | `openless-all/app/package.json:68`, `openless-all/app/vite.config.ts` |
| UI component library (chat panel only) | **@base-ui/react 1.6** + **@shadcn/react 0.2** | `openless-all/app/package.json:36,38`, `openless-all/app/src/components/chat/ui/*.tsx` |
| Icons | **lucide-react 1.23** | `openless-all/app/package.json:50` |
| Styling | **Tailwind v4** (chat panel only) + plain CSS variables (`tokens.css`, `global.css`) for the rest | `openless-all/app/vite.config.ts:9`, `openless-all/app/src/styles/` |
| Animation | **framer-motion 12.39** + **tw-animate-css** + **@formkit/auto-animate** | `openless-all/app/package.json:37,48,66` |
| State management | **Plain React Context + `useState`** (no Redux/Zustand/Jotai) | `openless-all/app/src/state/HotkeySettingsContext.tsx`, `openless-all/app/src/state/useAppState.ts` |
| i18n | **i18next 26 + react-i18next 17** | `openless-all/app/package.json:49,54` |
| IPC | **Tauri commands** (`#[tauri::command]` → `@tauri-apps/api/core::invoke`) | `openless-all/app/src-tauri/src/commands/`, `openless-all/app/src/lib/ipc/` |
| Audio capture | **cpal 0.15** | `openless-all/app/src-tauri/Cargo.toml:68` |
| Audio insertion | **enigo 0.3** (keystroke simulation) + **arboard 3** (clipboard) | `openless-all/app/src-tauri/Cargo.toml:81-82` |
| Global hotkey | **`global-hotkey` crate 0.6** (Carbon on macOS) — separate from `tauri-plugin-global-shortcut` | `openless-all/app/src-tauri/Cargo.toml:80`, `openless-all/app/src-tauri/src/lib.rs:829` |
| Tray icon | `tauri::tray::TrayIconBuilder` (Tauri's built-in, behind `tray-icon` feature) | `openless-all/app/src-tauri/Cargo.toml:76`, `openless-all/app/src-tauri/src/lib.rs:791` |
| Floating panel (macOS) | **`tauri-nspanel`** (git dep, branch `v2`) for non-activating NSPanel | `openless-all/app/src-tauri/Cargo.toml:134`, `openless-all/app/src-tauri/src/lib.rs:614` |
| Persistence | **Custom JSON files + OS keyring** (`keyring` crate with platform backends) | `openless-all/app/src-tauri/Cargo.toml:92-113`, `openless-all/app/src-tauri/src/persistence/` |
| Update channel | `tauri-plugin-updater 2.10.1` + `minisign` for Linux egui | `openless-all/app/src-tauri/tauri.conf.json:102-108` |
| Single-instance lock | `tauri-plugin-single-instance 2` | `openless-all/app/src-tauri/Cargo.toml:78` |
| Local ASR (Windows) | **sherpa-onnx 1.13.2** + **foundry-local-sdk 1.2.1 (WinML)** | `openless-all/app/src-tauri/Cargo.toml:143-145` |
| Local ASR (macOS arm64) | **`qwen3-asr-rs`** (vendored submodule, MLX feature) | `openless-all/app/src-tauri/Cargo.toml:141`, `.gitmodules` |
| Vendor markup | Custom LLM ("Ark"/火山) polish step with OpenAI-compatible HTTP | `openless-all/app/src-tauri/src/polish.rs`, `openless-all/app/src-tauri/src/persistence/` |

## 2. GUI framework choice — concrete

**Open-Less uses Tauri 2 (Tauri 2.11 specifically, version-pinned in `openless-all/app/src-tauri/Cargo.toml:27`).** It is **not** Electron, Flutter, Qt, Slint, or pure egui.

### Why Tauri (and the cost they've paid)

The design-handoff doc (`openless-all/design_handoff_openless/README.md:30`) spells it out explicitly:

> *"If the project hasn't picked a framework yet, **Tauri + React + TypeScript** is the best choice for this kind of 'local-first + cross-platform desktop + small bundle + system shortcuts' requirement."*

The cost is non-trivial and is documented in detail in the same repo:

- **A separate `openless-core` crate was carved out** (`openless-all/app/crates/openless-core/Cargo.toml`) so the same Rust business logic can be reused by both the Tauri shell (macOS/Windows) **and** the egui shell (Linux). The core is strictly `tauri`-free, `wry`-free, `egui`-free (`docs/linux-egui-backend-contract.md` §1).
- **`tauri.conf.json` has multiple per-platform overrides** (`openless-all/app/src-tauri/tauri.{android,linux,macos-mlx,windows}.conf.json`) — separate configs exist for Android (`tauri.android.conf.json`), Linux (`tauri.linux.conf.json`), macOS MLX (`tauri.macos-mlx.conf.json`), Windows (`tauri.windows.conf.json`). This is the cost of "one Tauri config that just works across all 4 OSes".
- **Tauri version pinning is paranoid**: the Cargo.toml comment at `openless-all/app/src-tauri/Cargo.toml:24` notes `tauri ~2.11` is forced because the Tauri cross-minor consistency check rejects npm 2.11 + Rust 2.10 combinations.
- **Linux Tauri was abandoned** and replaced with native egui (see `docs/linux-egui-shared-backend-plan.md` and the README badge `Linux-egui` instead of `Linux-Tauri`). The 24-point F01–F24 acceptance matrix at the top of that plan doc is the receipt.

### How the GUI + native split is structured

```
openless-all/app/
├── src/                        # React + TypeScript frontend (window-agnostic)
│   ├── App.tsx                 # single entry; route via ?window=capsule|qa|...
│   ├── components/             # 22 components incl. Capsule, FloatingShell, SiriGL
│   ├── lib/ipc/                # typed wrappers over @tauri-apps/api/core::invoke
│   ├── state/                  # 2 files: HotkeySettingsContext, useAppState
│   ├── pages/                  # lazy-loaded: QaPanel, SelectionPolishPreview, etc.
│   └── styles/{tokens,global}.css
├── src-tauri/
│   ├── Cargo.toml              # Tauri 2.11 + 195 #[tauri::command] handlers
│   ├── src/
│   │   ├── lib.rs (148 KB)     # tauri::Builder, tray, NSPanel, windows
│   │   ├── commands/           # 23 domain modules (channels, hotkeys, dictation, …)
│   │   ├── coordinator.rs (75 KB)
│   │   ├── recorder.rs (38 KB) # cpal-based audio capture
│   │   ├── insertion.rs (29 KB) # enigo-based cursor text insertion
│   │   ├── hotkey.rs (79 KB)   # global-hotkey + side-aware combo
│   │   └── persistence/        # JSON + keyring
│   ├── tauri.{android,linux,macos-mlx,windows}.conf.json
│   └── capabilities/{default,mobile}.json
├── crates/openless-core/       # framework-agnostic Rust (the "true" business core)
├── linux-egui/                 # alternate shell: native egui UI for Linux only
│   ├── Cargo.toml              # depends on openless-core only
│   └── src/{main,backend,runtime,fcitx5,…}.rs
└── android/                    # Tauri Android scaffolding (separate manifest path)
```

The split pattern to copy: **`openless-core` (no framework) → Tauri adapter (desktop) → egui adapter (Linux)**. The Linux path is the reason they extracted a framework-independent core in the first place (see `docs/core-platform-boundary-audit.md`).

## 3. Frontend stack

- **React 18.3.1 + TypeScript 5.6.3** (`openless-all/app/package.json:52-53,67`). No Suspense router — `App.tsx:28-53` uses `React.lazy()` keyed off `window=capsule` / `isQa` / `isLessComputer` route query string, so multiple Tauri webviews share one bundled entry but each only downloads its chunk.
- **Build tool**: Vite 6.4.3. `openless-all/app/vite.config.ts` is short and worth reading:
  - `react()` + `tailwindcss()` plugins only
  - `server.port: 1420`, `server.strictPort: true` — Tauri expects 1420 by convention (see `openless-all/app/src-tauri/tauri.conf.json:9`)
  - `envPrefix: ["VITE_", "TAURI_"]` — pulls `TAURI_ENV_PLATFORM` into the bundle so `App.tsx:44-47` can `import.meta.env.TAURI_ENV_PLATFORM` and conditionally skip the Less Computer bundle on mobile
  - `build.target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13"` — WebKit 13 (macOS) is the lowest common denominator for syntax
- **State management**: **plain React Context + `useState`**. Two files only:
  - `openless-all/app/src/state/useAppState.ts` (29 lines) — current tab + settings modal open
  - `openless-all/app/src/state/HotkeySettingsContext.tsx` (~270 lines) — preferences + hotkey capability + persist queue
  - There is **no Redux, no Zustand, no Jotai, no Pinia**. Cross-window state is sent over the Tauri event bus (`emit("microphone:level", …)` etc.).
- **UI component library**: deliberately minimal. The team built **`openless-all/app/src/components/ui/`** from scratch — only 5 files: `Modal.tsx`, `Row.tsx`, `SegSimple.tsx`, `SelectLite.tsx`, `SwitchLite.tsx`. The shadcn + `@base-ui/react` deps (`package.json:36,38`) are used **only inside `components/chat/`** for the Q&A chat panel (see `openless-all/app/src/components/chat/ui/{bubble,button,marker}.tsx`).
- **Styling**: **CSS variables only** (`openless-all/app/src/styles/tokens.css`) for 95% of the UI; **Tailwind v4 is scoped to `components/chat/`** via the `tailwindcss()` plugin and `chat.css` source list (`openless-all/app/vite.config.ts:13` comment). This is a deliberate split — they wanted design tokens that match the design handoff exactly without bringing Tailwind's atomic-class soup into the main shell.
- **Animation**: framer-motion 12.39 for the Q&A chat panel only; the capsule uses inline-style `transition: 'height 0.18s cubic-bezier(...)'` directly (`openless-all/app/src/components/Capsule.tsx:354`).

## 4. Cross-platform support — concrete

### What actually builds today

| Platform | GUI shell | Audio capture | Local ASR | Installer | CI evidence |
|---|---|---|---|---|---|
| macOS arm64 | Tauri 2.11 | cpal | qwen3-asr-rs (MLX) + sherpa-onnx | `.dmg` (Developer ID + notarization) | `.github/workflows/release-tauri.yml:38-41` |
| macOS x64 | Tauri 2.11 | cpal | sherpa-onnx | `.dmg` | `.github/workflows/release-tauri.yml:42-45` |
| Windows x64 | Tauri 2.11 | cpal | sherpa-onnx 1.13.2 + foundry-local-sdk 1.2.1 (WinML) | `.msi` + `.exe` (NSIS perMachine) | `.github/workflows/release-tauri.yml:46-49` |
| Linux x86_64 | **egui** (in-progress, `workflow_dispatch` only) | cpal | sherpa-onnx + Qwen runtime | AppImage (`.github/workflows/release-linux-egui.yml:66-75`) | workflow gated on real Ubuntu evidence |
| Android | Tauri 2.11 (`tauri:android:build`) | cpal | n/a | APK split per ABI | `.github/workflows/android-apk.yml` (458 lines) |

### Platform-specific gotchas (from comments + commit history + `docs/`)

1. **macOS NSPanel is mandatory for the floating capsule.** A plain Tauri window cannot sit above another app's full-screen Space on macOS. The capsule window is converted to a **non-activating NSPanel** at runtime via `tauri-nspanel` (see `openless-all/app/src-tauri/src/lib.rs:539,614,2430,2452`). The same trick is used for the QA panel and Less Computer panel.
2. **macOS MLX dependency is cfg-gated to aarch64** (`openless-all/app/src-tauri/Cargo.toml:136-141`) but Cargo still parses the manifest on all targets. CI non-macOS jobs have to actively delete the line via `scripts/ci-disable-macos-qwen3.mjs` (`.github/workflows/release-tauri.yml:68-70`).
3. **macOS audio device change notifications** use `coreaudio-sys` 0.2 directly (`AudioObjectAddPropertyListener`) instead of polling — see the comment at `openless-all/app/src-tauri/Cargo.toml:127-130`.
4. **Windows text insertion requires a custom IME DLL** (`openless-all/app/src-tauri/wix/openless-ime.wxs`, `openless-all/app/src-tauri/nsis/openless-ime-hooks.nsh`) referenced from `tauri.conf.json:88,92`. This is non-trivial — see `docs/windows-sherpa-onnx-asr-plan.md`.
5. **Windows IPC** has its own bespoke protocol (`openless-all/app/src-tauri/src/windows_ime_*.rs`, 6 files) for fallback text injection.
6. **Linux abandoned Tauri for egui** because Tauri on Linux needs WebKitGTK and they wanted to ship fcitx5 integration natively — see `docs/linux-egui-shared-backend-plan.md` F02 and `openless-all/app/linux-egui/src/fcitx5.rs`.
7. **Linux keyring backend splits** per OS family at `openless-all/app/src-tauri/Cargo.toml:92-113` (apple-native / windows-native / linux-native-sync-persistent + crypto-rust).
8. **Tauri's shell plugin had a CRITICAL CVE** (GHSA-c9pr-q8gx-3mgp, issue #668) — `tauri-plugin-shell` is pinned to exactly `2.3.5` (`openless-all/app/src-tauri/Cargo.toml:29`) and the comment links the issue.

### How the JS/TS frontend calls native code

Single mechanism: **Tauri commands via `@tauri-apps/api/core::invoke`**.

- The frontend wrapper layer is `openless-all/app/src/lib/ipc/` — 30 files, one per domain (asr-credentials, channels, dictation, history, hotkeys, devices, qa, etc.), all re-exported from `index.ts` (269 lines, see the file structure there).
- The frontend never imports from `@tauri-apps/api/core` directly — only `isTauri` and `invokeOrMock` are re-exported from `shared.ts`, and `invokeOrMock` requires `requireBackendReady()` before any other invoke (`openless-all/app/src/lib/ipc/shared.ts:57-71`). This is the "fail-closed 2.0 handshake" pattern referenced from `App.tsx:69-72`.
- Backend push to frontend: `app.emit("microphone:level", serde_json::json!({ "level": level }))` (see `openless-all/app/src-tauri/src/commands/misc.rs:133`).
- There are **195 `#[tauri::command]` handlers** registered in `generate_handler!` blocks (see `openless-all/app/src-tauri/src/lib.rs:178` and `:411`).
- **No NAPI, no wasm-bindgen, no separate FFI layer** — Tauri commands are the only bridge.

## 5. Audio-specific GUI patterns

### How Open-Less visualizes audio

**Single source: a `f32` level (0..1) emitted at ~60 Hz from Rust, rendered as a 5-bar envelope in the capsule.** That's it — there is no waveform, no FFT spectrum, no scrolling history.

- Backend: `start_microphone_level_monitor` (Rust) creates a `LevelProbeConsumer` that taps cpal's PCM stream and emits `microphone:level` events (`openless-all/app/src-tauri/src/commands/misc.rs:103-134`).
- Frontend: `AudioBars` in `openless-all/app/src/components/Capsule.tsx:319-360` renders 5 SVG-less `<span>` bars with an envelope `[0.55, 0.85, 1.0, 0.85, 0.55]`, applies a silence gate at 0.012 and response ceiling at 0.34, then `Math.pow(easedVoice, 0.42)`. The bars animate with `transition: height 0.18s cubic-bezier(0.22, 1, 0.36, 1)` — that transition tuning is the only audio-specific CSS worth copying.
- The capsule also renders a `SiriGL` style orb (gradient background animated via `SiriGL.tsx`, 471 lines), but that is purely cosmetic.

### Window topology

**Two windows today, more on the way**:

1. **`main`** (1240×800, hiddenTitle, transparent, titleBarStyle=Overlay) — `openless-all/app/src-tauri/tauri.conf.json:15-32`. Hidden by default (`"visible": false`).
2. **`capsule`** (460×180, `alwaysOnTop: true`, `decorations: false`, `focus: false`, `skipTaskbar: true`) — `openless-all/app/src-tauri/tauri.conf.json:33-49`. URL routes via `index.html?window=capsule`.

Plus dynamically-created webviews referenced from `openless-all/app/src-tauri/capabilities/default.json` (`qa`, `less-computer`, `less-computer-glow`, `selection-polish-preview`).

The parent project's **interpreter floating subtitle** maps cleanly onto the `capsule` template: small, borderless, alwaysOnTop, skipTaskbar, focus=false, macOS NSPanel-converted. See `docs/2.0-desktop-acceptance.md` for the multi-window criteria.

### System tray / menu bar

- **macOS/Linux**: `tauri::tray::TrayIconBuilder::with_id("main-tray")` at `openless-all/app/src-tauri/src/lib.rs:791`. The menu is dynamically rebuilt when settings change (microphone device list, style pack list) — see `build_tray_menu` and `handle_microphone_tray_menu_event` references at the same lines.
- **Tauri feature flag**: `tray-icon` is desktop-only, in `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` at `openless-all/app/src-tauri/Cargo.toml:76`.

### Global hotkeys

- **`global-hotkey` crate 0.6** at `openless-all/app/src-tauri/Cargo.toml:80` — used instead of `tauri-plugin-global-shortcut`. The reason (per comment `openless-all/app/src-tauri/src/lib.rs:829`) is that Carbon-based binding on macOS handles side-modifier keys more reliably.
- **Right Option (macOS) / Right Control (Windows)** is the default recording trigger (`USAGE.md:71`).
- Hotkey state and capability are surfaced via `get_hotkey_status` and `get_hotkey_capability` commands; the frontend exposes them via `openless-all/app/src/lib/ipc/hotkeys.ts`.
- On Linux, the same `global-hotkey` crate does not exist; the egui shell has its own `hotkeys.rs` (`openless-all/app/linux-egui/src/hotkeys.rs`).

### Audio device selection UI

- Backend command `list_microphone_devices` (`openless-all/app/src-tauri/src/commands/misc.rs:84-101`) wraps `Platform::microphone_devices()` from `openless-core`.
- Frontend wrapper `openless-all/app/src/lib/ipc/devices.ts` re-exports `listMicrophoneDevices`, `startMicrophoneLevelMonitor`, `stopMicrophoneLevelMonitor`.
- The same device list is rendered both in the Settings UI **and** in the tray menu (`openless-all/app/src-tauri/src/lib.rs:789-803`). The menu items are live-updated when Core reports a device change event (`openless-all/app/src-tauri/src/device_watch.rs`).

## 6. Reusable patterns for parent project

### Things to copy (with file:line references)

1. **`openless-core` framework-agnostic Rust crate pattern** (`openless-all/app/crates/openless-core/Cargo.toml`, `openless-all/app/src-tauri/Cargo.toml:22`).
   The parent project's Rust business logic should live in a `realtime-interpreter-core` crate that depends only on `tokio`, `reqwest`, `serde`, `cpal` — no `tauri`, no GUI framework. The Tauri (or alternate) shell becomes an adapter that imports the core and exposes commands. This pays off the day you want a second shell (mobile, web, CLI, headless server) — and Open-Less paid for it twice (once for the egui shell, once for the Android shell).

2. **`invokeOrMock` + `requireBackendReady` handshake** (`openless-all/app/src/lib/ipc/shared.ts:31-71`).
   Wrap every `@tauri-apps/api/core::invoke` call so the same React code runs in `vite preview` (no Tauri), in `tauri dev` (Tauri + mock fallback), and in production. The 2.0 contract version check (`BACKEND_CONTRACT_VERSION = "2.0.0"` at `shared.ts:14`) is a cheap insurance against stale builds calling a newer backend.

3. **Per-domain `lib/ipc/<domain>.ts` barrel + single `index.ts`** (`openless-all/app/src/lib/ipc/index.ts`, 269 lines).
   Each domain gets its own file (`hotkeys.ts`, `devices.ts`, `history.ts`, etc.) and the index re-exports. With 195 commands this is the only way to keep the frontend navigable. The parent project's IPC layer should follow the same shape from day one — not after commands hit triple digits.

4. **Capsule window as the floating subtitle template** (`openless-all/app/src-tauri/tauri.conf.json:33-49` + `openless-all/app/src/components/Capsule.tsx:319-360`).
   The 460×180, `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false` window is exactly the shape the parent project's B-channel floating subtitle needs. Combine with the NSPanel conversion (`openless-all/app/src-tauri/src/lib.rs:614`) for macOS full-screen Space correctness, and the `AudioBars` 5-envelope level meter for the audio-reactive cue.

5. **`framer-motion` scoped to one feature** (`openless-all/app/src/components/chat/`).
   Instead of letting animation libraries bleed across the whole app, isolate them to the chat panel and use inline `transition:` + CSS variables elsewhere. Keeps bundle size and CSS complexity manageable.

6. **CSP that pushes network calls to Rust** (`openless-all/app/src-tauri/tauri.conf.json:51-65` + `docs/tauri-csp.md`).
   `script-src 'self'`, `connect-src 'self' ipc: http://ipc.localhost http://localhost:1420 ws://localhost:1420`, `object-src 'none'`, `frame-ancestors 'none'`. The rationale (per `docs/tauri-csp.md`): provider/LLM/ASR/update requests all run in Rust, so the WebView never opens external connections — the WebView CSP only needs to cover its own bundle and Tauri IPC.

### Things to NOT copy

1. **AGPL-3.0 dual-license trap.** The top-level `LICENSE` is MIT (the Chinese voice-input documentation?), but the actual Tauri source — `openless-all/app/src-tauri/Cargo.toml:4` — is `AGPL-3.0-only`, and `openless-all/app/crates/openless-core/Cargo.toml:4` is also `AGPL-3.0-only`. Copying the `openless-core` crate or any non-trivial Rust file from `src-tauri/src/` would force the parent project to AGPL — incompatible with the parent project's MIT posture per `.scratch/macos-siminterpret-poc/research/`. The parent can copy the **architecture and patterns** (which are unprotectable), but cannot copy **code** from `src-tauri/src/` or `crates/openless-core/src/` without relicensing.

2. **No global state library for a 195-command surface.** Open-Less uses **plain React Context** + `useState` + a 270-line `HotkeySettingsContext.tsx`. With ~30 settings tabs, `framer-motion` chat panel, Q&A / Selection / Less Computer / Glow windows all sharing `HotkeySettingsProvider`, the context value is re-derived on every preference update and prop-drilled everywhere. The parent project should invest in **Zustand** (or Jotai) upfront once the command count exceeds ~20, not retrofit it after 100. The Open-Less pattern is fine for a focused app but does not scale to the interpreter's MT/ASR/TTS session lifecycle.

3. **Cpal-only audio capture on desktop.** `cpal 0.15` is in the shared dependency list (`openless-all/app/src-tauri/Cargo.toml:68`) and the recorder is cpal-only on macOS/Windows/Linux. The parent project's B-channel needs **system audio loopback** (VB-Cable on Windows, BlackHole on macOS, PulseAudio monitor on Linux) — which cpal does not provide cross-platform. The parent project will need `cpal` for mic input **plus** a separate loopback library per OS, or move to `oboe`/`AVAudioEngine` wrappers. The Open-Less pattern of "cpal + enigo + arboard" covers only the A-channel (mic → type), not the B-channel (system audio → caption).

## 7. Open questions for /grill-with-docs

1. **Open-Less uses `tauri-nspanel` (git, branch `v2`) for macOS full-Space windowing.** The parent project's floating subtitle has the same requirement on macOS. Is the parent willing to depend on an unreleased git branch of a third-party crate, or should the parent vendor / fork it (or wait for a stable release)?
2. **Open-Less uses `cpal` for mic-only capture** but the parent project also needs **system audio loopback** (B-channel). What library should the parent use for loopback per OS — `coreaudio-rs` / `ScreenCaptureKit` (macOS), `wasapi` direct bindings (Windows), `libpulse-binding` (Linux)? And should that be a separate `realtime-interpreter-loopback` crate so cpal stays focused on input?
3. **Open-Less has 195 `#[tauri::command]` handlers under two `generate_handler!` blocks** (`openless-all/app/src-tauri/src/lib.rs:178,411`). The parent project will likely grow past 100 commands. Does the parent want to (a) follow Open-Less's split into `commands/<domain>.rs` files with glob re-export (`openless-all/app/src-tauri/src/commands/mod.rs:55-93`), or (b) adopt a `specta`/`tauri-specta`-style typed-export pattern from day one?
4. **Open-Less uses `global-hotkey` 0.6 on desktop but a different `linux-egui/src/hotkeys.rs` on Linux.** The parent project targeting macOS/Windows desktop first can copy Open-Less's `global-hotkey` choice — but the moment Linux support is on the roadmap, the hotkey abstraction must be split into a core trait (per `docs/linux-egui-backend-contract.md` §"Hotkey capability"). What is the parent's Linux timeline?
5. **Open-Less's "minimal UI primitives + scoped shadcn" pattern (`openless-all/app/src/components/ui/` + `chat/`)** is unusual — they built Modal/Select/Switch from scratch for the main shell and only pulled in `@base-ui/react` + `@shadcn/react` for the chat panel. The parent project needs an interpreter UI (caption overlay + history pane + provider config). Should the parent (a) adopt the same minimal-UI pattern with a separate shadcn zone for any chat-like surface, or (b) use shadcn/ui uniformly across the whole app, or (c) write everything from scratch with `@base-ui/react`?
6. **Open-Less uses Tauri 2.11 with `withGlobalTauri: false` (`tauri.conf.json:13`) and gates all IPC through a typed barrel.** This is more boilerplate but provides compile-time-ish safety. Is the parent willing to pay the same boilerplate cost, or should it use the auto-generated bindings from `tauri-specta` to skip the manual `lib/ipc/<domain>.ts` wrappers?
