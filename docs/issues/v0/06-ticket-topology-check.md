## Goal

Land the pre-flight topology checker — a standalone Rust binary (`cargo run --bin topology-check`) plus the matching `ipc/topology::check` IPC command — that validates the 4-device wiring and the 3 anti-pattern "误区" mistakes at app start and on demand — so that no session can start in a topology that would cause a feedback loop.

## Acceptance criteria

- **AC4 — 4-device wiring detected correctly via pre-flight topology check**: at app start, validates (a) real mic ≠ BlackHole input, (b) BlackHole 2ch = R3 翻译输出, (c) BlackHole 16ch = 对方声音输入, (d) real headphones = 对方翻译输出. Per `00-overview.md` §3 AC4 + `06-deliverables.md` §3.1.
- **3-误区 self-check** (per `00-overview.md` §3 AC4 + `06-deliverables.md` §3.1): validates (a) R3 output VAC ≠ R4 input VAC, (b) meeting app mic input = R3 output VAC (not real mic), (c) 对方翻译输出 → real headphones only. Reject start if any check fails; surface actionable error.
- **Binary exit code**: `cargo run --bin topology-check` exits 0 on green, exits 1 with structured error on red/yellow. UI renders red/amber/green panel and refuses to start a session until amber or green (per `01-architecture.md` §7 pre-flight topology check).
- **Hot-unplug detection** (R6 per `00-overview.md` §6): CoreAudio device-change listener via `coreaudio-sys` 0.2 (per `openless-take.md` §4 #3); emits `device:lost` Tauri event; UI prompts "device changed — re-check topology" and pauses A/B channels.

## Implementation notes

- **Modules to be built**: `src-tauri/src/bin/topology-check.rs` (standalone binary), `src-tauri/src/ipc/topology.rs` (`topology::check` runs at app start + on demand; `topology::get_status` returns cached status so UI re-renders don't re-probe), `src-tauri/src/platform/macos.rs::enumerate_blackhole_devices` (queries CoreAudio via `coreaudio-sys` for BlackHole 2ch and BlackHole 16ch by name + channel count), hot-plug listener via `AudioObjectAddPropertyListener` per `openless-take.md` §4 #3 (pattern only, no code copy).
- **Pre-flight checklist** (per `01-architecture.md` §7 pre-flight + `06-deliverables.md` §3.1): (1) confirm mic input exists; (2) confirm BlackHole 2ch exists (R3 output); (3) confirm BlackHole 16ch / alternate loopback exists (R4 input); (4) confirm headphones/speaker exists (原声直出 output); (5) **3-misconception self-check** per `map.md` L124–128; (6) optional 1 kHz tone probe: route 1 s through BlackHole 2ch → capture from BlackHole 16ch → assert RMS > threshold (mirrors `check_voicemeeter.py` per `poc-docs-take.md` §7 + `05-realtime-voice-translator-deep-read.md` L72).
- **UI affordance**: `TopologyCheckPanel.tsx` shows red/amber/green panel with each check listed and actionable fix text per failure mode (e.g., "BlackHole 16ch missing — install via `brew install blackhole-16ch`").
- **1 kHz tone probe** (optional, when invoked from settings): plays a 1 s 1 kHz sine through the R3 BlackHole 2ch, captures from R4 BlackHole 16ch, asserts RMS > threshold. This proves the buses are not silently disconnected.
- **Reference decisions**: D13 (BlackHole 16ch + Aggregate Device, NOT ScreenCaptureKit), D25 (B-channel routing).
- **Spec cross-refs**: `01-architecture.md` §7 (pre-flight topology check enumeration), `00-overview.md` §3 AC4 (4-device wiring + 3 误区) + §6 R6 (audio device changes mid-session), `03-b-channel-subtitle.md` §4 (4-device wiring model), `06-deliverables.md` §3.1 (binary deliverable + 3 误区 self-check enumeration).

## Test plan

Single acceptance seam. Per `06-deliverables.md` §3.1:
- Manual smoke: with a correctly-wired machine (BlackHole 2ch + BlackHole 16ch installed; Aggregate Device configured), `cargo run --bin topology-check` exits 0 with all 4 device checks + 3 误区 checks green.
- Negative test: disconnect BlackHole 16ch, rerun — binary exits 1 with actionable error "BlackHole 16ch not found — install via `brew install blackhole-16ch`".
- Negative test: misroute meeting-app mic to real mic instead of BlackHole 2ch — binary exits 1 with "meeting app mic = real mic; should be BlackHole 2ch".
- Hot-unplug smoke: unplug BlackHole 2ch mid-session — UI emits `device:lost` banner; user must re-run pre-flight to resume.
- Self-meeting test (ticket #12) requires topology-check to be green before it starts.

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml + `cpal 0.15` + `coreaudio-sys 0.2` deps).

## Out of scope for this ticket

- **Audio pipelines (R3 / R4)** — only checks the topology, does not run sessions.
- **BlackHole install automation** — README + brew instructions suffice; no automated installer at v0.
- **Multi-conference-software setup guides** (Zoom/Teams/腾讯会议 specific UI) — covered indirectly because topology check validates device routing regardless of conference app.
- **Audio MIDI Setup automation** — UI references the Aggregate Device by name; creating it remains a manual step in Audio MIDI Setup.

## 进度：5%

### 当前进展 (2026-09-07, after PR #14 merged)
- ✅ PR #14 merged (squash 279fa22): v0 scaffold in main, all 8 AC verified.
- ✅ Issue #2 closed, listed in issue #1 Decisions so far.
- ✅ Issue #6 claimed: assignee = session user.
- ✅ Branch created: `feature/ticket-06-topology-check` from `main@279fa22`.
- ⏳ Pending: actual implementation (Rust binary + IPC command + UI panel + Zustand store integration).

### 下一步 (next session, fresh context)
- Load `/implement` skill from `/Users/wangbo/.agents/skills/implement/SKILL.md`.
- Entry point: `git checkout feature/ticket-06-topology-check` + read issue #6 body.
- First commit target: `cargo run --bin topology-check` exits 0 on a machine with BlackHole 16ch installed; exits 1 with structured error on misconfig.
- Build verification: `cargo check` + `cargo clippy --all-targets -- -D warnings` + `pnpm typecheck` all pass.
- After #6 close: unblocks #7 (latency probe), #11 (bypass routing), #12 (self-meeting test), #13 (build/distribute).

### 决策记录 (decision context)
- #6 chosen over #3 because v0 value proposition = UI completeness (4-device wiring visible to user), not end-to-end audio demo (which requires #8/#9/#10 unblocked first).
- See `docs/spec/v0/UI-EVOLUTION.md` for the per-ticket UI commitment map.
- See `docs/decisions/round-3-confirmations.md` for D24/D25/D26 (parallel-route, BH 16ch, M2 Air hardware) that this ticket implements.

### 引用
- Spec: `docs/spec/v0/00-overview.md` §2.1 F4 + AC4, §3.2 measurement protocol
- Spec: `docs/spec/v0/01-architecture.md` §7 (pre-flight topology check + macOS patterns)
- Spec: `docs/spec/v0/02-audio-pipeline.md` Appendix A.5 (user install steps for BlackHole 16ch + Aggregate)
- Spec: `docs/spec/v0/03-b-channel-subtitle.md` §4 (B-channel audio capture wiring)
- Decisions: D3 (BH 16ch + Aggregate), D24 (parallel-route), D25 (Aggregate Device), D26 (M2 MacBook Air dev/primary)
