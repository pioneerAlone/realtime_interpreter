# 06 · Deliverables — What v0 Ships With

> **Status**: DRAFT (round 2 of /grill-with-docs, 2026-09-06). Not committed to git yet.
> **Scope**: Concrete deliverables for the v0 ship — binaries, documentation, testing tooling, demo scenario, and explicit out-of-scope deferrals.
>
> All claims cite `docs/research/poc-docs-take.md`, `docs/research/openless-take.md`, `docs/research/latency-budget-v0.md`, or `.scratch/macos-siminterpret-poc/*` — see inline parentheticals. Items still requiring user confirmation are marked **[REVIEW]**.

---

## 1. v0 binary deliverables

### 1.1 macOS `.app` bundle

- **Build**: Tauri 2 build pipeline (`openless-take.md` §1 "Distribution channel" + `openless-take.md` §4 cross-platform table).
- **Targets**: `aarch64-apple-darwin` (M1+) + `x86_64-apple-darwin` (Intel).
- **Bundle ID**: `com.pioneeralone.realtime-interpreter` (placeholder; confirm before shipping).
- **Notarization**: depends on Apple Developer Program availability — see [REVIEW] §6 #1.

### 1.2 DMG installer

- **Signed + notarized** if Apple Developer Program available; otherwise **unsigned DMG with first-launch instructions**.
- **Distribution**: GitHub Releases (`openless-take.md` §1 mentions GitHub Releases with `v*-tauri` tag scheme — parent follows the same).

### 1.3 Source tarball + GitHub release

- Source tarball attached to the GitHub release.
- License: **MIT** for app code, **Apache-2.0** for vendored Doppelvoice `.proto` (per `poc-docs-take.md` §6 "ast_proto/" row + `map.md` Acceptance #5).
- Tag scheme: `v0.X.Y` (semver) + `v0.X.Y-tauri` (artifact tag).

---

## 2. v0 documentation deliverables

### 2.1 README.md (user-facing)

- Install BlackHole 2ch + BlackHole 16ch (brew + restart CoreAudio daemon).
- Configure 4-device wiring (matching the user Q10 screenshot model: mic + BlackHole 2ch + BlackHole 16ch + headphones).
- Set Doubao API key from 语音控制台 (NOT 方舟控制台) — per `poc-docs-take.md` §3 "Auth scheme" row + `01_技术可行性报告.md` L405–406.
- Run the pre-flight topology checker (`poc-docs-take.md` §7 row "Pre-flight topology checker").
- Start a session. Verify first-sound ≤3000 ms on a self-hosted meeting (Zoom / Teams / 腾讯会议).

### 2.2 CONTRIBUTING.md (developer)

- Rust 1.78+ toolchain.
- Node 20+ for the React frontend.
- `pnpm install` + `pnpm tauri dev` for hot-reload local dev.
- `cargo test` for unit tests + integration tests (`latency-budget-v0.md` Appendix D 7-test plan).
- How to add a new `#[tauri::command]` handler + matching `lib/ipc/<domain>.ts` wrapper (per Open-Less pattern, `openless-take.md` §6 pattern #3).
- How to regenerate Protobuf bindings from the `.proto` source.

### 2.3 docs/spec/v0/ (this folder, completed)

- `00-overview.md` (sibling, exists).
- `01-architecture.md` (sibling — to be written; assumed for v0).
- `02-audio-pipeline.md` (this batch).
- `03-b-channel-subtitle.md` (this batch).
- `04-latency-budget.md` (this batch).
- `05-tech-stack-decisions.md` (this batch).
- `06-deliverables.md` (this batch).

### 2.4 docs/adr/ (ADRs from §05)

- ADR-0001 through ADR-0012 (12 records) lifted from `docs/spec/v0/05-tech-stack-decisions.md` into individual files under `docs/adr/`.
- Format: `NNNN-short-title.md` per the `domain-modeling` skill convention (`AGENTS.md` §"Domain docs").

---

## 3. v0 testing deliverables

### 3.1 Pre-flight topology checker

- **What**: Standalone Rust binary that enumerates audio devices via `cpal`, validates BlackHole 2ch + BlackHole 16ch are present, and checks the user's meeting-software mic is set to BlackHole 2ch.
- **How to run**: `cargo run --bin topology-check`.
- **Inspired by**: `ricardobing/realtime-voice-translator`'s `check_voicemeeter.py` (per `poc-docs-take.md` §7 row "Pre-flight topology checker" + `.scratch/macos-siminterpret-poc/issues/05-realtime-voice-translator-deep-read.md`).
- **3 误区 self-check** (per `.scratch/macos-siminterpret-poc/issues/21-virtual-sound-card-wiki-synthesis.md`): validates (a) 链路 A 输出虚拟声卡 ≠ 链路 B 输入虚拟声卡; (b) 会议软件麦克风 = R3 输出对应的虚拟声卡 Output; (c) 对方翻译输出走真实耳机.

### 3.2 Latency probe

- **What**: Standalone Rust binary that plays a 30 s pre-recorded CN speech file (per `latency-budget-v0.md` Appendix D test 7), measures time from audio-out to first audible TTS in BlackHole, runs **5 times** and reports **median**.
- **How to run**: `cargo run --bin latency-probe -- --iterations 5`.
- **Pass criteria**: median ≤ 3000 ms (per `latency-budget-v0.md` §1.1 + user Q3.1-B).

### 3.3 Self-meeting acceptance test

- **What**: Cargo integration test that:
  1. Spins up a fake "meeting" (one cpal input → one cpal output through BlackHole 2ch).
  2. Starts R3 (s2s) session with a pre-recorded CN audio source.
  3. Captures R3 output from BlackHole 2ch; asserts English audio present, no infinite loop.
  4. Starts R4 (s2t) session with a pre-recorded EN audio source via BlackHole 16ch loopback.
  5. Asserts subtitle events 650–655 arrive within 1.5 s of speech start (per `latency-budget-v0.md` §2.2).
- **CI**: runs in GitHub Actions on every PR (Rust toolchain + macOS runner).
- **Pass criteria**: all 5 assertions pass.

### 3.4 8 acceptance criteria

Per `01_技术可行性报告.md` L268–278 (cited `poc-docs-take.md` §1.2 acceptance metrics table), v0 ships **8 acceptance criteria** (each with a test ID and pass criteria):

| # | Criterion | Test ID | Pass criteria |
|---|---|---|---|
| AC1 | BLEU ≥ 85% | External: BLEU eval against a held-out zh-en test set | BLEU ≥ 0.85 |
| AC2 | 音色相似度 ≥ 3.5/5 | User-judgement A/B against the user's own voice | Mean score ≥ 3.5 from 5 listeners |
| AC3 | 降噪 SNR ≥ 10 dB | **N/A at v0** — `denoise=false` server-side per `02_项目架构与技术栈.md` L115. Document as deferred. | n/a |
| AC4 | CPU ≤ 20% | Continuous `top -l 1` sample during a 30-min session | Mean ≤ 20% on M2 Air |
| AC5 | 内存 ≤ 300 MB | Same | Peak RSS ≤ 300 MB |
| AC6 | 网络 ≤ 256 kbps | `nettop` during a 30-min session | Mean ≤ 256 kbps |
| AC7 | A 通道延迟 ≤ 3000 ms | `latency-probe` binary (§3.2 above) | Median ≤ 3000 ms (tightened from PoC's 3.5 s target) |
| AC8 | B 通道字幕 ≤ 2500 ms | `latency-probe` binary extended to capture first-subtitle timestamp | Median ≤ 2500 ms |

---

## 4. v0 demo scenario

The acceptance demo (run on M2 Air wired cn-north network):

1. **Setup**: Open `realtime_interpreter.app` (built per §1.1).
2. **Pre-flight**: Run `cargo run --bin topology-check` — assert all checks pass.
3. **Wiring**: Configure 4 devices per the user's Q10 screenshot:
   - Mac mic → cpal capture (R3 input)
   - BlackHole 2ch → meeting software's microphone input (R3 output)
   - BlackHole 16ch → meeting software's speaker output (R4 input)
   - Headphones → system default output (R4 output + 原声直出 path)
4. **Self-hosted meeting**: Start a Zoom / Teams / Tencent Meeting call (user's choice) with the app as the mic/speaker endpoint.
5. **Session start**: In the app, click "Start Session". App emits warmup probe (per `latency-budget-v0.md` §3 stage 5 mitigation).
6. **Speak Chinese for 30 s**: User says 3–5 sentences. Verify:
   - BlackHole 2ch output → meeting software picks up English audio in user's own voice (via zero-sample clone).
   - Floating subtitle window shows bilingual transcript (English source + Chinese translation).
   - No feedback loop (i.e., user does not hear their own translation echoed back).
7. **原声直出 toggle**: Click the bypass button in the subtitle window. Verify audio routing changes immediately (other party's English is heard directly in headphones, no translation).
8. **Stop**: Click "Stop Session". Verify clean shutdown — no orphan audio threads, no stuck WS connections.

The demo video is recorded as part of v0 release (per GitHub Releases convention).

---

## 5. Out-of-scope (deferred to v1+)

Per `00-overview.md` §2.2 + `.scratch/macos-siminterpret-poc/map.md` Out of scope + `poc-docs-take.md` §7:

- **Windows support** — `map.md` Out of scope "用户唯一环境是 macOS"; v1+ per `25-macos-vs-windows-platform-diff.md` (which adds WASAPI loopback, SmartScreen reputation period, Windows Communications compatibility testing).
- **AI 纪要** — meeting minutes. `poc-docs-take.md` §7 row "AI纪要"; `map.md` Out of scope.
- **音色库 persistence** — cross-session stable voice clone. `poc-docs-take.md` §1.2 known risk + `map.md` Decisions #4 (deferred to v1+ 声音复刻 2.0 训练子命令).
- **术语库** (`corpus.boosting_table_id`, `corpus.regex_correct_table_id`) — `poc-docs-take.md` §7 row "术语库". Per `.scratch/macos-siminterpret-poc/issues/22-jinxi-customer-tutorial-product-map.md` this is 金喜's core differentiation; v0 ships without it.
- **多会议软件适配** — explicit per-software UI for Zoom/Teams/腾讯会议/钉钉/飞书/Meet/OBS. v0 supports "any meeting software that uses BlackHole 2ch as the mic input device" — no per-software config. `poc-docs-take.md` §7 row "会议软件配置图文引导".
- **自动更新** — `electron-updater` → `tauri-updater`. `poc-docs-take.md` §7 row "electron-updater 自动更新 + DMG/NSIS 打包". Defer to v0.1.
- **代码签名 / 公证** — needs Apple Developer Program enrollment. See [REVIEW] §6 #1.
- **DeepFilterNet 本地降噪** — `poc-docs-take.md` §4.1 stage 3: 100 ms cost not justified for `denoise=false` server-side. v0 uses AGC only (per `latency-budget-v0.md` §3 stage 3).
- **Subtitle injection into meeting software** (e.g., Zoom built-in caption API) — `map.md` Out of scope "实时字幕的会议软件层注入".
- **Voiceprint-based speaker identification** — `02_项目架构与技术栈.md` L241; deferred to v1+ per `poc-docs-take.md` §7 row.
- **Offline / 完全本地模式** — `map.md` Out of scope. Requires model quantization + local inference stack; engineering effort doubles.

---

## 6. [REVIEW] decisions for this section

1. **Apple Developer Program availability for code signing**: if available, v0 ships signed + notarized (no first-launch gate). If not, v0 ships unsigned with explicit first-launch instructions (用户 must right-click → Open to bypass Gatekeeper). Recommend: confirm availability before starting the release build pipeline.
2. **DMG distribution vs brew tap**: v0 ships via GitHub Releases + DMG. A `homebrew-realtime-interpreter` tap is **deferred to v0.1** unless the user wants it at v0 (more setup; not blocking). Recommend: DMG only at v0.
3. **GitHub release cadence**: per `openless-take.md` §1, Open-Less uses `v*-tauri` tag scheme. Parent uses `v0.X.Y` semver + `v0.X.Y-tauri` artifact tag (matches Open-Less pattern). Pre-releases (`v0.0.1-rc.1`) for any public beta. **[REVIEW]**: confirm cadence (e.g., is v0.0.1 the minimum first ship, or do we wait for v0.1.0 with all 8 acceptance criteria met?).
4. **Acceptance criteria gating**: do we ship v0 if some of AC1–AC8 fail (e.g., AC3 降噪 is N/A, AC2 音色相似度 requires user-judgement)? Recommend: ship v0.0.1 with all "must-pass" (AC4–AC8) and document "soft" criteria (AC1, AC2) as known limitations in the release notes.
5. **Open-Less code review of v0**: should we ask the Open-Less maintainers to review our IPC barrel pattern (per `openless-take.md` §7 question 6) before v0 ships? Recommend: optional; not blocking.

---

## Sources cited in this document

- `docs/research/poc-docs-take.md` §3 (auth, audio specs), §4.1 (acceptance criteria table), §6 (ast_proto row), §7 (gap inventory: pre-flight checker, AI 纪要, electron-updater, 会议软件 config, 术语库)
- `docs/research/openless-take.md` §1 (distribution channel, GitHub Releases + v*-tauri tags), §4 cross-platform table
- `docs/research/latency-budget-v0.md` §1.1 (≤3000 ms target), §3 stage 5 (warmup probe), §2.2 (B-channel subtitle latency), Appendix D test 7 (30 s integration test)
- `docs/spec/v0/00-overview.md` §2.2 (out-of-scope)
- `docs/spec/v0/05-tech-stack-decisions.md` ADR-0011 (Open-Less patterns only)
- `.scratch/macos-siminterpret-poc/issues/05-realtime-voice-translator-deep-read.md` (check_voicemeeter.py pattern)
- `.scratch/macos-siminterpret-poc/issues/21-virtual-sound-card-wiki-synthesis.md` (3 误区 self-check)
- `.scratch/macos-siminterpret-poc/issues/25-macos-vs-windows-platform-diff.md` (Windows v1+ effort estimate)
- `.scratch/macos-siminterpret-poc/map.md` Acceptance #1–5, Out of scope (Windows, AI 纪要, offline, etc.)
- Local-only reference: `01_技术可行性报告.md` L268–278 (8 acceptance criteria); `02_项目架构与技术栈.md` L115, L131, L145, L150, L173–174, L320, L497–524, L542–547, L562; `03_性能与成本分析.md` L246–249. Per `AGENTS.md` §"Local-only reference", paths only — no code copied.
