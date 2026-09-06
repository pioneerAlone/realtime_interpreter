# 金喜双通道版功能架构反推（benchmark）

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

金喜同声传译双通道版（dachengzionly / 一人公司 OPC，¥49-4999，1.3s 首音延迟）是 2026 出现的商业闭源产品——用户的目标是做一个开源替代品。本票目标是从**公开资料**反推金喜的技术架构，作为我们设计的 benchmark。

公开资料来源（必须用 primary source，不是博客）：
- 飞书 wiki 主文档：https://my.feishu.cn/wiki/WBfDwbZ1Zioj0Akeptkchgngnfe
- 飞书 wiki 虚拟声卡原理文：https://my.feishu.cn/wiki/UkPHwiEc6i48BvkRepKcbKAUn7b（首页，菜单里有该链接）
- 作者 YouTube 频道：https://www.youtube.com/@dachengzionly/shorts
- 演示视频：「同传基础介绍.mp4」「mac电脑同传介绍-教程.mp4」「使用教程.mp4」「对外同传能力展示.mp4」「同传音色展示教程.mp4」（都在飞书 wiki 内有嵌入，链接可能需要登录）
- 百度网盘下载（mac/win 软件本体）：https://pan.baidu.com/s/1QDJ6XtKGpAmZogPV6Hbnfw?pwd=8888 — **不必下载**（逆向风险），但截图/简介可参考

要回答的问题：

1. **翻译引擎猜测**：金喜大概率用什么？Doubao 同传 2.0（0 样本克隆是 Doubao 招牌）？还是 Whisper + GPT + TTS 组合？还是有自研模型？依据是什么（公开 demo 的延迟 / 音色 / 准确率特征）？
2. **1.3s 首音延迟怎么做到的**：
   - 是端到端 S2S 单模型（同传 2.0 这类），还是 ASR+MT+TTS 分步串行？
   - 流式首音播放（不等完整句子就出第一段音频）？
   - 是否有本地推理组件（Whisper streaming 这种）？
   - 网络拓扑推测（多 CDN / 边缘节点 / 国内/国外分流）？
3. **双通道架构**：是同一个进程两个 WebSocket 还是两个独立进程？怎么避免两个通道的反馈（自己的 R3 输出不会进入 R4 输入）？
4. **音色克隆机制**：公开文档说「无需提前训练，开口即克隆」——这与 Doubao 同传 2.0 的 0 样本一致。是直接调 Doubao 还是自研 0 样本克隆？标准版 vs 旗舰版的克隆差异（旗舰版说"支持自定义任何音色"——这个"自定义"是不是预训练？）？
5. **macOS 集成**：作者说「虚拟声卡免费提供」「电脑带麦克风就能用」——金喜安装包里是不是自带一个定制版 BlackHole？还是用系统已有的 BlackHole？怎么做到"一装就用"？
6. **API 费用梯度**（9-12 / 2-3 / 0.7-1 元/小时）：
   - 标准云端（9-12）vs 旗舰云端（2-3）：差别是模型大小 / 服务级别？还是真的就是混合架构？
   - 旗舰本地（0.7-1）：本地跑了什么？Whisper 本地？TTS 本地？MT 本地？
7. **可借鉴的产品形态**（不限技术）：
   - 双声卡独立配置（用户可给通道 A / B 各选不同声卡）
   - 自定义词库（医疗 / 教育 / 专业名词）
   - 30+ 语言 TTS 免费送
   - 一账号通 Windows + macOS
   - 价格阶梯（测试卡 / 月卡 / 年卡 / 一次性）

不需要逆向工程金喜本身。重点是搞清楚"它能到什么数字 + 大概用什么方法"作为我们的对照目标。

## Answer

Findings: `.scratch/macos-siminterpret-poc/research/15-jinxi-architecture-reverse.md`

金喜不是自研同传；标准云端几乎确定 = **Doubao-同声传译 2.0 (S2S)** 的 WebSocket 二次封装；旗舰云端 = **级联 ASR+MT+轻量 TTS**；旗舰本地 = **云端 ASR+MT + 本地 TTS（CosyVoice/Piper/GPT-SoVITS 一类）**。1.3s 首音与官方 S2S 2.21s 首字延迟的差量靠本地 VAD 预热 + 协议缓冲 + OS 音频缓冲填补。macOS 自带"免费虚拟声卡"高概率是**定制打包的 BlackHole**（mirror device 天然适配双通道）。双通道 = 同进程两个独立 WebSocket，靠设备级隔离避免反馈。

Confidence-tagged key inferences (high/medium/low):
- HIGH: 标准云端模式 = Doubao-同声传译 2.0 S2S（0 样本复刻 + 2-3s 延迟 + 中英双向一一对应金喜宣传）
- HIGH: macOS 自带的"免费虚拟声卡" = 自定义打包的 BlackHole（开源 + 支持驱动名/Bundle ID/图标定制 + mirror device）
- HIGH: 双通道架构 = 同进程两个独立 WebSocket 会话 + 独立输入/输出虚拟声卡设备（macOS Multi-Output + Aggregate Device）
- HIGH: 旗舰本地模式 = 云端 ASR + 云端 MT + 本地 TTS（用户文档明示"本地版语音合成免费"）
- MEDIUM: 旗舰云端"混合架构" = 级联 ASR+MT+TTS 而非 S2S（费用 3-4× 低，"体验接近端到端"靠 LLM 级联 + 流式 VAD）
- MEDIUM: 本地 TTS 候选 = CosyVoice（阿里，0 样本好）/ Piper / GPT-SoVITS 之一，需 PoC 阶段实测
- MEDIUM: 网络拓扑 = 火山引擎 cn-beijing 区域（1.3s 这个数字需要 cn 直连 + WebSocket 长连接）
- LOW: 金喜客户端 UI 框架（推测 Electron / Tauri，但需百度网盘安装包静态分析确认；本票声明不做逆向）

Open questions for PoC validation:
1. Doubao-同声传译 2.0 S2S vs 自建级联（Whisper + GPT-4o + CosyVoice）的实际首音延迟对比，哪端更接近 1.3s？
2. macOS 上 Multi-Output Device + 独立 BlackHole 镜像设备是否足够做双通道反馈隔离，还是必须叠 WebRTC APM？
3. 本地 TTS 在 Apple Silicon 上能否跑通 30+ 语言（无 NVIDIA GPU 路线）？
4. Doubao-同声传译 2.0 实际 token 速率 vs 金喜宣称的 9-12 元/小时，是否能在 PoC 跑下来对齐成本目标？
5. "自定义任何音色"具体是录制参考音频 + 同传模式，还是本地 TTS prompt 工程？

## Comments

<!-- conversation history -->