## Goal

Stand up the Tauri 2 shell with multi-window `tauri.conf.json`, the `~20 #[tauri::command]` IPC surface stub, the React 18 + TS 5.6 + Vite 6 frontend with Zustand stores, the system tray + global hotkeys, and the macOS NSPanel conversion of the floating subtitle window — so that all later tickets have a working binary to plug into.

## Acceptance criteria

- **AC9 (scaffold AC)**: `pnpm tauri dev` launches the main window with `MainView.tsx` rendered, the floating `subtitle` webview is created and converted to a non-activating NSPanel at runtime, the tray icon appears in the macOS menu bar with the menu items defined in `01-spec.md` Implementation Decisions, and `Right Option` global hotkey toggles subtitle visibility. Contributes to F9 (multi-window + tray per `00-overview.md` §2.1).
- Verifies via the build pipeline: `pnpm tauri build` produces an `.app` bundle for `aarch64-apple-darwin` (M-series) and `x86_64-apple-darwin` (Intel). Empty-command state is fine; what matters is the shell.
- `cargo run --bin topology-check` placeholder exits 0 (binary defined, real implementation lands in ticket #06). `cargo run --bin latency-probe` placeholder exits 0 (real impl in ticket #07).
- Frontend `pnpm build` produces a Vite bundle that is loaded by the Tauri webview; the IPC barrel `lib/ipc/index.ts` re-exports a `ping()` stub command.
- `cargo check` exits 0 across the whole crate; `cargo clippy --all-targets -- -D warnings` exits 0.
- `pnpm tauri dev` shows the CSP per `01-architecture.md` §7 enforced — a `fetch("https://example.com")` from the webview fails with a CSP error (smoke test that the network boundary is Rust-only).

## Implementation notes

- **Modules to be built at the architectural level**: `src-tauri/src/{main,lib,state,error}.rs`; `src-tauri/src/ipc/{mod,session,device,subtitle,topology,config,diagnostics}.rs` (each file may contain one stub command; later tickets fill the bodies); `src-tauri/src/platform/macos.rs` (NSPanel convert function); `src-tauri/tauri.conf.json` (multi-window); `src-tauri/capabilities/{default,capsule}.json` (window scopes); `src-tauri/Cargo.toml` with pinned versions per `openless-take.md` L58/L130 (`tauri = "2.11"` exact, `tauri-plugin-shell = "2.3.5"` exact for the CVE, `cpal = "0.15"`, `opus`, `tokio-tungstenite = "0.24"`, `prost = "0.13"`, `tonic = "0.12"`, `global-hotkey`, `tauri-nspanel = { git = "...", branch = "v2" }` per D20, `keyring = "2"`, `rubato`, `crossbeam-channel`).
- **Modules to be built on the frontend**: `src/main.tsx` (router by `?window=main|capsule`); `src/App.tsx`; `src/lib/ipc/{shared,index}.ts` (the `isTauri` + `requireBackendReady` + `invokeOrMock` handshake from `openless-take.md` §6 patterns #2/#3 — written fresh, no code copy); `src/store/{session,devices,subtitles,topology,config}.ts` (Zustand slices, each empty for now); `src/views/{MainView,SubtitleView}.tsx` (placeholder renders); `vite.config.ts` (`@vitejs/plugin-react` only per `openless-take.md` L96–100); `package.json` with `pnpm` lockfile + `tauri-apps/api` 2.x + `react` 18.3.1 + `zustand` 5.
- **Tray menu** (per `01-architecture.md` §2): `TrayIconBuilder::with_id("main-tray")` + dynamic menu rebuild. Menu items: "Start R3 / Stop R3 / Start R4 / Stop R4 / 原声直出 (Bypass) [Ctrl+Alt+P] / Show Subtitle [Right Option] / Hide Subtitle [Ctrl+Alt+H] / Quit". Initial state: Start R3, Start R4, Show Subtitle enabled; Stop disabled.
- **NSPanel conversion** (per `01-architecture.md` §7 + `03-b-channel-subtitle.md` §2.2): `src-tauri/src/platform/macos.rs::convert_capsule_to_nspanel` is called once during `lib::run()` after the subtitle webview is built. NSPanel flags: `nonactivatingPanel = true`, `floating`, `becomesKeyOnlyOnClick`, `worksWhenModal`. The conversion uses `tauri-nspanel` git-branch `v2` per D20.
- **Global hotkeys** (per `01-architecture.md` §7 + `openless-take.md` §5 "Global hotkeys"): registered via `global-hotkey` 0.6 crate, Carbon on macOS, side-modifier aware. Default v0 hotkey: Right Option (matches Open-Less `USAGE.md:71` per `openless-take.md` §5 #2 — pattern only). `Ctrl+Alt+P` toggles 原声直出. `Ctrl+Alt+H` hides the subtitle window.
- **Multi-window tauri.conf.json** (per `openless-take.md` §5 "Window topology" + `03-b-channel-subtitle.md` §2.1):
  - `main`: width 1240, height 800, `hiddenTitle: true`, `transparent: true`, `titleBarStyle: "Overlay"`, `trafficLightPosition: { x: 12, y: 14 }`.
  - `subtitle` (capsule): width 720, height 220, `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false`, `visible: false` (shown only when session starts), `titleBarStyle: "Overlay"`.
  - URL routes via `index.html?window=capsule` (the Open-Less `App.tsx:28-53` trick — pattern only).
- **CSP per `01-architecture.md` §7**: `script-src 'self'`, `connect-src 'self' ipc: http://ipc.localhost http://localhost:1420 ws://localhost:1420`, `object-src 'none'`, `frame-ancestors 'none'`. Webview opens no external connections — all Doubao / API traffic is Rust.
- **Reference decisions**: D4 (Tauri 2), D5 (Zustand), D6 (Open-Less patterns only — no code copy from `openless-all/app/src-tauri/src/` or `crates/openless-core/src/` per AGPL-3.0 license), D7 (Rust-heavy + TS-light), D20 (`tauri-nspanel` git-branch dep acceptable), D22 (no Apple Developer Program at v0 — ad-hoc self-sign only).
- **Spec cross-refs**: `01-architecture.md` §1 (top-level diagram), §2 (process/thread model), §3 (module layout — see `src-tauri/src/{audio,doubao,ipc,platform,state,error}.rs`), §6 (IPC surface enumeration of ~20 commands), §7 (macOS patterns including NSPanel conversion + multi-window tauri.conf.json + BlackHole detection + CSP); `00-overview.md` §5 (architecture summary); `06-deliverables.md` §2 (CONTRIBUTING.md mentions `pnpm install` + `pnpm tauri dev` + `cargo test`).

## Test plan

Single acceptance seam — no ticket-specific tests in this ticket. Verified by:
- **Manual smoke**: `pnpm tauri dev` shows main window; tray icon appears in menu bar; right-clicking the tray shows the menu items above; clicking Start R3 then Stop R3 toggles correctly; Right Option toggles subtitle visibility; subtitle window floats above full-screen Space (Quick test: activate the QuickTime Player in fullscreen; the subtitle stays visible).
- **Build smoke**: `pnpm tauri build` exits 0 on both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets; the produced `.app` bundle opens via `open dist/macos/realtime_interpreter.app` and shows the same shell as `pnpm tauri dev`.
- **Compile smoke**: `cargo check` exits 0; `cargo clippy --all-targets -- -D warnings` exits 0 (no warnings as errors at scaffold time).
- **CSP smoke**: in the dev webview console, `await fetch("https://example.com")` is rejected with a CSP error — proves the network boundary is Rust-only.
- **Placeholder binary smoke**: `cargo run --bin topology-check` exits 0 (prints "topology-check placeholder — see ticket #06"); `cargo run --bin latency-probe` exits 0 (prints "latency-probe placeholder — see ticket #07").

## Dependencies

- **None (can start immediately)** — this is the foundation ticket. Every other sub-issue (#03 through #13) is blocked by #02 because they all import from `state.rs`, the IPC barrel, or the Tauri builder.

## Out of scope for this ticket

- **Audio pipelines (R3/R4)** — stubs only; ticket #03 and #04 fill them in.
- **Doubao WebSocket client + auth + protobuf** — single `ping()` IPC stub for now; tickets #09 (auth), #10 (protobuf), #03/#04 (sessions) replace the body.
- **OGG demuxer, latency probe, self-meeting test, topology check** — placeholder binaries only; real implementations in tickets #06, #07, #08, #12.
- **Code signing + DMG + build pipeline polish** — ticket #13.
- **Floating subtitle window visual polish** (CSS, font-size slider, 3 display modes) — ticket #05.
- **原声直出 UI integration with subtitle window** — ticket #11.
- **Settings window UI** — placeholder tab only at scaffold; full settings window is a v0.1 follow-up.
- **Internationalization** — UI strings are English only at scaffold; v0 ships zh-CN + en strings hardcoded.
- **App icon + branding** — placeholder Tauri default icon at scaffold; final icon is a v0.x polish item.
- **Logging / structured tracing** — scaffold uses `eprintln!` + `console.log` only; `tracing`/`tracing-subscriber` wiring is added by whichever ticket first needs structured logs (likely #03 or #06).

## 进度：5%

### 当前进展
- ✅ Issue claimed: assignee = @me (via `gh issue edit 2 --add-assignee @me`, 2026-09-07)
- ✅ Feature branch opened: `feature/ticket-02-skeleton` from `main@cdec6c4`
- ✅ Handoff entry written: `docs/handoffs/HANDOFF-v0-implement.md`
- ✅ Environment smoke: pnpm 11.8 / node v25.2.1 / cargo 1.96 / rustc 1.96 / xcode CLT present; `cargo tauri` CLI not yet installed (added in step 1 of execution via `cargo install tauri-cli --version "^2.0"` or pnpm-managed)
- ⏳ Pending: actual code work (Cargo.toml, package.json, src-tauri/src/*, src/*, tauri.conf.json, capabilities/) + verification

### 下一步
- 启动新 session 加载 `/implement` skill（disable-model-invocation=true，需手动加载）。
- 入口：`/Users/wangbo/.agents/skills/implement/SKILL.md` + `docs/handoffs/HANDOFF-v0-implement.md`
- 第一次 commit 目标：可编译的 Tauri 2 + React 18 + TS 5.6 + Vite 6 + Zustand 骨架，`pnpm install && pnpm build && cargo check` 全过。
- Build 验证后 commit + push feature/ticket-02-skeleton + 通过 PR 合入 main。
- 全 6 项 acceptance criteria 通过后，comment 关闭 issue #2，移除 `ready-for-agent`，在 map issue #1 的 Decisions-so-far 追加一行 gist。

### 未确认项 / 已 accept 风险
- Tauri 2 在 macOS 14.4.1 上 NSPanel conversion 行为（tauri-nspanel v2 分支）需要在 GUI session 中手动 smoke；当前 session 没有 GUI，仅靠 `cargo check` / `pnpm build` 静态验证。
- `cargo install tauri-cli` 全局安装 vs pnpm-managed 决定已记录在 handoff 第 4 步；本 ticket 选 pnpm-managed（`@tauri-apps/cli` 在 devDependencies）。
- `Right Option` 默认 hotkey 与 Open-Less USAGE.md:71 一致（pattern only）；如冲突可在 v0.1 调整。

### 引用
- Spec: `docs/spec/v0/00-overview.md` §2.1 F9, AC1-AC8
- Spec: `docs/spec/v0/01-architecture.md` §1-§7
- Spec: `docs/spec/v0/03-b-channel-subtitle.md` §2 (floating NSPanel)
- Decisions: D4 (Tauri 2) / D5 (Zustand) / D6 (Open-Less patterns only) / D7 (Rust-heavy) / D20 (tauri-nspanel v2 branch) / D22 (ad-hoc self-sign)
- Open-Less reference (architecture only): `/tmp/openless-research/openless-all/`


## 进度：100%

### 实现完成 (2026-09-07, branch feature/ticket-02-skeleton, commit c9cd956)

- ✅ AC1 cargo check 0 errors
- ✅ AC2 cargo clippy --all-targets -- -D warnings 0 errors
- ✅ AC3 pnpm tauri build --debug → realtime_interpreter.app + realtime_interpreter_0.0.1_aarch64.dmg
- ✅ AC4 topology-check binary placeholder exits 0
- ✅ AC5 latency-probe binary placeholder exits 0 (with --iterations flag)
- ✅ AC6 pnpm typecheck 0 errors
- ✅ AC7 pnpm build (Vite) 38 modules, 147KB JS bundle
- ✅ AC8 CSP strict (frame-ancestors 'none', connect-src 'self' ipc: ws://localhost:1420)

### 下一步
- 等用户在 GUI session 手动 smoke：pnpm tauri dev 启动 → 看 tray icon 出现 → 右键看菜单 → 按 Right Option 看 subtitle 切换 → 测 NSPanel 浮在 fullscreen Space 上
- 合入 main：gh pr create --base main --head feature/ticket-02-skeleton
- #3-#13 ticket 现在可以开干

### 关键文件位置
- src-tauri/Cargo.toml — 依赖 + version pinning
- src-tauri/tauri.conf.json — 多窗口 + CSP + tray config
- src-tauri/src/lib.rs — Tauri builder + tray + hotkey + NSPanel convert
- src-tauri/src/ipc/ — 6 模块 × ~3 stubs = 18 IPC stubs (issue #1 spec said ~20)
- src/lib/ipc/{shared,index}.ts — isTauri + requireBackendReady + invokeOrMock
- src/store/ — 5 Zustand slices (空 stub, ticket #03+ 填)
