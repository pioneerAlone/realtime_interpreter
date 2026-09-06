# 02 · Audio Pipeline — R3 + R4 Channels

> **Status**: DRAFT (round 2 of /grill-with-docs, 2026-09-06). Not committed to git yet.
> **Scope**: v0 audio pipelines for both R3 (A-channel, outbound, your-voice English) and R4 (B-channel, inbound, bilingual subtitles). Covers frame sizing, ring-buffer design, Opus streaming decode, sample-rate handling, device hot-plug, and the 原声直出 (raw-passthrough) toggle.
>
> All claims cite `docs/research/poc-docs-take.md`, `docs/research/openless-take.md`, `docs/research/latency-budget-v0.md`, or `.scratch/macos-siminterpret-poc/issues/*` — see inline parentheticals.
> Items still requiring user confirmation are marked **[REVIEW]**.

---

## 1. R3 (A-channel) pipeline

R3 is the **outbound** path: you speak Chinese → your meeting hears English in a voice that sounds like you. The pipeline uses **Doubao 同传 2.0 S2S** (`poc-docs-take.md` §3 row "Doubao endpoint URL" + `latency-budget-v0.md` §3 stage 4) with **Rust `cpal` 0.15** capture and playback (per `openless-take.md` L32, L148) and the **`opus` crate** for streaming decode (per `latency-budget-v0.md` Appendix C stage 8).

### 1.1 R3 pipeline diagram

```mermaid
flowchart LR
    Mic[Mac mic<br/>16/48 kHz mono] -->|cpal capture thread| Cap{cpal<br/>256-frame<br/>buffer}
    Cap -->|20ms frames<br/>stage 1| Pre[AGC<br/>stage 3<br/>+5ms]
    Pre -->|VAD tap| VAD[Silero-v5<br/>threshold 0.3<br/>stage 2]
    Pre -->|16-bit PCM| WS[WebSocket<br/>tokio-tungstenite<br/>wss://openspeech.bytedance.com/<br/>api/v4/ast/v2/translate<br/>stage 4]
    WS -->|binary protobuf| Doubao[(Doubao AST 2.0<br/>S2S inference<br/>~2100 ms<br/>stage 5)]
    Doubao -->|TTSResponse 352<br/>ogg_opus chunks| Down[WebSocket<br/>downlink<br/>stage 6]
    Down -->|stream per chunk| OGG[Custom OGG demuxer<br/>+ opus crate decode<br/>stage 8 ~5ms total]
    OGG -->|48kHz PCM| Ring[SPSC ring<br/>crossbeam-channel<br/>40ms initial<br/>stage 7]
    Ring -->|cpal playback<br/>callback| Play{cpal<br/>256-frame<br/>buffer}
    Play -->|BlackHole 2ch<br/>R3 output| BH[BlackHole 2ch<br/>48kHz native<br/>stage 9]
    BH -->|meeting mic input| Meet[Meeting software<br/>Zoom / Teams / 腾讯会议]
```

### 1.2 Stage-by-stage notes

| # | Stage | What happens | Latency target | Source |
|---|---|---|---|---|
| 1 | Mic capture | `cpal::Stream` capture with `BufferSize::Fixed(256)` on CoreAudio HAL; emit 20ms frames (960 samples @ 48k, 320 @ 16k) | 10 ms | `latency-budget-v0.md` §2 stage 1 + §3 stage 1 |
| 2 | VAD | Silero-v5 ONNX tap on the same stream; threshold 0.3 (lower than default 0.5); `try_clone()` — no extra queuing | 0 ms | `latency-budget-v0.md` §2 stage 2 + §3 stage 2 |
| 3 | AGC | Inline peak tracker; target −16 dBFS, attack 5 ms / release 100 ms, limiter −3 dBFS. **No DeepFilterNet at v0** | +5 ms | `latency-budget-v0.md` §2 stage 3 + §3 stage 3 |
| 4 | WS uplink | `tokio-tungstenite` binary Protobuf frames; preconnect at app start; 30 s keep-alive ping | 50 ms | `latency-budget-v0.md` §2 stage 4 |
| 5 | Doubao S2S | Hard ceiling — AST 2.0 S2S inference; FLAL 2.21s per LiveInterpret 2.0 paper (cited `latency-budget-v0.md` §2 stage 5); v0 budget = 2100 ms optimistic, 2400 ms realistic | 2100–2400 ms | `poc-docs-take.md` §4.1 stage 5; `01_技术可行性报告.md` L274 |
| 6 | WS downlink | Same `tokio-tungstenite` connection; **read TTSResponse(352) chunks as they arrive** — do not wait for TTSSentenceEnd(351) (this is the Stage-8 unlock per `latency-budget-v0.md` §3 stage 6) | 40 ms | `latency-budget-v0.md` §2 stage 6 |
| 7 | Jitter buffer | `crossbeam-channel` SPSC ring (`VecDeque<i16>` behind `Arc<Mutex<…>>`); 40 ms initial fill then 20–40 ms adaptive per `03_性能与成本分析.md` L89–105 algorithm | 40 ms initial + 20–40 ms adaptive | `latency-budget-v0.md` §2 stage 7 + §3 stage 7 |
| 8 | Opus decode | `opus` crate `Decoder::new(48000, Channels::Stereo)` + custom OGG demuxer (~50 LoC inline or separate `opus-ogg-demux` crate — see §5); strip 2-byte `OpusHead` from first packet of each sentence; per-chunk decode `dec.decode(packet, &mut pcm, false)` | 5 ms total | `latency-budget-v0.md` §2 stage 8 + §3 stage 8 |
| 9 | Playback | `cpal::Stream::play` to BlackHole 2ch device; `buffer_size: BufferSize::Fixed(256)` = 5.3 ms device buffer; total = device buffer + CoreAudio HAL ≈ 20 ms | 20 ms | `latency-budget-v0.md` §2 stage 9 + §3 stage 9 |
| 10 | **End-to-end** | Sum of 1–9 at stage-5=2100 → **2270 ms**; at stage-5=2400 → **2570 ms** | **≤ 3000 ms** | `latency-budget-v0.md` §2.1 |

See `docs/spec/v0/04-latency-budget.md` §2 for the full waterfall with risk and citation columns.

---

## 2. R4 (B-channel) pipeline

R4 is the **inbound** path: the other party speaks English → you see bilingual subtitles (source + translation) in a floating window. The pipeline uses **Doubao 同传 2.0 S2T mode** (same WebSocket endpoint `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`, different `mode="s2t"` per `poc-docs-take.md` §3 "Doubao endpoint URL" + `01-volcengine-api-capabilities.md` L26). S2T emits bilingual subtitles directly via events 650–655 — **no separate ASR+MT module is needed** (per `map.md` Notes "T01 + T16 共同确认——R4 不需要独立 MT 模块"; `.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md` path A).

### 2.1 R4 pipeline diagram

```mermaid
flowchart LR
    Meet[Meeting software<br/>output to<br/>BlackHole 16ch] -->|BlackHole 16ch<br/>48kHz stereo| Loop{cpal<br/>loopback<br/>capture}
    Loop -->|20ms frames<br/>resampled 48→16kHz| Pre[AGC + VAD<br/>shared stage 2-3]
    Pre -->|16kHz PCM| WS2[WebSocket<br/>tokio-tungstenite<br/>mode=s2t<br/>source=en target=zh<br/>stage 4]
    WS2 -->|binary protobuf| Doubao2[(Doubao AST 2.0<br/>S2T inference<br/>~1200 ms FLAL<br/>stage 5)]
    Doubao2 -->|650 SourceSubtitleStart<br/>651 SourceSubtitleComplete<br/>652 SourceSubtitle<br/>653 TranslationSubtitleStart<br/>654 TranslationSubtitleComplete<br/>655 TranslationSubtitle| Evt[Rust<br/>doubao::event<br/>decoder]
    Evt -->|IPC event<br/>subtitle:append| Tauri[Tauri IPC<br/>app.emit]
    Tauri -->|Zustand<br/>subtitles store| React[React<br/>SubtitleWindow<br/>component]
    React -->|floating panel<br/>macOS NSPanel| Win[Subtitle window<br/>半透明 70%<br/>可拖拽 可缩放<br/>Ctrl+Alt+H 隐藏]
```

### 2.2 Stage-by-stage notes

| # | Stage | What happens | Latency | Source |
|---|---|---|---|---|
| 1 | B-channel capture | `cpal` loopback capture from BlackHole 16ch at 48 kHz stereo; resample 48→16 kHz via Rubato (TransEcho precedent — `03-transecho-deep-read.md`) | ~25 ms | `.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md`; `latency-budget-v0.md` §1.3 |
| 2 | AGC + VAD | Shared stage 2–3 modules with R3 (no per-channel re-implementation) | 5 ms | `latency-budget-v0.md` §2 stages 2–3 |
| 3 | WS uplink | Same `tokio-tungstenite` client lib as R3 but second connection; mode=s2t, source=en, target=zh (omit `target_audio` per `18-local-mt-models.md` path A) | 50 ms | `latency-budget-v0.md` §2 stage 4 |
| 4 | Doubao S2T | Single-session translation; emits 650–655 events per `01-volcengine-api-capabilities.md` L26 + `02_项目架构与技术栈.md` L272–288; paper FLAL 2.12 s en-zh per `18-local-mt-models.md` | ~1200 ms | `01-volcengine-api-capabilities.md` L26; `18-local-mt-models.md` |
| 5 | WS downlink | 650/651/652 + 653/654/655 events arrive over the same WS | 40 ms | `latency-budget-v0.md` §2 stage 6 |
| 6 | Rust event decode | `doubao::event::Decoder` consumes the protobuf; emits typed `Subtitle` struct (see `docs/spec/v0/03-b-channel-subtitle.md` §1) | < 1 ms | `poc-docs-take.md` §2 row "Key module/symbols" |
| 7 | IPC | `app.emit("subtitle:append", &Subtitle)` — same Tauri event-bus pattern as Open-Less (`openless-take.md` §6 pattern #2 + `openless-take.md` §4 "microphone:level" reference) | < 5 ms | `openless-take.md` §4 audio-specific GUI patterns |
| 8 | React re-render | Zustand `subtitles` store append; `SubtitleWindow` component re-renders (only this sentence / rolling / all mode) | < 16 ms | `openless-take.md` §6 pattern #2 |
| 9 | **B-channel end-to-end** | First subtitle visible in window | **~1.3–1.5 s** | `03_性能与成本分析.md` L69 (B-通道 latency claim) |

The B-channel claimed ~1.5 s end-to-end per `03_性能与成本分析.md` L69 is **entirely hypothetical** — no implementation exists in the PoC (`poc-docs-take.md` §1.1 — B-通道 ⏳待开发). v0 must **measure** this end-to-end and publish the number, not assume it.

---

## 3. Frame sizing decisions

| Frame | Value | Why | Source |
|---|---|---|---|
| **Capture frame** | **20 ms** (960 samples @ 48 kHz; 320 @ 16 kHz) | Half-frame queuing = 10 ms; smaller (10 ms) makes Opus packet loss / WS frame overhead dominate; bigger (40 ms) wastes stage-1 budget | `latency-budget-v0.md` §2 stage 1 + §3 stage 1 |
| **Opus decode frame** | **20 ms** (per `TTSResponse(352)` chunk) | Matches Doubao's server-side chunking per `.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md`; per-chunk decode ≈ 0.06 ms (cited `16-streaming-first-sound-optimization.md` L61 from `02_项目架构与技术栈.md` L185–207) | `latency-budget-v0.md` §3 stage 8 |
| **Jitter buffer initial fill** | **40 ms** (vs PoC's 120 ms) | Server emits ~1 chunk every 20 ms so we always have ~2 chunks ahead; PoC's 120 ms was sized to absorb `soundfile` whole-sentence decode jitter that no longer exists | `latency-budget-v0.md` §2 stage 7 + §3 stage 7 |
| **WS frame size** | **20 ms payload per binary frame** | Same as capture frame; matches Doubao's expected input cadence per `poc-docs-take.md` §3 row "Audio input spec" | `poc-docs-take.md` §3 |

**[REVIEW]** Trade-off: 20 ms is a deliberate compromise between first-sound latency and Opus/WS overhead. If integration tests show instability on M2 Air wifi (R2 in `latency-budget-v0.md` §4), the fallback is **40 ms** capture frames (saves nothing on first-sound, but cpal's larger buffer is more stable). See `docs/spec/v0/04-latency-budget.md` §9 [REVIEW] #1.

---

## 4. Ring buffer design

PoC used `bytearray + threading.Lock + 蓄能 120 ms` in Python (`poc-docs-take.md` §2 row "Key module/symbols in mac_ast2_s2s_v2.py" + `01_技术可行性报告.md` L387 row "播放队列线程安全"). This is **proven correct** but Python-specific.

### 4.1 Parent project choice: `crossbeam-channel` SPSC + `VecDeque<i16>`

Parent uses **Rust `crossbeam-channel` SPSC** (single-producer single-consumer) wrapping a `VecDeque<i16>` for the playback ring, with **40 ms 蓄能** (per `latency-budget-v0.md` §2 stage 7). Adapter: `Arc<tokio::sync::Mutex<VecDeque<i16>>>` is the equivalent async-friendly pattern (`latency-budget-v0.md` Appendix C stage 7).

### 4.2 Why `crossbeam` is preferable for v0

| Criterion | PoC Python `bytearray + Lock` | v0 Rust `crossbeam-channel` SPSC | Verdict |
|---|---|---|---|
| GIL-bound | Yes (Python) | N/A (Rust) | Rust wins |
| Lock contention | `threading.Lock` per write | Lock-free SPSC send/recv | Rust wins |
| Allocator behavior | Per-write resizing possible | Bounded capacity at creation; no realloc | Rust wins |
| Backpressure | Implicit via blocking send | Explicit via bounded channel + try_send fallback | Tie |
| Latency floor | ~1 ms (Python overhead) | < 100 µs (lock-free) | Rust wins by 10× |
| Maturity | PoC-proven | `crossbeam-channel` 0.5.x battle-tested | PoC has empirical evidence; crossbeam is widely used in production Rust audio code (e.g. `cpal` examples) |
| Cognitive load | Low (Python idiom) | Medium (Rust lifetime/borrow) | PoC is simpler to read |

The **40 ms 蓄能 vs 120 ms PoC** reduction is justified because the **stream decode at stage 8** (`latency-budget-v0.md` §3 stage 8) eliminates the 200–500 ms whole-sentence jitter that the PoC's 120 ms 蓄能 was sized to absorb (`poc-docs-take.md` §4.1 stage 7 row "Drops to 20ms possible but jitter risk" + `01_技术可行性报告.md` L399). With chunks streaming every ~20 ms, 40 ms = 2 chunks of safety is sufficient.

### 4.3 Bypass mode (原声直出)

When 原声直出 is on (§8 below), the ring is **bypassed entirely**: B-channel audio routes BlackHole 16ch → headphones directly, no decode, no playback thread, **0 ms latency cost**. See §8 below for routing.

---

## 5. Opus stream decode design

PoC's `opus_decoder.py` uses `soundfile` (`libsndfile`) and **accumulates `TTSResponse(352)` chunks until `TTSSentenceEnd(351)`, then whole-sentence decodes** — adds 200–500 ms (per `poc-docs-take.md` §4.1 + `01_技术可行性报告.md` L407 row "Opus解码 | soundfile (libsndfile)"). **v0 must not do this.** v0 uses `opus` crate + custom OGG demuxer for **per-chunk decode** (~0.06 ms per 20 ms packet per `16-streaming-first-sound-optimization.md` L61).

### 5.1 Why a custom OGG demuxer is required

Per `latency-budget-v0.md` Appendix E decision 2, no off-the-shelf Rust crate does **streaming** OGG/Opus demuxing at the granularity we need:

- `opus` crate (verify version at impl; ~0.3.x current per `latency-budget-v0.md` Appendix C stage 8) — provides the **decoder**, not the OGG container parser.
- `ogg` crate (verify version at impl) — provides OGG container parsing but is **sync/blocking**, which is a poor fit for `tokio`-native event loops.
- `lewton` (Vorbis only) — wrong codec.
- `pyogg` / `opuslib` — Python-only.

The custom demuxer needs to:

1. Strip the 2-byte `OpusHead` from the first packet of each sentence.
2. Detect `OpusTags` (once per stream, ignore).
3. Feed each subsequent `OpusPacket` to `Decoder::decode(packet, &mut pcm, false)`.
4. Push PCM samples to the ring (stage 7).

**Estimated LoC**: ~50 (per `latency-budget-v0.md` Appendix E decision 2 "Inline keeps binary lean; crate saves dev time. Cost of inline: ~2 dev days"). The parent project's pattern matches `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61 recommendation: "opuslib 流式解码避免 500ms 整句缓冲".

### 5.2 Fallback (HIGHEST RISK per `latency-budget-v0.md` §4 R3)

If the demuxer has bugs in integration testing, fall back to **whole-sentence decode** using `pyogg`-equivalent (Rust `ogg` + `opus` crates reading whole OGG stream) and ship at +200 ms. v0.1 demuxer fix in v0.2.

### 5.3 Test plan

Per `latency-budget-v0.md` Appendix D test 5: encode 1s of test speech locally, send through the demuxer + `opus` decoder, assert PCM output matches original within **SNR > 40 dB**. This is the **highest-risk integration test** because the demuxer is custom.

---

## 6. Audio device hot-plug

`cpal` exposes device-changed events via the host backend (CoreAudio on macOS). Open-Less wires `coreaudio-sys 0.2` directly for `AudioObjectAddPropertyListener` (`openless-take.md` §4 item 3). v0 follows the same pattern.

### 6.1 Event handling

| Event | Action |
|---|---|
| BlackHole 2ch unplugged | **Hard fail**: pause R3 session, emit IPC `device:lost` event, show banner "R3 输出设备丢失 — 请检查 BlackHole 2ch 连接"; do NOT auto-recover (we cannot guess the user's intent) |
| BlackHole 16ch unplugged | **Pause R4 session** (subtitle stream); 原声直出 (if on) **also** fails because both rely on BlackHole 16ch |
| Default mic changed | Re-bind the capture stream to the new default; seamless (cpal handles this internally) |
| Headphones unplugged | macOS routes audio to internal speaker; we do not intervene |

### 6.2 Why we don't auto-recover

Auto-recovery would require guessing which virtual device the user re-plugged, and could create a **feedback loop** (auto-reconnecting to the wrong BlackHole). Per `poc-docs-take.md` §7 row "3 误区 self-check" (dachengzionly wiki T21, per `map.md` Not-yet-specified): mistaking 翻译输出 VAC for 对方声音输入 VAC causes infinite echo. **The user must confirm the topology is correct before we resume.** The pre-flight topology checker (§10 in `docs/spec/v0/06-deliverables.md`) is the only safe re-entry path.

**[REVIEW]** Recovery policy options:

- **Option A (recommended)**: Hard fail + manual user restart of the session. Safe; user loses ≤ 30 s of meeting time.
- **Option B**: Auto-pause + show reconnect dialog. User clicks "Resume" after fixing the topology. Compromise.
- **Option C**: Auto-reconnect to the same-name device. Risky — could re-create a feedback loop if the user swapped devices.

---

## 7. Sample rate handling

| Path | Native rate | Why | Source |
|---|---|---|---|
| **Mic capture** | 48 kHz (or 16 kHz fallback) | Doubao accepts 16/24/48 kHz input per `02_项目架构与技术栈.md` L253 (rate is set in `source_audio`); 48 kHz avoids resample at capture. Resample to 16 kHz before WS send. | `latency-budget-v0.md` §3 stage 1 |
| **R3 playback** | **48 kHz native** — **REQUIRED** for BlackHole | BlackHole's native rate is 48 kHz per `latency-budget-v0.md` §2 stage 9 row "Set BlackHole to 48 kHz native to avoid internal resample"; the PoC's playback sample-rate bug per `poc-docs-take.md` §1 was partly a 44.1/48 mismatch issue | `latency-budget-v0.md` §2 stage 9 + §3 stage 9 |
| **B-channel capture** | 48 kHz from BlackHole 16ch | BlackHole 16ch native; resample 48→16 kHz via Rubato before WS send | `.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md` |
| **Opus decode output** | 48 kHz stereo | Match playback rate to avoid downstream resample | `latency-budget-v0.md` §3 stage 8 |

**[REVIEW]** Capture rate: 48 kHz (recommended in `latency-budget-v0.md` §3 stage 1, saves a resample step) vs 16 kHz direct (matches PoC `poc-docs-take.md` §3 row "Audio input spec"). 48 kHz sends `rate=16000` in the Protobuf header and lets the server resample — verify server accepts this at integration time. See `docs/spec/v0/04-latency-budget.md` §9 [REVIEW] #1.

---

## 8. 原声直出 (B-channel audio pass-through)

**Definition (per `01_技术可行性报告.md` L66 / `02_项目架构与技术栈.md` L66 cited in `poc-docs-take.md` §7 row "原声直出开关 (绕过同传)")**: the B-channel audio (other party's English as captured from BlackHole 16ch) is routed **directly to the headphones** without going through Doubao S2T translation. The user hears the original English; the subtitle window shows nothing.

### 8.1 Why this is in scope for v0

- It is the **single biggest cost-saver** in the cost analysis: per `03_性能与成本分析.md` L241 row "原声直出 100%" (i.e., 100% API cost reduction when on).
- It is the **"panic button"** for when the meeting drops to small talk or the user wants to listen directly without translation latency.
- It is the **debug tool**: lets the user verify B-channel audio is reaching the app at all, separate from the S2T pipeline working.

### 8.2 Routing

| Mode | Audio path | Latency to headphones | API cost |
|---|---|---|---|
| **原声直出 ON** | BlackHole 16ch → `cpal` loopback capture → `cpal` direct pass-through output → headphones (bypasses ring buffer entirely) | ~20 ms (BlackHole + CoreAudio HAL) | **0** (no Doubao S2T) |
| **原声直出 OFF (default)** | BlackHole 16ch → `cpal` loopback → WS → Doubao S2T → subtitle window (no audio to headphones unless R4 TTS is enabled, which v0 does NOT — see `02_项目架构与技术栈.md` L105 `enableTts` default false) | ~1.3–1.5 s for subtitle; no audio | ~50% of B-channel baseline |

### 8.3 UI affordance

- Tray menu toggle: "原声直出 (Bypass)" with keyboard shortcut `Ctrl+Alt+P` (placeholder; see [REVIEW] below).
- Floating subtitle window: button in the corner.
- The subtitle window must show a visible "原声直出" banner so the user knows they're hearing the un-translated audio.

**[REVIEW]** Default-on vs default-off trade-off:

- **Default OFF** (safer for first-time users; they always see translation working).
- **Default ON** (recommended by `03_性能与成本分析.md` L241 cost strategy; saves API cost on first run; user must opt-in to translation).

See `docs/spec/v0/03-b-channel-subtitle.md` §5 [REVIEW].

---

## 9. [REVIEW] decisions for this section

1. **Capture frame size**: 20 ms (recommended) vs 40 ms (safer for wifi) vs 80 ms (PoC default, too slow). Trade-off: latency vs stability.
2. **Opus decode frame matching**: confirm Doubao S2S `TTSResponse(352)` chunks arrive at 20 ms cadence in integration testing. If they arrive at variable sizes, the demuxer needs resync logic (additional dev time).
3. **Ring buffer size**: 40 ms initial (recommended) vs 60 ms (safer for wifi). The right answer depends on which market we ship to first (home wifi vs office wired) per `latency-budget-v0.md` Appendix E decision 3.
4. **Hot-plug recovery policy**: hard fail + manual restart (recommended, §6.2 Option A) vs auto-pause with reconnect dialog (Option B) vs auto-reconnect to same-name device (Option C, rejected).
5. **OGG demuxer inline (~50 LoC) vs separate `opus-ogg-demux` crate** (per `latency-budget-v0.md` Appendix E decision 2). Cost of inline: ~2 dev days.
6. **原声直出 default-on vs default-off** (per §8.3 [REVIEW]).

---

## Sources cited in this document

- `docs/research/poc-docs-take.md` §1.1, §2, §3, §4.1, §6, §7
- `docs/research/openless-take.md` L32, L148, §4 items 1–3, §6 patterns #2, #3
- `docs/research/latency-budget-v0.md` §1.3, §2 stages 1–9, §3 stages 1–8, §4 R1–R5, Appendix C, Appendix D test 5, Appendix E decisions 1–3
- `.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md` L26
- `.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md`
- `.scratch/macos-siminterpret-poc/issues/16-streaming-first-sound-optimization.md` L61
- `.scratch/macos-siminterpret-poc/issues/18-local-mt-models.md` path A
- `.scratch/macos-siminterpret-poc/issues/21-virtual-sound-card-wiki-synthesis.md` (3 误区 self-check)
- `.scratch/macos-siminterpret-poc/map.md` Notes (T01 + T16 — R4 doesn't need independent MT), Decisions #1
- Local-only reference: `realtime_interpreter_Minimal_Implementation/01_技术可行性报告.md` L274, L386–391, L399, L407; `02_项目架构与技术栈.md` L66, L105, L115, L128, L185–207, L253, L267–269, L272–288, L497–524; `03_性能与成本分析.md` L30–42, L69, L89–105, L241. Per `AGENTS.md` §"Local-only reference", paths only — no code copied.
