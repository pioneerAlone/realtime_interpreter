# Volcengine 豆包同传 2.0 S2S API 与 speaker_id 支持现状

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

火山引擎「豆包同传 2.0」（Doubao LiveInterpret 2.0）在 2026-09 时点的 S2S（speech-to-speech）流式 API 能力现状：

1. **speaker_id 是否原生支持**：S2S 流式接口是否支持指定预训练 `speaker_id`，让合成英文直接用预设音色？还是仅 `StartVoiceChat` 链路支持？两种模式（"实时音色复刻" 0 样本 vs "预训练 speaker_id" 跨语种迁移）在 API 层如何选、能否并存？
2. **端到端延迟口径**：PDF §3 说官方口径约 3s——这是中文→英文单向、还是含 VAD 起音等待、还是含 WebSocket 网络往返？实测数字（豆包官方 demo / 第三方 benchmark）通常在哪个区间？
3. **流式协议**：WebSocket 还是 gRPC？鉴权方式（API key 在 header / query？子账号 IAM？）？流式分片粒度（per-utterance / per-sentence / per-chunk）？断句策略可调项？VAD 灵敏度是客户端还是服务端控制？
4. **S2T 子能力**：R4 入方向用同传 2.0 的 S2T（speech-to-text）还是另用 ASR 服务？中英双语字幕是同传模型直出还是 ASR+MT 拼接？延迟差异？
5. **声音复刻 2.0 与同传 2.0 的关系**：是两个独立 API（先调复刻 2.0 拿到 speaker_id、再喂同传 2.0），还是同传 2.0 内置两种模式？跨语种音色迁移（"中文音色说英文"）是否限定走声音复刻 2.0 + 单独调用？
6. **控制台 / 文档入口**：2026-09 时的官方文档 URL、应用创建流程、权限开通流程、SDK 列表（Python / Node / Go？）

不需要登录控制台查账密，只需要查公开技术文档 + 第三方对比评测。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/01-volcengine-api-capabilities.md`

S2S = `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` WebSocket + 二进制 protobuf；speaker_id 同一字段切换零样本克隆（空）与预训练音色（填 `zh_female_*_bigtts` 等）；延迟论文实测 ~3s、本地 <500ms；S2T = `mode="s2t"` 同一 endpoint 另一取值，中英双语字幕由模型直出 650-655 事件；声音复刻 2.0 是「跨会话稳定音色」的预训练素材来源，非 S2S 前置；官方无 Python/Node SDK，全靠自维护 .proto 客户端（cite 7 primary sources）。

## Comments

<!-- conversation history -->
