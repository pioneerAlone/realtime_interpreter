# realtime-voice-translator 仓库深读 — Findings

**Ticket**: `.scratch/macos-siminterpret-poc/issues/05-realtime-voice-translator-deep-read.md`
**Repo**: https://github.com/ricardobing/realtime-voice-translator
**Local clone**: `/tmp/realtime-voice-translator` (`git clone --depth 1`, HEAD = `c12d62d`)
**Engine in this PoC**: 火山引擎豆包同传 2.0 + 声音复刻 2.0 (NOT Gemini). Repo engine is **Gemini Live Translate**, but the *audio-routing / anti-loop / dual-pipeline architecture* is API-agnostic — that's the part we read.
**Role**: 平台无关的"防回声思想"提取, 不是 macOS 实现决策.

---

## TL;DR (one-paragraph)

Repo 给出的"防回声" 是 **物理层路由隔离, 不靠 AEC/滤波**: 用 Voicemeeter Banana 的 **B1 虚拟总线** 把"系统播放给 mic 的音频"独立成一条流, 翻译输出只走 VB-Cable (会议软件 mic) 和 A1 (headphones), **不接入 B1**, 因此 B1 永远捕不到翻译器自己的输出, 物理上切断反馈环. 完整闭环靠两个**独立** Gemini Live WebSocket 会话 (A: mic→es→en→VB-Cable, B: B1→en→es→headphones). Anti-loop 由 4 层防御: (1) VB-Cable 输出不在系统回采总线; (2) 翻译输出只送 A1 不送 VAIO; (3) B1 只路由 VAIO 不路由 A1; (4) Gemini 端 `echo_target_language=True` 防止回放源语言. **代码层面没有 AEC/回声抑制算法**, 全靠路由矩阵 + 链路设计**。License: README badge 声称 MIT, 但**仓库根目录无 LICENSE 文件**, GitHub API `license: None` — 这是合规风险, 不能直接 copy 代码; 但**思想/路由拓扑/算法流程可自由复用** (它们不构成代码可版权的创造性表达, 且属公开方法论).

---

## 1. B1 总线隔离是什么 (Voicemeeter 视角)

**Voicemeeter Banana** 是 VB-Audio 出品的虚拟 mixer (free). 它的核心模型: 一个 N×M 矩阵, **Input channels (列)** × **Output buses (行)**.

- **A1 / A2 / A3** 是 "hardware outputs" — A1 通常对应物理 headphones/speakers
- **B1 / B2 / B3** 是 "virtual outputs" — B1 是软件可作为 input device 列出的虚拟总线 (在 Windows 录音设备里能看到 "VoiceMeeter Out B1")
- **VAIO** 是 "VoiceMeeter Input" 虚拟输入, 即**系统播放的总入口** — 把 Windows 默认播放设备设为 VoiceMeeter Input, 所有 app 的音频都会先过 VAIO, 再由 matrix 决定送往 A1/B1/A2/...

**关键连接** (来自 `docs/00-technical-analysis.md` 第 97-127 行 ASCII 拓扑 + `README.md` 第 145-156 行矩阵表):

| Channel strip \ Bus | A1 (headphones) | B1 (loopback capture) |
|---|---|---|
| **VAIO** (system playback) | ON ✅ | ON ✅ |
| **Hardware Input 1** (物理 mic) | ON (low vol monitoring) | **OFF** ❌ |

**为什么 "物理 mic → B1 OFF" 是关键**: 若 mic 进了 B1, mic 收到的声音就会到 B1, 而我们又把 B1 送进翻译 session B, 翻译输出再通过耳机 / VB-Cable 反馈回 mic → **feedback loop**. 关掉 mic→B1 这一格, B1 **只含 VAIO 流量**, 即只含**会议软件播放的对端人声**, 完全不含我方音频.

来源: `README.md` L151-156 "Why B1 off on the mic: if your mic leaks into B1, your translated output could feed back into the system loopback, creating an echo. The VAIO strip captures only the audio your video call app plays — not your microphone."

**Windows 默认设备** (`README.md` L161-164 + `docs/00-technical-analysis.md` L162-168):
- Default Playback = VoiceMeeter Input (VAIO) → 所有 app 声音进 VAIO
- Default Recording = VoiceMeeter Out B1 → Windows 全局 mic 是 B1
- 会议软件 mic 输入 = `CABLE Output (VB-Cable)` (不是 B1, 见下)

---

## 2. 完整路由矩阵 (你的问题 3)

画一张 **节点 → 边 → 设备** 拓扑, 标延迟:

```
┌──────────────────────────────────────────────────────────────────────┐
│  物理世界                                                           │
│                                                                       │
│  [真实 mic] ──analog──> [Hardware Input 1] ───┐                       │
│                                  │             │                       │
│                                  ▼             ▼                       │
│                          (A1 ON)         (B1 OFF)                     │
│                            │                                          │
│                            ▼                                          │
│                       [A1 hardware] ──analog──> [headphones]  ←── 你   │
│                                                                       │
│  [会议软件播放对端英文]                                               │
│        │                                                              │
│        ▼                                                              │
│  [Windows Default Playback = VAIO]                                    │
│        │                                                              │
│        ▼                                                              │
│  [VAIO channel strip]                                                 │
│      ├──── (A1 ON) ──> [headphones]  ←── 你听到对端原声              │
│      └──── (B1 ON) ──> [B1 Virtual Out]                              │
│                                  │                                    │
│                                  ▼                                    │
│                  [VoiceMeeter Out B1] (loopback capture)             │
│                                  │                                    │
│                                  ▼                                    │
│  ══════════════ 应用进程: voice-translator ══════════════             │
│                                                                       │
│  Direction A (es → en):                                               │
│    [Hardware Input 1 mic]                                             │
│         │ 16 kHz PCM, 100 ms chunks                                    │
│         │ latency: ~32-64 ms (PortAudio buffer @ 512-1024 samples)    │
│         ▼                                                             │
│    [Gemini Session A] target=es→en                                    │
│         │ WebSocket ~20-100 ms + processing 200-500 ms               │
│         │ total in: ~250-660 ms                                       │
│         ▼                                                             │
│    [VB-Cable Output / CABLE Input playback]                           │
│         │ 24 kHz PCM, PortAudio buffer ~64-100 ms                     │
│         ▼                                                             │
│    [VB-Cable device, internal bridge]                                 │
│         │ zero driver latency                                         │
│         ▼                                                             │
│    [CABLE Output recording endpoint]  ←── 会议软件 mic 选这个          │
│         │ app captures in real-time                                   │
│         ▼                                                             │
│    [Zoom / Meet / Teams / 腾讯会议] ──网络──> 对端听到英文              │
│                                                                       │
│  Direction B (en → es):                                               │
│    [VoiceMeeter Out B1]                                               │
│         │ 16 kHz PCM, 100 ms chunks                                   │
│         ▼                                                             │
│    [Gemini Session B] target=en→es                                    │
│         │ total in: ~250-660 ms                                       │
│         ▼                                                             │
│    [Hardware Output = headphones / A1 device]                         │
│         │ 24 kHz PCM, ~64-100 ms                                      │
│         ▼                                                             │
│    [headphones]  ←── 你听到对端翻译                                   │
│                                                                       │
│  ✅ NO EDGE connects our app's output back into VAIO or B1.            │
│  ✅ NO EDGE connects headphones (mic feedback path) back to anything.  │
└──────────────────────────────────────────────────────────────────────┘
```

**延迟贡献表** (源自 `docs/00-technical-analysis.md` L222-244):

| 组件 | 典型延迟 | 来源 |
|---|---|---|
| PortAudio capture buffer (1600 samples @ 16kHz) | 100 ms | `main.py` L52 `INPUT_CHUNK_SAMPLES = 1600` |
| WebSocket + 网络 | 20-100 ms | API 文档未给, 实测 |
| Gemini Live processing | 200-500 ms | 同上 |
| Playback buffer | 64-100 ms | PortAudio OutputStream 默认 |
| **单方向 end-to-end** | **~400-800 ms** | `docs/00-technical-analysis.md` L228 |

---

## 3. 双向 WebSocket 流 (你的问题 2)

**关键事实**: 单个 Gemini Live session **只能设一个 `target_language_code`** (`docs/00-technical-analysis.md` L9-14). 双向翻译必须**两个独立 session 并行** — 这是协议层约束, 不是实现选择.

**代码证据** (`src/main.py`):
  - L47 `MODEL = "gemini-3.5-live-translate-preview"`
  - L638-647 `_build_config()` 设 `target_language_code`, `echo_target_language=True`, `response_modalities=[AUDIO]`
  - L674 `async with self.client.aio.live.connect(model=MODEL, config=config)` — 一个 session 一次连接
  - L680-714 `sender()` 用 `session.send_realtime_input(audio=types.Blob(...))` 持续推流
  - L716-769 `receiver()` 用 `async for response in session.receive()` 持续拉流
  - L736-742 **处理打断**: `if sc.interrupted: log.debug("[%s] Turn interrupted, flushing output", self.label); while not output_queue.empty(): try: output_queue.get_nowait()...` — 即服务端推送 `server_content.interrupted = True` 时, 客户端**排空输出 queue 丢弃未播音频**, 实现"barge-in"语义

**流的形态**: **continuous, 不是 per-turn**. session 一直 open, 双向字节流持续. per-message frame:
  - 客户端上行: PCM chunks (16 kHz, 16-bit, mono) via `send_realtime_input`
  - 服务端下行: 同结构 PCM (24 kHz, 16-bit, mono) + transcription text via `sc.model_turn.parts[*].inline_data.data` 和 `sc.input_transcription.text` / `sc.output_transcription.text`

**Session 重连** (`main.py` L797-825 `run_with_reconnect`): 指数退避 `min(2.0 ** reconnect_count, 30.0)` 秒. 健康监控 (`L771-783 health_check`): 15 秒未收音频 → 抛 `ConnectionError` 触发重连. Health check 间隔 5 秒 (`L55 HEALTH_CHECK_INTERVAL = 5.0`).

**两个 session 并发模型** (`main.py` L877-888):
  - `TranslationPipeline.run()` 用 `asyncio.TaskGroup()` 同时起 capture/session/player 三个 task
  - 两个 pipeline (A, B) 在 `run_engine()` L1057-1058 分别 `asyncio.create_task(p.run())`
  - `VAD + SmartMutingController` (`main.py` L273-300) — **额外省成本设计**: B 路检测到对端说话时, A 路暂停上行, 反之亦然. 但这是优化, 不是防回声.

---

## 4. 防回声的具体代码 (你的问题 4)

**关键发现: repo 没有 AEC/回声抑制代码.** 全部依赖**路由层隔离**.

证据 (排除法):
  - `grep -n -i "aec\|echo_canc\|webrtc.*echo" /tmp/realtime-voice-translator/src/*.py` → 0 命中
  - `requirements.txt` 无 `webrtc-audio-processing` / `speexdsp` / `adaptive-filter` / `pyroomacoustics`
  - `src/main.py` 1263 行, 没有任何数字滤波 / NLMS / RLS / 自适应算法
  - **唯一**接近回声处理的代码: `VoiceActivityDetector` (`main.py` L215-270) 用 `webrtcvad` 做**静音检测**, 目的是**省 API 配额** (`L686-688 "VAD filtering — skip silence chunks to save API cost"`), **不是**回声消除

**防回声 = 物理层 + 路由配置**, 验证手段:

`src/check_voicemeeter.py` L131-176 是**功能性反环测试**, 不是代码层 AEC:
  - **Test 1** (L134-156): 往 VAIO 灌 440 Hz 测试音, 从 B1 录, RMS > 200 视为系统声音能到 B1.
  - **Test 2** (L158-176): 让用户对 mic 说话, 从 B1 录 3 秒, RMS < 500 视为 mic 没漏到 B1 (即没形成反馈环).
  - **Test 3** (L178-196): 测 VB-Cable 内部桥 (CABLE Input → CABLE Output) 是否通.

测试输出文案 (L169) `"anti-loop OK"` 显式命名为 anti-loop, 但**测量的是路由矩阵是否符合预期**, 不是测算法.

**会议软件端配置** (`README.md` L168-174 + `main.py` L1256-1262):
  - Speaker = Default (= VAIO → A1 → headphones)
  - Microphone = `CABLE Output (VB-Cable)` (这是**会议的 mic**, 不是 B1)

注意一个细节: `main.py` L1232 `Recording tab: set "CABLE Output" as Default Communications Device` — Windows 把 CABLE Output 设为"通讯专用"而非"默认", 让 B1 仍是系统默认录音 (给系统其它 app 用). 这种分工是 Windows 多 default device 模型给的便利.

---

## 5. macOS 对应方案候选 (你的问题 5)

Voicemeeter **仅 Windows**. macOS 等价方案**需要组合**, 没有单一一键替代. 候选清单 (来自 `research/06-macos-audio-routing-options.md` 主表, 这里引用其结论):

> **注**: 决策是 T10 + T12 的工作. 本节只列选项 + 各自防回声机制, **不评估**优劣.

| 候选 | R3 (虚拟 mic 给会议) | R4 (系统回采) | 防反馈机制 |
|---|---|---|---|
| **A. BlackHole 2ch + Multi-Output Device** | BlackHole 本身即虚拟 mic | Multi-Output Device 把系统输出同时送内置扬声器 + BlackHole | (a) BlackHole 自身不订阅 (防自环); (b) 系统输出走 Multi-Output 不绕回 BlackHole input; (c) 关内置 mic 监听 |
| **B. BlackHole + ScreenCaptureKit `excludesCurrentProcessAudio=true`** | BlackHole | ScreenCaptureKit 抓屏幕/进程音频, API 层排除自家进程 | API 层**内建** `excludesCurrentProcessAudio` 标志; **不依赖系统输出路由**, 不动 Audio MIDI Setup |
| **C. BlackHole + Process Tap (macOS 14.2+ `AudioHardwareCreateProcessTap`)** | BlackHole | Process Tap 抓指定进程或全局音频, `CATapMuteBehavior` 三态 | API 层**内建** `Muted` / `MutedWhileTapped`, 默认 `Unmuted`; 设 `Muted` 即物理切断被 tap 进程对外输出 |
| **D. Aggregate Device (BlackHole + Process Tap 复合)** | Aggregate 暴露为输入 | Process Tap 作为 aggregate 子设备 | 复杂; 第三方会议软件对 aggregate 枚举支持差异大, 不推荐 PoC |
| **E. 单 BlackHole + WASAPI-equivalent (`BlackHole 2ch` + 系统声音手动路由)** | BlackHole | BlackHole 同上, 但会议软件输出走内置扬声器, mic 录不到 (物理隔离) | 物理隔离 + 静音内置扬声器 — 最简单但用户体验差 |

**与 B1 思想最等价的是 C (Process Tap + `Muted`)**: tap 把指定进程的输出**静音**送出来给 capture client, 与 B1 只路由 VAIO 不路由 A1 的物理隔离同构.

**与 B1 思想有差异的是 B (ScreenCaptureKit)**: SCC 抓的是**整个 display/audio subsystem** 而非特定进程的特定输出, 通过 `excludesCurrentProcessAudio` 排除自家. 比 B1 粒度粗 (B1 = VAIO 流量, SCC = 全部音频 except 自家), 但实际效果接近.

**候选 A (BlackHole + Multi-Output)** 是 macOS 社区**最普遍**的方案 (Logic→Zoom 全套 wiki 教程), 但**绕系统输出**, 用户需手动建 Multi-Output Device + 把系统输出切到 Multi-Output, 步骤多.

候选排序**不是本 ticket 的工作** — 留给 T06 + T10. **强烈建议在 PoC 早期同时跑 A 与 B/C 做对比**, 因为 M2 / Sonoma 上 BlackHole 安装后不显示 (issue #793) / Multi-Output aggregate 时钟 drift (issue #824) 都是已记录的真实问题, 候选 A 不是无脑首选.

来源: 
- [Apple Process Tap docs](https://developer.apple.com/documentation/CoreAudio/capturing-system-audio-with-core-audio-taps)
- [Apple ScreenCaptureKit docs](https://developer.apple.com/documentation/ScreenCaptureKit/capturing-screen-content-in-macos)
- [BlackHole README](https://github.com/ExistentialAudio/BlackHole)
- 详细对比见 `research/06-macos-audio-routing-options.md`

---

## 6. README / docs 是否有"为什么这样设计" (你的问题 6)

**有**, 且比一般开源项目详尽. 三层文档:

| 文件 | 行数 | 内容 |
|---|---|---|
| `README.md` | 335 | 用户向, ASCII 拓扑图 (L27-58), Anti-loop design 段 (L249-257, 4 步解释), Troubleshooting 表 (L284-296 含 "Echo / feedback loop" 行) |
| `docs/00-technical-analysis.md` | 325 | 工程师向, §2 整节讲 loop 问题 + Voicemeeter 拓扑图 (L97-159) + §6 评估过且**否决的方案** (单 VB-Cable/WASAPI loopback 不可行的原因) |
| `docs/01-development-plan.md` | 182 | 5 阶段开发计划, Etapa 2 含路由验证清单 |

**"为什么这样设计"的精华**:
  - `README.md` L249-257 "Anti-loop design" 4 步:
    1. Direction A output → VB-Cable (virtual mic) — never played through speakers
    2. Direction B output → hardware headphones (A1) — never enters VAIO
    3. B1 loopback bus carries only audio from VAIO (system/app audio), not from A1
    4. Therefore B1 never captures the translator's own output
  - `docs/00-technical-analysis.md` L295-316 "Propuesta evaluada: Usar un solo cable virtual + WASAPI loopback" — **主动否决**了"只靠 WASAPI loopback 不上 Voicemeeter"的方案, 理由是"捕获 TODO lo que se reproduce en el dispositivo, incluyendo la salida de nuestra propia app (Direccion B), creando el loop infinito. La unica forma de evitarlo seria hacer echo cancellation por software, lo cual es complejo, fragil y agrega latencia" — 这是**对 macOS 单 BlackHole + WASAPI 的同款警告**, PoC 选方案时要警惕.

---

## 7. issue 区真实反馈案例 (你的问题 7)

**结论**: 仓库**没有 issues**.

证据 (GitHub API 实测):
  - `GET /repos/ricardobing/realtime-voice-translator/issues?state=all` → 0 items
  - `GET /search/issues?q=feedback+OR+echo+OR+loop+repo:ricardobing/realtime-voice-translator` → total_count = 0
  - `GET /repos/ricardobing/realtime-voice-translator/discussions` → `410 Gone` (discussions disabled)
  - `GET /repos/ricardobing/realtime-voice-translator` → `open_issues_count: 0`, created `2026-06-11`, pushed `2026-07-01` — 仓库**新且静默**

**含义**: 没有"用户报反馈环"的真实案例可参考. workaround 也无. **repo 作者自己的 troubleshooting 表** (`README.md` L284-296) 是唯一实战经验来源, 关键两条:
  - L292 "Echo / feedback loop | Microphone routed to B1 | In Voicemeeter: Hardware Input 1 must have B1 OFF"
  - L291 "Direction B doesn't translate (hear English) | B1 routing not configured | Run `check_voicemeeter.py`, enable B1 on VAIO in Voicemeeter"

即官方 workaround 是: **跑 `check_voicemeeter.py` 验证矩阵 + 手动回到 Voicemeeter GUI 关 B1 mic routing**. 这是**配置层面**的 workaround, 不是代码层面.

**对我们的启发**: repo 的 anti-loop 是**纯路由 + 配置校验**, 没有"运行时自适应修复"代码. macOS PoC 应**内置等价 checker** — 启动前自动验证候选方案拓扑, 失败时给用户明确指引 (类似 `check_voicemeeter.py` 的 Test 2).

---

## 8. 代码许可证 (你的问题 8)

**结论**: **README 声称 MIT, 但仓库根目录无 LICENSE 文件**. 这是合规风险.

证据:
  - `README.md` L4 badge: `[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)`
  - `README.md` L324 "License MIT — see [LICENSE](LICENSE) for details."
  - 但 `git clone --depth 1` 后 `find . -iname 'license*' -not -path './.git/*'` → **空**
  - GitHub API `/repos/ricardobing/realtime-voice-translator` → `license: None`

**MIT 隐含权利** (若 LICENSE 文件存在的话): 允许"使用、复制、修改、合并、发布、分发、再授权、出售", **前提是保留版权声明和许可声明**. 缺失 LICENSE 文件意味着**默认适用版权法最严解释** — 不可直接 copy 代码.

**但本 PoC 不需要 copy 代码**:
  - 防回声思想 (B1 矩阵拓扑 + dual WebSocket + echo_target_language flag) 是**公开方法论**, 不构成代码版权的创造性表达
  - 路由拓扑是**通用设计模式**, 多个 Windows 同传项目共享
  - 关键 API 调用 (`google-genai` SDK 的 `send_realtime_input` / `receive()`) 是**SDK 公开接口**, 用法记在 Google 官方文档
  - 测试逻辑 (`check_voicemeeter.py` 的 RMS 阈值) 极简, 完全可以重写

**复用策略**:
  - ✅ **可自由复用**: 拓扑图思想、anti-loop 4 步设计、dual session 模型、`echo_target_language=True` 的语义、`check_voicemeeter.py` 的 3-test 验证逻辑
  - ⚠️ **可参考但不直接 copy**: `main.py` 的 StateMachine + asyncio 编排 (1263 行), `devices.py` 的角色匹配打分算法 (278 行), `check_voicemeeter.py` 的具体阈值参数
  - ❌ **不可直接 vendor**: 任何带"Copyright (c) 2025 ..." 头的文件 (若有的话)

**给 PoC 的建议**: 在 `src/` 加文件头声明"本 PoC 代码独立编写, 参考 [ricardobing/realtime-voice-translator] 的架构设计 (MIT-claimed by author, no LICENSE file present)". 不依赖 MIT, 用项目自己的许可证.

---

## 关键代码片段摘录 (供 ticket 要求的摘录)

### A. Anti-loop 设计 (4 步) — `README.md` L249-257
```text
The feedback loop is prevented by Voicemeeter's bus isolation:
1. Direction A output goes to VB-Cable (virtual mic) — never played through speakers
2. Direction B output goes directly to the hardware headphones (A1) — never enters VAIO
3. The B1 loopback bus carries only audio from VAIO (system/app audio), not from A1
4. Therefore B1 never captures the translator's own output
```

### B. Gemini session 配置 — `src/main.py` L638-647
```python
def _build_config(self) -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        translation_config=types.TranslationConfig(
            target_language_code=self.target_language,
            echo_target_language=True,
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )
```

### C. 双向 send/receive + 服务端打断处理 — `src/main.py` L680-742
```python
async def sender():
    while True:
        await self._pause_event.wait()
        chunk = await input_queue.get()
        # VAD filtering — skip silence chunks to save API cost
        if should_send:
            await session.send_realtime_input(
                audio=types.Blob(
                    data=chunk,
                    mime_type=f"audio/pcm;rate={INPUT_SAMPLE_RATE}",
                )
            )

async def receiver():
    while True:
        async for response in session.receive():
            sc = response.server_content
            if sc is None: continue
            if sc.model_turn:
                for part in sc.model_turn.parts:
                    if part.inline_data and isinstance(part.inline_data.data, bytes):
                        await output_queue.put(part.inline_data.data)
            if sc.interrupted:
                # Barge-in: flush output queue
                while not output_queue.empty():
                    try: output_queue.get_nowait()
                    except asyncio.QueueEmpty: break
```

### D. 双 pipeline 并行 — `src/main.py` L877-888, L1057-1058
```python
async def run(self) -> None:
    await self.capture.start()
    await self.player.start()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(self.capture.run(), name=f"{self.label}-capture")
        tg.create_task(self.player.run(), name=f"{self.label}-playback")
        tg.create_task(
            self.session.run_with_reconnect(self.capture.queue, self.player.queue),
            name=f"{self.label}-session",
        )
# ...
for key, p in pipelines.items():
    tasks[key] = asyncio.create_task(p.run(), name=f"pipeline-{key}")
```

### E. 路由矩阵验证 (功能测试) — `src/check_voicemeeter.py` L131-176
```python
# Test 1: send tone to VAIO, capture from B1 — verify system audio reaches B1
tone = np.int16(16384 * np.sin(2 * np.pi * 440 * t))
rec = sd.playrec(tone, samplerate=RATE, channels=1, dtype="int16",
                 device=(b1_idx, vaio_idx), blocking=True)
rms = float(np.sqrt(np.mean(rec.astype(np.float64) ** 2)))
if rms > 200:
    print(f"  PASS  — RMS = {rms:.0f}  (system audio flows to B1)")
# ...

# Test 2: verify microphone does NOT leak to B1
mic_leak = sd.rec(RATE * 3, samplerate=RATE, channels=1,
                  dtype="int16", device=b1_idx, blocking=True)
rms_leak = float(np.sqrt(np.mean(mic_leak.astype(np.float64) ** 2)))
if rms_leak < 500:
    print(f"  PASS  — Mic RMS in B1 = {rms_leak:.0f}  (anti-loop OK)")
```

### F. Voicemeeter 矩阵配置 (用户配置) — `README.md` L148-156
```
| Channel strip           | A1 |  B1 |
|-------------------------|:--:|:---:|
| VAIO (Virtual Inputs)   | ON |  ON |
| Hardware Input 1 (mic)  | ON | OFF |
| All other Hardware Ins  | OFF| OFF |
```

---

## Sub-question quick recap (Ticket Q1-Q8 答复总览)

| # | Q | 一句话答复 |
|---|---|---|
| 1 | B1 是什么 | Voicemeeter 的"虚拟输出总线", 软件可作 input device 列出; VAIO→{A1,B1}, 物理 mic 只→A1 不→B1 = 物理切断 mic→翻译回采 |
| 2 | 双向 WS | **两个独立** Gemini Live session 并行 (协议限制 `target_language_code` 单值), 持续字节流非 per-turn, 服务端 `sc.interrupted` 触发客户端排空 output queue (barge-in) |
| 3 | 路由矩阵 | 见 §2 ASCII 图; 单向延迟 ~400-800 ms |
| 4 | 防回声代码 | **没有 AEC 代码**, 全靠路由层. 验证用 `check_voicemeeter.py` 测 RMS, 不做算法 |
| 5 | macOS 方案 | 5 候选 (BlackHole + Multi-Output / + SCC / + Process Tap / Aggregate / 单 BlackHole), 见 §5 表 |
| 6 | README/docs | 有, 三层 (README + 00-technical-analysis + 01-dev-plan), 含"否决单WASAPI"的反例论证 |
| 7 | issue 区 | **仓库 0 issues, discussions disabled**, 无真实反馈案例. workaround 仅来自 README troubleshooting 表 |
| 8 | license | README badge 声称 MIT, 但**仓库无 LICENSE 文件** (GitHub API `license: None`). 思想/拓扑可自由复用, 代码勿直接 copy |

---

## Sources (primary)

- Local clone `/tmp/realtime-voice-translator` (HEAD `c12d62d`)
- GitHub API: https://api.github.com/repos/ricardobing/realtime-voice-translator (`license: None`, `open_issues_count: 0`, `discussions: 410 Gone`)
- `README.md` L1-335 (anti-loop 设计 L249-257, 矩阵配置 L145-156, troubleshooting L284-296)
- `docs/00-technical-analysis.md` L1-325 (路由拓扑 L97-159, 音频格式 L249-289, 反例论证 L295-316)
- `docs/01-development-plan.md` L1-182 (5 阶段计划)
- `src/main.py` L1-1263 (Gemini session L638-825, pipelines L852-903, run_engine L925-1144)
- `src/check_voicemeeter.py` L1-242 (3-test 路由验证 L128-198)
- `src/devices.py` L1-278 (角色匹配 L64-107, 打分算法 L135-232)
- `src/preflight.py` L1-138 (启动前检查 + 设备解析)
- `src/config.py` L1-66 (持久化配置 — 默认设备索引)
- `src/windows_audio.py` L1-55 (读 Windows 默认播放/录音设备)
- `src/requirements.txt` (依赖列表, 无 AEC lib)
- `research/06-macos-audio-routing-options.md` (BlackHole/Process Tap/SCC 对比, 已存在)