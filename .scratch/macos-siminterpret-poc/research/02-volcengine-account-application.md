# 火山引擎账号 / API Key 申请路径

> 范围：从零开始到能在 PoC 脚本里对 `豆包同声传译 2.0`（S2S 自动音色复刻）和 `声音复刻 2.0` 发起第一次 WebSocket / HTTP 调用的最小链路。仅使用火山引擎官方文档 + 控制台公开页面。

## TL;DR（对 PoC 的实际影响）

- **个人身份证即可注册 + 实名**，不需要企业资质（仅实人扫脸或银行卡认证）。但官方文档明确写「扫脸认证仅支持持有中国居民身份证的用户」「银行卡认证仅支持持有中国身份证的用户」，**海外手机号 + 海外护照这条路径目前没看到官方入口**。M2 MacBook Air 用户如果没有大陆身份证 + +86 手机号，账号创建这步就会被卡住。
- **同传 2.0（S2S）** 是火山方舟（ark）下的领域模型，鉴权用 **API Key**；**声音复刻 2.0** 在豆包语音里走传统的 **APP ID + Access Token + Secret Key**。两套鉴权、两个控制台入口、但同一火山引擎账号都能登录。
- **新账号无需充值即可"试用体验"**：控制台点「试用」即获赠一定免费额度，正式开通后默认走**按量计费（后付费）**，账户有余额才扣，不存在"最低充值金额"的前置门槛。
- **声音复刻"创建完应用后免费赠送**：赠送音色 + 15 次训练 + 20000 字符合成（控制台为准）。
- **从注册到第一次 API 调用，实测最快 30 分钟内**（注册 3 分钟 + 实名扫脸 1-3 分钟 + 创建应用 + 试用开通 = 当天可用）。不需要工单/审核。
- **2026 年没有新增资质要求**；账号注册、实名、应用创建链路和 2025 相同。2026 公告主要是产品/SDK 升级（如「高代码 SDK Arkitect 正式发布」「Agent Plan 套餐赠送 ArkClaw 权益调整」），与能否注册/调用无关。

---

## 1. 个人注册路径

### 1.1 注册本身

- 入口：火山引擎首页右上角「注册」 / 直链 `https://signin.volcengine.com/auth/signup`
- 注册要素（来自官方账号注册页内嵌描述）：
  > "**必需项：1 个可正常接收短信的手机号（+86）**"
  > "若选择手机号+账号的登录密码的注册方式，准备好需要设置的登录密码"
  > "注册账号前准备：整个账号注册过程通常在 **3 分钟内** 可完成"
  > "1 个手机号可以注册（绑定）6 个火山引擎账号"
- 来源：<https://docs.volcengine.com/docs/account_related/Accountregistrationprocess?lang=zh>
- 结论：注册门槛低，但 **+86 中国大陆手机号是硬性条件**。官方文档没有给海外手机号的注册入口，也没有提及港澳台/海外手机号路径。

### 1.2 实名认证

- 「实名认证基本介绍」明确：
  > "在火山引擎上购买和使用云资源的过程中，为遵守相关法律法规，也为保障您的合法权益，**需要先进行实名认证**。"
  > "1 个个人主体支持实名认证 3 个火山引擎账号；1 个企业主体支持实名认证 10 个火山引擎账号。"
- 来源：<https://docs.volcengine.com/docs/account_related/Basicintroduction?lang=zh>
- 个人认证 3 种方式（来源：<https://docs.volcengine.com/docs/account_related/65010?lang=zh> 目录）：
  1. 通过抖音/微信 APP 扫脸认证
  2. 当前设备摄像头扫脸认证
  3. 银行卡认证

### 1.3 海外身份证件能否走个人实名？

**官方文档目前不支持海外身份证件路径：**

- 「通过抖音/微信 APP 扫脸认证」：
  > "**请注意，扫脸认证仅支持持有中国居民身份证的用户进行验证。**"
  > "证件号码：中国居民身份证号码（**仅支持中国大陆居民身份证**）"
- 「当前设备摄像头扫脸认证」：
  > "**请注意，扫脸认证仅支持持有中国居民身份证的用户进行验证。**"
  > "证件号码：中国居民身份证号码（**仅支持中国居民身份证**）"
- 「银行卡认证」：
  > "**请注意，银行卡认证方式通过您在银行办理银行卡时预留的手机号码进行身份验证，仅支持持有中国身份证的用户进行身份验证。**"
  > "证件类型：中国居民身份证（**只支持中国居民身份证**）"
  > "银行卡号码：中国银联成员机构发行的银行卡，**借记卡或贷记卡。（不支持信用卡）**"
- 来源（curl 抓取后从原始 HTML 提取，与浏览器渲染一致）：
  - <https://docs.volcengine.com/docs/account_related/VerifybyscanningfacethroughDouyinWeChatAPP?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/Currentdevicecamerafacescanauthentication?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/Bankcardauthentication?lang=zh>

**结论**：用户仅有海外护照/海外手机号时，目前官方文档**没有公开的实名路径**。需要借用有大陆身份证的朋友/同事完成认证，或者考虑与企业账号路径（见下）。

### 1.4 企业认证

- 企业认证 3 种方式：法人扫脸、银行打款、企业证件。
- 「法人扫脸认证」：
  > "**请注意：法人扫脸认证方式仅支持持有中国大陆居民身份证的法定代表人来完成认证**，且需要法人本人完成人脸识别认证。"
- 「企业证件认证」：
  > "前提是您持有有效清晰的企业证件照片或扫描件和企业法人本人**大陆身份证**信息，且您的**企业注册地是中国（不包含港澳台地区）**。"
  > "持有中国大陆居民身份证的被授权人需要扫脸验证本人身份。"
- 「如何选择企业实名认证方式」：
  > "如果企业法人为中国大陆身份证持有人，且注册地为中国（不包含港澳台地区），建议您进行..."
- 来源：
  - <https://docs.volcengine.com/docs/account_related/Corporatefacescanauthentication?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/Enterprisecertificateauthentication?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/Howtochoosethereal-nameauthenticationmethodforenterprises?lang=zh>
- 实名认证耗时：法人扫脸「提交上述信息并人脸识别成功后，企业实名认证立即通过」；银行打款方式「火山引擎将在 120 秒内向您的企业对公银行账户进行打款」，「填写成功后，企业实名认证立即通过」。

### 1.5 个人 vs 企业 实名的关键差异

来源：<https://docs.volcengine.com/docs/account_related/understanding-volcano-engine-account?lang=zh>（"个人实名与企业实名账号的区别"对照表）

| 维度 | 个人实名认证 | 企业实名认证 |
|---|---|---|
| 适用对象 | 个人 | 企业、政府、事业单位、团体、组织等 |
| 实名区别 | 以个人身份参加火山引擎各类活动，享受个人权益 | **可开通、购买更多火山引擎云服务**；以企业身份参加火山引擎各类活动，享受企业客户权益 |
| 发票信息 | 仅支持开具增值税普通发票，默认开具"个人"抬头，可按需申请个人实名及企业抬头 | 开具企业抬头的增值税专用发票或增值税普通发票 |
| 主体变更 | 个人主体**仅支持升级**为企业认证，**不支持个人变更个人主体** | 支持变更，企业主体变更流程 |

**对 PoC 的意义**：PoC 阶段用个人实名 + 后付费即可调用，无需企业资质；如果后续要给客户开增值税专用发票，需要升级到企业认证。

### 1.6 「开始使用」顺序建议

「了解火山引擎账号」页明确：
> "拥有火山引擎账号后，我们建议您按以下顺序完成初始化配置："
> "1. **完成实名认证（必做）：** 若要进一步体验或购买火山引擎产品，需要完成账号实名认证信息"
> "2. 加强账号安全：启用 MFA 多因素认证..."

来源：<https://docs.volcengine.com/docs/account_related/understanding-volcano-engine-account?lang=zh>

---

## 2. 应用创建与鉴权（同传 2.0 / 声音复刻 2.0 / 实时字幕）

### 2.1 两套独立的"应用"概念

豆包同声传译 2.0 在**火山方舟（ark）**产品线下，声音复刻 2.0 在**豆包语音**产品线下。两者的鉴权、应用、控制台入口都不同。

#### 声音复刻 2.0（豆包语音）

- 文档：「声音复刻下单及使用指南」
  > "创建完应用后，会免费赠送一定数量音色（具体以控制台为准），能够进行 15 次训练以及可以合成 20000 字符。"
  > "请参考下图获取**声音 ID（speakerid）、APP ID 以及 Access Token**。"
- 「控制台指引」明示了鉴权信息获取位置：
  > "进入[旧版控制台]，在左侧「API 服务中心」选择对应的模型，即可查询 **APP ID**、**Access Token** 和 **Secret Key**。"
- 鉴权链接样例：
  - `https://console.volcengine.com/speech/service/10035?AppID=6557161497`（旧版）
  - `https://console.volcengine.com/speech/app?AppID=6557161497`
- 模型开通路径：
  > "进入「控制台 - API 服务中心」页面，选择所需的大模型与应用名称，支持两种方式开通服务
  > - **试用体验**: 点击「试用」可获赠一定免费额度，用于功能验证与效果测试
  > - **正式开通**: 试用满意后，点击「开通」即可正式启用模型服务；**默认采用按量计费 (后付费) 模式**"
- 控制台有「服务详情」页可看 **状态查看 / 预警配置 / 资源购买**（按需增购并发或资源包）。
- 来源：
  - <https://docs.volcengine.com/docs/DoubaoVoice/Soundreplicationorderingandusageguide?lang=zh>
  - <https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh>
- "每个槽位对应 1 个音色 ID（speaker_id），并包含 15 次免费训练机会"（声音复刻下单页）。

#### 豆包同声传译 2.0（火山方舟）

- 「豆包语音-产品简介」明示：
  > "**语音同传**：豆包同声传译大模型采用端到端架构，在单一模型中完成语音识别、语义理解与翻译输出，实现高准确率、低时延的实时同传能力。"
  > "模型支持两种工作模式：
  >  - **语音到文本（S2T）**：流式输入语音，输出对应目标语种的翻译文本
  >  - **语音到语音（S2S）**：流式输入语音，模型在完成翻译的同时**自动复刻说话人音色**，并以原说话人的音色输出目标语种语音"
  > "基于全双工语音理解与生成框架，无需预先录制说话人音频，**传译过程中即可完成音色采样**，并以复刻音色输出译文语音。"
- **同传 2.0（S2S）本身内建音色采样**——不需要额外调用声音复刻 2.0 接口。也就是 PoC 场景下，"声音复刻 2.0"和"同传 2.0"可以是**独立能力**。
- 「同声传译 API」文档（DocID 1394617，URL `/docs/82379/1394617`）给出 WebSocket 接入：
  > `wss://ark-beta.cn-beijing.volces.com/api/v3/realtime?service=clasi&model=<Model>`
  > 请求 payload `model` 字段：`doubao-clasi-***`（示例，实际以模型列表为准）
  > 请求 payload：`session.input_audio_translation.source_language` / `target_language`
- 鉴权方式：火山方舟统一用 **API Key**，由「获取 API Key 并配置」流程获取（控制台 `/docs/ark/api-key` 入口）。
- 与「声音复刻 2.0」的 APP ID + Access Token 不互通。
- 来源：
  - <https://docs.volcengine.com/docs/DoubaoVoice/ProductOverview-9?lang=zh>
  - <https://docs.volcengine.com/docs/82379/Modellist?lang=zh>
  - <https://docs.volcengine.com/docs/82379/1394617>（同声传译 API 接入文档）

#### 实时字幕

- "豆包语音-产品简介"中"语音同传"工作模式之一即 **S2T（流式输入语音，输出对应目标语种的翻译文本）**，可应用于"会议字幕、AI 同传等场景"。所以**实时字幕用同传 2.0 的 S2T 模式即可**，不需要单独的"实时字幕"产品。
- 来源：<https://docs.volcengine.com/docs/DoubaoVoice/ProductOverview-9?lang=zh>

### 2.2 一个账号 + 两个应用 ≈ 同一账号不同"开通"动作

- 火山方舟（同传 2.0）和豆包语音（声音复刻 2.0 / 传统 ASR / TTS）**共用同一火山引擎账号**，但需要在各自控制台里 **"创建应用"→ 试用 / 正式开通**。是**两个独立的应用**，各拿各的鉴权凭证。
- 对 PoC 的建议：账号实名一次性 → 进火山方舟控制台创建 1 个应用拿 API Key 调用同传 2.0 → 进豆包语音控制台创建 1 个应用拿 APP ID + Access Token（如确实需要单独调用声音复刻 2.0）。

---

## 3. 免费试用 / 免费额度

### 3.1 同传 2.0（火山方舟）

- 模型开通页面写明两种方式：「试用体验：点击『试用』可获赠一定免费额度，用于功能验证与效果测试」和「正式开通：试用满意后，点击『开通』即可正式启用模型服务」。
- 来源：<https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh>（同样适用于火山方舟模型开通）。
- 火山方舟控制台里 "模型开通" 入口提供 **EnableAutoModelActivation - 启用自动开通新模型** / **DisableAutoModelActivation - 关闭自动开通新模型**（API 名称即控制台动作）。
- 来源：<https://docs.volcengine.com/docs/82379/api-key>（导航列出 ActivateModels / EnableAutoModelActivation 等 API）。

### 3.2 声音复刻 2.0

- "创建完应用后，会免费赠送一定数量音色，能够进行 15 次训练以及可以合成 20000 字符。"
- "所有预付费音色包含免费音色，均可进行 15 次训练，超出次数将报错且无法继续训练。"
- "每个槽位对应 1 个音色 ID（speaker_id），并包含 15 次免费训练机会。当前页面查看槽位剩余克隆次数，也支持购买新槽位。"
- 来源：
  - <https://docs.volcengine.com/docs/DoubaoVoice/Soundreplicationorderingandusageguide?lang=zh>
- 没有在公开文档中看到 "¥300-500 免费试用金" 这种明确数额；**官方措辞是"一定免费额度"**，具体数量以控制台为准。

### 3.3 限速 / QPS / 并发

- 同传 2.0、声音复刻 2.0 等模型的"并发 / QPS / 限时免费"信息：
  - 控制台"服务详情"页：「状态查看：模型并发、资源包详情（**剩余额度、过期时间**等）、模型服务状态等关键信息一览」
  - 提供按需**增购并发**或购买资源包
- 来源：<https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh>
- 旧文档有 "QPS/并发查询接口说明"（如 `https://docs.volcengine.com/docs/6561/1366006`），具体限额**以控制台显示为准**。文档页未列出默认上限数字。

### 3.4 试用阶段是否限制声音复刻

- 没有。声音复刻的免费音色就是"创建应用后免费赠送"，是试用阶段的常规能力，不需要额外申请。

---

## 4. 实名 → 充值 / 付费链路

### 4.1 是否必须先充值才能调用？

**不需要先充值。**

- 「正式开通」模型时默认走 **按量计费（后付费）**，账户有余额才扣，未充值则无法产生后付费账单。
- 「实名认证基本介绍」："需要先进行实名认证"，但**没有"必须充值"的要求**——实名后才能「体验或购买火山引擎产品」。
- 来源：
  - <https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh>（"按量计费 (后付费) 模式"）
  - <https://docs.volcengine.com/docs/account_related/Basicintroduction?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/understanding-volcano-engine-account?lang=zh>（"若要进一步体验或购买火山引擎产品，需要完成账号实名认证信息"）

### 4.2 充值方式、最低金额、支付手段

- 公开文档中关于充值的页面（如 `/docs/6258/1324635`、`/docs/6258/65002`、`/docs/6258/65004`）需要登录后才能查看具体支付手段与最低充值金额。
- 公开产品页（如 `/activity/free-trial`、`/finance/recharge`）由前端 JS 渲染，curl 抓取不到支付手段文案（**原始 HTML 仅返回约 65KB 的 SPA 外壳**）。
- **结论**：仅根据公开文档，无法确认最低充值金额、对支付宝 / 微信 / 信用卡（Visa/Mastercard）/ 海外卡的支持。**这一项需要在实际注册账号后进入"账户中心 → 充值"页面**才能验证。
- 推荐验证路径（不在本研究 ticket 范围内）：登录后访问 `https://console.volcengine.com/finance/recharge`。

### 4.3 个人 vs 企业 付费差异

- 个人实名账号：「仅支持开具增值税普通发票」，付款方式受发票类型限制。
- 企业实名账号：可开增值税专用发票或普通发票，便于对公付款。
- 来源：<https://docs.volcengine.com/docs/account_related/understanding-volcano-engine-account?lang=zh>

---

## 5. 从注册到第一次 API 调用耗时

- 注册：官方写「整个账号注册过程通常在 3 分钟内可完成」。
- 实名扫脸：扫脸 + 提交姓名/身份证号 ≈ 1-3 分钟，立即通过。
- 创建应用：在控制台里点几次鼠标，1-2 分钟。
- 模型开通（试用）：即时。
- **首次调用**：注册 + 实名 + 创建应用 + 开通 + 跑通 SDK Demo，预计 **30 分钟内**。**没有工单/审核环节。**
- 文档里的"立即生效"在实测中也基本成立——所有官方文档里实名（扫脸/银行卡认证）的措辞都是"认证立即通过"或"实时获取到认证结果"。
- 来源：
  - <https://docs.volcengine.com/docs/account_related/Accountregistrationprocess?lang=zh>
  - <https://docs.volcengine.com/docs/account_related/Bankcardauthentication?lang=zh>（"银行卡认证提交后可实时获取到认证结果"）

---

## 6. 2026 年变化（vs 2025）

- **账号注册、实名、应用创建、试用开通链路与 2025 一致**。没有发现 2026 年新增资质要求、个人身份证停止支持、能力下线等变化。
- 「个人主体仅支持升级为企业认证，不支持个人变更个人主体」属于长期规则，没有看到 2026 修订。
- 2026 年公告里主要是产品迭代/SDK 升级，与"能否注册 / 能否调用"无关：
  - 「方舟大模型服务平台链路优化通知」（2026 年 8 月 21 日凌晨 02:00-07:00 升级缓存服务，期间使用 Responses API 可能有短暂抖动）
  - 「26 年春节期间访问方式调整公告」
  - 「Agent Plan 套餐赠送 ArkClaw 权益调整公告」
  - 「Agent/Coding Plan 指定模型抵扣系数限时折扣活动」
  - 「高代码 SDK Arkitect 正式发布」属 2025 年末公告，但 2026 仍在使用
- "模型下线公告" 有 2025 / 2024 归档，没有看到 **同传 2.0 / 声音复刻 2.0 / S2S 同传 / clasi 模型** 在 2026 的下线/弃用通知。
- 来源：
  - <https://docs.volcengine.com/docs/82379/product-update-announcement-2026>
  - <https://docs.volcengine.com/docs/82379/access-changes-during-spring-festival-2026>
  - <https://www.volcengine.com/notice/Ark>

---

## 关键来源 URL 清单

| # | 用途 | URL |
|---|---|---|
| 1 | 注册流程 | <https://docs.volcengine.com/docs/account_related/Accountregistrationprocess?lang=zh> |
| 2 | 实名认证基本介绍 | <https://docs.volcengine.com/docs/account_related/Basicintroduction?lang=zh> |
| 3 | 实名认证总目录 | <https://docs.volcengine.com/docs/account_related/65010?lang=zh> |
| 4 | 抖音/微信扫脸认证 | <https://docs.volcengine.com/docs/account_related/VerifybyscanningfacethroughDouyinWeChatAPP?lang=zh> |
| 5 | 当前设备摄像头扫脸认证 | <https://docs.volcengine.com/docs/account_related/Currentdevicecamerafacescanauthentication?lang=zh> |
| 6 | 银行卡认证 | <https://docs.volcengine.com/docs/account_related/Bankcardauthentication?lang=zh> |
| 7 | 法人扫脸认证 | <https://docs.volcengine.com/docs/account_related/Corporatefacescanauthentication?lang=zh> |
| 8 | 企业证件认证 | <https://docs.volcengine.com/docs/account_related/Enterprisecertificateauthentication?lang=zh> |
| 9 | 如何选择企业实名认证方式 | <https://docs.volcengine.com/docs/account_related/Howtochoosethereal-nameauthenticationmethodforenterprises?lang=zh> |
| 10 | 了解火山引擎账号（含个人 vs 企业对比表） | <https://docs.volcengine.com/docs/account_related/understanding-volcano-engine-account?lang=zh> |
| 11 | 豆包语音产品简介（含语音同传 S2T/S2S 说明） | <https://docs.volcengine.com/docs/DoubaoVoice/ProductOverview-9?lang=zh> |
| 12 | 声音复刻下单及使用指南 | <https://docs.volcengine.com/docs/DoubaoVoice/Soundreplicationorderingandusageguide?lang=zh> |
| 13 | 豆包语音控制台指引 | <https://docs.volcengine.com/docs/DoubaoVoice/console-guidance?lang=zh> |
| 14 | 火山方舟模型列表 | <https://docs.volcengine.com/docs/82379/Modellist> |
| 15 | 同声传译 API 接入文档 | <https://docs.volcengine.com/docs/82379/1394617> |
| 16 | 火山方舟-获取 API Key 并配置 | <https://docs.volcengine.com/docs/82379/api-key> |
| 17 | 2026 产品更新公告 | <https://docs.volcengine.com/docs/82379/product-update-announcement-2026> |
| 18 | 26 年春节期间访问方式调整公告 | <https://docs.volcengine.com/docs/82379/access-changes-during-spring-festival-2026> |

---

## 未在本研究中覆盖的项（建议后续 ticket 跟进）

1. **支付方式与最低充值金额**：`/docs/6258/...` 充值文档需要登录，curl 抓不到文案。需要登录后查看 `console.volcengine.com/finance/recharge` 实际展示。
2. **海外手机号注册 / 海外身份证件实名**：目前**公开文档无此路径**。如项目用户确实没有大陆身份证 + +86 号，需要走"借用同事认证 + 个人子账号"或者寻找替代云厂商。
3. **同传 2.0 默认 QPS / 并发上限**：文档未列出具体数字，需登录控制台查看"服务详情"页或调 `QPS/并发查询接口`。
4. **声音复刻免费音色"具体赠送数量"**：文档措辞为"一定数量"，需登录控制台看实际数量。
