# 音色复刻模式选型（CLI 双模式 vs 单模式）

Labels: wayfinder:grilling

Status: open
Type: grilling
Blocked by: 01

## Question

PoC 阶段音色复刻用哪个模式？需要在用户决策后再实现（不是代码票，是决策票）：

**选项对比**：

| 维度 | A. 仅 0 样本自动复刻 | B. 仅预训练 speaker_id | C. 双模式 + CLI flag 切换 |
|---|---|---|---|
| 启动步骤 | 0（说话时实时采样） | 录 10s+ 中文样本 + 等训练完成（可能 1-5 分钟） | 看选哪个 |
| 跨会话音色稳定性 | 可能漂（取决于模型） | 稳定（同一 speaker_id 多次复用） | 看选哪个 |
| 首次启动延迟 | 略高（实时采样需多等几秒） | 训练完成后调用 S2S 时无额外延迟 | 看选哪个 |
| 调试体验 | 简单，无需先录 | 调试时每次换音色要重训 | 多一个参数 |
| PoC 复杂度 | 最低 | 中 | 最高（多一个 CLI flag + 训练子命令） |
| 适合谁 | "先看效果" / 一次性场景 | "正式会议" / 长期使用 | "我都想要" |

**待解决的子问题**：
1. 声音复刻 2.0 训练 speaker_id 通常需要多少样本（10s? 30s? 1 分钟？）？纯中文还是中英混合？
2. 训练完成的 speaker_id 跨平台 / 跨账号 / 跨设备复用性如何？（同账号不同 Mac 能否复用？）
3. 0 样本自动复刻的真实稳定性（开 30 分钟会不会音色漂？issue 区有没有 user 反馈？基于 T04）
4. PoC CLI 的 flag 设计：比如 `--clone-mode=zero-shot|speaker-id` + `--speaker-id=<id>` + `--train-speaker-id=<wav-path>`？

**用户偏好未知**：
- 你预期 PoC 用完会「扔掉」还是「长期用」？
- 你接受 PoC 启动前"先录 10s 中文"这个步骤吗？
- 你愿意为 PoC 多写一个训练子命令（哪怕简单）吗？

决策后输出：「模式选 X + reasoning + 涉及的代码改动清单」。

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
