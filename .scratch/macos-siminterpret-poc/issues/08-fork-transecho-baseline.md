# Fork TransEcho + 装依赖 + 跑通 baseline

Labels: wayfinder:task

Status: open
Type: task
Blocked by: 03

## Question

完成 PoC 代码仓库的本地初始化（**不接 API，只跑 baseline**）：

1. **Fork TransEcho** 到本机仓库组织（如 `FeatherHunter/TransEcho` 或用户偏好）：
   - GitHub 上点击 Fork（如果用户 GitHub 账号未定，先问）
   - clone 到本地 `.scratch/macos-siminterpret-poc/code/TransEcho/`
   - 加 upstream remote 指向 `tianpomin/TransEcho`（便于后续 sync 修复）
2. **依赖安装**：
   - 按 TransEcho README 装语言运行时（Swift / Node / Python / Electron，看实际）
   - 装 OS 级依赖（如有）
   - 装 audio 相关的系统扩展 / frameworks
3. **跑通 baseline（不接 API）**：
   - 不配 Volcengine API key，先跑 TransEcho 自带的 demo / dev mode
   - 验证：能在本机启动、UI/CLI 能起来、音频采集 / 输出基础链路工作
   - **预期会失败**：没 API key 时翻译调用会报错，但音频采集 / 输出模块应该工作——这是 baseline 的最小验证
4. **代码定位**（基于 T03 的发现）：
   - 标注「音频采集」/「翻译调用」/「虚拟麦克风输出」三段代码的位置
   - 标注「音量控制」/「错误处理」/「日志」的位置（PoC 阶段可能借用）
5. **Git 工作流**：
   - 建 `poc` 分支（不是 main / master）
   - 后续所有 PoC 改动都在这个分支
   - commit 规范：「PoC: <一句话描述>」
6. **依赖 audit**：
   - TransEcho 的依赖列表有没有已废弃的库？license 是否兼容？
   - 是否需要新增本 PoC 必备的依赖（如 CLI 参数解析、JSON 日志、speaker_id 训练 CLI）？

完成后输出：「仓库地址 + 本地路径 + baseline 跑通截图（或日志片段）+ 关键文件路径清单」。

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
