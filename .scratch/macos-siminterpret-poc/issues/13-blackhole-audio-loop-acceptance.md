# BlackHole 音频环路验收（CLI PoC）

Labels: wayfinder:task

Status: open
Type: task
Blocked by: 10, 12

## Question

跑 PoC 最小链路 CLI，**端到端验证 R3 出方向**（不接会议软件，只验证 BlackHole 输出）：

**验收步骤**：
1. **准备输入**：录 30 秒中文朗读（口播"今天我们来讨论一下 XX 项目"这类自然句子）
2. **启动 CLI**（伪命令）：
   ```
   poc --input=mic \
       --output=blackhole \
       --clone-mode=<T10 决策结果> \
       --speaker-id=<如果有> \
       --subtitle-format=<T11 决策结果>
   ```
3. **验证 BlackHole 输出**：
   - 用 Audio MIDI Setup 或 QuickTime Player 的"新建音频录制"选 BlackHole 作为输入
   - 录制 30 秒（与输入对齐）
   - 播回录制结果，听：
     - 是否是英文
     - 是否像用户自己的音色（0 样本自动复刻 / 预训练 speaker_id 都应该至少"沾边"）
     - 音质是否清晰（无破音 / 卡顿 / 截断）
4. **延迟测量**：
   - 在中文朗读某句末尾拍一下手（音频峰值）→ BlackHole 输出端录到拍手 + 翻译结束的时间差
   - 重复 5 次，取中位数
   - 写入「实测延迟 = X 秒（vs PDF §3 口径 3 秒）」
5. **成本测量**：
   - 跑 30 秒 → 看账户扣费
   - 折算成「每分钟会议成本」「每小时会议成本」
   - 写入「实测成本 = X 元/分钟」
6. **失败模式记录**：
   - 如果链路不通，记录第一处失败 + 报错日志 → 可能需要新开 follow-up 票

**deliverable**：
- 「R3 出方向 BlackHole 验收通过/失败」+ 「实测延迟数字」+ 「实测成本数字」+ 「音色克隆质量主观评价（用户自己的耳朵）」

**前置依赖**：
- T10（音色复刻模式已定）
- T12（总线隔离 PoC 已选定拓扑）

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->

## Acceptance checklist (resolution 时一并填)

- [ ] 30 秒中文朗读输入
- [ ] BlackHole 录制到 30 秒英文输出
- [ ] 输出确实是英文
- [ ] 音色像用户自己（主观评价）
- [ ] 音质清晰无破音
- [ ] 延迟中位数记录（X 秒）
- [ ] 成本折算记录（X 元/分钟）
- [ ] 失败模式（如有）记录
