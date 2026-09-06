# Doppelvoice 仓库深读（macOS 实时同传 PoC 参考）

研究对象：`https://github.com/TianqBu/Doppelvoice`（仓库别名 `Tianqi-Bu/Doppelvoice`，HTTP 重定向后是同一份代码）。
本地克隆：`/tmp/Doppelvoice`，单 commit `3776e48`（v0.3.3 release），HEAD 时间 `2026-04-26 13:00 -0400`。
最新发布版本：`v0.3.3`（[Releases](https://github.com/Tianqi-Bu/Doppelvoice/releases/latest)）；仓库本身 2026-04-25 创建、stars=3、open_issues=1（仅一个 PR `#1` "Add soundfile dependency to requirements"），用户社区极小，几乎没有公开 issue 反馈。

下面 8 条问题逐条对照源码 + 文档 + 实际 GitHub issue 区回答，所有引用给到行号。

---

## Q1. 音色克隆的代码接入点（0 样本自动复刻怎么触发）

**结论：Doppelvoice 完全不调用独立的「声音复刻 2.0」REST/HTTP 接口——0 样本克隆就是同传 2.0 WebSocket 流的内置能力，靠 `req.request.speaker_id = ""`（空串）+ `req.denoise = false` 两个字段触发。**

关键接入点：

1. **鉴权 / 资源（WebSocket 握手头）** — `src/doppelvoice/engine/doubao.py:70-77`
   ```python
   headers = [
       ("X-Api-App-Key", cred.app_key),
       ("X-Api-Access-Key", cred.access_key),
       ("X-Api-Resource-Id", cred.resource_id),
       ("X-Api-Connect-Id", self.connection_id),
   ]
   ```
   `resource_id` 默认 `volc.service_type.10053`（即「豆包同传 2.0」服务，不是「声音复刻 2.0」；见 `src/doppelvoice/config.py:65`）。
   URL 白名单强制 `wss://openspeech.bytedance.com`（`doubao.py:21-38`），防止 .env 被注入。

2. **StartSession 请求里设 `speaker_id` 与 `denoise`** — `src/doppelvoice/engine/doubao.py:138-169`（`_build_start_session`）
   ```python
   req.request.mode = t.mode                    # "s2s"
   req.request.source_language = t.source_language
   req.request.target_language = t.target_language
   if t.speaker_id:
       req.request.speaker_id = t.speaker_id   # 空串 ⇒ 不设 ⇒ 走克隆模式
   # 关键：影响零样本音色克隆的还原度。
   req.denoise = t.denoise                     # 默认 False，保留气声/共鸣
   ```

3. **`speaker_id` 字段语义**（`config.py:124-127` 注释明确写）：
   > `speaker_id: str = "" # 豆包 AST proto 字段；空=默认克隆模式 # 可试 "clone" / "0" / "auto" / UUID 等`

   配置层 `TranslationConfig` 还保留了一个未使用字段 `voice_clone: bool = True`（`config.py:125`），只在 `cli.py:116` 日志打印时被读，**没有真下发到 protobuf**。代码逻辑完全靠 `speaker_id == ""` + `denoise=False` 触发零样本克隆。

4. **`denoise` 是显式 false 的关键**（`doubao.py:163-164` 注释）：
   > `optional bool denoise = 7：显式发送，避免服务端默认（推测 true）磨平音色`

   验证：proto 字段确为 `optional bool denoise = 7;`（`engine/protos/products/understanding/ast/ast_service.proto:27`）。

**对本 PoC 的启示：**
- **不要先调声音复刻 2.0 拿 `speaker_id`。** Doppelvoice 的整个代码路径没有任何 HTTP TTS endpoint 调用（`grep tts|bigtts|voice.clone` 在 `src/` 下零命中），全程是同传 2.0 这一根 WebSocket 流内嵌的零样本克隆。
- 「用 speaker_id 指定已训练音色」是一个「实验性」旁路（`gui/i18n.py:85` 中文："Speaker ID（实验性，留空使用默认）"），Doppelvoice 自己也没把它当主路径。
- 跨 PoC 直接照搬的最小启动面：① 设 `.env` 里 `DOUBAO_APP_KEY` / `DOUBAO_ACCESS_KEY`；② StartSession 时 `speaker_id=""` + `denoise=False`；③ 客户端按 80ms 一包发 16k/16bit/mono PCM（`config.py:82-95`）。

---

## Q2. 跨语种音色迁移（中文音色说英文）

**Doppelvoice 没有专门做跨语种音色迁移的训练或后处理——它就是「把任意源语送进同一个 zero-shot clone 模型」，跨语种纯靠模型内部能力。**

事实清单：

- 训练阶段：**Doppelvoice 仓库里没有任何 HTTP 调声音复刻 2.0 / 上传参考音 / 注册 speaker_id 的代码**。整个仓库用 grep `voice_clone|bigtts|clone` 检索只命中 proto 字段 `speaker_id`、`req.denoise`、`voice_clone` 这个 unused bool、以及 `TestClone` 之类的测试名，没有任何调用 `/api/v1/tts/voice_clone` 或类似 endpoint 的地方。
- 运行时音色采样：服务端的零样本克隆是「在 StartSession 之后，从你流过来的 PCM 里实时采你音色特征」（README 第 4 行 "model captures your voice on the fly"），所以中文音色说英文时，是把同一段用户中文音色特征 + 英文目标文本一起喂给模型。
- **「中文口音残留」/ 跨语种效果讨论**：在文档里明确出现 **一处**：
  - `docs/en/TROUBLESHOOTING.md:84` 与 `docs/zh/TROUBLESHOOTING.md:78`：
    > "The public AST API is good but lags behind the Volcengine Console demo (which uses a different BFF endpoint with extra prosody processing). This is a hard ceiling."

  中文版（`docs/zh/TROUBLESHOOTING.md:78`）："音色表达性比火山控制台 demo 略弱（控制台走不同的 BFF 端点带额外韵律处理）"。
  
  这其实是「同传 2.0 公开 API vs 控制台 BFF 端点」的差异（控制台 demo 韵律更活），但被 Doppelvoice 作者明确归为「硬天花板」——侧面说明跨语种音色还原的可达上限受限于 API 而非用户接入方式。
- **唯一一处 issue/PR 讨论**：仓库只有 1 个 PR（#1 "Add soundfile dependency to requirements"），无任何用户报告「中文口音残留」「跨会话音色漂」。

**对本 PoC 的启示：**
- 跨语种音色迁移是「同传 2.0 模型自己负责的事」，客户端代码上**没有跨语种特殊路径**。PoC 这边不需要为「中文音色说英文」单独走声音复刻 2.0。
- 唯一能调的两个开关：① `DENOISE=0`（默认；开 1 会磨平气声/共鸣，对跨语种音色伤害最大）；② 前 15 秒不要停（README "Speak continuously for the first 10–15 s so the model can sample your voice"）。这两点直接写到 PoC 的 on-call 指南里。
- 「中文口音残留」这件事 Doppelvoice 自己都没修，**PoC 这边不要指望客户端 hack**。

---

## Q3. 9 语言支持架构

**per-session、per-`source_language/target_language` 配对，硬编码进 enum，靠 GUI 两个 QComboBox 下拉切换。**

代码：

- **9 语言常量** — `src/doppelvoice/gui/main_window.py:40`：
  ```python
  SUPPORTED_LANGS: tuple[str, ...] = ("zh", "en", "ja", "id", "es", "pt", "de", "fr", "zhen")
  ```
  末尾 `zhen` 是中英互译自动模式（源 + 目标都设 `zhen` 时由服务端做自动方向判定）。

- **配置加载** — `src/doppelvoice/config.py:177-184`：
  ```python
  if src := os.getenv("SOURCE_LANG"):
      translation_overrides["source_language"] = src
  if tgt := os.getenv("TARGET_LANG"):
      translation_overrides["target_language"] = tgt
  ```
  透传到 StartSession 的 `req.request.source_language / target_language`。

- **GUI 切换 UX** — `main_window.py:307-330`（`_populate_language_combos`） + `343-369`（`_on_lang_changed`，zhen 互锁逻辑）：
  - 两个 QComboBox（源/目标），每项 `userData` 是 API code（zh/en/...），显示文字走 `gui/i18n.py:152-158` 本地化（"中文"/"Chinese"/"Japanese" 等）。
  - `zhen` 互锁：用户把任一端改成 `zhen`，另一端自动跟着设 `zhen`；离开 `zhen` 时另一端默认回 `zh`/`en`（避免 src==tgt）。
  - 切换语言后**不立即重启会话**——目前 `cli.py`/`orchestrator.py` 都没看到 hot-swap 路径，估计要在下一次 start 时生效（受 `cfg.snapshot()` 隔离保护）。

- **服务端约束** — `docs/en/ARCHITECTURE.md:184-189`：
  > `9 codes: zh / en / ja / id / es / pt / de / fr / zhen. zhen is the bilingual ZH⇄EN auto mode — set both source_language and target_language to zhen. Any other language code is unidirectional (e.g. source_language=ja, target_language=en).`

**对本 PoC 的启示：**
- 9 语言 = 服务端能力，客户端只是一对字符串。PoC UI 沿用 `("zh","en","ja","id","es","pt","de","fr","zhen")` 这套常量即可。
- macOS 的 PoC 在切换语言时**重新 StartSession 即可**（因为 Doppelvoice 自己也没做 hot-swap，没有更优雅的范式可以参考）。

---

## Q4. 错误处理 / 降级

**三层降级：① 致命错误直接退出；② 瞬时错误指数退避重连；③ 整个错误处理里没有任何「用默认 AI 音色」或「跳过克隆」的降级路径。**

代码在 `src/doppelvoice/pipeline/orchestrator.py`：

- **致命 vs 瞬时分类** — `orchestrator.py:43-54`：
  ```python
  _TRANSIENT_CODES = {
      0,         # 未填
      11301,     # LIMIT_QPS
      11303,     # SERVER_BUSY
      21100,     # ERROR_PROCESSING
      21200,     # TIMEOUT_WAITING
      21201,     # TIMEOUT_PROCESSING
      21300,     # INTERRUPTED
      21701,     # AUDIO_DOWNLOAD_FAIL
      29900,     # ERROR_UNKNOWN（可能是瞬时）
  }
  ```
  之外的（鉴权 11200、参数 11500、格式 11103 等）全部 fatal（`orchestrator.py:339-341` `_handle_error`）：
  ```python
  if ev.status_code in _TRANSIENT_CODES:
      raise RuntimeError(f"remote transient code={ev.status_code} msg={ev.message}")
  raise _FatalRemote(ev.status_code, ev.message)
  ```

- **指数退避** — `orchestrator.py:142-151`：
  ```python
  delay = min(
      self.cfg.network.reconnect_base_s * (2 ** (attempt - 1)),
      self.cfg.network.reconnect_max_s,
  )
  ```
  默认 1s → 2s → 4s → … cap 30s（`config.py:138-142`）；且 `_reset_attempt` 标记在 `SessionStarted` 后被设 True（`orchestrator.py:173`），避免短抖动反复把退避累到 30s。

- **音色克隆失败/超时的降级**：**没有**。`voice_clone: bool = True` 这个开关虽然存在（`config.py:125`），但代码里从来没用过它去"切回默认 AI 音色"。原因：0 样本克隆是「同一根 WebSocket 流内置」，**没有独立的克隆子请求可供失败**——服务端没克隆出来就直接不出 TTS 音频，客户端只能选择「重连会话」或「放弃」。所以**"音色克隆失败时降级到默认 AI 音色"在 Doppelvoice 架构里根本不存在**这个回退路径，PoC 也不要凭空造。

- **网络抖动**：发送端 `orchestrator.py:211-222`（`_sender_loop`）每 80ms 没采到音频就发静音帧保活；接收端 `audio/playback.py:54-66` jitter buffer 120ms 默认（`config.py:90`），下溢就吐静音。

- **Oversize 帧** — `doubao.py:227-232` 拒绝 > 4MB 的服务端帧（防 OOM）；**WS URL 注入** — `doubao.py:26-38` 强制 `wss://` + 白名单主机名。

**对本 PoC 的启示：**
- 直接抄 `_TRANSIENT_CODES` 白名单 + 指数退避骨架即可。
- 「降级到默认音色」在这套 API 协议下不可达——把这点写进 PoC 的限制说明里，避免后续被人误以为能加。

---

## Q5. 与豆包 Seed LiveInterpret 2.0 的关系

**唯一调用的能力就是「豆包同声传译 2.0」 (`volc.service_type.10053`) 这一根 WebSocket。没有调用豆包 Seed 系列的任何其他能力（TTS / 声音复刻 2.0 / ASR / 翻译单独接口），也没有调用豆包 Seed 1.6 / Seed-1.5 等其他模型。**

证据：

- 整个仓库搜 `volc.service_type`、`openspeech.bytedance.com`、`bytedance`、`seed`、`LiveInterpret`，相关命中只有同传 2.0 的端点（`config.py:65` `volc.service_type.10053` 默认；`config.py:137` `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`）。
- README 第 9 行：
  > "Powered by ByteDance Doubao Seed LiveInterpret 2.0."
- README 致谢里提到「`kizuna-ai-lab/sokuji` 是 protobuf 反向工程参考」（README 第 176 行），即 protobuf schema 是借 sokuji 项目逆向 + 字节官方 demo 验证的，不是走文档化 SDK。
- proto schema (`engine/protos/...`) 是字节内部仓库 mirror 过来的（`au_base.proto` 头注释 "Copyright 2025 ByteDance Inc. Author: Yu WenTeng yuwenteng@bytedance.com"），但 Doppelvoice 编译这些 proto 后只把它们当成同传 2.0 协议的「线格式」用。

API 调用差异（与常见的「豆包 TTS 单独 API」对比）：
- **不走 HTTP REST**，全双工 WebSocket。
- 请求帧就是裸 protobuf `TranslateRequest`（`doubao.py:107` 直接 `SerializeToString()`，无 V3 binary frame 包装，见 `docs/en/ARCHITECTURE.md:108-109`）。
- 鉴权在 WS upgrade header（不是 HTTP Authorization）。
- 「voice clone」字段直接挂在同一个 `ReqParams.speaker_id`，无须单独调 `/voice/train` 这类 endpoint。

**对本 PoC 的启示：**
- 我们 PoC 也不需要任何额外 HTTP API——和 Doppelvoice 一样，只跑这一根 WS 即可。
- 后续若要加「先训练一个固定 speaker_id 复用」，那是另接「声音复刻 2.0」REST API（不在 Doppelvoice 代码里），需要单独集成。

---

## Q6. README / docs 是否说明「如何在 Teams/Zoom 用」

**README + docs/en/SETUP.md 给了明确步骤，但只覆盖 Windows + VB-Audio Virtual Cable，macOS 用户需要自己把 `CABLE Input/Output` 替换成 BlackHole 名字。**

具体指引（README.md:60-88）：
- 5 步快速开始：① 装 VB-Audio Virtual Cable → ② 下载 zip → ③ 复制 `.env.example` 到 `.env` 填 `DOUBAO_APP_KEY/ACCESS_KEY` → ④ 双击 `Doppelvoice.exe` → ⑤ **「在你的会议 app 里，把麦克风设为 `CABLE Output (VB-Audio Virtual Cable)`」**。
- 注意 README.md:114 解释：「"Output" sounds wrong — that's correct: it's the output of the virtual cable feeding INTO Zoom.」（你选的是「虚拟线缆的输出」，它会作为 Zoom 的输入）。这一处对我们 macOS / BlackHole 同样适用。

`docs/en/SETUP.md:111-123` 专门有「Use it inside meeting apps」小节：

- **Zoom**：Settings → Audio → Microphone → `CABLE Output (VB-Audio Virtual Cable)`；同时取消勾选 "Automatically adjust microphone volume"。
- **腾讯会议 / 飞书 / Microsoft Teams / Google Meet (Chrome)**：Audio → Microphone → `CABLE Output`。
- **OBS livestream**：Audio Input Capture → `CABLE Output`。
- **截图**：`docs/images/screenshot.png` 是 GUI 截图（README:56 引用），**没有**会议 app 配置的截图，文字指引是唯一参考。

中文版 `README.zh-CN.md:55-80` 与 `docs/zh/SETUP.md` 同样内容。

**对本 PoC 的启示：**
- 步骤结构可以直接复用——把"CABLE Output"全部替换为"BlackHole 2ch"并加一段「macOS 安装 BlackHole + Audio MIDI Setup 创建 Multi-Output Device」前置步骤。
- 没有现成 macOS 截图可用，需要 PoC 这边自己截。

---

## Q7. issue 区与 fork：用户报告「跨会话音色漂」「中文口音残留」？

**几乎没有公开反馈。仓库 2026-04-25 创建，2026-04-26 推到 v0.3.3，stars=3、open_issues=1，唯一的 issue/PR 是 #1 "Add soundfile dependency to requirements"，无任何用户讨论跨语种音色漂问题。**

- GitHub API 拉取（重定向后是 `Tianqi-Bu/Doppelvoice`）只返回 1 条记录：#1（PR "Add soundfile dependency to requirements"，open，body 为空）。
- 没有 Discussions 区启用。
- 没有 wiki / 没有 community forum。

**跨会话音色漂问题的唯一权威表述是 Doppelvoice 自己 CHANGELOG.md:273-274**（v0.2.2 release notes）：

> **"Voice-clone 'tone shift' on every reconnect (server re-samples zero-shot voice profile per session). Pending Doubao API research."**

中文版在 `docs/zh/ARCHITECTURE.md:265` 一表里：

> "重连即新会话 | 零样本音色重新采样，长会话音色会突变 | 调研 `speaker_id` 是否支持复用；UI 提示用户"

也就是说：**Doppelvoice 作者自己承认「重连后音色突变」是个 known issue**，根因是零样本克隆在每个新会话里重新采样，没有复用机制。**这正是本 PoC 必须警觉的同款问题**。

**典型 workaround（在 Doppelvoice 文档里能找到的所有提示）：**
- 减少不必要重连：把 `jitter_buffer_ms` 调到 300+ 缓解网络抖动（`SETUP.md:144`）。
- 前 15 秒连续说话让模型采样你（TROUBLESHOOTING.md:85）。
- 用宽带麦（≥48kHz native）；避免 AirPods 蓝牙 HFP 的 8kHz/16kHz 窄带。
- `DENOISE=0`（默认）。
- 长期 fix：调研是否给 `speaker_id` 传一个服务端可复用的 ID（Doppelvoice 自己还没做）。

**对本 PoC 的启示：**
- 我们 macOS 实时同传 PoC 一旦遇到网络抖动走重连路径，会**复现这个「重连后音色漂移」问题**——需要在 PoC 文档里写明这是已知限制。
- Workaround：① 尽量少重连；② 重连后前几句不要急着判断音色是否正确（给模型重新采样的时间窗口）。

---

## Q8. 代码许可证与能否 copy

**MIT License（`LICENSE`，copyright "2026 Doppelvoice contributors"），可以自由复制、修改、商用，唯一义务是保留版权声明和许可声明。**

`LICENSE` 全文（21 行）就是标准 MIT 文本。

`THIRD_PARTY_LICENSES.md` 列了打包进 Windows 二进制的第三方依赖（PySide6=LGPL-3.0 / libsoxr=LGPL-2.1 / libsndfile=LGPL-2.1 / PortAudio=MIT-style / OpenSSL=Apache-2.0 / NumPy=BSD-3 / websockets=BSD-3 / protobuf=Apache-2.0），全部是兼容 MIT 的宽松许可。

**对本 PoC 的「参考代码片段直接 copy」合规性结论：**
- ✅ Doppelvoice 自身的代码片段（protobuf 序列化、WebSocket 帧解析、orchestrator 状态机、playback jitter buffer）可以**直接 copy 到本 PoC**，唯一约束是「在 PoC 源码顶部或 NOTICE 文件里保留 `Copyright (c) 2026 Doppelvoice contributors` + MIT 全文」（Doppelvoice 的 pyproject 也明确写了 `[project.license] = MIT`）。
- ⚠️ Doppelvoice 自带的 `engine/protos/` 是字节内部 proto schema 的 mirror，复制时同样要保留字节的版权头（`au_base.proto` 顶部 "Copyright 2025 ByteDance Inc."）。本 PoC 直接用 `volc.service_type.10053` 这个 resource_id 时也要遵守字节的服务条款（README 引用过 https://www.volcengine.com/docs/82379/1394617 ）。
- ⚠️ 如果复用 Doppelvoice 的 PyInstaller 打包逻辑（`doppelvoice.spec`），里面涉及的 Qt6 (LGPL) 在重分发时必须能让用户替换 .dll（LGPL 合规要求）——对本 PoC 我们 macOS 不打包 Qt，不用管。

---

## 关键代码片段摘录（给 PoC 直接抄）

### A. StartSession 的最小 payload 构造（`src/doppelvoice/engine/doubao.py:138-169`）

```python
req = ast_pb.TranslateRequest()
self._fill_request_meta(req.request_meta)         # 只设 SessionID（uuid4）
req.event = EventType.StartSession                 # 100

req.user.uid = "ast_py_client"
req.user.did = "ast_py_client"

req.source_audio.format = "wav"                    # 不是 "pcm"
req.source_audio.rate   = 16000
req.source_audio.bits   = 16
req.source_audio.channel = 1

req.request.mode            = "s2s"
req.request.source_language = "zh"
req.request.target_language = "en"
# req.request.speaker_id 不设 ⇒ 走 zero-shot clone
req.denoise = False                                # 显式 false 保音色细节

req.target_audio.format = "ogg_opus"               # PCM 实测不响应
req.target_audio.rate   = 48000
```

### B. WebSocket 握手头（`doubao.py:70-77`）

```python
headers = [
    ("X-Api-App-Key",     cred.app_key),
    ("X-Api-Access-Key",  cred.access_key),
    ("X-Api-Resource-Id", cred.resource_id),       # volc.service_type.10053
    ("X-Api-Connect-Id",  self.connection_id),
]
```

### C. 发送端 80ms 一包（`pipeline/orchestrator.py:211-222` + `config.py:88-96`）

```python
chunk_ms = 80
chunk_samples = int(16000 * chunk_ms / 1000)       # 1280 samples
silence = b"\x00\x00" * chunk_samples
while not self._stop.is_set():
    chunk = await asyncio.wait_for(capture_q.get(), timeout=chunk_ms/1000)
    await client.send_audio(chunk)                  # send_audio 内部复用 _audio_req 模板
    # 静音超时：发 silence 包保活，避免服务端超时
```

### D. 错误分类与重连退避（`pipeline/orchestrator.py:43-54` + `123-151`）

```python
_TRANSIENT_CODES = {0, 11301, 11303, 21100, 21200, 21201, 21300, 21701, 29900}
# 其它都是 _FatalRemote：不重连，进程退出

delay = min(reconnect_base_s * (2 ** (attempt - 1)), reconnect_max_s)  # 1→2→4→...→30s
```

### E. 9 语言常量 + zhen 互锁 UX（`gui/main_window.py:40` + `343-369`）

```python
SUPPORTED_LANGS = ("zh", "en", "ja", "id", "es", "pt", "de", "fr", "zhen")
# 用户把任一端设成 zhen ⇒ 另一端自动设为 zhen
# 用户离开 zhen ⇒ 另一端默认 zh/en（避免 src==tgt）
```

---

## 跨语种音色迁移已知问题清单（PoC 必须心里有数）

| # | 问题 | 来源 | 临时 workaround |
|---|------|------|-----------------|
| 1 | **重连即新会话，音色突变** | `CHANGELOG.md:273-274` / `docs/zh/ARCHITECTURE.md:265` | 减少重连；前 15s 连续说话让模型重新采；jitter 拉到 300+ |
| 2 | AirPods 蓝牙 HFP (8/16kHz 窄带) 克隆差 | `README.md:141` / `TROUBLESHOOTING.md:52,82` | 用有线 / USB 麦 / 笔记本内置麦 |
| 3 | 公开 API 表达性比控制台 demo 差（BFF 端点带额外韵律） | `TROUBLESHOOTING.md:50-52,84` | 无；硬天花板 |
| 4 | 短句不稳定（首字辅音被服务端 VAD 切） | `SETUP.md:158-160` | 前 15s 连续说话 + `DENOISE=0` |
| 5 | 服务端 denoise=true 默认会磨平音色 | `docs/en/ARCHITECTURE.md:115` / `doubao.py:163-164` | 显式 `denoise=False` |
| 6 | `speaker_id` 复用尚未支持 | `CHANGELOG.md:273-274` | Doppelvoice 自己 pending 调研 |
| 7 | 整句 ogg_opus 解码增加 ~500ms 输出端延迟 | `README.md:151-152` | Doppelvoice v0.5 计划切 streaming opus |
| 8 | 用扬声器不开耳机 → 声学反馈环（自己声音被翻回来） | `README.md:154-156` / `TROUBLESHOOTING.md:54-79` | **必须戴耳机**；或调高 RMS 静音门限到 0.020 |

---

## 与 TransEcho 风格差异对照表

> 备注：本 PoC 没读过 TransEcho 仓库，下面差异对照只基于 Doppelvoice 内部特征，方便后续若引入 TransEcho 风格时做快速比对。

| 维度 | Doppelvoice 做法 | TransEcho 常见做法（按行业惯例推断，待后续 ticket 验证） |
|---|---|---|
| 传输 | WebSocket 双工流，每 80ms 一包 protobuf | 经常是 WebSocket 但帧格式可能用 JSON+gRPC 二进制，或 HTTP chunked |
| 鉴权 | WS upgrade header（X-Api-App-Key / X-Api-Access-Key / X-Api-Resource-Id） | 通常类似火山引擎 header 或 HTTP Bearer |
| 克隆触发 | StartSession 时 `speaker_id=""` + `denoise=False` 内嵌触发 | 可能要求先单独调训练 API 拿 speaker_id，再传 |
| 错误降级 | 白名单瞬时错误 + 指数退避重连；其它 fatal 退出 | 常有 "fallback to default TTS" 路径 |
| 音频输出 | ogg_opus（默认）/ pcm（不可用）48kHz，写入 VB-Cable Input | 常直接吐 wav / pcm；可能不依赖虚拟麦 |
| 平台 | Windows + VB-Cable；macOS/Linux 在 v0.6 路线图 | 常跨平台（Python + sounddevice 即可） |
| 字幕 | 650/651/652 (源) + 653/654/655 (译) protobuf 事件流 | 常 SSE / WebSocket sub-protocol |
| 重连后音色 | 突变（已知 issue，pending Doubao API research） | 可能通过缓存 speaker_id 解决 |
| 许可 | MIT | 待查 |

---

## 引用清单

源码：
- `src/doppelvoice/engine/doubao.py`（WebSocket 客户端 + 错误分类）
- `src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto`（请求/响应 schema）
- `src/doppelvoice/engine/protos/products/understanding/base/au_base.proto`（Code 枚举 + User/Audio/ReqParams 定义）
- `src/doppelvoice/pipeline/orchestrator.py`（session 编排 + 退避重连）
- `src/doppelvoice/audio/playback.py`（jitter buffer + 重采样）
- `src/doppelvoice/config.py`（frozen dataclass 配置）
- `src/doppelvoice/gui/main_window.py`（9 语言下拉 + zhen 互锁）
- `src/doppelvoice/gui/settings_dialog.py`（Settings → Advanced → speaker_id / denoise 开关）
- `src/doppelvoice/gui/i18n.py`（GUI 中英文案 + 9 语言显示名）

文档：
- `README.md` / `README.zh-CN.md`
- `docs/en/ARCHITECTURE.md` / `docs/zh/ARCHITECTURE.md`
- `docs/en/SETUP.md` / `docs/zh/SETUP.md`
- `docs/en/TROUBLESHOOTING.md` / `docs/zh/TROUBLESHOOTING.md`
- `docs/en/PRD.md` / `docs/zh/PRD.md`
- `CHANGELOG.md`（v0.2.2 voice-clone tone shift issue）
- `LICENSE`（MIT）
- `THIRD_PARTY_LICENSES.md`
- `.env.example`

远程元信息：
- https://github.com/Tianqi-Bu/Doppelvoice（canonical，GitHub 自动重定向自 `TianqBu/`）
- https://api.github.com/repos/Tianqi-Bu/Doppelvoice（创建于 2026-04-25，stars=3，open_issues=1）
- https://github.com/Tianqi-Bu/Doppelvoice/issues?state=all（仅 1 条记录：PR #1 "Add soundfile dependency to requirements"）
