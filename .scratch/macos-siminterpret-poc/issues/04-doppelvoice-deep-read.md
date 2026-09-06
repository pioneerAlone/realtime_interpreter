# Doppelvoice 仓库深读

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

PDF §7 列出 `TianqBu/Doppelvoice` 为「几乎就是完整需求：中文→英文 + 你的音色，看音色克隆接入方式」。本仓库不直接 fork，但作为「音色克隆接入方式」的参考必须读透：

1. **音色克隆的代码接入点**：0 样本自动复刻（同传 2.0 内置）在代码里如何触发？鉴权 / 参数如何传？是否需要先调一次声音复刻 2.0 拿到 speaker_id？
2. **跨语种音色迁移（中文音色说英文）**：Doppelvoice 的具体实现？声音复刻 2.0 训练的 speaker_id 是中文的还是跨语种的？跨语种效果（"中文口音残留"程度）在文档 / issue 区是否有讨论？
3. **9 语言支持架构**：怎么做的？per-language 配置？语言切换的 UX？
4. **错误处理 / 降级**：音色克隆失败 / 超时 / 网络抖动时，Doppelvoice 走什么回退路径（用默认 AI 音色？跳过克隆？）？
5. **与豆包 Seed LiveInterpret 2.0 的关系**：是直接调同传 2.0，还是用了豆包 Seed 系列的别的能力？API 调用差异？
6. **README / docs**：官方 README 是否说明了"如何在 Teams/Zoom 用"、是否提供了"会议软件麦克风指向哪个虚拟设备"的截图 / 步骤？
7. **issue 区与 fork**：是否有用户报告"中文音色说英文有口音"、"跨会话音色漂"等问题？典型 workaround？
8. **代码许可证**：MIT / Apache / GPL？能否作为本 PoC 的参考代码片段直接 copy？

最终交付：「音色克隆接入的关键代码片段摘录」+ 「跨语种音色迁移已知问题清单」+ 「与 TransEcho 风格差异对照表」。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/04-doppelvoice-deep-read.md`

豆包同传 2.0 WebSocket 内置 0 样本克隆（`speaker_id=""` + `denoise=false` 触发），完全不调声音复刻 2.0 单独 API；9 语言走 `zhen` 互锁下拉；issue/PR 区只有 1 条（#1 soundfile dep），CHANGELOG 自承「重连后零样本音色突变」已知问题；MIT 许可可直接 copy 须保留版权声明。

Key cross-language voice cloning notes:
- 0 样本克隆是同传 2.0 一根 WebSocket 流的内置能力，没有任何独立的「声音复刻 2.0」HTTP 调用（`grep tts|bigtts|voice_clone` 在 `src/` 下零命中）。
- StartSession 时 `req.request.speaker_id = ""`（空串）+ `req.denoise = false`（默认）是触发零样本克隆的全部条件；GUI 还暴露了「speaker_id 实验性填写」旁路，但官方不推荐。
- 跨语种音色迁移是「模型内部负责」，客户端代码无任何 special path；不需要先调声音复刻 2.0 训练 speaker_id。
- 「中文口音残留」「跨会话音色漂」: Doppelvoice 作者自承「重连即新会话、零样本音色重新采样、长会话音色会突变」(CHANGELOG v0.2.2, ARCHITECTURE.md known limits)；公开 API 表达性上限低于火山控制台 demo（控制台走 BFF 端点带额外韵律），被列为 hard ceiling。
- 9 语言 = 客户端一对字符串 (`zh/en/ja/id/es/pt/de/fr/zhen`)，`zhen` 是中英自动互译（源/目标都填 zhen）；切换语言靠两个 QComboBox + `zhen` 互锁 UX，不做 hot-swap。
- 错误处理三层：致命错误（鉴权/参数/格式）直接退出；瞬时白名单 (11301/11303/21100/21200/21201/21300/21701/29900) 走指数退避 1→2→4→…→30s；**没有任何「降级到默认 AI 音色」回退路径**——因为克隆没有独立子请求。
- 仅调豆包同传 2.0 (`volc.service_type.10053`) 一根 WebSocket，不调豆包 Seed 系列其他能力（无 HTTP REST、无独立 TTS/voice-train endpoint）。
- README + SETUP.md 给 Windows+VB-Cable 的会议 app 接入步骤（Zoom/Teams/腾讯会议/飞书/Meet/OBS），把 "CABLE Output" 替换为 "BlackHole 2ch" 即适用于 macOS PoC。
- 仓库 2026-04-25 创建、stars=3、issue 区只有 PR #1 (soundfile dep)；无用户反馈中文口音/音色漂问题——所以这些「已知问题」都是 Doppelvoice 作者自己在 CHANGELOG + 文档里披露的。
- 许可证：MIT（LICENSE，Copyright 2026 Doppelvoice contributors）；可直接 copy Doppelvoice 代码片段到 PoC，**唯一义务是保留版权声明 + MIT 全文**；proto schema 顶部有 ByteDance 版权头需一并保留。

## Comments

<!-- conversation history -->
