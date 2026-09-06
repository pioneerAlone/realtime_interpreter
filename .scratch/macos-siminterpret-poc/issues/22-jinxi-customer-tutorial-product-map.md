# 金喜客户专属教程 · 产品 map 抓取

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户分享金喜作者的客户专属教程 wiki（`U2hLwLP7AiXSPUkBaNXcIlNynab`，"别人产品的一个 map"），要求通过 computer-use 在已登录 Chrome 中抓取，作为对标参考。

调研问题：
1. 三模式（标准云端/轻量云端/轻量本地）的技术分层与平台/显卡/音色差异
2. 延迟 FAQ 的口径与数字（1.3s vs 市面 3s）+ VPN 直连降延迟的含义
3. 原声直出 / 音色训练 / 术语库的产品定义
4. macOS 安装链（Homebrew + BlackHole 2ch + VB-CABLE + 未授权 DMG）
5. 与 T15/T20/T21 的互锁与修正

## Answer

通过 orca computer-use（hash 导航 + PageDown 翻页）完整抓取。关键结论：

- **三模式技术分层**：标准云端 = 零样本实时克隆（mac+win，最贵）；轻量云端 = 训练音色两卡槽（级联栈，混合识别方案 A/B）；轻量本地 = 参考音频实时克隆（仅 Win + RTX 3060 12GB+，30+ 语言）——三档分别印证 T15/T20 的反推
- **延迟口径**：云端实测首音 1.3s vs 市面普遍 3s；VPN 会加延迟，官方解法 = 域名直连白名单 → 网络路径是延迟一等公民
- **原声直出**：双向 runtime 可切换 bypass（我→对方不翻译直传 / 对方→我听原声+看字幕）
- **音色训练**：标准=零样本实时；轻量云=预训练 slot×2；本地=参考音频 prompt 实时
- **术语库** = 金喜自认核心差异化；实现入口 = Doubao `ReqParams.corpus`（T18 已发现）
- **macOS 安装** = 标准 brew BlackHole 2ch + VB-CABLE + 允许未授权 DMG（修正 T15「定制版」猜测；我们的 DMG 签名+公证 = 体验差异化）

Findings 详 → [research/22](.scratch/macos-siminterpret-poc/research/22-jinxi-customer-tutorial-product-map.md)

## Comments

<!-- conversation history -->