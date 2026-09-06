# macOS 总线隔离 PoC（防回声最小实现）

Labels: wayfinder:prototype

Status: open
Type: prototype
Blocked by: 05, 06, 07, 08, 09

## Question

在 macOS 上搭最小链路，验证「自己翻译自己」的反馈环能被切断。来源：real time-voice-translator 的 B1 总线隔离思想（基于 T05），macOS 对应方案（基于 T06）：

**最小验证步骤**：
1. **不接翻译 API**：先用一段预录的中文 WAV 文件作为输入 + 一段预录的英文 WAV 作为"翻译输出"（模拟 S2S 返回）
2. **构建三种拓扑**（分别跑一遍，验证哪种不会反馈环）：
   - **拓扑 A**：中文 WAV → 物理扬声器播放 → 内置麦克风采集（模拟"用户说话"）→ BlackHole 输出"翻译" WAV → BlackHole 回采（如果开了回采）→ 翻译输入
   - **拓扑 B**：中文 WAV 直接送入"翻译输入"（跳过真实麦克风），翻译输出 → BlackHole 虚拟麦克风，但回采通道完全避开 BlackHole（只用 Multi-Output Device 的内置扬声器口接收）
   - **拓扑 C**：中文 WAV → BlackHole 输入口 → 翻译 → BlackHole 输出口；R4 回采走 ScreenCaptureKit（基于 T06 的混合方案），完全不经过 BlackHole 的回采总线
3. **每种拓扑的反馈环检测**：
   - 用 `osascript` 或类似工具监控翻译输入端是否出现了翻译输出端的内容（文本相同）
   - 如果出现 → 反馈环存在 → 该拓扑失败
   - 如果没出现 → 拓扑有效
4. **选定一个拓扑作为 PoC 实施方案**

**deliverable**：
- 「macOS 上 B1 隔离思想的等价实现」+ 「哪种 BlackHole 拓扑 + ScreenCaptureKit / Process Tap 组合能切断反馈」+ 「3 种拓扑的对比日志」+ 「最终选定的拓扑图」

**依赖**：
- T05（B1 思想读透）
- T06（macOS 路由选项对比）
- T07（BlackHole 已装）
- T08（TransEcho baseline 已跑通，能借用其音频模块）
- T09（API key 到位——但本票不用真实 API，用预录 WAV 模拟）

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
