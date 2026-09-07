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