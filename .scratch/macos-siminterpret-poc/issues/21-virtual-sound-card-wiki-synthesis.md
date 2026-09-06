# 大成子 ONLY · 虚拟声卡原理 wiki 内容抓取 + 合成

Labels: wayfinder:research

Status: resolved
Type: research
Blocked by:

## Question

用户分享了金喜作者本人写的"虚拟声卡原理"飞书 wiki（`N913wtQdfiRbC9k7wiEcMPC9n4d`），要求我读一下。Flybook wiki 需要登录才能看内容（curl 拿不到），需要通过 orca computer-use 在用户已打开的 Chrome 里读取。

调研问题（与 T05/T06 互锁 + 补充）：
1. wiki 完整内容结构是什么
2. 大成子版本的「虚拟声卡原理」大白话与 T05/T06 调研的关系
3. **是否补充了 T06 没覆盖的内容**（特别是反面教材 / 典型错误配置）
4. 是否影响 PoC ticket 的验收 checklist
5. R4 「只字幕不要声音合成」是否被作者明确支持

## Answer

通过 orca computer-use 抓取 Chrome 已登录 Chrome 打开的 wiki 内容，DOM accessibility tree 完整读取（324 elements + 截图）：

- **完整 5 段结构**（一二三四五）+ 1 用户评论问答
- **链路 A（我→对方）+ 链路 B（对方→我）独立双链路架构**与 T05/T06 一致
- **核心新增 · 3 个典型误区**（T06 调研未涵盖的反面教材）：
  1. 误区 1（死循环）：两个翻译输出用同一虚拟声卡 → 无限套娃 + 回声爆炸
  2. 误区 2（传原文）：会议软件麦克风选真实麦 → 未翻译原文传给会议
  3. 误区 3（串音）：对方翻译输出接虚拟声卡 → 串音给会议
- **新增 · R4 单字幕模式可行**（作者回复用户评论「可以，配置完全自由」）
- **新增 · 百度网盘安装包链接**（同作者的虚拟声卡工具集，可能含定制 BlackHole）

对 PoC 的影响：
- T12（macOS 总线隔离 PoC）+ T13（BlackHole 音频环路验收）+ T14（自开会议验收）应加入这 3 误区作为自检 checklist
- T10（音色克隆选型）可简化（已确认 R4 只字幕也可行，T10 只关心 R3 出方向克隆）
- T07 仍走标准 brew install blackhole-2ch 路径，wiki 安装包留作 v1+ "一键安装"备选

Findings 详 → [research/21](.scratch/macos-siminterpret-poc/research/21-virtual-sound-card-wiki-synthesis.md)

## Comments

<!-- conversation history -->