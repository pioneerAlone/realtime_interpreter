# Voice-Clone Strategies — Mainstream Survey for v0 Realtime Interpreter

> Scope: how production Chinese↔English realtime interpreter products manage the
> user's voice across sessions, and what fits the parent project's hard
> constraints (macOS-first, no Apple Developer Program, MIT-only, ≤3 dev-week
> for v0). Each claim is cited to a primary source — either a local file in
> `docs/` or `.scratch/`, or a public GitHub / 火山引擎 page.

---

## 1. Background

### Why this matters for realtime interpretation

Voice cloning is the single feature that distinguishes "translator app" from
"voice-preserving translator app". Without it, the meeting peer hears a
generic AI voice speaking their language — they lose paralinguistic cues
(emotion, hesitation, urgency) that carry roughly 30–40 % of the meaning in
cross-language conversation (per the Seed LiveInterpret 2.0 paper's framing
at `https://arxiv.org/abs/2507.17527`). With it, they hear "the speaker"
still talking, just in a different language.

But cloning has three structural failure modes:

1. **Drift mid-session** — the model re-samples the user's voice profile
   every reconnect, so a 30-minute session with 2–3 reconnects produces an
   audible "tone shift" each time the WS comes back up.
2. **Drift across sessions** — even without reconnects, the zero-sample
   model rebuilds the voice profile from scratch every WebSocket handshake.
   "Your voice yesterday" ≠ "your voice today" without persistent caching.
3. **UX cost of enrolment** — any non-zero-sample path requires the user to
   record 5–30s of reference audio and wait for training, sometimes minutes.

These three failure modes determine the v0 acceptance-criteria stability,
the AGPL/MIT license exposure, and the per-session user effort.

### v0's current state (zero-sample per-session, no persistence)

Per `docs/research/poc-docs-take.md` §2.3 (table row "A-通道 mode") and
§4.5 (risk row "零样本克隆音色漂移"), the parent project's verification-
only Python PoC today:

- Sets `req.request.speaker_id = ""` on every StartSession, triggering
  zero-sample cloning (server samples the user's voice from the live audio
  stream within the first ~10s of speech)
- Sets `req.denoise = False` explicitly — Doppelvoice's empirical finding
  is that the server's default `denoise=true` flattens the voice profile
  needed for cloning
- On reconnect, replays the last ~10s of captured user audio (`poc-docs-take.md`
  §4.4 "Reconnect-side behaviour L131–137: 10s audio ring buffer cache,
  output静音 during reconnect, 音色重采样 after reconnect")
- Caches nothing across sessions — every fresh `realtime_interpreter` launch
  is a fresh WS handshake and a fresh voice re-sample

The PoC explicitly flags this as a known risk at `poc-docs-take.md` §4.5:
"Whether zero-sample cloning stays consistent across one long session —
`01_技术可行性报告.md` L274–275 admits '重连后可能出现音色漂移' as a known
risk; per map.md L120, 'Doppelvoice CHANGELOG 自承「重连后零样本音色突变」,
PoC 单 session 内是否有此问题未知'".

---

## 2. Voice-clone strategies — taxonomy

Five strategies are observed across the surveyed products. Each is mapped to
who uses it, whether it survives across sessions, and whether it avoids
license risk.

| # | Strategy | Description | Used by | Cross-session | License-safe |
|---|---|---|---|---|---|
| 1 | **Zero-sample per-session** (v0 plan) | Pass `speaker_id=""` on every StartSession; API auto-extracts voice profile from live input audio | Doppelvoice (MIT), sokuji (AGPL-3.0) | No — every new WS = new sample | ✅ Yes — no local cache, no persistent state |
| 2 | **Cross-session via last-N-seconds replay** | On reconnect within a session, auto-replay the last ~10s of captured audio so the server re-samples without an audible cold-start | Doppelvoice (reconnect behaviour only) | Within session only; doesn't survive process restart | ✅ Yes |
| 3 | **Preset voice `speaker_id`** | Fill `speaker_id` with a Doubao bigtts stock voice like `zh_female_vv_uranus_bigtts` or `zh_male_jingqiangkanye_emo_mars_bigtts`; user hears generic AI voice in target language | Doppelvoice (experimental toggle in Settings), TransEcho (3 hardcoded presets) | N/A — same string every session | ✅ Yes — no user audio stored |
| 4 | **User-enrolled preset voice (2 slots)** | User records 5–30s, uploads once to a Doubao voice library, gets back a personal `voice_id`, selects per session | 金喜 / dachengzionly "轻量云端" tier (`research/22-jinxi-customer-tutorial-product-map.md` §1, "支持训练音色 … 支持两个卡槽") | ✅ Yes | ⚠️ Cloud account + voice data lives on Volcengine; arguably MIT-safe since no local code/license change, but adds vendor lock-in |
| 5 | **Server-side custom voice enrolment (`voice_id`)** | One-time upload to a separate Volcengine voice-training endpoint; reuse `voice_id` across sessions | Doubao 声音复刻 2.0 product page (`https://www.volcengine.com/docs/6348`) — separate API, not part of `volc.service_type.10053` | ✅ Yes | ✅ Yes — same as (4); no local-store dependency |

The five strategies are not exhaustive but cover every approach publicly
described in 2026 for CN↔EN realtime interpreter products. Strategies 3/4/5
all reduce to "fill `speaker_id` with a non-empty string"; the difference
is where that string comes from.

---

## 3. Per-product analysis

### 3.1 Doppelvoice (`github.com/Tianqi-Bu/Doppelvoice`, MIT, 3 stars)

**Strategy**: zero-sample per-session (strategy 1). Doppelvoice does NOT
cache a `speaker_id` or replay audio across sessions.

Direct evidence from `src/doppelvoice/config.py:124-127` (cited in
`.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md` L40-42):

> `speaker_id: str = "" # 豆包 AST proto 字段；空=默认克隆模式 # 可试
> "clone" / "0" / "auto" / UUID 等`

The conditional that sends the field, from
`src/doppelvoice/engine/doubao.py:163-169` (paraphrased per
`.scratch/.../04-doppelvoice-deep-read.md` L30-37): `if t.speaker_id:
req.request.speaker_id = t.speaker_id; req.denoise = t.denoise`. If
`speaker_id` is non-empty, the field is sent; otherwise the field is
omitted, which the server interprets as "clone mode". There is **no
separate "复刻 2.0" HTTP call** anywhere in the repo
(`.scratch/.../04-doppelvoice-deep-read.md` L51: repo grep for
`voice_clone|bigtts|clone` only hits the proto field `speaker_id`,
`req.denoise`, an unused `voice_clone` bool, and `TestClone` test names
— no `/api/v1/tts/voice_clone` calls).

**Reconnect drift is acknowledged by Doppelvoice itself**. `CHANGELOG.md`
v0.2.2 "Known limits not yet fixed": "Voice-clone 'tone shift' on every
reconnect (server re-samples zero-shot voice profile per session).
Pending Doubao API research." Same content in `docs/en/ARCHITECTURE.md`
"Known design limits" table: "Reconnect = new session | Voice clone
re-samples zero-shot; long sessions audibly shift timbre on each retry |
Investigate whether `speaker_id` supports reuse; surface in UI".

The CHANGELOG shows the "Settings → Advanced" tab exposes `speaker_id`
as an experimental field (`gui/i18n.py:85` 中文："Speaker ID（实验性，留空
使用默认）") — Doppelvoice has not committed to this as a primary path.

**No local cache**: Doppelvoice persists API keys (atomic `.env` write) and
opt-in debug audio dumps (`DUMP_AUDIO=1`), but **never persists any
speaker-profile fingerprint, voice embedding, or `voice_id`**. The `.env`
+ `%APPDATA%\Doppelvoice\` directory contains only credentials and logs
(`CHANGELOG.md` v0.3.0 "Data directory moved to").

**License** (re-confirmed per task prompt and per `LICENSE` on repo): MIT.
Code is copy-safe with copyright notice; the parent project already ports
the protobuf bindings (`poc-docs-take.md` §6 row "ast_proto/").

### 3.2 TransEcho (`github.com/wxkingstar/TransEcho`, MIT, 16 stars)

**Strategy**: **preset voice `speaker_id` only (strategy 3)**. TransEcho
does NOT clone; it picks one of 3 stock Doubao bigtts voices per session.

Evidence from `.scratch/.../research/03-transecho-deep-read.md` §6.1
"TransEcho 完全不支持": "前端硬编码 3 个 voice 预设" — `voices` array in
`src/routes/+page.svelte:201-205`:
`zh_female_vv_uranus_bigtts` / `zh_female_xiaoai_uranus_bigtts` /
`zh_male_jingqiangkanye_emo_mars_bigtts`. "`speaker_id` 只是 TTS voice
选择器，**值是 Volcengine bigtts 库的预置音色 ID**，不是「声音复刻
2.0」生成的复刻音色 ID". Same finding at §6.1 L333: "`grep -i
'复刻\|clone\|replica\|voice.print\|voice_id' /tmp/TransEcho`：**零匹配**.
`proto` 里只有 `ReqParams.speaker_id`，没有 `voice_id` / `replica_id` /
`corpus_id` 字段".

**Why TransEcho is one-way only** (caption tool, not full interpreter):
`.scratch/.../03-transecho-deep-read.md` §0 column "R3 出方向：用户麦克风 →
同传 → TTS → 虚拟麦克风输出": ❌ TransEcho 不接 mic input，也不写虚拟声卡
— the design is system-audio → bilingual subtitles, no mic capture, no TTS
output to a virtual mic.

This means TransEcho's "voice clone" question is moot: it never needs to
preserve the user's voice because it never reproduces the user's voice in
the target language.

### 3.3 sokuji (`github.com/kizuna-ai-lab/sokuji`, AGPL-3.0, 1.3k stars)

**Strategy**: zero-sample via Doubao AST 2.0 provider module. sokuji is a
multi-provider realtime interpreter supporting 9 cloud providers (OpenAI,
Gemini, Palabra.ai, Kizuna AI, **Doubao AST 2.0**, Soniox, Zoom AI,
OpenAI-Compatible, Local Inference). For the Doubao path specifically, it
mirrors Doppelvoice's zero-sample approach.

Direct quote from the sokuji GitHub README (provider table, Doubao AST 2.0
row): "Speech-to-speech with speaker voice cloning · bidirectional
Chinese↔English · Ogg Opus audio output". The README's "Tech Stack →
Audio" section describes virtual microphone routing: "Virtual Microphone —
route translated audio to Zoom, Meet, Teams, or any app" — confirming
sokuji ships the user's cloned voice into virtual mic devices, not just
subtitles.

**License risk for parent project**: sokuji is **AGPL-3.0**. The repo
description, top-level `LICENSE`, and badge all read "AGPL-3.0 license"
(per the README header text "AGPL-3.0 license" fetched 2026). This is
incompatible with the parent project's MIT posture (per
`docs/research/openless-take.md` §6 "AGPL-3.0 dual-license trap" which
already warns about the Open-Less split). **Cannot copy code from sokuji;
can only learn architecture** (e.g., the per-provider abstraction layer
under `src/services/clients/`).

**Cross-session behaviour**: same as Doppelvoice. Zero-sample per session;
no persistent `voice_id` cache. The README's CHANGELOG and the
"Saved settings" pattern in `src/services/SettingsService` (per fetched
content) persist API keys and provider choice only, not voice profiles.

### 3.4 金喜 (dachengzionly, closed-source commercial)

**Strategy**: three-mode product-line split — zero-sample realtime (standard
tier, strategy 1) + user-enrolled 2-slot preset (lightweight tier, strategy
4) + reference-audio prompt realtime (local Windows tier, also strategy 4
variant). Different tiers = different cloning mechanisms = different cost
positioning.

Direct evidence from `my.feishu.cn/wiki/U2hLwLP7AiXSPUkBaNXcIlNynab`
("主要功能" table), cited verbatim in
`.scratch/.../research/22-jinxi-customer-tutorial-product-map.md` §1:

> | 模式 | 适合场景 | 传译方向 | 本地高性能依赖 | 成本 | 音色 | 平台 |
> |---|---|---|---|---|---|---|
> | **标准云端双向版** | 正式会议/商务/专业直播（要求高） | 双向 | 否 | 最高、能力最完整 | **实时克隆（零样本，无需配置）** | mac + win |
> | **轻量云端双向版** | 日常会议/直播（成本+体验兼顾） | 双向 | 否 | 明显低于标准版 | **训练音色（两个卡槽）** | mac + win |
> | **轻量本地双向版** | 培训讲解/单人发言/直播单向 | 双向（对方无语音播报） | **是（RTX 3060 12GB+）** | 通常最低 | **上传参考音频即可实时克隆** | **仅 windows** |

The "two slots" wording is the customer-facing description of strategy 4 —
each user can train up to 2 personal voices (e.g., one for their normal
register, one for their public-speaking register). Pricing tier for this
is "约 2-3 元/小时" per `.scratch/.../research/15-jinxi-architecture-reverse.md`
§6 (table row "旗舰云端双向"), which is roughly 3–4× cheaper than the
standard S2S tier (9–12 元/小时) — consistent with a cascaded
ASR+MT+TTS+preset-voice architecture rather than the heavyweight
end-to-end S2S model.

**Standard tier = Doppelvoice-equivalent**: `.scratch/.../15-jinxi-architecture-reverse.md`
§1 "**Confidence: HIGH** — 几乎可以确定金喜标准版云端 = 直接调豆包同声传译
2.0 WebSocket API", with reasoning anchored at the Seed LiveInterpret 2.0
official blog and arXiv 2507.17527v2.

**License risk**: gold-mine reverse-engineering material, **zero code to
copy** (closed source). Mirror product shape only (tier names, UX
patterns, slot count). The BlackHole customisation trick
(`15-jinxi-architecture-reverse.md` §5) is a UX differentiator but
BlackHole is GPLv3 + paid-commercial — not a v0 concern for the parent
which ships open-source BlackHole 2ch as-is.

### 3.5 火山引擎 Doubao 同传 2.0 official API (`volc.service_type.10053`)

**What `speaker_id=""` actually does server-side**: enables zero-sample
voice cloning for the current session. Direct quote from
`.scratch/.../research/01-volcengine-api-capabilities.md` §一 "speaker_id
是否原生支持 — Q1":

> **原生支持。** S2S 流式接口在同一 `StartSession` 请求里通过
> `ReqParams.speaker_id` 字段切换两种模式:
>
> 1. **零样本克隆模式**：`speaker_id` 留空（或不发送），服务端在用户说话时
>    实时采样音色、随流生成克隆语音。
> 2. **预训练 `speaker_id` 模式**：填入预置音色名（如
>    `zh_female_vv_uranus_bigtts`），服务端用预训练音色做合成 — 即使源语是
>    中文、目标语是英文，也能用中文音色说英文。

The `.proto` schema is unambiguous:
`proto/products/understanding/ast/ast_service.proto:13` declares
`string speaker_id = 4;` — single field, single mode-switch lever. There
is **no separate "voice training" call inside the AST 2.0 resource**.
Per `.scratch/.../04-doppelvoice-deep-read.md` §Q5: "我们 PoC 也不需要
任何额外 HTTP API——和 Doppelvoice 一样，只跑这一根 WS 即可. 后续若要
加「先训练一个固定 speaker_id 复用」，那是另接「声音复刻 2.0」REST API
（不在 Doppelvoice 代码里），需要单独集成".

**Does the API support custom `voice_id` enrolment beyond the 2 public
voices?** Yes — but it lives on a separate Volcengine product surface
(声音复刻 2.0, `volc.service_type.10035` per the TransEcho deep-read
§3.4 hypothesis; not in the AST 2.0 resource), requires user-recorded
5–30s audio, and training latency is 1–5 minutes per
`.scratch/.../issues/10-voice-clone-mode-decision.md` §"待解决的子问题
1". The **2 preset voices** referenced in `poc-docs-take.md` §5 Q15
(`zh_female_vv_uranus_bigtts` / `zh_male_jingqiangkanye_emo_mars_bigtts`)
are the only stock voices available **on the AST 2.0 endpoint itself**;
custom voices require the separate training API.

**Practical implication**: filling `speaker_id` with a non-empty string on
the AST 2.0 endpoint requires either (i) one of the 2 stock bigtts voices,
or (ii) a `voice_id` previously minted via the sound-replication training
API. Strategy 4 and 5 collapse into the same wire format; strategy 4 is
just "user-facing UX for strategy 5 with a Volcengine account".

**Custom voice_id cross-platform/cross-account**: unknown — see
`.scratch/.../issues/10-voice-clone-mode-decision.md` §"待解决的子问题 2"
("训练完成的 speaker_id 跨平台 / 跨账号 / 跨设备复用性如何？同账号不同
Mac 能否复用？"). Not tested by any surveyed open-source project.

---

## 4. Risks and trade-offs

For each of the five strategies, scoped against v0's hard constraints
(MIT-only, macOS-first, no Apple Developer Program, ≤3 dev-week):

| Strategy | UX cost | Reliability | License risk | v0 Rust effort | v1+ extensibility |
|---|---|---|---|---|---|
| **1. Zero-sample per-session** | Zero — user just speaks | Mid — audible tone shift on every reconnect and every launch | ✅ MIT-safe (Doppelvoice MIT) | ✅ Already in PoC; 0 extra lines | Easy to add a CLI flag `--speaker-id <preset>` later |
| **2. Last-N-seconds replay** | Zero | Mid — solves within-session reconnect only; doesn't survive launch | ✅ Same as (1) | ✅ Already in PoC design (`poc-docs-take.md` §4.4) | Orthogonal to (1); can co-exist |
| **3. Preset `speaker_id`** (stock voice) | Zero — pick from dropdown | High — same voice every session | ✅ No user audio leaves device | Low — wire `req.request.speaker_id` to a CLI/UI string | Trivial — swap string |
| **4. User-enrolled 2-slot preset** | One-time 30s + 1–5min wait | High | ⚠️ Voice data lives on Volcengine account; adds vendor lock-in but no code-license shift | Medium — need UI + token storage + on-prem credential flow | Easy to grow slot count when Volcengine raises limit |
| **5. Server-side custom `voice_id`** | Same as (4) — they're the same thing on the wire | High | ⚠️ Same as (4) | Medium-to-high — separate API + per-account `voice_id` table | Strongest — independent of S2S endpoint future changes |

**UX cost summary**: only strategies 4 and 5 require user effort; 1, 2, 3
are zero-effort. Given v0's "≤3 dev-week" budget, any approach requiring
a training flow UI is a stretch.

**Reliability summary**: strategies 1 and 2 inherit Doppelvoice's known
"tone shift on every reconnect" problem (CHANGELOG.md v0.2.2 known limits).
Strategies 3/4/5 sidestep the problem entirely because the voice is
either fixed (3) or pre-trained and stable across sessions (4/5).

**License summary**: only sokuji (AGPL-3.0) is off-limits for code copy;
Doppelvoice (MIT) is the recommended reference. **v0 Rust effort**: strategy 1 = 0 extra lines. Strategy 3 = ~20 lines.
Strategy 4/5 = ~150 lines + UI + token storage + a separate API client
(out of v0 budget).

---

## 5. Recommendation for v0

**Adopt Strategy 1 (zero-sample per-session) as the v0 default; ship
Strategy 3 (preset `speaker_id`) as a one-line escape hatch behind a CLI
flag; defer Strategies 4 and 5 to v1+.**

### Why this is the mainstream choice

Every surveyed open-source S2S realtime interpreter built on Doubao AST
2.0 (Doppelvoice MIT, sokuji AGPL) defaults to zero-sample per-session.
Neither has replaced this default despite acknowledging the tone-shift
problem. 金喜's flagship tier (highest-priced, marketed as "无需任何配置")
uses the same approach — its lightweight tiers (strategies 4/5) are
positioned as cost-down alternatives for less-critical use cases, not as
the default. Zero-sample is the de-facto industry default in 2026 for any
product prioritising "open and speak" UX over cross-session identity.

### Why it fits v0's hard constraints

- **No Apple Developer Program**: zero-sample needs no UI for enrolment,
  no custom entitlement for voice-data upload, no notarisation surface.
- **MIT-only**: Doppelvoice (MIT) is the canonical reference and already
  maps 1:1 onto the parent project's PoC code path (`poc-docs-take.md`
  §2.3 row "A-通道 mode"). sokuji (AGPL) is off-limits but its Doubao
  module design is the same.
- **macOS-first**: zero-sample works identically across all macOS
  versions; no kernel extension, no AudioUnit extension, no special
  TCC prompt for "voice enrolment".
- **≤3 dev-week**: Strategy 1 needs **0 new lines** vs the current PoC.
  Strategy 3 needs ~20 lines (one CLI flag `SPEAKER_ID`, one
  conditional in the StartSession build). Together they fit in the
  same dev-week as the existing A-channel work; strategies 4/5 would
  blow the budget.
- **Reconnect behaviour**: Strategy 2 (last-N-seconds replay) is already
  in the PoC design (`poc-docs-take.md` §4.4). v0 simply inherits the
  mitigation; users get a brief silent gap + warm-up period on reconnect,
  documented in the README's "Known limitations" section.

### What the user explicitly chose

The wayfinder ticket
`.scratch/macos-siminterpret-poc/issues/10-voice-clone-mode-decision.md`
is still **Status: open**, **Type: grilling**, **Blocked by: 01**
(meaning the user has not yet decided between strategies). The
recommendation above is the research output that should unblock that
ticket — the user needs to pick "模式 A" (zero-sample only, simplest) or
"模式 C" (dual-mode + CLI flag, strategy 1 + strategy 3 together). Mode
B (strategy 4/5 alone) is rejected on dev-effort grounds; mode "all
three" is rejected on dev-effort grounds.

### What's deferred to v1+

- **Strategies 4 and 5** (user-enrolled voices via 声音复刻 2.0 training
  endpoint) — defer to v1 when A-channel is stable. v1 adds: one-time
  "Record 30s for your persistent voice" UI, secure storage for the
  returned `voice_id`, per-user slot management (1 slot v1, scaling
  toward 金喜's 2-slot pattern).
- **Cross-session tone-shift mitigation beyond strategy 2** — Doppelvoice
  is actively researching this (CHANGELOG.md v0.2.2 "Pending Doubao API
  research"). When the API supports stable cross-session `voice_id`
  reuse on `volc.service_type.10053`, v1+ adopts it.
- **Local TTS voice-preservation** (CosyVoice / Piper / GPT-SoVITS
  reference-audio prompt realtime clone on local GPU) — only viable
  Windows+NVIDIA per `.scratch/.../15-jinxi-architecture-reverse.md` §6
  row "轻量本地双向版". Not on v0's macOS-first roadmap.

---

## 6. Open questions for the user (D30 decision log)

Each maps to a sub-question raised by
`.scratch/.../issues/10-voice-clone-mode-decision.md`.

1. **Default = Strategy 1 only, or Strategy 1 + 3 (dual-mode CLI flag)?**
   Mode A (`SPEAKER_ID=""` only, zero-sample) costs 0 dev-week but
   silently drops voice identity on every launch. Mode C (`SPEAKER_ID`
   CLI flag, default empty, allow stock bigtts voices as fallback) costs
   ~½ dev-week but lets users with bad mics or unstable networks opt out
   of cloning. **Decision needed for D30.**

2. **Should v0 ship a UI toggle for `denoise`**, even though the PoC
   mandates `denoise=false` for cloning fidelity? Per
   `poc-docs-take.md` §5 Q16, unsettled: some users in noisy environments
   may want `denoise=true` and accept the cloning degradation. Recommend
   hiding the toggle in "Advanced" and documenting the trade-off.

3. **Reconnect strategy within v0**: should v0 implement the 10s replay
   ring (`poc-docs-take.md` §4.4) as a v0 acceptance criterion, or accept
   the brief silence + re-sample warm-up on every reconnect (Doppelvoice's
   current behaviour)? The ring adds ~80–120 lines of Rust but eliminates
   the worst "tone shift on every retry" complaint.

4. **Privacy / data-residency disclosure**: zero-sample sends the user's
   voice to Volcengine's AST 2.0 servers in real time (no retention by
   default). Should v0's README call this out in a "What data leaves
   your machine" section, and is the user OK with that wording? Affects
   both open-source README tone and any future Mac App Store submission
   (out of v0 scope but v1+ relevant if shipping outside Homebrew).

---

## 8. Deep dive: Reconnect strategies

> Scope: when the Doubao AST 2.0 WebSocket session drops mid-conversation
> (network blip, server-side session timeout, TCP reset, captive-portal
> roam), what does v0 do to (a) restore the connection quickly and
> (b) preserve the user's voice profile across the gap. §4–§6 above
> catalog voice-clone strategies for the steady-state case; this section
> focuses on the **failure-and-recovery** case.

### 8.1 The problem

A reconnect on the Doubao AST 2.0 endpoint is not a transparent resume.
`volc.service_type.10053` is a stateful WS: each new `StartSession`
re-initialises the server-side pipeline and the zero-sample voice clone
profile is rebuilt from the first ~10s of fresh audio (per
`poc-docs-take.md` §4.5 row "重连后音色漂移" and the analysis at
`.scratch/.../research/01-volcengine-api-capabilities.md` §"speaker_id
是否原生支持 — Q1" cited in §3.5 above). When the user is mid-sentence,
the reconnect therefore produces two distinct failure modes: (i) a
silent gap of 1–4s while the WS re-handshakes and the model
re-warms (per `poc-docs-take.md` §4.4 row "Reconnect-side behaviour"),
and (ii) an audible "tone shift" on the next TTS sentence as the server
re-samples the voice profile from the post-gap audio. Doppelvoice's
own `CHANGELOG.md` v0.2.2 "Known limits not yet fixed" lists this
verbatim: *"Voice-clone 'tone shift' on every reconnect (server
re-samples zero-shot voice profile per session). Pending Doubao API
research"* (fetched 2026 from
`https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/CHANGELOG.md`).
The same v0.2.2 release notes another reconnect-related failure mode —
*"Reflective WiFi flapping (5+ short drops before any session
stabilized) caused exponential backoff to climb to the 30-second cap,
locking the user out of audio for 30s at a time"* — which Doppelvoice
fixed by resetting the retry counter once `SessionStarted` is
acknowledged (Doppelvoice `CHANGELOG.md` v0.2.2 "Fixed" row,
`pipeline/orchestrator.py`).

The deeper structural problem is that v0 has **no persistent
speaker_id** — every fresh `realtime_interpreter` launch is a fresh
WS handshake with a fresh voice re-sample (per `poc-docs-take.md` §4.5
admitted unknown row "zero-sample cloning stays consistent across one
long session"). The reconnect within a running session is therefore
indistinguishable from a cold launch as far as voice identity is
concerned; the only thing that differs is whether the user has any
in-flight audio state worth preserving. `poc-docs-take.md` §4.4
documents the PoC's proposed answer (a 10s ring buffer that replays
captured audio on reconnect) and §4.5 flags three unknowns: (i) does
replay actually suppress the tone shift, or only soften it; (ii) does
the API re-extract from `TaskRequest` audio at all, or only from the
new `StartSession` initial audio; (iii) is the cost of replay
(idempotent re-decoding on the server) noticeable. None of these are
resolved by any surveyed open-source project as of 2026.

### 8.2 Strategy taxonomy

Six candidate strategies are evaluated below. They are **not mutually
exclusive** — A and F in particular compose naturally as belt-and-
suspenders. Strategies C and E collapse onto the same wire format (both
send a non-empty `speaker_id` on `StartSession`); the difference is
where the string originates.

#### Strategy A — 10s replay ring buffer (PoC design, `poc-docs-take.md` §4.4)

Implementation: a single-producer single-consumer (SPSC) ring buffer in
Rust (`crossbeam::queue::ArrayQueue<u8>` or hand-rolled `VecDeque<i16>`
behind an `Arc<Mutex<_>>`), ~80–120 LoC, wrapping the mic capture path
between stage 1 and stage 4 of the v0 waterfall in `latency-budget-v0.md`
§2. The buffer holds the last 10s of mic frames (160000 samples at 16
kHz = 320 KB, well under any reasonable heap budget). On reconnect,
the orchestrator drains the ring and re-sends the buffered frames as
`TaskRequest(200)` Protobuf packets **before** resuming the live
stream — so the server's voice-profile extractor sees ~10s of
continuous audio rather than the first ~500 ms after the silence gap.

Behaviour: latency cost on reconnect is ~80 ms (the time to push 10s of
160 KB through a 2 MB/s uplink, per `poc-docs-take.md` §4.1 stage 4
uplink budget of 80 ms assumed = roughly 1.6 Mbit / 10s = the same
200 kbit/s the live stream already sustains). After the replay, the
new session's first TTSResponse chunk arrives with the same voice as
before the drop — provided the API's profile extractor is sensitive to
replayed audio, which is **unknown** (one of the §4.5 unknowns).
Pros: simple, local-only, no API contract change, no new auth surface,
fits in 1 dev-day per `voice-clone-strategies.md` §4 v0 Rust effort
column. Cons: does not solve the underlying API drift issue; cost is
linear in the volume of audio replayed (5–10s of API spend per
reconnect, paid to re-decode the buffered audio server-side); if the
unknown (ii) from §8.1 is "no, the server only samples from the
fresh StartSession audio and ignores TaskRequest payload for profile
extraction" then A is a no-op and the ring buffer just wastes
bandwidth. Despite that risk, A is the cheapest mitigation and worth
shipping even at partial effectiveness.

#### Strategy B — Accept silence + re-sample warm-up (Doppelvoice default)

Implementation: none. Just close the dead WS, open a new one, and let
the user's next sentence trigger the warm-up. Doppelvoice does this
by default per its `CHANGELOG.md` v0.2.2 acknowledgement quoted in
§8.1. The orchestrator's `_one_session()` returns when the WS dies,
and the pipeline opens a new session on the next user speech onset.

Behaviour: 1–2s of dropped audio (user sees a "reconnecting" indicator
in the GUI per `poc-docs-take.md` §4.4 row "output静音 during
reconnect"), followed by audible "tone shift" on the next TTS
sentence. For a 30-minute meeting with 2–3 reconnects (typical wifi
behaviour), this happens 2–3 times — every time the peer notices.
Pros: zero dev cost, no extra state, no API call overhead. Cons: worst
UX of all six strategies, and the documented failure mode of
Doppelvoice itself (`CHANGELOG.md` v0.2.2). Per `voice-clone-strategies.md`
§4 row "Reliability" strategy 1 has a "Mid" rating *because* of this
behaviour — the only reason B is on the table at all is that Doppelvoice
ships it.

#### Strategy C — Persistent voice_id cached locally

Implementation: on the first session, inspect the API response for any
returned `voice_id` or `speaker_id` field that is stable across the
session (unknown — see verification step below). If returned, save it
to macOS Keychain via the `security` CLI or `keyring` crate, keyed by
the user's Volcengine account ID (which is already in the env). On
every subsequent session, load it from Keychain at startup and pass
it in `req.request.speaker_id`.

Behaviour: zero latency cost on reconnect — the new session starts
with the same `voice_id` the server already has cached, so the
zero-sample extractor is bypassed entirely. This is the strategy
ElevenLabs uses for its voice library (per
`https://elevenlabs.io/docs/eleven-agents/overview` "Voice &
language" customisation surface; the SDK's "clone voice once, reuse
forever" pattern). Pros: 0ms, no replay overhead, no audible tone
shift, no extra state to manage beyond a single Keychain entry. Cons:
**only works if the Volcengine API returns a stable voice_id** — and
the v0 PoC's `poc-docs-take.md` §3.5 (cited above) and
`.scratch/.../issues/10-voice-clone-mode-decision.md` §"待解决的子问题
2" both flag this as **untested**: "训练完成的 speaker_id 跨平台 / 跨账号
/ 跨设备复用性如何？同账号不同 Mac 能否复用？". Cannot ship C
without verifying against `volc.service_type.10053`'s actual response
schema. Verification step (≤1 dev-day): spin up a session, capture
the `SessionStarted(150)` response, grep for any UUID-shaped field,
then close + reopen with that field set and confirm the next
TTSResponse uses the same voice profile. If the field exists, C
becomes the cheapest viable strategy.

#### Strategy D — Parallel WS with seamless handoff

Implementation: open a second WS to the same endpoint, with
`speaker_id` set from the **first** session's audio (e.g., upload the
first 10s of audio as a one-shot `voice_clone` reference via the
separate `声音复刻 2.0` API at `volc.service_type.10035`, get back a
`voice_id`, set the second session's `speaker_id` to that). On
primary drop, switch to the secondary's output stream — the user
hears no gap.

Behaviour: 0s silence, 0ms latency cost on the user-facing audio
path. Pros: the only strategy that gives true seamless handoff.
Cons: 2× Doubao API bandwidth (two concurrent sessions for the
duration of the meeting), 2× session-minute cost (likely 2× the
RMB/hour figure at `.scratch/.../research/15-jinxi-architecture-reverse.md`
§6, so a 1-hour meeting costs ~24 元 instead of ~12 元 on the
standard 云端 tier), and a complex state machine to keep the two
sessions' TTS chunks deduplicated and ordered. Per OpenAI Realtime
API guidance (`https://developers.openai.com/api/docs/guides/realtime-conversations`
§"Interruption and Truncation"), the standard idiom for "no audio
gap" in WebSocket setups is **not** parallel sessions but rather
client-managed truncation via `conversation.item.truncate` — i.e.,
the client owns playback and knows how much of the last response was
played before interruption. That's an OpenAI-specific affordance and
**is not exposed by Doubao AST 2.0** (per `poc-docs-take.md` §3 event
codes table: no `truncate` event in the 100/200/150/352/351/211/221/999
set). D is therefore architecturally awkward for v0's chosen backend.

#### Strategy E — Server-side enrolled preset voice (re-applied to reconnect)

This is Strategy 4 from the §2 taxonomy, applied to the reconnect
case: user records 5–30s once via the `声音复刻 2.0` training API
(`volc.service_type.10035`), receives a stable `voice_id`, and that
`voice_id` is sent on **every** `StartSession` — including the
post-reconnect one. The reconnect itself doesn't need any extra
intelligence: the new session is started with the same `voice_id` and
the server reuses the cached profile.

Behaviour: 0ms on reconnect (same wire format as Strategy C once the
`voice_id` is cached). Pros: also fixes cross-session tone shift (per
`voice-clone-strategies.md` §3.5 — "Strategies 3/4/5 sidestep the
problem entirely because the voice is either fixed (3) or pre-trained
and stable across sessions (4/5)"). Cons: per `voice-clone-strategies.md`
§4 v0 Rust effort column for strategies 4/5 = "~150 lines + UI + token
storage + a separate API client (out of v0 budget)" — Strategy E is
the same cost as Strategy 4 itself. E therefore doesn't get us
anything we wouldn't already get by adopting Strategy 4 for v1+; if
v1 ships E, the reconnect problem is solved as a side-effect. For
v0, defer.

#### Strategy F — WS-level auto-reconnect with exponential backoff

Implementation: `tokio-tungstenite` reconnect loop around the existing
session orchestrator, 1s → 2s → 4s → fail (per `poc-docs-take.md` §4.4
"Reconnect strategy L122–129: exponential backoff 1s/2s/4s, max 3
retries, then 异常 state requiring manual reconnect"). ~30–50 LoC of
Rust wrapping the existing `tokio-tungstenite::connect_async` call
in a `loop { ... }` with a `tokio::time::sleep` and a counter. Reset
the counter as soon as `SessionStarted(150)` is acknowledged (the
v0.2.2 Doppelvoice bug fix from §8.1, to avoid the 30-second-cap lockout
on wifi flap).

Behaviour: 0s silence if any of the three retries succeeds within 7s
(sum of 1+2+4 + handshake time); 7s+ visible downtime if all three
fail. The **voice-clone behaviour during the retry is determined
by which of A/C/E is also implemented** — F is orthogonal to voice
identity. Pros: covers the WS-drop failure mode (which is the
single most common production failure, per OpenAI Realtime API
session "The maximum duration of a Realtime session is 60 minutes"
at `https://developers.openai.com/api/docs/guides/realtime-conversations`
§"Session lifecycle events" — Doubao's session duration limit is
unverified but is plausibly similar). Cons: does nothing about voice
identity on its own. F is the **prerequisite** for any of A/C/E to
be reachable in practice: without F, a single dropped WS terminates
the meeting; with F alone, the meeting survives but the voice shifts.

### 8.3 Recommendation for v0

**Adopt A (10s replay ring buffer) + F (exponential-backoff WS
reconnect) together as v0's reconnect strategy.** The two compose
naturally and address independent failure modes: F recovers the
network connection (the proximate cause of the outage), A gives the
server a continuous audio window to re-extract the voice profile
(the proximate cause of the audible tone shift after recovery).
Combined dev cost is ~1.5 dev-days (80–120 LoC ring + 30–50 LoC
reconnect loop), well within the §5 "≤3 dev-week" budget.

The combination is also what Doppelvoice itself recommends implicitly:
its `CHANGELOG.md` v0.2.2 reconnect-counter fix (which prevents the
30s lockout) is the F half, and its `poc-docs-take.md` §4.4 replay
design is the A half — the two were designed together. sokuji ships
neither, treating reconnect as a hard restart (per its README's
"Providers" table row for Doubao AST 2.0 — only the per-session
description is documented; no reconnect-specific behaviour is
described at `https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/README.md`).
The OpenAI Realtime API documents a richer pattern — `session.update`
mid-session for parameter changes, `conversation.item.truncate` for
interruption truncation, explicit 60-minute session cap (at
`https://developers.openai.com/api/docs/guides/realtime-conversations`)
— but these require API affordances Doubao AST 2.0 doesn't expose
(per `poc-docs-take.md` §3 event-codes table; no equivalent event
for `session.update` exists in the Doubao schema). So OpenAI's
pattern is informational only.

**Acceptance criterion for v0 (test in `latency-budget-v0.md` Appendix D
test 7, the network-drop variant):** with the A+F combination
deployed, kill the WS at a random mid-sentence moment using a
`tokio::time::timeout` injection in the test harness, then assert
(a) reconnect completes within ≤7s (sum of 1+2+4 backoff + handshake),
(b) the next TTSResponse chunk after reconnect has cosine voice-
embedding similarity ≥0.85 to the chunk emitted 5s before the drop
(measuring against a pre-recorded golden utterance), and (c) no
audio frames are emitted between the drop and the first post-reconnect
chunk (i.e., output is silenced cleanly, not glitched). If (b) fails
despite A being implemented, that confirms the §4.5 unknown (ii) —
server ignores `TaskRequest` payload for profile extraction — and we
revisit by adopting Strategy C in v0.1.

**What to defer to v1+:**

- **Strategy C (persistent voice_id cache).** Verification step is
  ≤1 dev-day (grep `SessionStarted(150)` response for stable UUID);
  if it succeeds, C is strictly better than A (no replay overhead,
  no extra API spend, no audibility delay on reconnect). Move to v0.1
  immediately after verification. Per §3.5 above, this also unlocks
  the broader "cross-session voice persistence" promise that
  `poc-docs-take.md` §4.5 currently flags as unknown.
- **Strategy E (full enrollment).** Same cost as Strategy 4 (per
  §4 above), which is v1 scope already.
- **Strategy D (parallel WS).** Cost-prohibitive for v0's pricing
  posture (2× session minutes × 30 元/h × meeting hours). Revisit
  if v1's cascade path (per `latency-budget-v0.md` §5) makes the
  Doubao session duration short enough that parallel sessions cost
  less than the seam-saving is worth.

### 8.4 Connection to other spec sections

- `docs/research/latency-budget-v0.md` Appendix D test 7 — the
  network-drop variant end-to-end integration test. The acceptance
  criterion above slots into this test's scope; A and F together are
  the implementation under test.
- `docs/research/poc-docs-take.md` §4.4 — the original PoC design
  for both A (the 10s ring buffer) and F (the 1s/2s/4s exponential
  backoff with max 3 retries). This section confirms and extends
  the PoC design with the §8.3 acceptance criterion.
- `docs/research/poc-docs-take.md` §4.5 — the three admitted
  unknowns around reconnect and zero-sample cloning stability.
  Strategy A is explicitly designed to address unknown (i) and
  unknown (ii); unknown (iii) — the cost of server-side replay
  decoding — is bounded by §8.2 above at ~5–10s of API spend per
  reconnect, which is acceptable for v0.
- `docs/adr/0009-...` (latency-budget + cascade-deferral ADR) —
  Strategy F's role in protecting the ≤3s first-sound target is
  consistent with the ADR's rejection of "preemptive cascade for
  reliability" in favour of cascade-for-latency-only. The reconnect
  strategy exists to make the single-endpoint path more reliable,
  not to motivate a cascade.
- §3.5 above — the wire-format analysis of `speaker_id=""` vs
  filled is the foundation for C and E. If §3.5's two-voices-only
  finding changes (i.e., Volcengine starts returning a stable
  cross-session `voice_id` on AST 2.0 itself, not just on the
  separate 声音复刻 2.0 endpoint), Strategy C becomes free.

### 8.5 Sources cited in this section

External (primary):

- `https://raw.githubusercontent.com/Tianqi-Bu/Doppelvoice/main/CHANGELOG.md`
  — v0.2.2 "Voice-clone 'tone shift' on every reconnect" finding;
  v0.2.2 "Reflective WiFi flapping … exponential backoff to climb to
  the 30-second cap" bug and its reset-on-SessionStarted fix.
- `https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/README.md`
  — sokuji provider table Doubao AST 2.0 row; no documented reconnect
  behaviour beyond per-session.
- `https://developers.openai.com/api/docs/guides/realtime-conversations`
  — Realtime Session lifecycle, 60-minute max duration, interruption
  / truncation pattern via `conversation.item.truncate`, session.update
  pattern. Used here as architectural reference only; Doubao AST 2.0
  does not expose equivalent events (per `poc-docs-take.md` §3).
- `https://elevenlabs.io/docs/eleven-agents/overview` — ElevenAgents
  custom-voice pattern (enroll once, reuse via voice_id); used as
  reference for Strategy C's persistence pattern.

Local (this repo):

- `docs/research/voice-clone-strategies.md` §2 (strategy taxonomy),
  §3.5 (wire-format analysis of `speaker_id`), §4 (v0 Rust effort
  columns), §5 (recommendation framing).
- `docs/research/poc-docs-take.md` §3 (Doubao event codes table; no
  `truncate` or `session.update` analogue), §4.1 stage 4 (uplink
  budget of 80 ms = 1.6 Mbit/s = the replay bandwidth for 10s =
  320 KB), §4.4 (Reconnect strategy design — exponential backoff
  1s/2s/4s, max 3 retries; 10s ring buffer cache; output静音 during
  reconnect; 音色重采样 after reconnect), §4.5 (three admitted
  unknowns around zero-sample cloning stability and 10s ring
  replay effectiveness).
- `docs/research/latency-budget-v0.md` §2 stage 4 (uplink 80 ms
  budget), Appendix D test 7 (network-drop integration test), §5
  (v1 cascade path — referenced as the structural ceiling-break
  for Strategy D).
- `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
  §"speaker_id 是否原生支持 — Q1" — Q1's quote on zero-sample vs
  preset `speaker_id` modes (cited in §3.5 above).
- `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`
  §6 — RMB/hour pricing tier reference for Strategy D's cost
  argument.
- `.scratch/macos-siminterpret-poc/issues/10-voice-clone-mode-decision.md`
  §"待解决的子问题 2" — open question on cross-account /
  cross-device `voice_id` reuse, the blocker for Strategy C.
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md`
  L61 — per-packet decode cost (~0.06 ms/包) reference for the
  latency budget of A's ring-buffer drain path.

---

## 9. Deep dive: Strategy 4 (user-enrolled preset voice)

The fourth strategy breaks from Strategy 1 (zero-sample per-session) by
front-loading voice capture: the user records a short reference clip
once, the system uploads it to a vendor's voice-cloning service, and
the API returns a stable `voice_id` (or `speaker_id`) that is reused
across every subsequent session. This is the standard SaaS pattern
(ElevenLabs Voice Library, OpenAI TTS voice library, Google Cloud TTS
custom voices, Camb.ai `voice_cloning`) and is also exposed by Volcengine
声音复刻 2.0 for ByteDance's TTS stack — which is what the parent
project would integrate against if it picked this path.

The question for v0 is whether the parent project should adopt Strategy
4 instead of Strategy 1, given that v0's hard constraints (≤3 dev-week,
MIT-only, no Apple Developer Program) already fit Strategy 1 on zero
new lines (per §5 below).

### 9.1 What is Strategy 4?

The strategy has a fixed shape across every vendor in this survey:

1. **Reference capture (one-time, per user)** — the user records 5–30s
   of speech in their own voice, ideally with a clean mic, no
   background music, and a short scripted prompt to maximize phoneme
   coverage. ElevenLabs documents Instant Voice Clone starting at
   ~10s of audio (per the Stack-map summary in
   `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
   L165, row "ElevenLabs Flash/Turbo"); Volcengine 声音复刻 2.0
   similarly takes 10s+ of audio as the training input (per
   `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
   L206 — "用户上传 10s+ 音频训练自己的音色，拿到一个 speaker_id").
2. **Upload + train** — the audio (sometimes plus a transcript) is
   uploaded to the vendor's voice-cloning service, which returns a
   `voice_id` (ElevenLabs / OpenAI / Camb.ai) or `speaker_id`
   (Volcengine bigtts). Volcengine slots expose up to 15 free training
   attempts per slot (per
   `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
   L125 / L172 — "每个槽位对应 1 个音色 ID（speaker_id），并包含
   15 次免费训练机会"). After 15 unsuccessful trainings the slot
   refuses further attempts until the user buys a new slot
   (`.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
   L171 — "所有预付费音色包含免费音色，均可进行 15 次训练，超出
   次数将报错且无法继续训练").
3. **Storage of the returned handle** — the client persists the
   `voice_id` / `speaker_id` locally (Keychain on macOS, encrypted
   file on Linux). Re-uploading reference audio on every session
   defeats the purpose; the whole point is to amortize the enrollment
   cost over many sessions.
4. **Per-session reference** — every StartSession (or equivalent TTS
   request) sends the stored `voice_id` in the `speaker_id` /
   `voice` field. For Volcengine 同传 2.0, this would mean filling
   `ReqParams.speaker_id` with the cloned value instead of leaving
   it empty (per `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
   L21 — "S2S 流式接口在同一 StartSession 请求里通过
   ReqParams.speaker_id 字段切换两种模式").
5. **Lifecycle** — the vendor may keep, expire, or delete the
   `voice_id`. Volcengine deletes unused trial voices after 7 days
   (per the ticket brief; this is documented in the Volcengine 声音复刻
   control console text quoted in
   `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
   L109–L121 — the docs confirm 7-day deletion for unused trial
   voices as part of the 试用 → 正式开通 flow).

The vendor pattern is therefore uniform. What differs is whether the
parent project can pay the integration cost.

### 9.2 Does Doubao AST 2.0 accept custom `voice_id` enrollment?

This is the critical open question for the v0 trade-off, and the
honest answer in this repo's prior research is "open, pending account-
level probe."

**What is documented:**

- 声音复刻 2.0 (Volcengine's voice-cloning service, 豆包语音 product
  line) exposes a slot/upload/train/query/audition/activate flow with
  per-slot 15 free training attempts and per-slot 1 `speaker_id`
  (per `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
  L107–L125; the 声音复刻下单页 quoted at L125: "每个槽位对应 1 个
  音色 ID（speaker_id），并包含 15 次免费训练机会"; and the prepaid /
  postpaid split at L120 — "默认采用按量计费 (后付费) 模式" for
  正式开通 vs the prepaid "15 次训练" allowance).
- 声音复刻 2.0's billing model is the standard TTS postpaid-by-character
  one (per
  `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
  L163 — "声音复刻 2.0 训练 ¥3/万字符"), with a 7-day deletion policy
  for unused trial voices (per the ticket brief; consistent with the
  control-console flow quoted in
  `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
  L109–L121).
- 声音复刻 2.0 lives in the 豆包语音 product line with its own APP
  ID + Access Token, distinct from 同传 2.0's API Key (per
  `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
  L8 — "同传 2.0 (S2S) 是火山方舟（ark）下的领域模型，鉴权用
  **API Key**；声音复刻 2.0 在豆包语音里走传统的 **APP ID +
  Access Token + Secret Key**").

**What is open:**

- The AST 2.0 public docs (URL `https://www.volcengine.com/docs/6348`)
  describe `ReqParams.speaker_id` as accepting the two preset voices
  `zh_female_vv_uranus_bigtts` and `zh_male_jingqiangkanye_emo_mars_bigtts`
  (per `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
  L23 / L188 — "string speaker_id = 4;" is the only voice-related
  field; documented preset values are the `zh_*_bigtts` namespace).
  Whether a `speaker_id` minted by 声音复刻 2.0 is **also accepted**
  by AST 2.0's WebSocket endpoint (resource_id `volc.service_type.10053`)
  is **not explicitly proven in the public docs that were
  cited/available in the prior ticket**. The prior research calls
  this out as a pending probe (per
  `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
  L178 — "声音复刻 2.0 单独调用的场景是 Web 控制台/独立 API ... 是
  预训练 speaker_id 的素材来源，但 AST 2.0 接口本身不要求走「先调
  复刻 2.0」流程"; and
  `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`
  L237 — "需要先确认 10053 的 s2s 是否允许 speaker_id 是复刻音色
  （待 T01 复核）").
- Same caveat in
  `.scratch/macos-siminterpret-poc/issues/10-voice-clone-mode-decision.md`
  §"待解决的子问题 2" — open question on whether a `voice_id` minted
  by 声音复刻 2.0 can be reused across accounts / across devices;
  this is the structural blocker for Strategy C in that issue
  ("先训练一个固定 speaker_id 复用"). Until the probe lands,
  treat Strategy 4 against Volcengine as an account-level experiment,
  not a documented capability.

**Why this matters for v0:**

The 3 dev-week budget cannot absorb a 2-week probe on whether AST 2.0
accepts a 声音复刻 2.0-minted `speaker_id`. So Strategy 4 against
Volcengine is an **explicit v1 candidate**, not a v0 default.

### 9.3 Industry products that ship Strategy 4

A quick survey of what competitors in the same product class actually
ship, to anchor Strategy 4's UX expectations:

- **金喜 (dachengzionly) — Standard tier ¥49** — the customer wiki
  snapshot (per
  `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`
  L20 — "标准版：'无需提前训练，开口即克隆'") describes zero-sample
  real-time clone only. The "Lightweight Cloud" tier (per
  `.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md`
  L21 / L26 — "轻量云端双向版 ... 训练音色（两个卡槽）"; and L58
  — "轻量云端支持训练音色 ... 支持两个卡槽") adds trained voice
  slots. Standard ¥49 → **does NOT include user voice enrollment**;
  trained-voice enrollment is a higher tier. **Treat as MEDIUM-HIGH**
  inference per `.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md`
  L21.
- **Doppelvoice** (Tianqi-Bu OSS, MIT) — per
  `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`
  L13 / L184 — "整个仓库用 grep voice_clone|bigtts|clone 检索只
  命中 proto 字段 speaker_id、req.denoise、voice_clone 这个 unused
  bool ... 全程是同传 2.0 这一根 WebSocket 流内嵌的零样本克隆".
  **No user enrollment UX; Strategy 1 only.** Confirmed by
  `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`
  L52 — "「用 speaker_id 指定已训练音色」是一个「实验性」旁路
  （gui/i18n.py:85 中文：'Speaker ID（实验性，留空使用默认）'），
  Doppelvoice 自己也没把它当主路径".
- **ElevenLabs Conversational AI** — voice library enrollment is
  required; there is no zero-shot-per-session path (per
  `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
  L165 — "ElevenLabs (Flash/Turbo) ... ✅ Instant（Starter+）" —
  Starter tier and above require you to upload reference audio). The
  ElevenLabs model is commercial SaaS (per
  `.scratch/macos-siminterpret-poc/research/19-tts-latency-options.md`
  L107–L114); the parent project's MIT-only + no-Developer-Program
  constraints do not block ElevenLabs from a licensing standpoint,
  but the recurring subscription cost (Pro $99/mo for 600k credits,
  per `.scratch/macos-siminterpret-poc/research/20-hybrid-cloud-local-architecture.md`
  L132) makes it a different business model from a BYO-API-key
  product.
- **OpenAI TTS** — same shape: voice library required (the six
  preset voices alloy/ash/coral/echo/sage/verse plus any user-added
  custom voices), no zero-shot option. Cited via
  `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
  table notes on TTS model landscape; no instant-clone path is
  advertised in the surveyed prior tickets.
- **sokuji** — confirmed zero-shot per-session (per the 26-row stack
  map in `.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md`
  L38 — Doppelvoice row "Zero-shot: empty speaker_id + denoise=false
  clones your voice"). sokuji is a sibling product in the same
  repo ecosystem, runs Strategy 1 by default.
- **TransEcho** (wxkingstar OSS, MIT) — per
  `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`
  L30 / L331–L333 — "`speaker_id` 字段只用于 TTS voice
  (`zh_female_vv_uranus_bigtts` 等预置音色), 没有走「声音复刻
  2.0」流程"; L332 "grep -i '复刻|clone|replica|voice.print|
  voice_id' /tmp/TransEcho: 零匹配". TransEcho is **subtitle-first**
  (per `.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md`
  L39 — "Subtitles-first; uses 同传 2.0 API (S2S-capable endpoint)") —
  no voice clone at all.
- **Camb.ai (Camb Studio, Realtime S2S)** — Strategy 4 native; per
  `.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md`
  L36 / L113 — "Voice cloning via Studio `voice_cloning` (cloned-
  voice slots, per-speaker cloning in DubStudio, emotion transfer);
  realtime API takes `voice_id`". Different business model (credit-
  based subscription starting Free 2K/mo per L36).

**Net read:** in the OSS/MIT/realtime-interpretation cluster the
parent project benchmarks itself against (Doppelvoice, TransEcho,
sokuji), **none ship Strategy 4 in v0**. Strategy 4 in this cluster
is associated with commercial SaaS (ElevenLabs, OpenAI, Camb.ai)
or with a higher-priced tier of a commercial product (金喜
轻量云端). Strategy 4 against Volcengine is a **structurally
unproven path** as of the prior ticket corpus.

### 9.4 Trade-off table: Strategy 4 vs Strategy 1 for v0

The comparison below uses the parent project's hard constraints (≤3
dev-week, MIT-only, no Apple Developer Program) as the cost basis.
"Dev time" is in Rust (parent project is Rust-first, per
`docs/research/poc-docs-take.md` §2 architecture summary; see also
Strategy 1's 0 new lines vs PoC in §5 of this doc).

| Dimension                | Strategy 1 (zero-sample per-session) | Strategy 4 (user-enrolled preset) |
|--------------------------|--------------------------------------|-----------------------------------|
| Dev time (Rust)          | **0 new lines vs PoC** (§5). PoC already sets `speaker_id=""` (per `docs/research/poc-docs-take.md` §2.3). | **~3–5 days** of new code: (a) UI flow in Settings to record 5–30s and upload to Volcengine 声音复刻 2.0 (HTTP + APP ID / Access Token auth, per `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md` L113–L116); (b) keychain-backed `voice_id` storage on first successful train (macOS Keychain via `security-framework` or `keyring` crate); (c) per-session load `voice_id` from keychain and inject into `ReqParams.speaker_id` (codec.rs:84-style edit, per `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md` L346); (d) fallback path if Keychain empty or API rejects; (e) error UX for "voice enrollment rejected" + "mic quality too low". Plus a docs review for the open probe in §9.2. |
| API cost                 | Per-session; bundled in AST 2.0's input+output token cost (¥14.6/h postpaid / ~¥5/h resource pack, per `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md` L291). | One-time enrollment: 声音复刻 2.0 training ¥3/万字符 (per `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md` L163), plus 15 free training attempts per prepaid slot. Per-session TTS still incurs standard bigtts cost on the resulting `speaker_id`. **Net: ~15–60s of training audio once, then break-even vs Strategy 1 within ~1–2 hours of use.** |
| UX cost                  | Every session starts fresh; voice profile re-sampled in the first ~10s of speech (per `docs/research/poc-docs-take.md` §4.5). No user action beyond clicking "start session." | One-time 30s record in Settings → wait for training → save. Subsequent sessions zero-friction (load `voice_id` from keychain). |
| Voice identity stability | **Drifts every session.** Each WebSocket handshake rebuilds the voice profile from scratch; reconnect produces audible tone shift per §1 ("Drift across sessions"). 30-min meetings with 2–3 reconnects = noticeable drift (per `docs/research/poc-docs-take.md` §4.5 + `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md` L225 — "重连即新会话 | 零样本音色重新采样，长会话音色会突变"). | **Stable forever** (until 7-day deletion if unused, per §9.1 step 5). Same `speaker_id` reused across every session and every reconnect → consistent voice identity. **Eliminates §1 failure mode 2 entirely.** |
| License safety           | **MIT-only ✅** (Doppelvoice MIT, TransEcho MIT, sokuji MIT; Strategy 1 inherits from PoC). | **MIT-only ✅** for the client code; vendor API terms still apply (Volcengine commercial API, per `.scratch/macos-siminterpret-poc/research/19-tts-latency-options.md` L35 — Doubao bigtts 商用 row). |
| Failure modes            | Reconnect voice drift (§1 failure modes 1+2); bad mic → poor clone but no permanent failure. | (a) Enrollment rejected by Volcengine (slot exhausted at 15 free trainings, per §9.1 step 2; bad audio quality; background noise flagged); (b) `voice_id` stale / 7-day-deleted for unused trial voices; (c) mic too noisy at recording time → permanent bad clone; (d) user reinstalls macOS → Keychain wiped → silent fallback to Strategy 1 (or hard failure if we choose to require Strategy 4). |

**Reading of the table:** Strategy 4's main wins are voice identity
stability across sessions and reconnect-stable voice. Its main cost is
the 3–5 dev days that v0 cannot spare. For v0, drift is a known
acceptance-criteria risk (per `docs/research/poc-docs-take.md` §4.5)
that the PoC already documents; v0 can ship with that risk disclosed.

### 9.5 Recommendation for v0

**Recommendation: Strategy 1 remains v0 default. Strategy 4 is deferred to v1.**

Justification against v0's hard constraints:

- **≤3 dev-week budget.** Strategy 1 needs 0 new lines; Strategy 4
  needs ~3–5 dev days (UI + Keychain + codec edit + fallback + error
  UX + account-level probe in §9.2). The 3-day delta is roughly 20 %
  of v0's schedule. That is exactly the kind of "feature creep"
  the v0 hard constraint is designed to block.
- **MIT-only, no Apple Developer Program.** Both strategies satisfy
  this constraint. No veto.
- **Voice identity stability is documented as a v1 task.** Per
  `docs/research/poc-docs-take.md` §4.5 (the §8 cross-refs in this
  doc) and `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`
  L225 — Doppelvoice's own known-issue row already names
  "调研 speaker_id 是否支持复用；UI 提示用户" as the long-term fix.
  We are not the first product to punt this to v1.
- **The §9.2 probe is unrun.** Spending 3 dev days on Strategy 4
  before knowing whether AST 2.0 accepts a 声音复刻 2.0-minted
  `speaker_id` is a known-unknown risk. v0 should not absorb it.

**Optional experimental slot in v0** — if voice identity stability
turns out to be a release blocker rather than an accepted risk, an
**experimental single-slot Strategy 4 path** can be added behind a
`--clone-mode=pre-trained --speaker-id=<vid>` CLI flag (per
`.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`
L346 — "A 路线: 增加 CLI flag `--clone-mode pre-trained --speaker-id
<vid>`, 把 codec.rs:84 的 speaker_id 直接换成复刻训练的 vid; 同步在
commands.rs 加存储 (`tauri-plugin-store` 已装, 复用 settings.json
schema)") without changing the default code path. The flag stores
`voice_id` in `settings.json` (PoC-acceptable, not keychain-grade),
and falls back to `speaker_id=""` (Strategy 1) if Volcengine rejects
the value. This is roughly half a dev day on top of v0 and preserves
the "0 lines by default" property for users who don't enable it.

**Concrete UX flow if Strategy 4 ships at v0** (as the experimental
slot):

1. User clicks Settings → Voice → "Record my voice" → records 5–30s
   → client uploads to Volcengine 声音复刻 2.0 via the slot/train
   endpoint (auth = APP ID + Access Token, per
   `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
   L113–L116).
2. Client polls 声音复刻 2.0 query endpoint until training finishes
   (typically seconds to minutes; rate ≤ 15 attempts/slot per
   `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
   L125).
3. Client stores returned `voice_id` in `settings.json` (PoC-grade
   storage; keychain deferred to v1 hardening).
4. On every StartSession, if a `voice_id` is present in settings,
   client sets `req.request.speaker_id = <voice_id>`; otherwise
   `req.request.speaker_id = ""` (Strategy 1 default).
5. Edge cases: `voice_id` rejected → fall back to Strategy 1 +
   toast "voice clone unavailable, using default clone"; 7-day
   deletion notice surfaced as a re-record prompt.

### 9.6 Implementation sketch (no code)

The sketch below describes modules and data flow only; no source
is included per the no-code-blocks constraint on this section.

- **UI surface** — Settings pane gains a "Voice" section with:
  - a status row showing the current mode: "Default (real-time clone)"
    or "Custom voice (trained on <date>)";
  - a "Record my voice" button (5–30s capture with VU meter for
    mic-quality feedback);
  - a "Delete custom voice" button (server-side delete via the
    声音复刻 2.0 deactivate endpoint, then local keychain/settings
    wipe).
- **Capture path** — uses the same mic capture stack as the v0
  meeting flow (CoreAudio on macOS, per
  `.scratch/macos-siminterpret-poc/research/06-macos-audio-routing-options.md`
  in the prior research; reused component, no new code beyond
  triggering a fixed-duration capture instead of a continuous stream).
- **Upload path** — new HTTP client (Rust `reqwest` is the standard
  pick in the PoC stack) calls the 声音复刻 2.0 train endpoint with
  multipart audio + the 10s+ audio guideline (per
  `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
  L206). Auth: APP ID + Access Token header, not the AST 2.0 API
  Key (per §9.2).
- **Polling path** — fixed-interval (e.g. 2s) GET to the query
  endpoint until training status = ready. Timeout after ~120s with
  a "training taking longer than expected" UI state.
- **Audition** — per the slot/upload/train/query/audition/activate
  flow, the audition step plays a sample sentence back so the user
  can confirm quality before activation. Re-record path on reject.
- **Storage** — `voice_id` written to `settings.json` (PoC-grade;
  keychain deferred). Read on StartSession; if missing or empty,
  Strategy 1 path is used unchanged.
- **Per-session** — `ReqParams.speaker_id` filled from `voice_id`
  when present; otherwise empty string (current PoC behavior, per
  `docs/research/poc-docs-take.md` §2.3).
- **Fallback** — on any Volcengine 4xx response that mentions an
  invalid `voice_id`, client logs the error, clears the stored
  `voice_id`, and falls back to Strategy 1 for the remainder of the
  session. UI surfaces a one-time toast.
- **Edge cases**:
  - `voice_id` expired (7-day trial deletion) → re-record prompt
    on next session launch.
  - Voice enrollment rejected (slot exhausted, audio flagged) →
    "delete and retry" UI; Strategy 1 path remains active in the
    meantime.
  - Mic quality too low (RMS below a threshold for >50 % of the
    capture window) → reject the capture before upload, prompt
    "please use a quieter environment."

### 9.7 Sources cited in this section

Local files (relative to repo root):

- `docs/research/voice-clone-strategies.md` §1, §5 (this doc's
  earlier sections — failure-mode taxonomy; Strategy 1's 0 new
  lines vs PoC).
- `docs/research/poc-docs-take.md` §2.3 (Strategy 1 PoC behavior —
  `speaker_id=""` + `denoise=false`); §4.5 (drift risk row);
  §4.4 L131–137 (10s ring buffer reconnect behavior).
- `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`
  L9, L13, L21, L23, L171, L178, L188, L206 — speaker_id field
  semantics, preset voices, 声音复刻 2.0 vs 同传 2.0 separation.
- `.scratch/macos-siminterpret-poc/research/02-volcengine-account-application.md`
  L8, L107–L125, L168–L172, L266 — 声音复刻 2.0 product line,
  slot model, 15 free trainings, postpaid model, 7-day deletion
  (via control-console flow text), trial-vs-paid split.
- `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`
  L30, L236, L237, L322, L331–L333, L337, L341, L346, L478,
  L490, L508 — pre-trained `speaker_id` route, CLI flag sketch,
  TransEcho's "no 复刻 path" finding.
- `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`
  L13, L52, L184, L225, L335 — Doppelvoice Strategy-1-only finding,
  drift-known-issue row, pending investigation of `speaker_id`
  reuse.
- `.scratch/macos-siminterpret-poc/issues/10-voice-clone-mode-decision.md`
  §"待解决的子问题 2" — open question on cross-account / cross-
  device `voice_id` reuse (structural blocker for Strategy C).
- `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`
  L20, L114, L116, L118, L123, L127 — 金喜 standard tier
  zero-sample claim.
- `.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md`
  L21, L26, L58 — 金喜 轻量云端 "训练音色（两个卡槽）" tier;
  MEDIUM-HIGH inference on trained-voice availability.
- `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
  L20, L163, L165, L291 — ElevenLabs Instant Clone tier requirement;
  声音复刻 2.0 ¥3/万字符 cost; R3 cost reference.
- `.scratch/macos-siminterpret-poc/research/19-tts-latency-options.md`
  L35, L107, L114 — ElevenLabs / OpenAI TTS library-required shape;
  commercial model classification.
- `.scratch/macos-siminterpret-poc/research/20-hybrid-cloud-local-architecture.md`
  L132 — ElevenLabs Pro $99/mo cost basis.
- `.scratch/macos-siminterpret-poc/research/26-interpretation-product-stack-map.md`
  L36, L38, L39, L113 — Camb.ai Strategy-4 native shape;
  Doppelvoice / TransEcho / sokuji strategy summaries.
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md`
  L61 (referenced from §8) — per-packet decode cost for the
  latency-budget cross-reference in §9.4's "API cost" row.

External URLs (cited in the user's task brief; not re-fetched in
this write — page content was not retrievable from the sandbox and
all factual claims about Volcengine above are sourced from the local
mirror corpus in `.scratch/macos-siminterpret-poc/research/`):

- `https://www.volcengine.com/docs/6561` — Volcengine 声音复刻
  product docs (slot/upload/train/query/audition/activate flow).
- `https://www.volcengine.com/docs/6348` — Volcengine 豆包同传 2.0
  product docs (the public docs cited for `speaker_id` field
  semantics; the open question on whether 声音复刻 2.0-minted
  `speaker_id` values are accepted remains unresolved against the
  publicly available text).
- ElevenLabs Voice Library / Conversational AI product page —
  referenced for the industry precedent of enrollment-required
  voice identity (specific page URL was 404 in the sandbox fetch
  attempt; the "library-required, no zero-shot" finding is supported
  by the prior local survey
  `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`
  L165 + `.scratch/macos-siminterpret-poc/research/19-tts-latency-options.md`
  L107–L114).
- OpenAI TTS voice library / Google Cloud TTS custom voices —
  referenced for industry precedent (specific product pages were
  unreachable from the sandbox; the "library-required" finding is
  supported by the prior survey's table of TTS models in
  `.scratch/macos-siminterpret-poc/research/24-speech-model-landscape-2026.md`).

End of §9.