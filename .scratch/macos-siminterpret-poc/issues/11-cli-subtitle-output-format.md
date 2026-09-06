# PoC CLI 输出格式决策（字幕渲染）

Labels: wayfinder:grilling

Status: open
Type: grilling
Blocked by: 03, 04

## Question

PoC 的 R4 入方向双语字幕输出到 stdout 时，格式怎么定？需要在用户决策后再实现（不是代码票，是决策票）：

**待选项**：

| 选项 | 形态 | 适合 | 不适合 |
|---|---|---|---|
| A. 单行追加 | `中: 你好 / EN: Hello\n` 一句接一句 | tail 实时看 / 重定向到文件 | 多句并发时混淆 |
| B. 双行中英对照（块） | `你好\nHello\n` 配对 | 终端阅读 | 不便做二次处理 |
| C. 时间戳 + JSON Lines | `{"t":1.2,"lang":"zh","text":"你好"}\n{"t":1.3,"lang":"en","text":"Hello"}\n` | 二次处理（前端渲染 / 字幕文件生成） | 终端阅读不直观 |
| D. 双流分文件 | stdout 给字幕，`subtitle.jsonl` 给二次处理 | 既要肉眼看又要机器消费 | 需要额外文件管理 |
| E. ANSI 颜色（区分中/英） | `\x1b[33m你好\x1b[0m / \x1b[36mHello\x1b[0m` | 终端阅读 | 重定向到文件时颜色码变噪音 |

**R3 出方向的"音频"输出不走 stdout**（走 BlackHole 虚拟麦克风），所以这一票只关心 R4 字幕的 stdout 格式。

**待解决的子问题**：
1. 中英双语是同传 2.0 直出（一调用同时返回 zh + en 两个文本流），还是要分别调 ASR + MT？
2. 时间戳精度：句级（每说一句话一个 ts）还是词级（每个词一个 ts，对齐时间用）？
3. 是否需要 `--quiet` / `--json-only` / `--human-readable` 等开关？
4. 字幕要不要支持「会话保存」——把整场会议的字幕落盘成 SRT/VTT 文件？
5. 与 T13 验收测试的接口：测试怎么"读"字幕做断言？

决策后输出：「格式选 X + CLI flag 列表 + 验收测试如何读取字幕」。

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
