# TransEcho 仓库深读

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

PDF §7 列出 `tianpomin/TransEcho` 为「macOS 端『免虚拟声卡』回采系统音频的思路」专用仓（ScreenCaptureKit + 豆包同传 2.0）。本仓库已锁定为 PoC 的代码起点，需要回答：

1. **整体架构**：目录结构、主入口、核心模块（音频采集 / 翻译调用 / 输出路由 / UI 各在哪）？
2. **macOS 系统音频回采**：ScreenCaptureKit 捕获"系统正在播放的音频"的具体代码路径？权限申请（ScreenCaptureKit 需要授权）？与 BlackHole 类虚拟声卡回采的对比（延迟 / 音质 / CPU 占用）？
3. **豆包同传 2.0 接入**：用的是 WebSocket 还是 gRPC？流式分片策略？鉴权如何注入？请求 / 响应结构？
4. **虚拟麦克风输出**：用了什么虚拟声卡（BlackHole？还是自建 driver？）？是否做了 Multi-Output Device 配置？
5. **防回声 / 总线隔离**：用了什么机制避免"自己翻译自己"？有没有借鉴 realtime-voice-translator 的 B1 思想？
6. **音色克隆**：TransEcho 是否已支持音色克隆？如果支持，走的是哪条路径（声音复刻 2.0 还是同传 2.0 内置）？
7. **跨平台性**：是否仅 macOS？同一份代码能否在 Windows 上跑（哪些模块要重写）？
8. **代码质量 / 依赖**：语言 / 框架（推测是 Swift + ScreenCaptureKit，可能是 Electron/Tauri 也可能）、依赖体量、最近一次 commit 时间、issue 区是否有已知未解 bug？
9. **与本 PoC 的差距点**：从 TransEcho baseline 到本 PoC 验收标准（R3+R4 + CLI + BlackHole 验收 + 自开会议验收）之间，要补 / 改 / 删哪些部分？

最终交付：一份「TransEcho 现有能力 vs 本 PoC 需求」的差距清单 + 关键代码片段摘录（音频采集、API 调用、虚拟麦克风输出三段）。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/03-transecho-deep-read.md`

Gist: Tech stack = Tauri 2 + Rust + Svelte 5 SPA + ScreenCaptureKit (macOS) / WASAPI loopback (Windows) + Rubato 48k→16k resampler + Rodio TTS + tokio-tungstenite WebSocket + prost Protobuf over `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` with hardcoded `volc.service_type.10053` (= 豆包同传 2.0). 单向 system-audio→字幕+s2s-TTS, 2,678 行 (Rust 1,835 + Svelte 843), 最近 commit 2026-03-27 (v0.1.4). 仓库 URL 是 `wxkingstar/TransEcho` (非 `tianpomin`, PDF 笔误). 可复用部分 = transport/ + resample.rs + capture_macos.rs (改 1 行) + playback.rs (改 device). 不可复用 = 整个 Svelte UI + Tauri 前端链 + speaker_id 只支持预置音色 (不支持声音复刻 2.0).

Gap checklist (to-do after this research):
1. **CLI entry** — 删 Tauri/Svelte 整条链，新增 `bin/realtime_voice.rs` main + `clap` 参数解析 (--source-lang / --target-lang / --clone-mode / --speaker-id / --blackhole-device / --log-level)
2. **R3 出方向 mic capture** — 新增 `audio/capture_blackhole_input.rs` (~80 行 cpal) 从 BlackHole 2ch/16ch Input 1 采用户 mic
3. **R3 出方向 TTS → BlackHole output** — 改 `audio/playback.rs::TtsHandle::new` 接受 device_name 参数（Rodio 不直接暴露，改用 cpal output stream，约 50 行 diff）
4. **R4 subtitle 输出到 stdout** — `commands.rs` 的 Tauri Channel 推送改成 stdout JSON line（`{"type":"translation","text":"...","is_final":true}`）让 CLI 可被脚本消费
5. **双向同传编排** — 当前 1 session = 1 方向，本 PoC 要双 WS（一个 10053 s2s 给 R3 + 一个 10053 s2t 给 R4），~100 行新增
6. **声音复刻 2.0 接入** — `speaker_id` 字段当前只能传预置音色（如 `zh_female_vv_uranus_bigtts`），不支持「声音复刻 2.0」训练的 `voice_id`；需加 CLI flag `--clone-mode pre-trained --speaker-id <vid>`，先在「声音复刻 2.0」服务训练，再在同传 2.0 StartSession 替换 `speaker_id`（待 T01/T10 复核 API 路径）
7. **BlackHole Multi-Output Device 配置脚本** — `scripts/setup-blackhole.sh` 用 `SwitchAudioSource` 或 `coreaudiod` 创建 2 个 Multi-Output Devices（mic+A 输出 + meeting 音频源），启动 PoC 前 idempotent 自检
8. **删 `with_excludes_current_process_audio(true)`** — 改 `false`，否则 R4 SCC 抓不到 R3 TTS 经 meeting app 播放的回声（本 PoC 走 BlackHole bus 隔离，不需要这层自避）
9. **denoise = true** — `codec.rs:87` 改 `Some(true)`，让同传 2.0 服务端降噪（PoC 录音环境不理想时有用）
10. **凭证来源从 settings.json → CLI args / .env** — 去掉 GUI 设置面板，凭证从 `args` 或 `.env` (`dotenvy` 已在 Cargo.toml) 读

估计代码量: 复用 ~1,500 行（transport + resample + capture_macos 改 1 行 + 半个 playback）+ 新增 ~600-900 行（CLI entry + R3 mic capture + R3 TTS-to-BlackHole + dual-WS 编排 + 声音复刻 2.0 参数路径 + bus 自检）+ 删除 ~900 行（Svelte + Tauri UI 链）= 净增 +200 ~ +500 行 Rust.

## Comments

<!-- conversation history -->
