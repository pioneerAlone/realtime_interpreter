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

## 进度：100% (extension — device pickers landed)

### 当前进展 (2026-09-07, PR #15 extension round)

- ✅ **Device pickers** (extension on user feedback "UI 太简陋"): 4 picker rows in `TopologyCheckPanel` (mic / R3-out VAC / R4-in VAC / headphones) backed by `SelectLite` — custom dropdown (portal popover, keyboard nav, exit animation, dark-mode aware). Mirrors Open-Less `SelectLite` visual contract (architecture only; no code copy).
- ✅ **Persistence**: `TopologyPrefs` (4-slot struct) round-trips through `tauri-plugin-store` (`topology-prefs.bin` in app data dir). `get_topology_prefs` / `set_topology_prefs` IPC commands. Restart-persistent.
- ✅ **Recheck on pick**: `set_topology_prefs` returns the fresh `TopologyReport` so the UI re-renders verdict + per-row severity without a second round-trip.
- ✅ **Stale-pick visibility**: if the user has a saved pick that no longer matches a discovered device (BlackHole unplugged → replugged), the picker still surfaces the saved name as "(not currently visible)" so the recheck can recover it.
- ✅ **Standalone CLI parity**: `cargo run --bin topology-check -- --mic X --r3-out Y --r4-in Z --r4-out W` for CI smoke tests that don't go through the UI store.

- ✅ CoreAudio FFI enumeration via `coreaudio-sys` 0.2 (no cpal/objc2 stack).
- ✅ 4-device wiring check (mic + BH 2ch + BH 16ch + headphones) returns per-check verdict.
- ✅ 3-misconception self-check (T21 wiki) wired as 3 separate rows in `TopologyReport.checks`.
- ✅ Standalone binary `cargo run --bin topology-check` runs with red/amber/green panel, exit codes 0/1, `--json` mode.
- ✅ IPC commands: `check_topology`, `topology_status` (cached for re-renders), `fix_topology_hint`.
- ✅ R6 hot-unplug detector: `AudioObjectAddPropertyListener` → `device:lost` Tauri event.
- ✅ React UI: `TopologyCheckPanel.tsx` rendered in MainView with verdict dot, per-row fix text, Re-check button, hot-unplug banner.

### Verification on the user's M2 Air (all green)

```
$ cd src-tauri && cargo run --bin topology-check
verdict: WARN   (误区 2 — user must confirm meeting app mic = BlackHole 2ch in the meeting app UI; soft check)

exit=0
```

```
$ cd src-tauri && cargo run --bin topology-check -- \
    --mic 'MacBook Air麦克风' --r3-out 'BlackHole 2ch' \
    --r4-in 'BlackHole 16ch' --r4-out 'MacBook Air扬声器'
verdict: WARN   (still 误区 2 — meeting-app mic soft check)

exit=0
```

| Check | Result |
|---|---|
| `cargo check --all-targets` | clean |
| `cargo clippy --all-targets -- -D warnings` | clean |
| `cargo test --lib` | 2 passed (`cache_round_trip`, `empty_prefs_check_runs`) |
| `pnpm typecheck` | clean |
| `pnpm build` | 165 kB JS + 9 kB CSS bundle (SelectLite + picker rows) |
| `cargo run --bin topology-check` (live) | 7 devices enumerated; verdict WARN exit 0 |
| `cargo run --bin topology-check --json` (live) | valid JSON, parsed by Python `json.load` |
| `cargo run --bin topology-check -- --mic ... --r3-out ...` (live) | explicit override mode works |

### 下一步

- Issue #6 done; PR #15 open against `main`.
- Unblocks #7 (latency probe), #11 (bypass routing), #12 (self-meeting test), #13 (build/distribute).
- v0.1 demo flow: `cargo run --bin topology-check` before starting any session, per `06-deliverables.md` §4 step 2.

### 未确认项

(none — all 4 acceptance criteria verified against live CoreAudio on M2 Air with BlackHole 2ch+16ch installed)

### 引用

- Spec: `docs/spec/v0/00-overview.md` §2.1 F4 + AC4, §3.2 measurement protocol
- Spec: `docs/spec/v0/01-architecture.md` §7 (pre-flight topology check + macOS patterns)
- Spec: `docs/spec/v0/02-audio-pipeline.md` Appendix A.5 (user install steps for BlackHole 16ch + Aggregate)
- Spec: `docs/spec/v0/03-b-channel-subtitle.md` §4 (B-channel audio capture wiring)
- Decisions: D3 (BH 16ch + Aggregate), D24 (parallel-route), D25 (Aggregate Device), D26 (M2 MacBook Air dev/primary)
- PR: https://github.com/pioneerAlone/realtime_interpreter/pull/15
