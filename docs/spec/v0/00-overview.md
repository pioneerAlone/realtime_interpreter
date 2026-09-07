# 00 · Overview — v0 实时双向同传 (双通道版)

> **Status**: DRAFT (round 2 of /grill-with-docs, 2026-09-06). Not committed to git yet.
> **Owner**: `pioneerAlone/realtime_interpreter` (GitHub repo per `docs/agents/issue-tracker.md`).
> **Source-of-truth documents**: `docs/research/poc-docs-take.md`, `docs/research/openless-take.md`, `docs/research/latency-budget-v0.md`, `docs/agents/issue-tracker.md`, `AGENTS.md`, `.scratch/macos-siminterpret-poc/map.md`. Every claim traces to one of these — see §8.
> Items still requiring user confirmation are marked **[REVIEW]**.

### 0.1 How to read this document

- **Spec writers / implementers**: focus on §2 (scope), §3 (acceptance criteria), §5 (architecture summary), and the citations in §6 (risk register). Every "F" or "AC" or "R" ID is stable — copy/paste into GitHub issues per `docs/agents/issue-tracker.md`.
- **Reviewers / grillers**: focus on §4 (PoC contradictions reconciled) and §7 (open decisions). §4 is normative; if you disagree, file a new ticket tagged `needs-human-decision` before v0 lock.
- **Future agents porting from the PoC**: read §2.2 (what to drop) and §4 (which contradictions to ignore). The PoC at `realtime_interpreter_Minimal_Implementation/` is git-ignored per `AGENTS.md` §"Local-only reference" — read `poc-docs-take.md` instead.

### 0.2 Glossary (project-specific terms)

| Term | Meaning | Source |
|---|---|---|
| A-channel / R3 | Outbound speech pipeline: my voice → translation → meeting hears | `map.md` Notes "Tech route" |
| B-channel / R4 | Inbound speech pipeline: meeting's voice → system audio → subtitles I see | `map.md` Notes "Tech route" |
| s2s / s2t | Speech-to-speech / speech-to-text modes of Doubao 同传 2.0 | `poc-docs-take.md` §3 row "A-通道 mode" |
| 0-sample clone | Voice clone without pre-training (`speaker_id=""`) | `poc-docs-take.md` §3; `map.md` Decisions #4 |
| 蓄能 (prefill) | Initial fill of the playback ring buffer to absorb startup jitter | `poc-docs-take.md` §4.1 stage 7 |
| B1 总线隔离 | Voicemeeter / BlackHole-style physical bus isolation to prevent feedback | `map.md` Decisions #5 |
| 3-误区 | Three anti-pattern topology mistakes (T21 wiki research) | `map.md` Not-yet-specified "T21" |
| Cascade | v1 path: local ASR → Doubao S2T → local TTS (replaces single S2S endpoint) | `latency-budget-v0.md` §5 |
| FLAL | First-Letter Arrival Latency (paper metric) | `latency-budget-v0.md` §3 stage 5; `arXiv:2410.00037` |

---

## 1. Product summary

v0 is the **first shipping cut** of an open-source macOS-first realtime Chinese↔English interpreter that competes with 金喜同声传译双通道版 (closed-source commercial; see `map.md` Destination + Comments session #2). It delivers **dual channels** in one Tauri app:

- **A-channel (R3)** — you speak Chinese → meeting hears your-voice English via zero-sample voice cloning on Doubao 同传 2.0 S2S (no pre-training, `speaker_id=""` per `map.md` Decisions #4).
- **B-channel (R4)** — other party speaks English → you see bilingual source + translated subtitles in a floating panel driven by Doubao 同传 2.0 S2T (same WebSocket endpoint, different mode, per `poc-docs-take.md` §3 row "Doubao endpoint URL").

v0 ships **macOS only**, targets **≤ 3 s first-sound latency** on M2 Air (user decision 2026-09-06, per `latency-budget-v0.md` §1.1), licensed **MIT/Apache** per `map.md` Acceptance #5. v0 is **not** a v1 cascade, **not** Windows, **not** offline, **not** multi-language, **not** AI 纪要, **not** 术语库 — see §2.2 and `map.md` Out of scope.

### 1.1 What "compete with 金喜" means concretely

| Aspect | 金喜 (per `map.md` Notes + `15-jinxi-architecture-reverse.md` L33, L70 cited in `latency-budget-v0.md` §3 stage 5) | v0 (this spec) |
|---|---|---|
| First-sound (user-perceived) | ~1.3 s (1 s delta over Doubao S2S FLAL 2.21 s) | ≤ 3 s median |
| Architecture | Cloud S2S + pre-roll tricks (VAD warmup + protocol buffer + OS audio buffer + cn-beijing RTT) | Cloud S2S + Rust `opus` crate stream decode |
| Voice clone | Standard: 0-sample via Doubao S2S session; Premium: pre-trained (MEDIUM confidence) | 0-sample only (F7) |
| Open-source | No (closed, ¥49–4999) | Yes (MIT/Apache) |
| Multi-channel | Dual channel (R3 + R4) | Dual channel (F1 + F2) |
| Cost | 9–12 元/小时 standard; 2–3 元/小时 premium | ~5–14 元/小时 (user BYO API key) |
| Platform | macOS + Windows | macOS only (F9 macOS-only Tauri config per `openless-take.md` §2) |

The 1.7 s gap (3.0 − 1.3) is the **structural ceiling** of cloud-only S2S — `latency-budget-v0.md` §1.4 fixes stage 5 (Doubao AST 2.0 S2S inference) at ≥ 2100 ms. v1 cascade (`latency-budget-v0.md` §5) is the path to ≤ 2 s.

---

## 2. v0 scope

### 2.1 In scope

The 12 features below constitute v0's contract. Anything not on this list is v1+.

| ID | Feature | Source / decision |
|---|---|---|
| F1 | A-channel s2s (R3) end-to-end on Mac | `poc-docs-take.md` §1.1 (PoC proved through TTS pipeline); `latency-budget-v0.md` §2 stages 1–10 |
| F2 | B-channel s2t subtitle (R4) on Mac | `poc-docs-take.md` §7 row "R4 B-通道 (英→中字幕, mode=s2t)"; `map.md` Notes "T01 + T16 共同确认……R4 不需要独立 MT 模块" |
| F3 | 4-device BlackHole wiring + Multi-Output Device | `latency-budget-v0.md` §2 stage 9; `poc-docs-take.md` §2 row "Virtual-audio-card strategy"; `map.md` Decisions #1 (T06 macOS routing research) |
| F4 | Pre-flight topology checker (analogous to `check_voicemeeter.py`) | `poc-docs-take.md` §7 row "Pre-flight topology checker"; `map.md` Not-yet-specified "类似 check_voicemeeter.py 的启动前拓扑验证工具" |
| F5 | First-sound latency ≤ 3000 ms median on M2 Air, 5 runs | `latency-budget-v0.md` §1.1; user decision 2026-09-06 |
| F6 | Dual-channel self-meeting test (no feedback, both channels simultaneously) | `map.md` Acceptance #2 "R3+R4 双通道端到端"; `map.md` Decisions #5 (B1 总线隔离原理) |
| F7 | Zero-sample voice cloning without pre-enrollment (`speaker_id=""`) | `poc-docs-take.md` §3 row "A-通道 mode"; `map.md` Decisions #4 (T01 + T04 correction — 声音复刻 2.0 is *not* a v0 prerequisite) |
| F8 | 4-channel RMS level meter (mic / 翻译输出 / 对方输入 / 耳机输出) | `poc-docs-take.md` §7 row "4 通道电平表"; design from `02_项目架构与技术栈.md` L79 |
| F9 | System tray + multi-window (settings, floating subtitle, level meter) | `openless-take.md` §2 "How the GUI + native split is structured" (Tauri 2 tray + capsule pattern) |
| F10 | IPC barrel pattern (`lib/ipc/<domain>.ts` + `index.ts`) | `openless-take.md` §3 + §6 pattern #3 (per-domain file + single index.ts re-export, with `invokeOrMock` 2.0 contract handshake) |
| F11 | Auto-reconnect with voice re-clone (`format=pcm` is **not** available; we use `ogg_opus`) | `latency-budget-v0.md` §4 R1; `poc-docs-take.md` §3 row "Auth scheme" + "Audio output spec"; `02_项目架构与技术栈.md` L131 |
| F12 | v1 cascade interface seam (capture frame chunk / subtitle stream / TTS command) | `map.md` Notes "代码里预留 v1 cascade 接口"; `latency-budget-v0.md` §5. **Locked (per decisions/round-2-confirmations.md D19)**: seam is a v1 ticket, not a v0 implementation deliverable. v0 ships as cloud-only Doubao S2S + S2T. |

### 2.2 Out of scope (deferred to v1+)

Each deferral is an explicit destination decision, not an oversight. Each line carries a `map.md` or `poc-docs-take.md` citation so we can re-evaluate at v1 kickoff.

- **Windows platform parity** — `map.md` Out of scope "用户唯一环境是 macOS"; `poc-docs-take.md` §7 row "阶段3: Windows 适配 ⏳待开发". v0 = `tauri.macos-mlx.conf.json`-only (per `openless-take.md` §2 per-platform override pattern).
- **AI 纪要 (meeting minutes)** — `poc-docs-take.md` §7 row "AI纪要"; deferred per `map.md` Out of scope. Cost estimate: ~0.1–0.5 元/次 per `03_性能与成本分析.md` L188, but not built.
- **Voice-clone library persistence across sessions** — `poc-docs-take.md` §4.5 row "Whether 0-sample cloning stays consistent across one long session"; deferred to v1's 声音复刻 2.0 子命令 per `map.md` Decisions #4 "已知限制" (Doppelvoice CHANGELOG self-admits reconnect drift).
- **术语库 (custom glossary / `corpus.boosting_table_id` / `corpus.regex_correct_table_id`)** — `poc-docs-take.md` §7 row "术语库". Doubao Protobuf field exists; v0 ships without it; v1 may expose via settings window.
- **Multi-conference-software adapters** (Zoom/Teams/腾讯会议/钉钉/飞书/Meet/OBS setup guides) — `poc-docs-take.md` §7 row "会议软件配置图文引导". Covered indirectly by topology check (F4) which validates device routing regardless of conference app.
- **Auto-update + DMG/NSIS packaging** — `poc-docs-take.md` §7 row "electron-updater 自动更新 + DMG/NSIS 打包". GitHub Releases + manual download only at v0.
- **Code signing / notarization** — `poc-docs-take.md` §7 row "Mac notarization + Win 代码签名". Distribution gate to macOS Gatekeeper at v0 is the developer's Developer ID; org-level notarization is v1+ per `map.md` Out of scope.
- **DeepFilterNet local denoise** — `latency-budget-v0.md` §3 stage 3 "Do not integrate DeepFilterNet at v0"; `poc-docs-take.md` §1.2 row "DeepFilterNet integration". 100 ms cost per `poc-docs-take.md` §4.1 stage 3 is unaffordable when stage 5 alone is 2100 ms; server-side `denoise=false` is canonical at v0.
- **Multi-language (zh↔ja/zh↔ko/en↔ja etc.)** — `map.md` Out of scope "destination 只锁中英". Doubao supports 9 languages per `map.md` Decisions #4 but extending is a v1 config flip.
- **Offline / full-local cascade (v1 path)** — `latency-budget-v0.md` §5; `map.md` Out of scope "离线完全本地模式". Requires sherpa-onnx + CosyVoice 3 + model quantization; engineering effort roughly doubles.

#### 2.2.1 What "deferred" means concretely

Deferred items are **not** to be partially implemented. Either v0 ships the feature end-to-end or it ships nothing for that feature. The rationale is:

1. **Half-built features ship as bugs.** A F7-without-F8 (0-sample clone without stable voice library) is a known-bad state (per `map.md` Decisions #4 "已知限制" — Doppelvoice CHANGELOG admits drift).
2. **Surface area for security review is per-feature.** `map.md` Acceptance #5 promises "开源就意味着代码质量 / 文档 / 测试覆盖不能糊弄". Each added feature expands the audit surface.
3. **v1's cascade path is the structural fix** for several "deferred" items (R7 voice drift, latency floor, etc.) — implementing them before the cascade seam (F12) is wasted work.

---

## 3. Acceptance criteria

Each criterion is testable on M2 Air (the user's sole hardware per `map.md` Notes "用户上下文"). Test protocol follows `latency-budget-v0.md` Appendix D. Numbering is stable for cross-referencing in GitHub issues (each AC becomes a `gh issue create --label acceptance-criteria` per `docs/agents/issue-tracker.md`).

- **AC1 — A-channel first-sound latency ≤ 3000 ms** (soft at v0, hard at v0.5): median of 5 runs, wired cn-north network, M2 Air, `denoise=false`, `ogg_opus` path. Per `latency-budget-v0.md` §1.1 + Appendix D test #7. **Locked (per decisions/round-2-confirmations.md D18)**: v0 ships even if measured > 3 s; recovery options per `latency-budget-v0.md` Appendix B. Optimization continues post-launch; the structural fix (v1 cascade) is tracked as a v1 ticket.
- **AC2 — B-channel first-subtitle latency ≤ 2500 ms**: median of 5 runs on M2 Air, `mode=s2t`, exclude TTS — per `poc-docs-take.md` §4.2 "~1.5s end-to-end" claim, but budget ≥ 1 s headroom for system audio loopback + 字幕 rendering. Test uses a 30 s pre-recorded English file as input.
- **AC3 — A-channel zero-sample voice cloning works without pre-enrollment**: speak 30 s of Chinese into the mic, ask the meeting (human-judgement pass) "did the English voice sound like you?". Test protocol per `poc-docs-take.md` §4.5 row "Whether `speaker_id` ever be set to a non-empty value" (PoC verified `speaker_id=""` works at L379).
- **AC4 — 4-device wiring detected correctly via pre-flight topology check**: at app start, validate (a) real mic ≠ BlackHole input, (b) BlackHole 2ch = 翻译输出, (c) BlackHole 16ch = 对方声音输入, (d) real headphones = 对方翻译输出. Per `map.md` Not-yet-specified "3 个必检误区" (T21) and `poc-docs-take.md` §7 row "3-误区 self-check". Reject start if any check fails; surface actionable error.
- **AC5 — Dual-channel self-meeting test passes**: open a Zoom (or any) meeting with self as sole attendee, enable both A and B channels simultaneously, hold a 60 s conversation; no audible feedback loop, both channels produce expected output. Per `map.md` Acceptance #2 + `poc-docs-take.md` §7 row "Dual-channel self-meeting test". Must be runnable as a one-shot CLI test (no human interaction).
- **AC6 — Resource ceiling during 30-min continuous run**: CPU ≤ 30% avg, RAM ≤ 400 MB resident on M2 Air. Per `latency-budget-v0.md` §4 R1 (proxy) and `poc-docs-take.md` §1.2 row "Acceptance metrics vs. measurements" (PoC aspirational bar = CPU ≤ 20% / RAM ≤ 300 MB; v0 targets relaxed per `map.md` Notes "金喜没有公开的 CPU / RAM 数字").
- **AC7 — Latency stability over 30-min continuous run**: A-channel first-sound median does not drift > 500 ms between first and last 5-minute windows. Per `poc-docs-take.md` §4.5 row "Whether 0-sample cloning stays consistent across one long session". Drift > 500 ms indicates either jitter buffer miscalibration (stage 7 per `latency-budget-v0.md` §2) or 0-sample cloning drift (Doppelvoice CHANGELOG per `map.md` Decisions #4).
- **AC8 — Network resilience**: after a forced 3-second network drop (`pfctl` rule or wifi toggle), the session auto-reconnects within ≤ 3 s of network recovery, and the voice re-clone succeeds on the next sentence (no manual restart). Per `poc-docs-take.md` §4.4 row "Reconnect strategy" (指数退避 1s/2s/4s, max 3 retries) + §4.5 row "Reconnect-side behaviour" (10s cache + re-clone).

### 3.1 Acceptance criteria not in v0

These are deferred to v1+ but listed for transparency so future agents don't ask "where's BLEU?":

- **BLEU ≥ 85%, 音色相似度 ≥ 3.5/5, SNR ≥ 10 dB** — per `01_技术可行性报告.md` L268–278 cited `poc-docs-take.md` §1.2. Not measured by PoC, not required by v0 contract.
- **Per-hour cost ≤ ¥5** — per `map.md` Acceptance #4 "v0 接受 ~5-14 元/小时". Tracked but not enforced as hard acceptance bar at v0 (depends on user's API key tier per `map.md` Not-yet-specified "T02 揭示的硬阻塞 #2").
- **Speaker-change detection / 双语原文 spk_chg-driven split** — per `poc-docs-take.md` §7 row "Spk_chg 说话人识别". Not in v0; v1 may add.

### 3.2 Per-AC measurement protocol (sketch)

| AC | Measurement | Pass criterion | Re-measure on |
|---|---|---|---|
| AC1 | Play pre-recorded 30 s CN file → measure audio-out arrival on BlackHole capture | median over 5 runs ≤ 3000 ms | M2 Air, wired cn-north, fresh app start |
| AC2 | Play pre-recorded 30 s EN file → measure first subtitle render in floating window | median over 5 runs ≤ 2500 ms | M2 Air, fresh app start |
| AC3 | 30 s live-mic CN, ask meeting "voice match?" | subjective pass (binary) | every release |
| AC4 | Run topology checker at app start | all 4 device checks return true | every launch + after device-change event (AC6 R6) |
| AC5 | Self-meeting: open Zoom, hold 60 s conversation, listen for feedback | no audible loop, both channels produce output | every release |
| AC6 | `top -pid $(pgrep realtime-interpreter)` over 30 min run | CPU avg ≤ 30%, RSS ≤ 400 MB | M2 Air, every release |
| AC7 | Same protocol as AC1 but split run into 6 × 5-min windows | first window median − last window median ≤ 500 ms | every release |
| AC8 | `sudo pfctl -e` rule to drop wss://openspeech.bytedance.com for 3 s, then unblock | auto-reconnect within 3 s + next sentence voice-cloned | every release |

Detailed test protocol per `latency-budget-v0.md` Appendix D (7 specific test plans for stages 1–9).

---

## 4. Internal PoC contradictions — reconciled per round-2 decisions

The PoC docs contradict themselves on five points. Each is resolved here per the round-2 user decisions (`map.md` Comments session #2 — "原 T01-T06 仍有效（基础事实不变），但需重新解读为「产品对标」的输入而非「PoC 链路」的输入"). These resolutions are normative for v0 — if any other agent re-encounters the contradiction, this section is the tie-breaker.

### 4.1 Playback status: README "调试中" vs `01_技术可行性报告.md` appendix "✅ 已优化"

- **Conflict**: `poc-docs-take.md` §1.1 / §5 Q1 — README 当前状态 table lists 阶段1 as "🔄 验证中 / 播放端采样率问题调试中", while `01_技术可行性报告.md` L386 (cited `poc-docs-take.md` §1.1) marks the playback rewrite as "✅ 已优化".
- **Resolution**: Treat **playback rewrite as PoC-verified** (`bytearray` ring + 120 ms 蓄能 + `threading.Lock`, per `poc-docs-take.md` §2 "Key module/symbols in `mac_ast2_s2s_v2.py`"); **re-tune on parent project M2 Air** because BlackHole's native sample rate (48 kHz per `latency-budget-v0.md` §3 stage 9) and the PoC's M2 calibration are not guaranteed identical (per `poc-docs-take.md` §4.5 row "Whether the 120 ms playback 蓄能 + 40–80 ms jitter buffer is the right calibration on M-series").
- **Why**: The 120 ms 蓄能 pattern is provably thread-safe (3 prior Python approaches failed per `poc-docs-take.md` §2 "Notable module/symbols"); the calibration numbers are environment-specific. Lock the pattern, retune the numbers on real M2 Air hardware.

### 4.2 Auth scheme: 2-header vs 3-header

- **Conflict**: `poc-docs-take.md` §3 row "Auth scheme" — `02_项目架构与技术栈.md` L128 documents the 3-header scheme (`X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id`) as canonical; `01_技术可行性报告.md` L405–406 and README L137–147 say the 2-header scheme (`X-Api-Key` + `X-Api-Resource-Id`) is what works.
- **Resolution**: **Canonical = 2-header (`X-Api-Key` + `X-Api-Resource-Id`)**. The 3-header scheme is kept only as a fallback for diagnostic parity with `realtime_interpreter_Minimal_Implementation/src/auth_test.py` (per `poc-docs-take.md` §6 row "`auth_test.py`" — "the probe must be runnable as a standalone CLI"). The auth-probe iterates over both header schemes × both console origins (语音控制台 vs 方舟控制台); only 2-header + 语音控制台 works (per `poc-docs-take.md` §3 row "Auth scheme").
- **Why**: 2-header is what `auth_test.py` empirically verified against 语音控制台; the 3-header doc row is stale (per `poc-docs-take.md` §3 "Notable internal inconsistency"). API Key must come from **语音控制台**, not 方舟控制台 (per `map.md` Decisions #7).

### 4.3 Latency budget: PoC's 2.6–2.9 s vs measured 3.0–3.7 s

- **Conflict**: `poc-docs-take.md` §4.1 — `03_性能与成本分析.md` L30–42 declares 2600–2900 ms (broken down as 40 + 0 + 100 + 80 + 2200 + 60 + 40–80 + 40), but the same doc admits the number depends on `format=pcm` which the API does not honor (per `01_技术可行性报告.md` L408 cited `poc-docs-take.md` §4.1). Actual PoC baseline is 3000–3700 ms with `soundfile` whole-sentence decode.
- **Resolution**: **v0 target = 3000 ms median** with the ogg_opus + `opus` crate stream-decode path (`latency-budget-v0.md` §1.5 envelope — 2270 ms floor, 2570 ms realistic, 430–730 ms margin). Do **not** ship the 2.6–2.9 s number anywhere user-facing — it depends on an API capability the server does not deliver.
- **Why**: `latency-budget-v0.md` §1.4 + §2.2 shows 2270–2570 ms is reachable on the ogg_opus path with a Rust + `opus` crate rebuild; the 2.6–2.9 s is wishful and depends on `format=pcm` which is "目前不生效" (per `01_技术可行性报告.md` L408 cited `poc-docs-take.md` §4.1).

### 4.4 Platform: PoC "先 Windows 后 Mac" vs destination "Mac-first"

- **Conflict**: `poc-docs-take.md` §5 Q7 — `01_技术可行性报告.md` L345 ("**先 Windows 后 Mac**：用户主要使用 Windows") and `02_项目架构与技术栈.md` L566 ("开发策略 … 先 Windows 后 Mac") BOTH recommend Windows-first, but `map.md` Destination + Acceptance state Mac-only (M2 MacBook Air is the user's sole hardware, per `map.md` Notes "用户上下文").
- **Resolution**: **v0 = macOS-only**. Windows is v1+ (per `map.md` Out of scope "Windows 平台对等——用户唯一环境是 macOS"). All per-platform Tauri config overrides from Open-Less (`openless-take.md` §2 "How the GUI + native split is structured" — Android/Linux/macOS-mlx/Windows conf files) are scoped to **macOS only** at v0.
- **Why**: Single-hardware developer (M2 Air per `map.md` Notes); cross-platform Tauri config overhead (`openless-take.md` §2 cost — "A separate `openless-core` crate was carved out" + 4 per-platform Tauri conf files + Linux Tauri abandonment replaced with egui) is unjustified until Win ships.

### 4.5 Event-code schema: PoC subset vs `02_项目架构与技术栈.md` superset vs s2t 650–655

- **Conflict**: `poc-docs-take.md` §5 Q10 + Q13 — PoC source handles 100/150/200/211/221/351/352/999; `02_项目架构与技术栈.md` L272–288 documents a superset including 210/212/220/222/230/900/901; `01-volcengine-api-capabilities.md` (cited `map.md` Decisions #6) reports s2t-mode events **650–655** for source/translation subtitles on the SAME WebSocket session.
- **Resolution**: **s2s mode = PoC subset** (100, 150, 200, 211, 221, 351, 352, 999); **s2t mode = 650/651/652 (SourceSubtitle Start/Complete) + 653/654/655 (TranslationSubtitle Start/Complete)** per `map.md` Decisions #6. The 210/212/220/222/230/900/901 superset is documented but unimplemented at v0; future-proof by parsing them as **unknown-but-logged** (never silently drop, never panic).
- **Why**: `map.md` Decisions #6 confirms s2t events are 650–655, and `map.md` Decisions #11 confirms R4 = 1 WS + 1 session (mode=s2t, same endpoint). Shipping the minimum needed keeps the binary lean and lets us add event handlers incrementally without parser refactors.

---

## 5. Architecture one-paragraph summary

v0 is a **Tauri 2 + Rust-heavy** desktop app with a thin **React 18 + TypeScript 5.6 + Vite 6** frontend (`openless-take.md` §2 + §3) — Rust owns audio I/O (`cpal 0.15`, per `openless-take.md` L32 + `latency-budget-v0.md` Appendix C stage 1), Opus decode (`opus` crate stream, per `latency-budget-v0.md` §3 stage 8 — the single biggest v0 win over PoC's `soundfile`), the Doubao WebSocket client (`tokio-tungstenite` binary-only Protobuf over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, per `poc-docs-take.md` §3 + `latency-budget-v0.md` Appendix C stages 4+6), and protobuf binding regeneration (`prost` / `tonic`, per `poc-docs-take.md` §6 row "`ast_proto/`" + `latency-budget-v0.md` Appendix C row "Protobuf" — original `.proto` source must be obtained from Doppelvoice since the PoC only ships pre-compiled Python bindings). The frontend owns state via **Zustand** (departing from Open-Less's plain React Context, per `openless-take.md` §6 #2 — "Open-Less pattern does not scale to the interpreter's MT/ASR/TTS session lifecycle"), exposes typed IPC through a `lib/ipc/<domain>.ts` barrel mirroring Open-Less's pattern with `invokeOrMock` 2.0 contract handshake (`openless-take.md` §6 #3, `shared.ts:57-71`), and renders a settings window + system tray + floating subtitle window via `tauri-nspanel` for macOS full-Space windowing (`openless-take.md` §5 #1). Audio routing is **4-device BlackHole**: real-mic → A-channel → BlackHole 2ch → 会议软件 mic input (R3 path); 会议软件 系统音频 → ScreenCaptureKit `excludesCurrentProcessAudio=true` (or Multi-Output + BlackHole 16ch fallback) → B-channel s2t → bilingual subtitle window (R4 path per `map.md` Notes "Tech route" + Decisions #1). Doubao **R3 = S2S** (`volc.service_type.10053`, mode `s2s`, `speaker_id=""`, `denoise=false`); **R4 = S2T** on the same endpoint (mode `s2t`, filter out 350–352 events per `map.md` Decisions #6). Pre-flight topology check enforces the 3-误区 anti-loop (per `map.md` Not-yet-specified "T21"). Upcoming spec sections detail: 01-domain & CONTEXT, 02-stack & crate selection, 03-module boundaries (the `realtime-interpreter-core` framework-agnostic crate pattern from `openless-take.md` §6 #1 — paying off the day we want a second shell), 04-IPC contract, 05-frontend windows, 06-deployment & CI.

### 5.1 Stage-by-stage allocation

This is the mapping from the 10-stage waterfall (`latency-budget-v0.md` §2) to the Rust/TS component that owns each stage. Section 02 picks the crates; section 03 picks which module each stage lives in.

| Stage | ms budget (v0 target) | Owner module | Crate / lib | Source |
|---|---|---|---|---|
| 1 — capture buffer | 10 | `core::audio::capture` | `cpal 0.15` (256-frame CoreAudio HAL) | `latency-budget-v0.md` §3 stage 1 + Appendix C |
| 2 — VAD | 0 | `core::audio::vad` (tap on capture stream) | `vad-rs` Silero-v5 or inline RMS | `latency-budget-v0.md` §3 stage 2 |
| 3 — AGC | 5 | `core::audio::agc` | inline peak tracker or `webrtc-audio-processing` | `latency-budget-v0.md` §3 stage 3 |
| 4 — uplink | 50 | `core::net::ws_a` | `tokio-tungstenite 0.24.x` (binary Protobuf) | `latency-budget-v0.md` §3 stage 4 + Appendix C |
| 5 — S2S inference | 2100 (fixed ceiling) | n/a (server-side) | n/a | `latency-budget-v0.md` §3 stage 5 |
| 6 — downlink | 40 | `core::net::ws_a` (same conn as stage 4) | same | `latency-budget-v0.md` §3 stage 6 |
| 7 — jitter buffer | 40 initial + 20–40 adaptive | `core::audio::playback_ring` | `Arc<tokio::sync::Mutex<VecDeque<i16>>>` | `latency-budget-v0.md` §3 stage 7 + Appendix C |
| 8 — opus decode | 5 | `core::audio::opus_decode` | `opus 0.3.x` + custom OGG demuxer | `latency-budget-v0.md` §3 stage 8 + Appendix C |
| 9 — playback | 20 | `core::audio::playback` | `cpal 0.15` (same as stage 1) → BlackHole 2ch | `latency-budget-v0.md` §3 stage 9 + Appendix C |
| **Total** | **≤ 3000** | — | — | `latency-budget-v0.md` §1.5 |

R-channel (R4) stages are similar but skip stage 9 (no TTS playback) and add subtitle rendering in the TS frontend.

---

## 6. Risk register

Risks are ordered by severity (H × I first). Each row's mitigation traces back to a source document so we don't paper over known unknowns. Likelihood and Impact use L/M/H.

| ID | Description | L | I | Mitigation | Source |
|---|---|---|---|---|---|
| R1 | **Doubao AST 2.0 S2S inference regresses ≥ 2730 ms** (server cold-start, GC, or burst load) — the only stage that can mathematically blow the ≤ 3 s budget | M | H | (a) App-start warmup probe (saves ~100 ms cold-start per `latency-budget-v0.md` §3 stage 5); (b) real-time RTT + "翻译端延迟" badge in the tray menu; (c) auto-reconnect fresh session if S2S p99 > 2400 ms; (d) **structural fix = v1 cascade** (`latency-budget-v0.md` §5) | `latency-budget-v0.md` §4 R1 |
| R2 | **OGG demuxer for streaming TTSResponse chunks is custom Rust code** — PoC used `soundfile` which handled OGG internally; if demuxer is buggy (drops packet / mis-splits chunk), audio glitches force fallback to whole-sentence decode (+200 ms) | M | M | (a) Pre-flight: encode 1 s known-pattern ogg_opus locally, assert decoder output SNR > 40 dB (per `latency-budget-v0.md` Appendix D test #5 — **highest-risk test**); (b) keep `soundfile`-equivalent whole-sentence fallback **compiled in behind a feature flag**; (c) integration test = 1000 sentences glitch-free | `latency-budget-v0.md` §4 R3 |
| R3 | **Home wifi adds 50–150 ms to network budget** vs cn-north wired assumption; stage 4 + 6 = 90 ms on wired, can hit 200+ ms on wifi | H in real deployments | M | (a) Pre-flight RTT check at app start, warn if RTT > 150 ms (yellow per `03_性能与成本分析.md` L100–102 cited `poc-docs-take.md` §4.4); (b) "wired recommended" banner in user setup guide; (c) v1 cascade removes uplink cost entirely (local ASR per `latency-budget-v0.md` §5) | `latency-budget-v0.md` §4 R2 |
| R4 | **BlackHole 48 kHz native-rate assumption** — PoC playback bug was partly a 44.1/48 mismatch issue (`poc-docs-take.md` §1.1 "播放端采样率问题调试中"); if BlackHole #793 regresses on M-series, stage 9 jumps 20 ms → 40+ ms | L–M | M | (a) Pre-flight topology check rejects M-series where BlackHole doesn't enumerate at 48 kHz (per `06-macos-audio-routing-options.md` L44 cited `latency-budget-v0.md` §4 R4); (b) document BlackHole 2ch v0.7.1+ minimum version; (c) v1 alt = Process Tap (macOS 14.2+) or direct AVAudioEngine | `latency-budget-v0.md` §4 R4 |
| R5 | **Open-Less code contamination (AGPL-3.0 license)** — only architecture/patterns copied; if a developer "helpfully" ports a non-trivial function from `openless-all/app/src-tauri/src/*.rs`, the entire parent project must AGPL (incompatible with MIT per `map.md` Acceptance #5) | M if dev slips | H | (a) Hard rule: **never** copy `openless-all/app/src-tauri/src/*.rs` or `openless-all/app/crates/openless-core/src/*.rs` (AGPL-3.0-only per `openless-take.md` §1 + §6 #1); (b) only the **architecture** (Tauri 2 + Rust core + React shell + IPC barrel + NSPanel + per-domain `lib/ipc/`) is portable; (c) every parent-project Rust file carries a header note "independent implementation" if it draws on a specific Open-Less pattern | `openless-take.md` §1, §6 #1 |
| R6 | **Audio device changes mid-session** (hot-unplug, Bluetooth reconnect) — breaks the topology assumption AC4 is built on | M | M | (a) CoreAudio device-change listener via `coreaudio-sys` (per `openless-take.md` §4 #3 "macOS audio device change notifications use `coreaudio-sys` 0.2 directly") to fire `device-changed` Tauri event; (b) front-end surfaces a "device changed — re-check topology" prompt and pauses A/B channels; (c) user must re-run pre-flight check to resume | `openless-take.md` §4 #3 |
| R7 | **Zero-sample cloning "音色漂移" over a 30-min single session** (Doppelvoice CHANGELOG v0.2.2 + docs/ARCHITECTURE.md self-admits reconnect drift per `map.md` Decisions #4 "已知限制") | M in ≥ 30-min sessions | L–M | (a) Cache last 10 s of user audio per `02_项目架构与技术栈.md` L131 design (cited `poc-docs-take.md` §4.4 row "Reconnect-side behaviour"); (b) on reconnect re-send the cached audio as `speaker_id=""` warmup; (c) instrument sessions to log drift so v1 can decide whether to lock to a pre-trained `speaker_id` early via 声音复刻 2.0 | `poc-docs-take.md` §4.5; `map.md` Decisions #4 |

### 6.1 Risk severity calculation note

Likelihood × Impact matrix (used to order the table above):

| | L-impact | M-impact | H-impact |
|---|---|---|---|
| **H-likelihood** | skip | R3 (home wifi) | (none at v0) |
| **M-likelihood** | R7 (drift) | R2 (OGG demuxer), R4 (BlackHole rate), R6 (device hot-swap) | R1 (S2S inference) |
| **L-likelihood** | (none) | (none) | R5 (AGPL contamination) |

R1 and R5 are the only H-impact items; R5 is conditional on developer discipline ("if dev slips" per R5 row).

---

## 7. Open decisions (require user input before v0 lock)

These are the items where the spec defers to the user. Each maps to a future `gh issue create` (per `docs/agents/issue-tracker.md`) with label `needs-human-decision` once v0 lock is attempted.

1. ~~**[REVIEW]** **Acceptable v0 first-sound latency if measured > 3 s** in CI/production.~~ **Locked (per decisions/round-2-confirmations.md D18)**: v0 accepts a measured first-sound latency above 3 s as shippable; optimization continues post-launch. AC1 is **soft at v0**, **hard at v0.5**. Recovery options per `latency-budget-v0.md` Appendix B remain in scope but are ship-blocking if AC1 misses by > 500 ms.
2. ~~**[REVIEW]** **Latency-margin policy** — 430–730 ms margin (per `latency-budget-v0.md` §2.1) is enough headroom for v0, or invest in cascade interface seam (F12 in §2.1) immediately to make v1 ≤ 2 s reachable in a single release cycle.~~ **Locked (per decisions/round-2-confirmations.md D19)**: cascade seam goes in **after v0 launches**; not blocking for v0. v0 ships as cloud-only Doubao S2S + S2T (no local ASR/MT/TTS fallback). The v1 cascade contract (local ASR + Doubao S2T + CosyVoice 3) becomes a v1 ticket.
3. **[REVIEW]** **"原声直出" toggle** (per `poc-docs-take.md` §7 row "原声直出开关 (绕过同传)" and `02_项目架构与技术栈.md` L66) — should v0 ship with a UI switch to bypass B-channel translation when meeting software already translates? Affects cost (per `03_性能与成本分析.md` L241 "100%" bypass saving) and test matrix.
4. ~~**[REVIEW]** **Multi-language scope at v0** — zh↔en only (per `map.md` Out of scope) or include ja/ko on R3 only as a free win?~~ **Locked (per decisions/round-2-confirmations.md D23)**: **zh↔en only at v0**. Doubao 同传 2.0 supports 9 languages per `map.md` Decisions #4 but the Protobuf `source_language` / `target_language` fields are hard-coded `zh` / `en` in v0; language picker UI is deferred to v1+. Adding more languages later is a config flip, not a rebuild.
5. **[REVIEW]** **Distribution model** — DMG download from GitHub Releases (per `poc-docs-take.md` §7 row "electron-updater 自动更新 + DMG/NSIS 打包" and `map.md` Out of scope "macOS DMG 打包"), or also `brew install --cask`? Affects CI matrix (per `docs/agents/issue-tracker.md` conventions, this becomes a `gh issue create --label distribution`).
6. **[REVIEW]** **Capture sample-rate choice** — 48 kHz native (recommended by `latency-budget-v0.md` §3 stage 1, saves a resample step but sends `rate=16000` to server) vs 16 kHz direct (matches PoC). Affects Opus encoder choice on the server side and the Protobuf `source_audio.rate` field.
7. ~~**[REVIEW]** **Tauri-NSPanel dependency posture** — Open-Less uses a git branch of `tauri-nspanel` (`openless-take.md` §5 #1, also cited `openless-take.md` §7 Q1 "parent willing to depend on an unreleased git branch of a third-party crate") for macOS full-Space windowing. Acceptable to depend on an unreleased git branch, or vendor/fork?~~ **Locked (per decisions/round-2-confirmations.md D20)**: `tauri-nspanel` git-branch dependency (branch `v2`) is **acceptable for v0**; `Cargo.toml` adds `tauri-nspanel = { git = "…", branch = "v2" }` (matching Open-Less usage in `openless-take.md` §5 #1). Vendor a fork if upstream stays unstable, but no v0 work to fork preemptively. The floating subtitle window (F9 in §2.1) needs this — without NSPanel the subtitle won't show above full-screen Spaces.

### 7.1 Decision-priority ordering

If user time is limited, address decisions in this order (highest blast-radius first):

1. **#2 (latency-margin policy / cascade seam)** — **locked D19**; cascade is a v1 ticket, not a v0 implementation seam.
2. **#1 (acceptable latency if > 3 s)** — **locked D18**; AC1 is soft at v0, hard at v0.5.
3. **#4 (multi-language scope)** — **locked D23**; zh↔en only at v0.
4. **#5 (distribution model)** — affects CI matrix in section 06.
5. **#3 (原声直出 toggle)**, **#6 (capture sample rate)** — UX / implementation details, can default to recommended answer if user is silent. **#7 (NSPanel posture) — locked D20**; git-branch dep is acceptable.

---

## 8. References

Every claim in §1–§7 traces back to one of these six documents. The spec intentionally does NOT reference `realtime_interpreter_Minimal_Implementation/` (the git-ignored PoC) directly — that directory is local reference only per `AGENTS.md` §"Local-only reference", and every PoC-internal citation goes through `poc-docs-take.md` instead.

| Doc | Lines | Role in this spec |
|---|---|---|
| `docs/research/poc-docs-take.md` | 309 | Distillation of the git-ignored A-channel Doubao s2s PoC; the only sanctioned reference to PoC internals. All PoC citations in this spec go through this take. |
| `docs/research/openless-take.md` | 218 | GUI stack take on the AGPL-licensed Open-Less Tauri 2 + React voice-input app; source of patterns 1–6 in §5 + risk R5 + open decision #7. |
| `docs/research/latency-budget-v0.md` | 203 | 10-stage waterfall + ≤ 3 s first-sound target with 430–730 ms margin; source of AC1, R1–R4, F12, and Appendix B/C/D recovery + crate choices. |
| `docs/agents/issue-tracker.md` | 53 | GitHub Issues conventions for `pioneerAlone/realtime_interpreter`; where every AC1–AC8 and risk R1–R7 will be filed as `gh issue create`. |
| `AGENTS.md` | 21 | Workspace conventions; **the git-ignored PoC at `realtime_interpreter_Minimal_Implementation/` is local reference only** and is referenced here only through `poc-docs-take.md` (per AGENTS.md §"Local-only reference"). Also defines the 5-role triage label vocabulary (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`) that each [REVIEW] item will use. |
| `.scratch/macos-siminterpret-poc/map.md` | 153 | Wayfinder map for the destination product; defines scope, R3/R4 architecture, 0-sample cloning decision, 3-误区 self-check, and v1 cascade seam. |

---

(End of section 00 — DRAFT)
