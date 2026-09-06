# 申请火山引擎 API key + 创建应用 + 充值/试用

Labels: wayfinder:task

Status: open
Type: task
Blocked by: 02

## Question

完成火山引擎账号开通 + API key 创建 + 应用开通 + 充值/试用金，使 PoC 能发起第一次真实 S2S 调用：

1. **账号注册 + 实名**：
   - 注册路径（个人 vs 企业）—— 取决于用户身份（先确认）
   - 实名材料（身份证 / 营业执照 / 银行卡验证）
   - 实名审核时长（通常多久）
2. **创建应用**：
   - 在「语音技术」类目下创建应用，拿到 `APP_ID` + `APP_KEY` / `ACCESS_TOKEN`
   - 应用名（如 `macos-siminterpret-poc`）
3. **开通能力**：
   - 同传 2.0（S2S 流式）
   - 声音复刻 2.0（speaker_id 训练）
   - 实时语音识别 / 同传字幕（S2T）
4. **充值 / 试用金**：
   - 是否有免费试用（基于 T02 research 结果）？试用金能撑多久 PoC？
   - 是否必须先充值才能调用？最低充值金额？
   - 试用阶段的 QPS / 并发限制？
5. **第一次 S2S 调用冒烟**：
   - 用 cURL / Python / Node 写一个最小 client，发起一次 S2S 调用（中文短句 → 英文音频）
   - 验证 token 鉴权链路通
   - 验证流式音频能完整返回
6. **凭据管理**：
   - API key 不能 commit 进 git
   - 用环境变量 / `.env` 文件（加进 `.gitignore`）/ macOS Keychain 哪种？
7. **成本预估**：
   - 根据 T02 research 拿到的单价，计算"PoC 一小时会议大概花多少钱"
   - 给用户一个明确的"烧钱速度"参考

完成后输出：「账号邮箱（脱敏）+ 应用 ID + 能力开通截图 + 第一次 S2S 调用日志 + 成本估算」。

## Answer

<!-- populated on resolution -->

## Comments

<!-- conversation history -->
## Tasks checklist (在 resolution 时一并填)

- [ ] 账号注册完成
- [ ] 实名认证通过
- [ ] 应用创建并拿到 APP_ID + APP_KEY
- [ ] 同传 2.0 / 声音复刻 2.0 / 实时字幕权限开通
- [ ] 充值 / 试用金到账
- [ ] 第一次 S2S 调用冒烟通过
- [ ] 凭据管理方案落地（环境变量 / .env / Keychain）
- [ ] 成本估算数字记录
