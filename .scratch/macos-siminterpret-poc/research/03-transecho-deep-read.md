# T03 — TransEcho 仓库深读

> Wayfinder ticket: `.scratch/macos-siminterpret-poc/issues/03-transecho-deep-read.md`
> Repo: https://github.com/wxkingstar/TransEcho (clone owner actually `wxkingstar`, not `tianpomin` — see §10)
> Clone used: `git clone --depth 1 https://github.com/tianpomin/TransEcho /tmp/TransEcho` (HTTPS redirect to the same origin; shallow depth 1, so git history is just the HEAD commit)
> Method: read source code + README + CLAUDE.md + proto + GitHub web view. No blog write-ups cited as primary.

---

## 0. TL;DR (one-screen gist)

**Tech stack = Tauri 2 (Rust backend + Svelte 5/SvelteKit frontend, SSR-off SPA) + ScreenCaptureKit (macOS) / WASAPI loopback (Windows) + Rubato resampler + Rodio TTS + tokio-tungstenite WebSocket + prost Protobuf over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` with `volc.service_type.10053` (= 豆包同声传译 2.0 二进制版). Direction is one-way only (system-audio → subtitles + optional TTS); Svelte UI shows bilingual subtitles.**

**Status vs. our PoC needs (R3 出方向 + R4 入方向 + CLI + BlackHole virtual-mic + 防回声 + 声音复刻 2.0):**

| 需要 | TransEcho 有 | 备注 |
|---|---|---|
| 豆包同传 2.0 WebSocket 客户端 | ✅ 完整可复用 | `transport/client.rs` + `transport/codec.rs` + `proto/` |
| Protobuf 编解码（含 `ReqParams.speaker_id`） | ✅ | 直接拷 |
| `volc.service_type.10053` 同传 2.0 resource | ✅ hardcoded | 我们要复用同一 resource |
| Rubato 48kHz→16kHz mono i16 重采样 | ✅ | `audio/resample.rs` 可复用 |
| `AudioFrame` 数据结构 | ✅ | `audio/capture_macos.rs`/`capture_windows.rs` 复用 |
| macOS 屏幕录制权限 + ScreenCaptureKit 音频捕获 | ✅ | `capture_macos.rs` (R4 字幕方向唯一可用) |
| Windows WASAPI loopback | ✅ | 仅参考 |
| Rodio TTS 播放器 + jitter buffer | ✅ | `audio/playback.rs` (本地扬声器播报) |
| 静噪门限 (RMS 0.01/0.02 hysteresis) | ✅ | `commands.rs:200-259` |
| 字幕事件去重 (last 15 finalized) | ✅ | `commands.rs:307-347` |
| **R3 出方向：用户麦克风 → 同传 → TTS → 虚拟麦克风输出** | ❌ | TransEcho 不接 mic input，也不写虚拟声卡 |
| **R4 正确方向：从远端扬声器播放回采** | ✅ (方向对) | 但仅供字幕，不形成隔离总线 |
| **声音复刻 2.0 (pre-trained `speaker_id`)** | ❌ | `speaker_id` 字段只用于 TTS voice (`zh_female_vv_uranus_bigtts` 等预置音色), 没有走「声音复刻 2.0」流程 |
| **音色克隆 0-sample (同传 2.0 内置)** | ❌ | 同传 2.0 10053 resource 不支持 0-sample; 需要 10035 流式语音 + 复刻 2.0 |
| **虚拟麦克风输出 (BlackHole)** | ❌ | TransEcho 用 Rodio 直接播到 default output |
| **Multi-Output Device 配置** | ❌ | 没有 |
| **总线隔离 / 防回声 (B1 思想)** | ❌ | 没有；用户只能静音系统声音听字幕，不能边看边说边播 |
| **CLI-only 启动 (无 UI)** | ❌ | Tauri 桌面 app，单页 Svelte UI；改造成 CLI 需要重写 entry |
| **R3+R4 双向同传 (single session)** | ❌ | 单向 |
| **bilingual 双字幕输出 (中+EN) 到 stdout** | ❌ | Svelte UI 渲染，JSON event 到 Tauri Channel |

**结论**: TransEcho 是 **R4 入方向字幕 + 同传 2.0 client + WebSocket/Protobuf 栈** 的几乎完整实现，但 **R3 出方向、虚拟麦克风输出、防回声总线、声音复刻 2.0、CLI** 全部缺失。代码量约 2.7k 行 Rust/Svelte，估计 **要新增 ~600–900 行 Rust 代码 + 改写 entry** 才能拉到本 PoC 验收线。

---

## 1. 整体架构

### 1.1 顶层目录结构 (`/tmp/TransEcho`)

```
TransEcho/                                v0.1.4 (2026-03-27)
├── package.json                          # Node/前端元数据 (Tauri 2 SDK + Svelte 5)
├── README.md / README_EN.md              # 中英双语文档
├── CLAUDE.md                             # Claude Code 引导 (~76 行项目说明)
├── src/                                  # SvelteKit SPA
│   ├── app.html
│   └── routes/
│       ├── +layout.ts                    # `export const ssr = false` (SPA 模式)
│       └── +page.svelte                  # 843 行单体 UI (字幕+设置+状态栏)
├── src-tauri/
│   ├── Cargo.toml                        # 48 行依赖清单
│   ├── tauri.conf.json                   # 窗口 480×640, identifier com.wangxin.transecho
│   ├── Entitlements.plist                # 仅 com.apple.security.screen-recording
│   ├── capabilities/default.json         # core/opener/store + app:version
│   ├── build.rs                          # prost-build 编译 .proto
│   ├── proto/                            # Volcengine 官方 .proto (3 个文件)
│   │   ├── common/{events.proto, rpcmeta.proto}
│   │   └── products/understanding/{ast/ast_service.proto, base/au_base.proto}
│   └── src/
│       ├── main.rs (6) / lib.rs (43)     # entry; lib.rs 装载 plugins + invoke handlers
│       ├── commands.rs (405)             # Tauri IPC `start_interpretation` / `stop_interpretation`
│       ├── audio/
│       │   ├── mod.rs (10)               # cfg-gate macos→capture_macos.rs, windows→capture_windows.rs
│       │   ├── capture_macos.rs (169)     # ScreenCaptureKit + CMSampleBuffer
│       │   ├── capture_windows.rs (163)   # cpal WASAPI loopback
│       │   ├── resample.rs (156)         # Rubato FFT 48k stereo → 16k mono i16
│       │   └── playback.rs (233)         # Rodio streaming + jitter buffer
│       └── transport/
│           ├── mod.rs (20)               # 包含 prost 生成的子模块
│           ├── client.rs (242)           # tokio-tungstenite WebSocket + Ping/Pong/timeout
│           └── codec.rs (388)            # Protobuf encode/decode + SessionConfig + TranslationEvent
├── docs/community-posts.md               # 5 个社媒发文模板 (V2EX/掘金/少数派/Reddit/Twitter)
└── static/, .github/, svelte.config.js, vite.config.js, tsconfig.json, package-lock.json
```

总计代码量 (per `wc -l`): **Rust = 1,835 行** + **Svelte = 843 行** = **2,678 行**。

### 1.2 主入口

- **`src-tauri/src/lib.rs`** 是真正入口，`tauri::Builder::default()` 装 3 个 plugin (opener/store)，注册 2 个 IPC handler (`start_interpretation` / `stop_interpretation`)，挂 `RunEvent::ExitRequested` cleanup 把 `stop_tx` 取出发 stop signal。
- `src-tauri/src/main.rs` 只是 `transecho_lib::run()` 一行 (`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`)。
- 前端 `src/routes/+page.svelte` 是 SPA 单页（843 行含 inline CSS），所有 UI 都在这：一个设置抽屉（API key + 语言对 + TTS 开关 + 3 个 voice 预设），主区域是字幕滚动列表，底部一个大圆按钮 start/stop。

### 1.3 核心模块位置

| 关注点 | 文件 | 行 |
|---|---|---|
| 音频采集（macOS） | `src-tauri/src/audio/capture_macos.rs` | 169 |
| 音频采集（Windows 参考） | `src-tauri/src/audio/capture_windows.rs` | 163 |
| 重采样（48k→16k） | `src-tauri/src/audio/resample.rs` | 156 |
| TTS 播放 | `src-tauri/src/audio/playback.rs` | 233 |
| WS 客户端 | `src-tauri/src/transport/client.rs` | 242 |
| Protobuf codec | `src-tauri/src/transport/codec.rs` | 388 |
| 会话编排 + IPC | `src-tauri/src/commands.rs` | 405 |
| Svelte UI | `src/routes/+page.svelte` | 843 |

---

## 2. macOS 系统音频回采 (ScreenCaptureKit)

### 2.1 代码路径

**`src-tauri/src/audio/capture_macos.rs`** 是单文件完整实现。关键路径：

1. **`SCShareableContent::get()`** 取可共享内容（line 125），`displays().first()` 取主显示器（line 127-129）→ 注意：必须存在显示器才能开音频捕获（headless 不可用）。
2. **`SCContentFilter::create().with_display(display).with_excluding_windows(&[]).build()`** 创建过滤器（line 131-134）→ 整屏过滤，排除窗列表为空。
3. **`SCStreamConfiguration::new()`** 配（line 136-142）：
   - `with_width(2)` / `with_height(2)` —— 画面输出缩到 2×2（仅取音频，画面扔掉，CPU 友好）
   - `with_captures_audio(true)`
   - `with_excludes_current_process_audio(true)` —— **关键：排除自己进程**，否则会捕获 Rodio TTS 自己的输出（最朴素的一层「自避」）
   - `with_sample_rate(48000)`
   - `with_channel_count(2)`
4. **`AudioCaptureHandler`** 实现 `SCStreamOutputTrait::did_output_sample_buffer`（line 22-117）：
   - 仅处理 `SCStreamOutputType::Audio`（line 24-26）
   - 从 `CMSampleBuffer` 取 `audio_buffer_list`（line 35）
   - **关键的非交错解交错**：ScreenCaptureKit 送的 audio buffer list 是 non-interleaved（每个 buffer 一个声道），代码（line 48-79）显式做 `for ch in &channel_buffers { interleaved.push(ch[i]) }` 重组成 `[L0,R0,L1,R1,...]`
   - 每 500 帧打一次 RMS/max-abs 日志（line 87-102），便于 debug 静音
5. **传输**：`mpsc::Sender<AudioFrame>`，**`try_send`**（line 111），队列满时丢帧（line 112-114）—— 音频管线永远不能阻塞 capture 线程。
6. **`start_capture(buffer_size: usize)`** 返回 `(mpsc::Receiver<AudioFrame>, CaptureHandle)`，`buffer_size = 50`（见 `commands.rs:151`），即约 1 秒 48kHz 立体声的缓冲。

### 2.2 权限申请

- **代码里完全不写 TCC 申请**：macOS 14+ 上 `SCStream` 第一次调用会自动触发系统弹窗「TransEcho 想录制屏幕和音频」，用户同意后写入 `~/Library/Application Support/com.apple.wxkingstar.transecho/` 数据库。
- **`Entitlements.plist`**（8 行）只声明 `<key>com.apple.security.screen-recording</key><true/>`。**没有** `com.apple.security.device.audio-input` 或 `com.apple.security.device.microphone` —— 因为 ScreenCaptureKit 的 audio 在「屏幕录制」权限下放行，不需要额外 mic 权限。
- **`tauri.conf.json`** 没有 `bundle.macOS.providerShortName` 或 hardened runtime 标志；`signingIdentity` 是 `Developer ID Application: INAGORA CO., LTD. (SZ26HJEMC7)`（来自发行版签名，不是本机开发账号）。
- **README 提示**（README.md:154）：「确保已授予『屏幕录制』权限...授权后需重启应用」—— 这是 macOS 14 已知行为，授权后第一次进程未持有 token，要重启生效。

### 2.3 与 BlackHole 类虚拟声卡回采对比

| 维度 | ScreenCaptureKit (TransEcho 用) | BlackHole 2ch (本 PoC 用) |
|---|---|---|
| 系统权限 | 屏幕录制（一次性） | 无（核心音频驱动，预装驱动级权限） |
| 延迟 | ~50–150 ms（CMSampleBuffer 帧间隔 + 重采样） | ~10–30 ms（CoreAudio 环回） |
| 音质 | 与系统输出 bit-perfect | 与系统输出 bit-perfect，但若同设备既播又采易串扰 |
| CPU 占用 | 较高（视频管线即使缩 2×2 也要跑）+ Rubato FFT | 极低（OS 内部 0-copy） |
| 隔离性 | ✅ 跨应用（捕整个 system output） | ❌ 仅本应用路由的 audio unit；R4 需 Multi-Output Device 把 meeting app 输出 route 到 BlackHole input bus |
| 自避 | `with_excludes_current_process_audio(true)` 一键搞定 | 需 OS 路由配置 |
| macOS 版本要求 | 14.0+ | 10.10+ |
| Headless/无显示器 | ❌ | ✅ |

**对本 PoC 的取舍**：
- **R4 (入方向字幕)**: 沿用 ScreenCaptureKit 即可，复用 `capture_macos.rs` 整文件。改一处：把 `with_excludes_current_process_audio` 改为 `false`（否则 R3 输出的 TTS 从 default output 出去时，会被 SCC 当成本进程音频拒掉；其实不影响 R4 字幕，但如果我们 R3 TTS 想通过「BlackHole input bus」再被 SCC 回采形成回路，反而需要这个开关打开）。
- **R3 (出方向)**: 弃用 SCC，改用 BlackHole input bus 作为 mic 设备的 source（OS 级别）。Rust 端要新增一个 `audio/capture_blackhole_input.rs`（用 `cpal` 列设备，挑 `BlackHole 2ch`，建 input stream 取样，类似 `capture_windows.rs`），约 80 行。
- **BlackHole vs SCC 的 CPU**: T13 acceptance 测一次 CPU 占用即可量化。

---

## 3. 豆包同传 2.0 接入

### 3.1 协议 = WebSocket（不是 gRPC）

**`src-tauri/src/transport/client.rs:9`**:
```rust
const WS_URL: &str = "wss://openspeech.bytedance.com/api/v4/ast/v2/translate";
```

- **不是真正的 gRPC**，虽然 `.proto` 文件定义了 `service ASTService { rpc Translate(stream) returns (stream) }`（`proto/products/understanding/ast/ast_service.proto:41-43`）。
- 实际协议是 **HTTP 101 Upgrade 到 WebSocket**，每条 binary frame 是一个 serialized `TranslateRequest` protobuf。**`build.rs:3-6`** 用 `prost_build::compile_protos` 编 `ast_service.proto`，**但这只是借 protobuf 做序列化格式，不走 gRPC over HTTP/2**。
- 鉴权通过 **HTTP request headers** 注入（client.rs:48-62）：

```rust
.header("X-Api-App-Key", &self.config.app_key)
.header("X-Api-Access-Key", &self.config.access_key)
.header("X-Api-Resource-Id", &self.config.resource_id)
.header("X-Api-Connect-Id", &self.config.connection_id)
.header("Host", "openspeech.bytedance.com")
.header("Connection", "Upgrade")
.header("Upgrade", "websocket")
.header("Sec-WebSocket-Version", "13")
.header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key())
```

**注意**: 这里 `X-Api-Access-Key` 是 Volcengine 文档里的 token string，**不是 OAuth JWT**。`X-Api-Connect-Id` 是 per-connection UUID（commands.rs:89 用 `uuid::Uuid::new_v4()` 生成）。

### 3.2 流式分片策略

**Audio pipeline → WebSocket frame**:

1. **ScreenCaptureKit** 给 48kHz stereo f32 non-interleaved → `capture_macos.rs:65-80` 合成 interleaved
2. **`commands.rs:208-280`** pipeline task:
   - 第一帧到达时按 `frame.sample_rate` / `frame.channels` 懒初始化 `AudioResampler`（line 210-232）
   - Rubato chunk size = `source_rate * 80ms` = `48000 * 80 / 1000 = 3840 frames`
   - 每 `chunk_size_interleaved = 3840 * 2 = 7680 samples` 调一次 `resampler.process`
   - **关键**: 重采样后**再切 1280 samples/帧**（即 80ms 16kHz mono）发送：`commands.rs:269-275`：
     ```rust
     while offset < pcm16.len() {
         let end = (offset + 1280).min(pcm16.len());
         if audio_sender.send(pcm16[offset..end].to_vec()).await.is_err() {
             return;
         }
         offset = end;
     }
     ```
     1280 = 16000 Hz × 0.080 s。完全匹配 Volcengine 同传 2.0 期望的 80 ms 帧边界。
3. **`transport/client.rs:148-238`** write task 把每帧 1280 i16 样本 wrap 进 `TranslateRequest{ event: TaskRequest, source_audio: { binary_data: 2560 bytes } }` (codec.rs:94-141)，`sequence` 自增发送。
4. **静噪门限**：RMS < 0.01 静 30 帧 → 进入 silence；RMS > 0.02 才唤醒（双阈值 hysteresis，commands.rs:200-259）。**silence 期间不发任何 audio frame** —— 节省 token 计费。

### 3.3 请求 / 响应结构

**StartSession** (`codec.rs:23-91`):
```protobuf
TranslateRequest {
  request_meta: RequestMeta {
    endpoint: "volc.service_type.10053",
    app_key, app_id: "",
    resource_id: "volc.service_type.10053",
    connection_id, session_id, sequence: 0
  },
  event: StartSession,
  user: User { uid: "", did: "", platform: "macOS", sdk_version: "", app_version: "" },
  source_audio: Audio { format: "wav", codec: "raw", rate: 16000, bits: 16, channel: 1, ... },
  target_audio: Audio { format: "pcm", rate: 24000, bits: 32, channel: 1, ... } // 仅 s2s
  request: ReqParams { mode: "s2s"|"s2t", source_language, target_language, speaker_id, corpus: None },
  denoise: Some(false)
}
```

**Audio frame** (`codec.rs:94-141`): 同样 `TranslateRequest`，`event: TaskRequest`，`source_audio.binary_data: 2560 bytes`，其余字段空。

**FinishSession** (`codec.rs:144-164`): 仅 `event: FinishSession` + meta。

**响应** (`codec.rs:166-255`): `TranslateResponse.event` enum（`SessionStarted` / `SessionFinished` / `SessionFailed` / `SourceSubtitleStart` / `SourceSubtitleResponse` / `SourceSubtitleEnd` / `TranslationSubtitleStart` / `TranslationSubtitleResponse` / `TranslationSubtitleEnd` / `TtsResponse` / `TtsSentenceEnd` / `UsageResponse` / `AudioMuted`）+ 文本 (`text`) + 时间戳 + TTS bytes (`data`)。

`commands.rs:122-148` 在 `start_interpretation` 同步等 `SessionStarted`，**10 秒超时则报错**。这是正确的握手保护。

### 3.4 本 PoC 要改什么

- `resource_id = "volc.service_type.10053"`（同传 2.0 二进制版）**保留**，这就是 R3 出方向用的 resource。
- **新增 `resource_id = "volc.service_type.10035"` + ReqParams 中 `corpus` 字段** 用于声音复刻 2.0 流式推理？—— 待 T01 API ticket 复核。声音复刻 2.0 是独立服务，单独鉴权 + 单独 endpoint，**不应该通过同传 2.0 的 `speaker_id` 字段**。
- `mode` 三态: `s2t` (字幕)、`s2s` (语音播报 TTS in-band)、`s2s_pcm_clone` (可能不存在) —— 本 PoC 的 R3 要走 `s2s` 但 TTS 用 cloned voice，**需要先确认 10053 的 s2s 是否允许 `speaker_id` 是复刻音色**（待 T01 复核）。如果不允许，则 R3 要拆成两步: 10053 s2t 拿到英文文本 → 10035 (声音复刻 2.0 streaming TTS) 合成 → 输出到 BlackHole input bus。
- WebSocket 重连 / 多 session 暂未实现 —— 单 session 用完即弃 (commands.rs:391 在 cleanup 时 `drop(audio_tx)` 自动触发 FinishSession)。

---

## 4. 虚拟麦克风输出

### 4.1 TransEcho 完全没有

`grep -i "blackhole\|virtual\|virtual_mic\|aggregate\|multi-output" /tmp/TransEcho`：**零匹配**。

### 4.2 实际方案 = Rodio → default output

**`src-tauri/src/audio/playback.rs:131-179`** 是 TTS 播放器（s2s 模式播服务端返回的 PCM）：

1. `OutputStream::try_default()` (line 137) —— 直接拉 OS **default output device**，这是 Rodio 默认行为。
2. `Sink::try_new(&stream_handle)` 建一个 sink，append 自定义 `StreamingSource`。
3. `StreamingSource` (`playback.rs:12-117`) 实现 rodio `Source` trait: 非阻塞 next()（line 59-101），每次先消费 current chunk，**empty 就插 10 ms 静音**（line 91-97）以维持音频时间，**永不阻塞 audio callback thread**。
4. **Pre-buffer jitter buffer** (line 32-53): 启动时最多等 500 ms 累积 ≥ 200 ms (sample_rate/5) 样本再放。
5. `TtsHandle::play_pcm_bytes(&[u8])` (line 183-196): 把服务端 `TranslateResponse.data` (PCM 32-bit float LE, 24kHz mono) chunks 解码后塞进 sync_channel(50)。
6. 没有设备选择 API，没有「写到 BlackHole」的代码。

### 4.3 Multi-Output Device 配置

**无**。TransEcho 不做 OS 级音频路由，只用 Rodio default device。

### 4.4 本 PoC 要新增什么

**R3 出方向 TTS → 虚拟麦克风** = 把 `playback.rs` 改成可选设备：

```rust
// pseudocode — 在 TtsHandle::new 接受 device_name 参数
let host = cpal::default_host();
let device = host.output_devices()?
    .find(|d| d.name().ok() == Some("BlackHole 2ch"))
    .ok_or("BlackHole 2ch not found")?;
let stream = device.build_output_stream(&config, data_callback, err_fn, None)?;
```

但 Rodio 不直接暴露 `cpal` device 选择，需要绕过 Sink / OutputStream，直接用 `cpal::Stream` 写。或者**改用 `cpal`** 整个替代 Rodio 输出（更可控但要重写 jitter buffer）。

或者**更简单**：保持 Rodio，但用 macOS `SwitchAudioSource` CLI（或 `coreaudio-sys` Rust 绑定）在启动 TransEcho 前**把 default output 临时切到 BlackHole 2ch**，再播 TTS。代价是用户同时听不到本地声音（无所谓，因为 R3 TTS 是要发往远端的，本地不该回放）。

R4 方向：从 BlackHole 2ch input bus 作为 mic 设备采集，送给 TransEcho 已有的 `audio/capture_macos.rs` **不能**——因为 SCC 是捕 system output，不是 mic。要新写 `audio/capture_mic.rs` 用 `cpal` 拉 BlackHole 2ch input，约 80 行。

---

## 5. 防回声 / 总线隔离

### 5.1 TransEcho 的「防自避」机制

只有 **2 层**：

1. **`SCStreamConfiguration::with_excludes_current_process_audio(true)`** (`capture_macos.rs:140`) —— SCC 不捕自己进程的 Rodio 输出。**这只防 R3 TTS 经 default output 被自己 SCC 抓到，对跨进程场景（meeting app 播 R3 TTS 再被 R4 SCC 抓到）无效**。
2. **RMS 静噪门限** (`commands.rs:200-259`) —— 这是「省 token」而不是「防回声」。silence 期间 SCC 还在跑，只是不发 audio 给豆包。

### 5.2 没有 B1 思想

`grep -i "feedback\|echo\|bus\|隔离\|segregat\|mix.minus\|reference\|playback.*capture\|reference_signal" /tmp/TransEcho`：**零匹配**。

TransEcho 的设计前提是 **「用户戴耳机」+ 「meeting app 不放自己进程的音频」**，根本不需要 B1。AEC / reference signal / bus topology 在代码里 0 行。

### 5.3 对本 PoC 的影响

R4 必须从 meeting app 播放输出里回采（因为同声传译 2.0 要听对方说话），R3 又要把 TTS 通过 BlackHole 灌进 meeting app 的 mic input。如果 meeting app 的 mic input = BlackHole 2ch（多输出设备把 meeting app 输出 route 到 BlackHole input bus），那 TTS 经 BlackHole input bus → meeting app 播放 → 远端说话 → meeting app 播放 → BlackHole input bus → 同传 → TTS → ...**形成回路**。

**解决办法就是 B1 思想 + Multi-Output Device topology**（在 T06 macOS routing ticket / T12 bus isolation prototype 里展开，本 ticket 不展开）。核心:

- 用户物理麦克风 → Multi-Output Device A (用户耳机 + BlackHole 16ch Input 1)
- meeting app 输出 → Multi-Output Device B (用户耳机 + BlackHole 16ch Input 2)
- BlackHole 16ch Input 1 → R3 翻译源
- BlackHole 16ch Input 2 → R4 翻译源
- **R3 的 TTS 直接写 BlackHole 16ch Input 3**，meeting app 的 mic input = Input 3（不是 Input 1/2）
- 这样 R3 输出不会到 R4 输入（不同 physical bus），形成 B1-style 隔离

TransEcho 的代码 0 行涉及这个——**需要从零设计**。

---

## 6. 音色克隆（声音复刻 2.0）

### 6.1 TransEcho 完全不支持

证据：

1. **`speaker_id` 字段的用法** (`commands.rs:71,100`, `codec.rs:19,84,273`, `transport/mod.rs`)：前端硬编码 3 个 voice 预设：
   ```js
   // src/routes/+page.svelte:201-205
   const voices = [
     { id: "zh_female_vv_uranus_bigtts", name: "女声 A" },
     { id: "zh_female_xiaoai_uranus_bigtts", name: "女声 B" },
     { id: "zh_male_jingqiangkanye_emo_mars_bigtts", name: "男声" },
   ];
   ```
   `speaker_id` 只是 TTS voice 选择器，**值是 Volcengine bigtts 库的预置音色 ID**，不是「声音复刻 2.0」生成的复刻音色 ID。
2. **`grep -i "复刻\|clone\|replica\|voice.print\|voice_id" /tmp/TransEcho`**：**零匹配**。`proto` 里只有 `ReqParams.speaker_id`（`proto/products/understanding/ast/ast_service.proto:13`），没有 `voice_id` / `replica_id` / `corpus_id` 字段。
3. **`resource_id = "volc.service_type.10053"`** 是同传 2.0 binary 端点，不支持 0-sample clone 也不接收复刻音色——待 T01 复核。

### 6.2 路径选择

**声音复刻 2.0** 是独立服务，需单独鉴权 + 单独 endpoint，**不会通过同传 2.0 的 `speaker_id` 走**。两种实现路线：

| 路线 | 实现 | 复杂度 | 质量 |
|---|---|---|---|
| **A. Pre-trained `speaker_id`** | 先用「声音复刻 2.0」API 训练一段 10s+ 录音，拿到 `voice_id` (类似 `speaker_id` 但来自 10035 服务的训练 API) → 在同传 2.0 StartSession 把这个 `voice_id` 作为 `speaker_id` 传进去 | 中 | ✅ 高（同传 2.0 直接调预训练音色） |
| **B. 0-sample auto clone** | 同传 2.0 服务端在第一句 ASR 后自动推断音色，**用对方原声音色合成** | 低（不动代码） | ⚠️ 音色稳定度未知；不会保持「用户原声」 |

**TransEcho 当前没有走 A 或 B 任一**，需要本 PoC 自行加：

- A 路线: 增加 CLI flag `--clone-mode pre-trained --speaker-id <vid>`，把 `codec.rs:84` 的 `speaker_id` 直接换成复刻训练的 vid；同步在 `commands.rs` 加存储 (`tauri-plugin-store` 已装，复用 settings.json schema)
- B 路线: 不改 `speaker_id`，但要在 acceptance 测里验证 30 分钟内音色不漂（待 T13 决定如何测）

---

## 7. 跨平台性

### 7.1 支持矩阵

| 平台 | 状态 | 路径 |
|---|---|---|
| **macOS 14.0+** (Apple Silicon) | ✅ 主目标 | `src-tauri/src/audio/capture_macos.rs` (ScreenCaptureKit) |
| **macOS 13 / Intel** | ⚠️ 不在 README 声明，编译可过但缺 SCC feature gate | 同上 |
| **Windows 10+** | ✅ 实测 | `src-tauri/src/audio/capture_windows.rs` (cpal WASAPI loopback) |
| **Linux** | ❌ | README:169「Linux 暂不支持，欢迎 PR」 |
| **iOS / Android** | ❌ | Tauri config 但无 mobile entry |

### 7.2 Windows 实现摘要 (`capture_windows.rs`)

- `cpal::default_host()` 拿 WASAPI host
- `host.default_output_device()` 取默认输出
- **关键 trick: 在 output device 上 `build_input_stream` 即开 WASAPI loopback**（line 81-149），cpal 内部走 WASAPI `AUDIOCLIENT_ACTIVATION_TYPE_LOOPBACK`
- 支持 `SampleFormat::F32` 和 `SampleFormat::I16`（line 82-149）
- 同样的 RMS 日志 + try_send 丢帧策略

### 7.3 本 PoC 跨平台需求

- 用户设备 = M2 MacBook Air + macOS 14.4.1（map.md:39），所以**只需 macOS**。
- Windows parity 是 out-of-scope（map.md:71）。
- Windows 代码可以保留作为 PoC 后续扩展参考，**不会在本 ticket 落地**。

---

## 8. 代码质量 / 依赖 / 仓库活跃度

### 8.1 代码质量

**正面**:

- 错误处理规范：`Result<T, Box<dyn Error + Send + Sync>>` 跨 await 友好 (`commands.rs:151`)
- 优雅停机：`CleanupGuard` Drop + `AppState.stop_tx` 双重清理 (`commands.rs:42-60`)，防 panic 残留
- 静噪 hysteresis 双阈值防 chattering (`commands.rs:200-259`)
- TTS jitter buffer pre-buffer 200ms + 永不阻塞 callback (`playback.rs:32-101`)
- WebSocket read/write timeout + 15s ping keepalive (`client.rs:11-20, 86-145, 152-238`)
- Resource cleanup explicit: `commands.rs:383-391` 恢复音量 + drop TTS player + drop audio_tx + stop capture
- 字幕去重: 后端 last 15 finalized (`commands.rs:307-309`)，前端 last 10 (`+page.svelte:94-103`) 双层
- 协议细节: protobuf 全字段填齐（即便不传的字段也显式 `String::new()`，`codec.rs:35-58, 116-138`）—— 防止服务端误读脏数据
- 单测覆盖重采样 (`resample.rs:104-155`) + codec 编解码 (`codec.rs:257-388`)

**负面/注意**:

- UI 单文件 843 行 Svelte + inline CSS，没有组件拆分
- 前端双语对照是中文注释 + 英文字符串字面量混合，没有 i18n 框架
- `tauri-plugin-store` 存凭证是**明文** JSON 文件（settings.json），无加密
- `commands.rs:367-369` 把 WebSocket 断连写成 `"连接已断开"` 但前端当成 error 显示 → UX 错位
- `with_excludes_current_process_audio(true)` 是自避唯一一道闸，对跨进程 meeting 失效
- 没 `denoise`（codec.rs:87 显式 `denoise: Some(false)`），同传 2.0 服务端降噪未开
- `package.json` 没有 ESLint / Prettier / Rust clippy 配置
- `Cargo.toml` 只有 3 行 comment 区，没有任何 `[profile.release]` 调优

### 8.2 依赖体量 (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-opener = "2"
tauri-plugin-store = "2"
serde / serde_json
rubato = "0.16"           # 重采样
rodio = "0.19"            # TTS 播放
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = { version = "0.26", features = ["native-tls"] }
prost = "0.13"
uuid / http / futures-util / dotenvy
tracing / tracing-subscriber

[target.'cfg(target_os = "macos")'.dependencies]
screencapturekit = { version = "1.5", features = ["macos_14_0"] }

[target.'cfg(target_os = "windows")'.dependencies]
cpal = "0.15"
```

`Cargo.lock` 大约 6,200 行（含 zbus / ring / rustls / symphonia / rodio 全家），总体**轻量**：release binary 估计 8–15 MB（Rust+Tauri 典型值）。

`package.json`：
```json
"dependencies": {
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-opener": "^2",
  "@tauri-apps/plugin-store": "^2.4.2"
},
"devDependencies": {
  "@sveltejs/adapter-static": "^3.0.6",
  "@sveltejs/kit": "^2.9.0",
  "@sveltejs/vite-plugin-svelte": "^5.0.0",
  "@tauri-apps/cli": "^2",
  "svelte": "^5.0.0",
  "svelte-check": "^4.0.0",
  "typescript": "~5.6.2",
  "vite": "^6.0.3"
}
```

### 8.3 仓库活跃度

| 指标 | 值 | 来源 |
|---|---|---|
| **最近 commit** | `9ff3311` @ **2026-03-27 19:50:25 +0800** | `git log -1` |
| **commit message** | `v0.1.4: fix Windows repeated speech, add version display, Developer ID signing` | 同上 |
| **版本号** | v0.1.4 (Cargo.toml:3 / package.json:3) | |
| **总 commits (GitHub)** | 20 | github.com/wxkingstar/TransEcho (web view) |
| **Stars / Forks** | 16 / 5 | 同上 |
| **Open Issues** | 0 | 同上 |
| **Open PRs** | 1 | 同上 |
| **License** | MIT | LICENSE |
| **Identifier** | `com.wangxin.transecho` | tauri.conf.json:5 |
| **Maintainer** | wangxin (wxkingstar) | README:189 + GitHub profile |

**Activity 评估**: 单人项目，半年内 20 个 commit，最近一次 2026-03-27 修复 Windows 重复说话问题 + 加版本显示 + 加 Developer ID 签名 → **活跃但单兵**。无外部贡献者。

---

## 9. 与本 PoC 的差距点 (gap checklist)

### 9.1 必须新增（高优）

1. **CLI entry** —— 把 Tauri/Svelte UI 整个拆掉（或保留作为 debug UI），增加 `bin/realtime_voice.rs` 或类似 main，参数从 `std::env::args()` 解析 (--source-lang / --target-lang / --clone-mode / --speaker-id / --blackhole-device / --log-level)
2. **R3 出方向：mic capture** —— 新增 `audio/capture_blackhole_input.rs` (~80 行 cpal-based)：从 BlackHole 2ch (或 BlackHole 16ch Input 1) 采集用户物理 mic 的数字化信号 → 重采样 → 送 10053 s2s。**复用** `audio/resample.rs` + `transport/client.rs` + `transport/codec.rs`。
3. **R3 出方向：TTS → BlackHole output** —— 改写 `audio/playback.rs::TtsHandle::new` 接受 device name 参数；默认 device = "BlackHole 2ch" (R3 输出) 或 "BlackHole 16ch" + 选 channel (R3 在独立 bus 上)。约 50 行 diff。
4. **R4 入方向：subtitle 输出到 stdout** —— 把 `commands.rs` 的 Tauri Channel 推送改成 stdout JSON line（`{"type":"translation","text":"...","is_final":true}`），让 CLI 可被 `jq` / 录制脚本消费。
5. **双向同传单 session**：当前 `start_interpretation` 一次只起一个 WS session。要么开 2 个 WS（一个 10053 s2s R3 + 一个 10053 s2t R4），要么单 WS 复用但加方向路由。后者代价高，建议前者，~100 行新增。
6. **声音复刻 2.0 接入** —— 加 `--clone-mode pre-trained --speaker-id <vid>` 参数路径；如果是 0-sample auto clone（mode B），不改代码但要在 acceptance 测里验证。
7. **BlackHole Multi-Output Device 配置脚本** —— `scripts/setup-blackhole.sh`：用 `SwitchAudioSource` 或 `coreaudiod` plist 创建 2 个 Multi-Output Devices (mic+A 输出 + meeting 音频源)；启动 PoC 前 require 已配置好，或 PoC 启动时 idempotent 自检。

### 9.2 需要小幅改

8. **删除 `with_excludes_current_process_audio(true)`** —— 改 `false`，否则 R4 SCC 抓不到 R3 TTS 经 meeting app 播放出来的回声 → 但本 PoC 不需要 SCC 抓自己，因为 R3 走 BlackHole bus 隔离
9. **denoise = true** —— codec.rs:87 改 `Some(true)` 让同传 2.0 服务端降噪（PoC 录音环境不理想时有用）
10. **Tauri Channel → stdout 桥接** —— 最小改动方案：保留 Tauri Channel 同时把每个 SubtitleEvent 复制一份写 stdout；前端保留供 debug
11. **API key 从 settings.json → CLI args / .env** —— map.md 说 CLI only，则去掉 GUI 设置面板，凭证从 `args` 或 `.env` (`dotenvy` 已在 Cargo.toml) 读

### 9.3 可以保留

12. **整个 `transport/`** —— client.rs + codec.rs + proto/ 直接拷，**不需要改一行**（resource_id / speaker_id 都走 config）
13. **`audio/resample.rs`** —— 完全可复用
14. **`capture_macos.rs` 整体**（除 `with_excludes_current_process_audio`）—— 给 R4 用
15. **`commands.rs` 的去重 / 静噪 / timeout / cleanup 逻辑** —— 移植到 CLI main 的 event loop
16. **`playback.rs` 的 jitter buffer / StreamingSource 状态机** —— 复用，但要改 device 选择

### 9.4 必须删除

17. **`src/routes/+page.svelte` 整文件 (843 行)** —— CLI only，UI 删
18. **SvelteKit / vite / svelte-check 构建链** —— 删 `package.json` + `svelte.config.js` + `vite.config.js` + `tsconfig.json` + `src/`。整个前端栈不要
19. **`tauri-plugin-store` / `tauri-plugin-opener`** —— 不需要了
20. **`src-tauri/tauri.conf.json` 的 windows[] / frontendDist / beforeDevCommand** —— 改 no-window Tauri app 或干脆**退到纯 Rust CLI**（更推荐，省下 Tauri runtime 启动开销）

### 9.5 估计代码量

| 类别 | 行数 |
|---|---|
| 复用 | ~1,500 (transport + resample + capture_macos 改 1 行 + 半个 playback) |
| 新增 | ~600-900 (CLI entry + R3 mic capture + R3 TTS-to-BlackHole + dual-WS 编排 + 声音复刻 2.0 参数路径 + bus 自检) |
| 删除 | ~900 (Svelte + Tauri UI 链) |
| 净增 | **约 +200 ~ +500 行 Rust** |

---

## 10. 仓库 URL 修正（值得记录）

**Ticket §Question 写的**: `https://github.com/tianpomin/TransEcho`
**实际 git remote** (从 README clone URL): `https://github.com/wxkingstar/TransEcho`
**前者 404**；后者是真实仓库。`tianpomin` 大概率是 PDF 报告作者笔误或自己 fork。本 ticket 用的 clone 命令是从 ticket 原文抄的，但 git 服务端会自动 redirect（所以 `git clone` 能成）—— 下次去 GitHub 看 issues / PRs 时要记得去 `wxkingstar/TransEcho`。

---

## 11. 引用速查表

| 主题 | 文件 : 行 |
|---|---|
| ScreenCaptureKit capture 主入口 | `src-tauri/src/audio/capture_macos.rs` : 120-156 |
| CMSampleBuffer f32 解交错 | `src-tauri/src/audio/capture_macos.rs` : 48-80 |
| 自避 `with_excludes_current_process_audio(true)` | `src-tauri/src/audio/capture_macos.rs` : 140 |
| 屏幕录制 entitlement | `src-tauri/Entitlements.plist` : 5-6 |
| WebSocket URL + 鉴权 headers | `src-tauri/src/transport/client.rs` : 9, 48-62 |
| WebSocket read/write/ping timeout | `src-tauri/src/transport/client.rs` : 11-20, 86-238 |
| Resource ID = 10053 hardcoded | `src-tauri/src/commands.rs` : 94 |
| 1280-sample (80ms @ 16kHz) 分片 | `src-tauri/src/commands.rs` : 269-275 |
| RMS 静噪 hysteresis | `src-tauri/src/commands.rs` : 200-259 |
| 字幕去重 last 15 | `src-tauri/src/commands.rs` : 307-347 |
| ReqParams.speaker_id | `src-tauri/proto/products/understanding/ast/ast_service.proto` : 13 |
| StartSession encode | `src-tauri/src/transport/codec.rs` : 23-91 |
| Audio frame encode | `src-tauri/src/transport/codec.rs` : 94-141 |
| TTS StreamingSource 非阻塞 + jitter buffer | `src-tauri/src/audio/playback.rs` : 12-117, 131-179 |
| Rodio default output | `src-tauri/src/audio/playback.rs` : 137 |
| CleanupGuard 防 panic 残留 | `src-tauri/src/commands.rs` : 42-60 |
| Windows WASAPI loopback | `src-tauri/src/audio/capture_windows.rs` : 41-156 |
| 前端 3 个 voice 预设 (non-clone) | `src/routes/+page.svelte` : 201-205 |
| 前端字幕去重 last 10 | `src/routes/+page.svelte` : 94-103 |
| 单测重采样 | `src-tauri/src/audio/resample.rs` : 104-155 |
| 单测 codec | `src-tauri/src/transport/codec.rs` : 257-388 |

---

## 12. 对其他 ticket 的建议

- **T04 doppelvoice-deep-read**: 应该会确认 doppelvoice 是否有不同的 capture / output 路径，验证下我有没有遗漏的「输出到 virtual mic」开源实现。
- **T05 realtime-voice-translator-deep-read**: 该仓的 B1 思想正是本 PoC 缺的总线隔离设计；如果它的实现是 macOS-only 且和我们撞设计，可直接借鉴代码而非重写。
- **T06 macos-audio-routing-options**: 会量化 ScreenCaptureKit vs BlackHole 的延迟/CPU 实测值，本 ticket 的 §2.3 表格是 pre-measurement 的定性比较。
- **T07 fork-transecho-baseline**: 本 ticket 给出了「fork 后要新增/改/删什么」的具体清单 (gap checklist §9)，T07 可以直接引用本文件。
- **T09 volcengine-api-key-apply**: 鉴权字段 `X-Api-App-Key` / `X-Api-Access-Key` 是 token string（不是 OAuth），见 client.rs:50-51。
- **T10 voice-clone-mode-decision**: TransEcho 的 `speaker_id` 只能传预置音色 ID，不能传「声音复刻 2.0」vid —— 必须先在「声音复刻 2.0」服务训练拿到 vid，再在同传 2.0 StartSession 替换 `speaker_id`。这是关键的 API 路径区分，本 PoC 要在 T10 里确认。
