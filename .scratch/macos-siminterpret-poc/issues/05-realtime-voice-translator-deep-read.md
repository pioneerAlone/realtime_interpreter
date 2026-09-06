# realtime-voice-translator 仓库深读（防回声架构）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

PDF §7 标 `ricardobing/realtime-voice-translator` 为「**必读**」：「B1 总线隔离防回声、双向 WebSocket、完整路由矩阵」。技术栈是 Gemini Live + Voicemeeter Banana + VB-Cable（Windows）。本 PoC 虽在 macOS 上做，但"防回声思想"是平台无关的，必须读透：

1. **B1 总线隔离是什么**：Voicemeeter Banana 的 B1 总线具体是什么？翻译输出只入 B1、B1 不进系统回采总线——这在 Voicemeeter 的 routing 矩阵里是怎么连的？
2. **双向 WebSocket 流**：Gemini Live 的双向流协议细节？per-turn 还是 continuous？客户端如何处理 server-initiated 打断？
3. **完整路由矩阵**：从"用户真实麦克风" → "翻译模型" → "虚拟麦克风" → "会议软件输入" → "会议软件播放" → "系统回采" → "翻译模型输入" 这一圈，画出 Voicemeeter 的 routing 拓扑，标出每条边的延迟贡献。
4. **防回声的具体代码**：怎么确保"用户麦克风不会采到翻译输出"？靠物理隔离（Voicemeeter 不路由）还是软件层滤波？会议软件端有没有特别配置？
5. **macOS 上的对应方案**：Voicemeeter Banana 是 Windows-only。BlackHole + Multi-Output Device 能否实现等价的总线隔离？还是要靠 Process Tap (macOS 14+) / ScreenCaptureKit 做"只回采指定应用的声音"？
6. **README / docs**：是否有架构图？是否有"为什么这样设计"的说明（不是只给"怎么配"）？
7. **issue 区**：是否有用户报告"反馈环 / 自己翻译自己"的真实案例？典型 workaround？
8. **代码许可证**：能否复用其 B1 隔离设计思想（直接 copy 代码也行）？

最终交付：「B1 总线隔离原理 + 拓扑图（用 ASCII 画也行）」+ 「macOS 对应方案候选清单（不是决策，是选项）」+ 「关键代码片段摘录」。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/05-realtime-voice-translator-deep-read.md`

Voicemeeter B1 总线隔离 (物理路由切断反馈环, 无 AEC 代码): 双独立 Gemini Live WebSocket session (协议层限制 `target_language_code` 单值), VAIO→{A1,B1}/mic 只→A1 不→B1 的矩阵拓扑, `echo_target_language=True` 防止服务端回放源语言; license badge 声称 MIT 但仓库**无 LICENSE 文件** (GitHub API `license: None`), 思想/拓扑可自由复用, 代码勿直接 copy.

macOS B1 思想候选对应方案 (not a decision, just candidates for T06):
1. BlackHole 2ch + Multi-Output Device (R3=BlackHole 虚拟 mic; R4=Multi-Output 把系统声音同时送内置扬声器+BlackHole)
2. BlackHole + ScreenCaptureKit `excludesCurrentProcessAudio=true` (R3=BlackHole; R4=SCC 抓音频, API 层排除自家进程)
3. BlackHole + Process Tap `AudioHardwareCreateProcessTap` (R3=BlackHole; R4=Tap + `CATapMuteBehavior.Muted` 物理切断)
4. Aggregate Device (BlackHole + Process Tap 复合) — 会议软件对 aggregate 枚举支持差异大, 不推荐 PoC
5. 单 BlackHole + 系统手动路由 (最简但 UX 差)

## Comments

<!-- conversation history -->
