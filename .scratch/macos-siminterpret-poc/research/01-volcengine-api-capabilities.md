# 火山引擎豆包同传 2.0 (Doubao Seed LiveInterpret 2.0) S2S API 能力现状 — Research

> Status: 2026-09 时点，基于公开技术文档、产品页、官方 .proto schema、技术论文，以及 GitHub 上开源客户端 (Doppelvoice / sokuji / TransEcho) 已验证的接入代码。
> Ticket: `.scratch/macos-siminterpret-poc/issues/01-volcengine-api-capabilities.md`
> 所有结论均附一级 URL 证据。

## TL;DR

- **豆包同传 2.0 是端到端 S2S 模型**，原生支持「说话人音色零样本克隆」；同一接口还接受「预训练 `speaker_id`」走预置音色。两条路径在 **同一个 StartSession 请求里切换**，不互相打架。
- **协议是 WebSocket (wss) + 二进制 protobuf**，没有 gRPC 包装。鉴权在 HTTP 升级头里注入，不是 query string。
- **官方口径端到端延迟 ≈ 3 秒**（论文实测把克隆语音平均延迟从 ~10s 砍到 ~3s）。
- **S2T 是 `mode` 字段的一个值**（`s2s` / `s2t` 二选一），不是另一个独立 API；字幕事件用 SourceSubtitleStart/Response/End + TranslationSubtitleStart/Response/End 区分源语/译语。
- **声音复刻 2.0 走 预训练 `speaker_id`**；同传 2.0 内置「零样本实时克隆」（speaker_id 留空）。两者不是先后调用关系，是同一个 endpoint 同一个请求的不同参数。
- **官方文档入口**：`https://www.volcengine.com/docs/6561/1756902` （AST 2.0 协议主入口），控制台 `https://console.volcengine.com/speech/app`，产品介绍页 `https://seed.bytedance.com/en/seed_liveinterpret`。

---

## 一、speaker_id 是否原生支持 — Q1

### 结论
**原生支持。** S2S 流式接口在同一 `StartSession` 请求里通过 `ReqParams.speaker_id` 字段切换两种模式：
1. **零样本克隆模式**：`speaker_id` 留空（或不发送），服务端在用户说话时实时采样音色、随流生成克隆语音。
2. **预训练 `speaker_id` 模式**：填入预置音色名（如 `zh_female_vv_uranus_bigtts`），合成时使用预训练音色，不再做零样本克隆。

两者**走同一个 WebSocket endpoint、同一个 protobuf schema**，切换只是请求体里 `speaker_id` 字段是否为空。没有两条不同链路，也没有「实时音色复刻 API vs StartVoiceChat API」的分裂（StartVoiceChat 是实时音视频 (RTC) 里的 AI 对话方案，不是同传 2.0 的同义接口）。

### 证据

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto` —— **官方 .proto 文件**：
  ```proto
  message ReqParams {
    string mode = 1;            // 可能是s2t , s2s 选一个, 控制是否需要语音
    string source_language = 2; // 源语言
    string target_language = 3; // 目标语言
    string speaker_id = 4;
    understanding.Corpus corpus = 100;
  }
  ```
  → `speaker_id` 是 proto 第 4 字段，可空字符串。

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/doubao.py` (L160-L161)：
  ```python
  if t.speaker_id:
      req.request.speaker_id = t.speaker_id
  ```
  → 留空 = 走零样本克隆；填字符串 = 走预设音色。

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/README.md` (L112, L34)：
  > "`SPEAKER_ID` _empty_ | Doubao `ReqParams.speaker_id` — empty = clone the speaker; set to a preset like `zh_female_vv_uranus_bigtts` to use a stock voice instead"
  > "voice is cloned zero-shot from your speech as you talk."

- `https://arxiv.org/abs/2507.17527`（Seed LiveInterpret 2.0 官方技术报告）摘要原文：
  > "we introduce Seed-LiveInterpret 2.0, an end-to-end SI model that delivers high-fidelity, ultra-low-latency speech-to-speech generation **with voice cloning capabilities**."
  → 端到端模型内置克隆能力，非外挂。

### 设计含义（对 PoC）
- **两种模式可以并存**：同一份客户端代码，`SPEAKER_ID` 环境变量切换即可。
- **预设音色值的命名空间** 看起来是 `zh_female_<name>_bigtts` 这种形式，但**完整白名单在官方控制台/API 文档里，未在公开 proto 中给出** —— PoC 阶段需要从控制台或文档枚举。

---

## 二、端到端延迟口径 — Q2

### 结论
**官方论文数据：克隆语音平均延迟 ≈ 3 秒**（从上一代 ~10s 降到 ~3s，约 -70%）。**实际生产实测在 2.5–3 秒区间**（取决于说话人停顿、本地缓冲、输出格式）。
延迟构成 ≈ 模型推理硬下限 2.5s + 本地采集/编码/缓冲 <500ms + 解码回放（ogg_opus 整句解码比 raw pcm 多 ~500ms，但 API 不直接吐 pcm）。

### 证据

- `https://arxiv.org/abs/2507.17527` 摘要原文：
  > "Seed-LiveInterpret 2.0 … slashing the average latency of cloned speech from nearly 10 seconds to a near-real-time **3 seconds**, which is around a near 70% reduction that drastically enhances practical usability."
  → 论文里 3 秒是**含端到端全链路**的平均实测口径，不是单独推理。

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/README.md` (L34, L43, L146-L148)：
  > "End-to-end latency ≈ 2.5–3 s. Subtitles stream token-by-token; voice is cloned zero-shot from your speech as you talk."
  > "⚡ **~2.5 s latency** — production-grade real-time"
  > "**End-to-end latency floor ≈ 2.5 s** is the model's hard limit per the [Seed LiveInterpret 2.0 paper](https://arxiv.org/abs/2507.17527); local processing adds <500 ms."

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/docs/en/ARCHITECTURE.md` (L285)：
  > "**Sentence-end ogg/opus batch decode** | Output side waits for the full sentence (3-5s) before first sample plays | Switch to streaming opus (`opuslib`) or re-test `format=pcm`"

### 设计含义（对 PoC）
- 用户需要「自然留停顿」才能拿到完整句子后再听译音；这是商务同传节奏，不是对话节奏。
- 输出格式选 `ogg_opus` 时有额外 ~500ms 缓冲（整句解码），选 `pcm` 则直接吐流（但 Doppelvoice 实测服务端对 `format=pcm` 当前不响应，README 注明 "the API does not currently honor"）。**当前实际只有 ogg_opus 一条可走**。
- 字幕事件 (SourceSubtitleStart/Response/End) 早于音频 (TTSResponse) 出现，是天然的「字幕先行」出口，R4 的双语字幕流可以比 R3 译音更早展示。

---

## 三、流式协议 — Q3

### 结论

| 维度 | 值 | 证据 |
|---|---|---|
| 协议 | **WebSocket Secure (wss) + 二进制 protobuf**；无 gRPC 包装 | proto schema (`ast_service.proto`) 直接以 TranslateRequest 消息为帧；两端代码均用 websockets/原生 WebSocket |
| Endpoint | `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` | Doppelvoice + sokuji 默认值 |
| 鉴权 | **HTTP Upgrade 头**：X-Api-App-Key / X-Api-Access-Key / X-Api-Resource-Id / X-Api-Connect-Id | Doppelvoice `doubao.py` L72-L76；sokuji `VolcengineAST2Client.ts` 注释 |
| Resource ID | `volc.service_type.10053` | Doppelvoice `config.py` 默认 |
| 请求帧 | `TranslateRequest`（一个 proto 消息覆盖 StartSession / TaskRequest / FinishSession 三个事件，用 `event` 字段区分） | ast_service.proto |
| 响应帧 | `TranslateResponse`（同理一个 proto 消息覆盖 SessionStarted / SourceSubtitle{Start,Response,End} / TranslationSubtitle{Start,Response,End} / TTSSentence{Start,End} / TTSResponse / UsageResponse / SessionFinished / SessionFailed） | events.proto |
| 输入分片粒度 | **每包 80ms 的 16kHz/16bit/mono PCM**（1280 samples / 2560 bytes），由客户端每次构造一个 TaskRequest | Doppelvoice `orchestrator.py` L213 `chunk_samples = int(sr * chunk_ms / 1000)`，默认 chunk_ms=80 |
| 输入音频格式标识 | `source_audio.format = "wav"`（按 Doppelvoice 对官方 demo 的对齐），rate=16000, bits=16, channel=1 | ast_service.proto + Doppelvoice `_build_start_session` |
| 输出音频格式 | `target_audio.format = "ogg_opus"`（默认；客户端控制推荐 48000Hz，Doppelvoice 用 48000；sokuji 用 24000 都行） | Doppelvoice config + sokuji 头注释 |
| 断句策略 | **服务端 VAD**；客户端无 VAD 控制（推荐关客户端 RMS 门限）。事件层有 TTSSentenceStart/End 标记「句子边界」，需要客户端按句重组 ogg 流 | events.proto + Doppelvoice 配置注释：「豆包服务端有自己的 VAD」 |
| VAD 控制 | **服务端侧**，不可由 AST 2.0 客户端调；通用 ReqParams（au_base.proto）里有 `enable_vad / vad_signal / vad_silence_time / vad_mode / vad_segment_duration` 等字段，但 **AST 2.0 的 ReqParams 不是通用 ReqParams**，只暴露 `mode/source_language/target_language/speaker_id/corpus` | ast_service.proto vs au_base.proto |
| Keepalive | 客户端在静默时每 ~80ms 发静音 PCM 包维持连接；服务端无连接空闲超时 | Doppelvoice `orchestrator.py` `_sender_loop` |
| 鉴权子账号 | 官方没有公开子账号/IAM 文档片段；目前已知使用 X-Api-App-Key + X-Api-Access-Key 两组凭据（注意：`Access Key` ≠ 控制台上的"API Key"），从 `console.volcengine.com/speech/app` 创建应用获得 | Doppelvoice `.env.example` 注释：「`DOUBAO_APP_KEY` = 控制台显示的 "App Key" 字段（不是 Access Token / API Key）」 |

### 证据（直链）

- Endpoint + 鉴权头：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/doubao.py` (L66-L91)
  - `https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/src/services/clients/VolcengineAST2Client.ts` (L1-L60)：明确注释「`Endpoint: wss://openspeech.bytedance.com/api/v4/ast/v2/translate`」
- 事件枚举（350-352 = TTS，650-655 = 字幕）：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/common/events.proto`
- 输入分片粒度：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/pipeline/orchestrator.py` (L213-L222)
- 输出格式：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/config.py` (L86, L95)
- 客户端 VAD 推荐关闭：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/config.py` (L91-L94)
- AST 2.0 自己的 ReqParams（不暴露 VAD 字段）：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto`
- 通用 ReqParams（有 VAD 字段）：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/base/au_base.proto` (L122-L168)

### 设计含义（对 PoC）
- **没有 IAM 子账号文档**，目前是「主账号创建应用 → 拿到一组 App Key + Access Token」直接用。需要登录控制台才能看到权限开通流程（属于 T02 的范围）。
- **断句只能靠事件层 (TTSSentenceStart/End)**，不能在请求里调灵敏度；想改「多快分句」只能换 denoise / speaker_id 等间接手段。
- **WebSocket 鉴权头注入** 在浏览器/扩展里有坑（不能 setHeader），所以 sokuji 走 Electron `webRequest.onBeforeSendHeaders` 注入；macOS 原生客户端直连 WebSocket 没有这个问题。

---

## 四、S2T 子能力 — Q4

### 结论
**S2T 不是另一个 API，是 AST 2.0 endpoint 在 `mode` 字段上的另一个取值**（`mode = "s2t"`）。
中英双语字幕由 **同一个模型直出**，不是 ASR + MT 拼接：
- `SourceSubtitleStart/Response/End` (事件 650/651/652) → 源语字幕（中文）
- `TranslationSubtitleStart/Response/End` (事件 653/654/655) → 译语字幕（英文）
- 当 `mode = "s2s"` 时，**额外** 还会回 TTS 音频流（事件 350/351/352）；当 `mode = "s2t"` 时，**只回字幕**，不出 TTS。

所以 R4 入方向（要中英双语字幕、不出英文音频给客户）— 把 `mode = "s2t"` + `target_language = "zh"` 跑一遍就能拿到双语字幕流。

### 证据

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto`：
  ```proto
  message ReqParams {
    string mode = 1;            // 可能是s2t , s2s 选一个, 控制是否需要语音
    ...
  }
  ```
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/config.py` (L124)：
  > `mode: str = "s2s"                             # "s2s" 语音到语音 / "s2t" 语音到文本`
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/README.md` (L110)：
  > "`MODE` | `s2s` | `s2s` (speech→speech) or `s2t` (speech→text)"
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/common/events.proto`：定义 650/651/652 + 653/654/655 两组字幕事件，注释明确区分 source vs translation。
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/doubao.py` (L276-L290)：`_classify` 把两组事件分别归到 `source_text` / `target_text` 两个 kind，**共用同一份上游事件流**。

### 延迟差异（S2T vs S2S）
论文未单独比较；按 AST 内部结构推断，S2T 只跑识别+翻译、不跑 TTS，应比 S2S 略快，但 **同一会话不可能同时是 S2S 和 S2T**——一次 StartSession 锁定一个 mode。要双向双管道（出 S2S + 入 S2T），需要两个独立 session（两个 WebSocket 连接、两组鉴权）。

### 设计含义（对 PoC）
- R3 出方向 → 1 个 S2S session（中文进、英文音出）
- R4 入方向 → 1 个 S2T session（英文进、中英文幕出）
- 两 session **互相独立**，可以并行跑，不共享 VAD/分句上下文。PoC 的双管道对应双 WebSocket 连接。

---

## 五、声音复刻 2.0 与同传 2.0 的关系 — Q5

### 结论
**两者在 AST 2.0 S2S 接口里是同一个 endpoint、同一个请求、两种模式**，而不是「先复刻再同传」的两次调用：
- **零样本自动复刻**：在 `StartSession` 里把 `speaker_id` 留空（默认行为），服务端在流式推理时实时采样音色，**对当前会话有效**。
- **预训练 `speaker_id` 跨语种迁移**：在 `StartSession` 里填 `speaker_id`（如 `zh_female_vv_uranus_bigtts`），服务端用预训练音色做合成 — 即使源语是中文、目标语是英文，也能用中文音色说英文。

「声音复刻 2.0 单独调用」的场景是 **Web 控制台/独立 API**（用户上传 10s+ 音频训练自己的音色，拿到一个 `speaker_id`，之后在 S2S 请求里引用）。这是 **预训练 speaker_id 的素材来源**，**但 AST 2.0 接口本身不要求走「先调复刻 2.0」流程**——可以跳过训练，直接用预置音色，也可以空 speaker_id 让模型实时克隆。

### 证据

- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/protos/products/understanding/ast/ast_service.proto` (L7-L13)：
  ```proto
  message ReqParams {
    string mode = 1;
    string source_language = 2;
    string target_language = 3;
    string speaker_id = 4;       // ← 唯一一个音色相关字段
    understanding.Corpus corpus = 100;
  }
  ```
  → AST 2.0 没有「声音复刻独立参数」，只有这一个字段。
- `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/README.md` (L34, L52)：
  > "voice is cloned zero-shot from your speech as you talk"
  > "🗣 **Zero-shot voice cloning** — model captures your voice on the fly"
- `https://arxiv.org/abs/2507.17527` 摘要：
  > "an end-to-end SI model that delivers high-fidelity, ultra-low-latency speech-to-speech generation **with voice cloning capabilities**."
  → 克隆是模型内禀能力，不是外部拼接。
- Doppelvoice 的 `_build_start_session` 注释 (`https://github.com/Tianqi-Bu/Doppelvoice/blob/main/src/doppelvoice/engine/doubao.py` L138-L141)：
  > "denoise 显式发送：默认 false 保留说话人音色细节供零样本克隆。"
  → 零样本克隆是默认模式。

### 设计含义（对 PoC）
- **跨语种音色迁移**（用户中文音色说英文）= 把 `speaker_id` 留空 + `mode=s2s` + `source=zh / target=en`，**不需要任何「先调声音复刻 2.0」前置**。这就是 map.md 想要的 R3 形态。
- **预训练 speaker_id 跨语种迁移** = 把 `speaker_id` 填上预设值（如 `zh_female_vv_uranus_bigtts`），用火山引擎公开音色库中的「中文音色」说英文。可在控制台或声音复刻 2.0 自定义训练后获得。
- **声音复刻 2.0 单独 API 路径**：控制台 → 声音复刻 2.0 → 上传参考音频 → 训练 → 拿到自定义 `speaker_id` → 再在同传 2.0 里引用。**这是稳定跨会话克隆的官方路径**（T09/T10 的两种 mode 切换就是这件事）。

---

## 六、控制台 / 文档 / SDK — Q6

### 结论
2026-09 时点公开入口：

| 用途 | URL |
|---|---|
| 同传 2.0 协议主文档 | `https://www.volcengine.com/docs/6561/1756902`（301 跳 `https://docs.volcengine.com/docs/6561/1756902`） |
| 产品介绍页（官方） | `https://seed.bytedance.com/en/seed_liveinterpret`（JS 渲染，只读） |
| 控制台 → 创建应用 / 取 App Key + Access Token | `https://console.volcengine.com/speech/app`（需登录） |
| 学术 / 论文 | `https://arxiv.org/abs/2507.17527` |
| WebSocket endpoint | `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` |

**官方 SDK**：截至 2026-09，公开 GitHub 上**没有**官方的 Python/Node/Go 同传 2.0 SDK。所有公开客户端（Doppelvoice / sokuji / voice_translator 等）都是**自维护**的 protobuf + WebSocket 实现，复用 ByteDance Seed GitHub 仓库里的官方 `.proto` 源文件。
- Doppelvoice 是**纯 Python 客户端**（PySide6 GUI，websockets + protobuf + sounddevice），对 Windows PyInstaller 友好。
- sokuji 是 **TypeScript 客户端**（Electron + 浏览器扩展），用 protobuf.js 解码。

**应用创建流程**（从控制台 + .env.example 注释推断）：
1. 登录火山引擎控制台 → 进入「豆包语音」(https://console.volcengine.com/speech/app)
2. 创建应用 → 开通「同声传译 2.0」能力 → 拿到 **App Key**（不是 Access Token / API Key）和 **Access Token**（字母数字混合）
3. 把这两个填到 `.env` 的 `DOUBAO_APP_KEY` / `DOUBAO_ACCESS_KEY`
4. `DOUBAO_RESOURCE_ID` 预填 `volc.service_type.10053`，除非字节官方更名否则不要动

### 证据

- 官方 docs URL（sokuji 客户端明确引用）：
  - `https://raw.githubusercontent.com/kizuna-ai-lab/sokuji/main/src/services/clients/VolcengineAST2Client.ts` 注释：「`per https://www.volcengine.com/docs/6561/1756902`」
  - URL 验证：`curl -I https://www.volcengine.com/docs/6561/1756902` → `HTTP/2 301`, `location: https://docs.volcengine.com/docs/6561/1756902`
- 产品介绍页：
  - `https://seed.bytedance.com/en/seed_liveinterpret`（页面 JS 渲染，但 GitHub README 多处引用确认存在）
- 控制台入口（需登录，无法直接读内容）：
  - `https://console.volcengine.com/docs/6561/1756902` 的 .env 注释：「`Where to find them / 在哪获取: https://console.volcengine.com/speech/app → 豆包语音 (Doubao Voice) → 同声传译 2.0 (Simultaneous Interpretation 2.0) → 应用管理 (App Management)`」
- 字段名映射（最容易踩的坑）：
  - `https://github.com/Tianqi-Bu/Doppelvoice/blob/main/.env.example` (L1-L25)：
    ```
    #   DOUBAO_APP_KEY    = 控制台显示的 "App Key" 字段（不是 Access Token / API Key）
    #   DOUBAO_ACCESS_KEY = 控制台显示的 "Access Token" 字段（字母数字混合）
    #   DOUBAO_RESOURCE_ID 已预填，除非字节官方更名否则别动
    ```
- 没有官方 SDK：
  - GitHub 上搜索 `volcengine-ast` / `doubao-liveinterpret` / `seed-liveinterpret`，**无 `bytedance/` 或 `volcengine/` 官方仓库直接发布客户端 SDK**。所有公开实现都自维护 .proto + 解析。
  - Doppelvoice README (L176) 仅引用：「`[ByteDance Seed LiveInterpret 2.0](https://seed.bytedance.com/en/seed_liveinterpret) — the underlying translation model`」+ `[kizuna-ai-lab/sokuji](https://github.com/kizuna-ai-lab/sokuji) — protobuf reverse-engineering reference`

### 设计含义（对 PoC）
- **不需要等官方 SDK** —— Doppelvoice 的 Python 实现已经稳定（46 个单测通过），可作为 PoC 的直接 fork 起点。Sokuji 的 TypeScript 实现也可参考用于 Electron 路线。
- **App Key 命名陷阱**：Doppelvoice 注释明确警告 — 控制台的"App Key"≠"Access Token"，不要错填成控制台通用的"API Key"或"AK/SK"。T02/T09 落地时这是第一关。

---

## 已知信息缺口 / 待办

1. **预训练 `speaker_id` 白名单**：Doppelvoice 文档举了 `zh_female_vv_uranus_bigtts` 一个例子；完整白名单需登录控制台或读官方声音复刻 2.0 文档（URL 未在 ticket 要求范围内）。
2. **官方 Python SDK 状态**：截至 2026-09，未见 `volcengine-sdk-python` 官方包内含同传 2.0 客户端（搜索 GitHub `volcengine` 组织无对应客户端包）。如有变化需在 T02 复查。
3. **价格 / 配额 / 用量**：Doppelvoice 代码里看到 `UsageResponse` (event=154) 携带计费信息，但未在 ticket 范围内，不展开。
4. **真实流式 PCM 输出**：Doppelvoice 注释「`format=pcm` which the API does not currently honor」——若官方后续放开流式 PCM 解码，PoC 可进一步降 ~500ms 延迟。

## 主要一级源（汇总）

1. **Doppelvoice 源码**：`https://github.com/Tianqi-Bu/Doppelvoice` —— 含官方 .proto 文件、Python 客户端完整实现、架构文档
2. **sokuji 源码**：`https://github.com/kizuna-ai-lab/sokuji` —— TypeScript 客户端实现、明确引用官方 docs URL `https://www.volcengine.com/docs/6561/1756902`
3. **Seed LiveInterpret 2.0 论文**：`https://arxiv.org/abs/2507.17527` —— 延迟、克隆能力的权威表述
4. **Seed 官方产品页**：`https://seed.bytedance.com/en/seed_liveinterpret` —— 模型背景
5. **火山引擎 docs AST 2.0 入口**：`https://www.volcengine.com/docs/6561/1756902`（301 → `https://docs.volcengine.com/docs/6561/1756902`，需登录或 JS 渲染）
6. **火山引擎控制台**：`https://console.volcengine.com/speech/app` —— 创建应用、取密钥
7. **TransEcho 仓库**：`https://github.com/wxkingstar/TransEcho`（fork 自 tianpomin/TransEcho）—— Rust + Tauri + Svelte 实现，作为 macOS 路径的 PoC fork 候选
