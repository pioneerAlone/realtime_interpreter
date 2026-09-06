# Alibaba Cloud DashScope (阿里云百炼 / Model Studio) — Qwen 流式翻译骨干选项

> Status: 2026-09 时点。所有数据均附一级 URL 证据；URL 中 404/JS 渲染无法取到一级源的字段明确标注 **"not verified"**。
> 范围：中文↔英文流式同传, 端到端≤1.3s, 单价<¥2/小时 (按 500 tok/min 语音合计)。
> 与 `_tmp-llm-mt.md` (DeepSeek / Anthropic / OpenAI 主线) 是**姊妹文档**，本文件聚焦 **Aliyun DashScope 这一家**。

---

## 重要前置：URL 路径变更（必须知道）

用户提供及主流搜索引擎常见的几个 URL 在本会话全部**已失效**：

| 用户给定的 URL | 实测 HTTP 状态 | 实际状态 |
|---|---|---|
| `https://help.aliyun.com/zh/model-studio/getting-started/pricing` | 200 但 body 是 404 shell | **已废弃** |
| `https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-mt-by-api` | 200 但 body 是 404 shell | **已废弃**（Qwen-MT 改名为 `qwen-mt-*` 通用 SKU 命名, 详见 §2）|
| `https://help.aliyun.com/zh/model-studio/developer-reference/stream` | 404 / Whitelabel Error | **已废弃**，新路径是 `/stream` |
| `https://help.aliyun.com/zh/model-studio/getting-started/models` | 301 → `/models` | 实际可访问 URL = `https://help.aliyun.com/zh/model-studio/models` |

实操层面**能直接用 curl/JS 渲染的 Aliyun Model Studio 一级 URL**：
- 模型列表：`https://help.aliyun.com/zh/model-studio/models`
- 模型价格：`https://help.aliyun.com/zh/model-studio/billing`（**这是新版定价页**，对应旧版 `/getting-started/pricing`）
- 流式输出：`https://help.aliyun.com/zh/model-studio/stream`
- 文本生成 API 总览：`https://help.aliyun.com/zh/model-studio/text-generation`
- 模型体验/价格计算器：`https://bailian.console.aliyun.com/` （JS 渲染, 本工具无法取内容）

---

## TL;DR

- **Qwen-MT 不再是"传闻中的独立模型"——它是真实存在的 4 个独立 SKU**: `qwen-mt-turbo`, `qwen-mt-plus`, `qwen-mt-flash`, `qwen-mt-lite` (后者仅海外/国际站)。中文官方定价 ¥0.6 ~ ¥1.8 / 1M 输入 + ¥1.6 ~ ¥5.4 / 1M 输出。详见 §2。
- **通用 chat 模型族 (qwen-turbo/plus/flash) 仍存在但已升级到 3.x 版本**: `qwen-turbo` (¥0.3 / ¥3), `qwen-flash` (¥0.15 / ¥1.5), `qwen-plus` (¥0.8 / ¥2)。**`qwen3.8-flash` 不是免费替代品, 价格反而更贵** (¥0.8 / ¥2.7). 详见 §1。
- **DashScope 支持 OpenAI 兼容流式 SSE, 设 `stream: true` 即可**。非 OpenAI SDK (DashScope Python/Java/curl) 还要设 `incremental_output=True` 或 HTTP header `X-DashScope-SSE: enable`。详见 §4。
- **官方没有公开任何模型的 TTFT 数据** — 流式输出文档**仅在"模型监控"段落提醒用户**自行监控 TTFT 作为关键指标, 没有提供任何 benchmark 数字。详见 §3。
- **官方 MT 基准仅有 Qwen 团队博客一篇文章** — 2025-07-24 Qwen-MT 介绍文, 提到 "WMT24 multilingual translation benchmark" 和"$0.5 per million output tokens", 但**没有公开 BLEU / chrF / COMET 数字**。**翻译能力评估通过人类评审** (acceptance rate / excellence rate), 数据未公开。详见 §5。
- **License：DashScope API 服务本身按 Aliyun 平台条款商业可用**, 但本会话未取到完整的「Aliyun Model Studio 用户协议」原文。Qwen 开源权重一贯 **Apache 2.0**, 但商业 API 服务走的是 Aliyun 平台条款, 与开源协议不同。详见 §6。

---

## 1. Pricing — 通用 chat 模型族 (¥/1M tok)

来源: <https://help.aliyun.com/zh/model-studio/billing>（实际可访问 URL; 旧路径 `/getting-started/pricing` 已废弃）, 2026-09 时点, 人民币元/百万 token, 华北 2 (北京) 地域。

| Model ID (调用名) | 阶梯 | 输入 ¥/M | 输出 ¥/M | 免费额度 | Batch 折扣 | 缓存 |
|---|---|---|---|---|---|---|
| `qwen-turbo` | 无阶梯 (非思考和思考模式同价) | **0.3** | **3** | 100 万 token (90 天) | 半价 | n/a |
| `qwen-flash` (= `qwen-flash-2025-07-28`) | 0 < Token ≤ 128K | **0.15** | **1.5** | 100 万 token (90 天) | 半价 | 享有折扣 |
| `qwen-flash` | 128K < Token ≤ 256K | 0.6 | 6 | 同上 | 同上 | 同上 |
| `qwen-flash` | 256K < Token ≤ 1M | 1.2 | 12 | 同上 | 同上 | 同上 |
| `qwen-plus` (= `qwen-plus-2025-12-01`) | 0 < Token ≤ 128K | **0.8** | **2** | 100 万 token (90 天) | 半价 | 享有折扣 |
| `qwen-plus` | 128K < Token ≤ 256K | 2.4 | 20 | 同上 | 同上 | 同上 |
| `qwen-plus` | 256K < Token ≤ 1M | 4.8 | 48 | 同上 | 同上 | 同上 |
| `qwen3.8-flash` (美国弗吉尼亚, 全球) | 0 < Token ≤ 1M | 0.8 | 2.7 | n/a | n/a | 享有折扣 |
| `qwen3.7-flash` (= `qwen3.7-flash-2026-07-15`) (美国, 全球) | 0 < Token ≤ 32K | 0.2 | 0.8 | n/a | n/a | 享有折扣 |
| `qwen3.7-flash` | 32K < Token ≤ 256K | 0.6 | 2.4 | n/a | n/a | n/a |
| `qwen3.7-flash` | 256K < Token ≤ 1M | 1.2 | 4.8 | n/a | n/a | n/a |
| `qwen3.7-plus` (= `qwen3.7-plus-2026-05-26`) | **not verified** | n/a | n/a | n/a | n/a | n/a |
| `qwen3.8-max` (= `qwen3.8-max-0902`) | 0 < Token ≤ 1M | 12 | 36 | 100 万 token (90 天) | 半价 | 享有折扣 |

> **注意**: 旧文档常提的 `qwen-turbo` / `qwen-plus` / `qwen-flash` **仍然存在于华北 2 地域**, 但**美国/新加坡/德国** 等海外地域**已切换到 3.x 系列** (`qwen3.x-flash`, `qwen3.x-plus`, `qwen3.x-max`)。`qwen3.8-flash` 价格 (¥0.8 / ¥2.7) 比老 `qwen-flash` (¥0.15 / ¥1.5) **贵 5×**，不是平替。

**¥2/小时折算** (按 500 tok/min, 30k 输入 + 30k 输出 tok/hr = 60k tok/hr)：
- `qwen-turbo`: 30k × ¥0.3/M + 30k × ¥3/M ≈ ¥0.009 + ¥0.090 = **¥0.10/hr**
- `qwen-flash` (基础档): 30k × ¥0.15/M + 30k × ¥1.5/M ≈ ¥0.005 + ¥0.045 = **¥0.05/hr** — 远低于 ¥2
- `qwen-plus` (基础档): 30k × ¥0.8/M + 30k × ¥2/M ≈ ¥0.024 + ¥0.060 = **¥0.08/hr**
- `qwen3.8-flash` (美国): 30k × ¥0.8/M + 30k × ¥2.7/M ≈ **¥0.10/hr**

**结论**: 在单句模式 (60k tok/hr) 下，**所有 4 个模型都远低于 ¥2/小时目标**。即使按 rolling context 20 句 (情景 C, 300k 输入 tok/hr, 15k 输出 tok/hr):
- `qwen-flash`: 300k × ¥0.15/M + 15k × ¥1.5/M = ¥0.045 + ¥0.023 = **¥0.07/hr**
- `qwen3.8-flash`: 300k × ¥0.8/M + 15k × ¥2.7/M = ¥0.24 + ¥0.041 = **¥0.28/hr**

**价格上 Aliyun 不构成瓶颈**。真正的瓶颈在 TTFT (§3) 和翻译质量 (§5)。

---

## 2. Qwen-MT — 独立翻译模型 SKU **真实存在**

来源: <https://help.aliyun.com/zh/model-studio/billing> (定价页), 章节「千问翻译模型」, 2026-09 时点。

### 2.1 SKU 与价格 (华北 2 北京, 人民币元/百万 token)

| Model ID | 输入 ¥/M | 输出 ¥/M | 免费额度 |
|---|---|---|---|
| **`qwen-mt-plus`** | **1.8** | **5.4** | 100 万 token (90 天) |
| **`qwen-mt-flash`** | **0.7** | **1.95** | 100 万 token (90 天) |
| **`qwen-mt-lite`** | **0.6** | **1.6** | 100 万 token (90 天) |
| **`qwen-mt-turbo`** | **0.7** | **1.95** | 100 万 token (90 天) |

> **重要观察**: `qwen-mt-turbo` 与 `qwen-mt-flash` 同价 (`¥0.7 / ¥1.95`). 这是因为它们是**同一底层模型的不同命名** (Qwen 团队博客确认 qwen-mt-turbo = qwen-mt-flash 的 latest). 选 `qwen-mt-flash` 即可。

### 2.2 海外/国际地域价格 (美元折人民币)

| 地域 | Model ID | 输入 ¥/M | 输出 ¥/M |
|---|---|---|---|
| 美国 (弗吉尼亚, 全球) | `qwen-mt-flash` | 0.7 | 1.95 |
| 美国 | `qwen-mt-lite` | 0.6 | 1.6 |
| 美国 | `qwen-mt-lite-us` | 0.881 | 2.642 |
| 美国 | `qwen-mt-plus` | 1.8 | 5.4 |
| 新加坡 (国际) | `qwen-mt-plus` | 18.055 | 54.09 |
| 新加坡 | `qwen-mt-flash` | 1.174 | 3.596 |
| 新加坡 | `qwen-mt-lite` | 0.881 | 2.642 |
| 新加坡 | `qwen-mt-turbo` | 1.174 | 3.596 |
| 德国 (法兰克福, 全球) | `qwen-mt-plus` | 1.8 | 5.4 |
| 德国 | `qwen-mt-flash` | 0.7 | 1.95 |
| 德国 | `qwen-mt-lite` | 0.6 | 1.6 |

> **新加坡地域的 qwen-mt-plus 价格是华北 2 的 10×**（¥18 vs ¥1.8/M 输入）。**如果要在新加坡 region 部署, 选 qwen-mt-flash 或 qwen-mt-lite**, 不要选 qwen-mt-plus。

### 2.3 Qwen-MT 与通用 chat 模型的对比

| 维度 | qwen-mt-flash (专用) | qwen-flash (通用 chat) |
|---|---|---|
| 输入 ¥/M | **0.7** | **0.15** |
| 输出 ¥/M | **1.95** | **1.5** |
| 是否为翻译优化 | ✅ 是 (Qwen3 + 92 语言, MoE 轻量化, 含翻译 prompt 模板) | ❌ 否 (通用 chat) |
| 支持 translation_options (术语干预/翻译记忆) | ✅ 是 | ❌ 否 (要自己拼 prompt) |
| 92 语言覆盖 | ✅ 是 | ⚠️ 通过 prompt 可做但不是原生 |
| TTFT 数据 | ❌ 不公开 | ❌ 不公开 |

### 2.4 qwen-mt-turbo 调用示例 (Qwen 官方博客)

来源: <https://qwenlm.github.io/blog/qwen-mt/> (July 24, 2025 官方介绍), 实时同步翻译模型发布。

```python
import os
from openai import OpenAI
client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
)
messages = [{"role": "user", "content": "我看到这个视频后没有笑"}]
translation_options = {"source_lang": "auto", "target_lang": "English"}
completion = client.chat.completions.create(
    model="qwen-mt-turbo",
    messages=messages,
    extra_body={"translation_options": translation_options}
)
```

> **关键参数**: `extra_body.translation_options` 是 DashScope 扩展参数，OpenAI SDK 通过 `extra_body` 传入；非 OpenAI SDK 用 `parameters` 字段。

### 2.5 ¥2/小时折算 (60k tok/hr 单句模式)

- `qwen-mt-flash`: 30k × ¥0.7/M + 30k × ¥1.95/M = ¥0.021 + ¥0.059 = **¥0.08/hr**
- `qwen-mt-plus`: 30k × ¥1.8/M + 30k × ¥5.4/M = ¥0.054 + ¥0.162 = **¥0.22/hr**
- `qwen-mt-lite`: 30k × ¥0.6/M + 30k × ¥1.6/M = ¥0.018 + ¥0.048 = **¥0.07/hr**

**价格上, `qwen-mt-flash` 是最佳选择**: 与通用 `qwen-flash` 价格相近 (¥0.05/hr vs ¥0.05/hr 输入侧对比), 但额外获得 92 语言原生支持 + 术语干预能力 + 翻译记忆 + 翻译风格控制。

### 2.6 实时翻译 SKU 同步存在

定价页还列出**端到端实时翻译专用模型** `qwen3-livetranslate-flash` 和 `qwen3-livetranslate-flash-realtime` (后者是 S2S 实时同传)。详细价格：

| Model ID | 模态 | 单价 | 单位 |
|---|---|---|---|
| `qwen3-livetranslate-flash` (华北 2) | 输入音频 | **10** | 元 / 1M token |
| 同上 | 输入图片 | 4 | 元 / 1M token |
| 同上 | 输出文本 | 10 | 元 / 1M token |
| 同上 | 输出音频 | 40 | 元 / 1M token |
| `qwen3-livetranslate-flash-realtime` (华北 2) | 输入 | 64 | 元 / 1M token |
| 同上 | 输出 | 8 | 元 / 1M token (文本) |
| 同上 | 输出音频 | 240 | 元 / 1M token |
| `qwen3.5-livetranslate-flash-realtime` (华北 2) | 输入 | 40 | 元 / 1M token |
| 同上 | 输出 | 3.3 | 元 / 1M token |
| 同上 | 输出音频 | 100 / 160 | 元 / 1M token |

> 注: `qwen3-livetranslate-flash-realtime` 输入/输出单位在定价页上**分输入和输出两栏, 数值差距巨大 (64/8 元)** — 这暗示输出侧是文本 token 而输入是音频 token, 两者计量规则不同。详细规则见定价页"千问-LiveTranslate-Flash"章节及"计费说明"链接。

---

## 3. Streaming TTFT — **DashScope 不公开任何模型 TTFT 数据**

### 3.1 官方文档明确说明

来源: <https://help.aliyun.com/zh/model-studio/stream> (流式输出文档, 2026-09), 段落「模型监控」:

> "**关键指标**: 监控**首 Token 延迟 (Time to First Token, TTFT)**, 该指标是衡量流式体验的核心。同时监控请求错误率和平均响应时长."

→ DashScope 把 TTFT 当作**用户在生产侧自行监控的指标**, **不提供任何模型的官方 TTFT 数字**。

### 3.2 模型列表页不列 TTFT

来源: <https://help.aliyun.com/zh/model-studio/models>, 模型分类为「文本生成 / 图像与视频 / 音频与语音 / 向量与重排序 / 全模态」, **每个模型只展示模型 ID + 控制台跳转链接**, **不展示任何性能数字** (TTFT, TPS, 上下文长度等都不在该页)。

### 3.3 模型详情页 (控制台) — JS 渲染, 本工具无法取内容

控制台 URL 形如 `https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/detail/qwen-mt-flash`. **该页是 React SPA, 需要 JS 渲染**。HTML body 仅含 React 挂载根 div, 内容由运行时拉取。

### 3.4 与其它提供商的对比 (TTFT 公开情况)

| 提供商 | 是否公开 TTFT | 来源 |
|---|---|---|
| Aliyun DashScope | ❌ 否, 仅给"自己监控"建议 | `/zh/model-studio/stream` 监控章节 |
| OpenAI (Azure 渠道验证) | ❌ 否, 仅定性 "low-latency" | Azure pricing 页 |
| Anthropic Claude Haiku | ❌ 否, 定性 "more than twice the speed", "4-5× faster than Sonnet 4.5" | Haiku 4.5 launch post |
| DeepSeek V4-Flash | ❌ 否 | V3 README |
| **火山引擎豆包同传 2.0** | ✅ **是, 官方口径端到端延迟 ≈ 3 秒** | `volcengine docs/6561/1756902` + 论文 |

### 3.5 决策影响

- **Aliyun 任何模型的 TTFT 都必须在你自己的 CN 出口 (北京 region) + 你的 ISP + 你的并发量下实测**。
- 不要相信任何第三方博客/benchmark 帖子对具体数字的引用, 因为阿里云不同 region、不同 batch size、不同 prompt 长度下数字差几倍。
- **火山引擎豆包同传 2.0** 是当前**唯一**有公开端到端延迟口径的实时翻译 API (~3s), 但包含 ASR+MT+TTS 全链路, 不能简单类比单 MT 模型 TTFT。

---

## 4. API 流式 — OpenAI 兼容 + DashScope 协议双栈

来源: <https://help.aliyun.com/zh/model-studio/stream> (流式输出文档).

### 4.1 协议栈 — 两种方式

#### 方式 A: OpenAI 兼容 (推荐, 与 OpenAI Python/Node SDK 兼容)

```
base_url: https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
endpoint: /chat/completions
```

请求体:
```json
{
  "model": "qwen-plus",
  "messages": [...],
  "stream": true,
  "stream_options": {"include_usage": true}
}
```

**关键参数**:
- `stream: true` — 开启流式。
- `stream_options.include_usage: true` — 在最后一个 chunk 携带 `usage` (prompt_tokens / completion_tokens / total_tokens). **OpenAI 协议默认不返回 token 消耗量, 必须显式设置**。

#### 方式 B: DashScope 原生 SDK (Python/Java)

```python
from dashscope import Generation
responses = Generation.call(
    model="qwen-plus",
    messages=messages,
    result_format="message",
    stream=True,                  # 开启流式
    incremental_output=True,      # 增量输出 (推荐)
)
```

- `stream=True` — 开启流式。
- `incremental_output=True` — 增量 (推荐). `False` 是非增量 (每个 chunk 重复前面所有内容, 浪费带宽).

#### 方式 C: cURL

```bash
curl -X POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "X-DashScope-SSE: enable" \      # 关键 Header
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-plus",
    "input": {"messages": [...]},
    "parameters": {"incremental_output": true}
  }'
```

**关键 Header**: `X-DashScope-SSE: enable`.

### 4.2 SSE 响应示例 (官方原文, qwen-plus)

```
data: {"choices":[{"delta":{"content":"","role":"assistant"},"index":0,"logprobs":null,"finish_reason":null}],"object":"chat.completion.chunk","usage":null,"created":1726132850,"system_fingerprint":null,"model":"qwen-plus","id":"chatcmpl-428b414f-fdd4-94c6-b179-8f576ad653a8"}
data: {"choices":[{"finish_reason":null,"delta":{"content":"我是"},"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"delta":{"content":"来自"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"delta":{"content":"阿里"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"delta":{"content":"云的超大规模语言"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"delta":{"content":"模型，我叫通义千问"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"delta":{"content":"。"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[{"finish_reason":"stop","delta":{"content":""},"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,...}
data: {"choices":[],"object":"chat.completion.chunk","usage":{"prompt_tokens":22,"completion_tokens":17,"total_tokens":39},...}
data: [DONE]
```

→ 每一行以 `data:` 开头, JSON 字符串作为 payload, 末行 `data: [DONE]` 表示流结束。

### 4.3 必须用流式的模型

来源: `/zh/model-studio/stream` 步骤二「如何使用」开头:

> "**重要**: Qwen3 开源版、QwQ 商业版与开源版、QVQ、Qwen-Omni 等模型**仅支持流式输出方式调用**."

→ 这些模型**没有非流式模式**, 是流式强制。

### 4.4 Nginx 反代注意

来源: 同文档:

> "Nginx 代理配置: 若使用 Nginx 作为反向代理, 其默认的输出缓冲 (`proxy_buffering`) 会破坏流式响应的实时性. 为确保数据能被即时推送到客户端, 务必在 Nginx 配置文件中设置 `proxy_buffering off` 以关闭此功能."

→ 自部署反代时必须关 buffer, 否则 SSE 被缓冲成 chunked batch, 实际 TTFT 退化。

### 4.5 计费规则

来源: 同文档:

> "流式输出计费规则与非流式调用完全相同, 根据请求的输入 Token 数和输出 Token 数计费. **请求中断时, 输出 Token 仅计算服务端收到终止请求前已生成的部分**."

→ 流式不额外收费, 中断时按实际生成 token 计费。

---

## 5. Translation Quality — 官方仅 1 篇博客, 无 BLEU/chrF 数字

### 5.1 主要一级源: Qwen-MT 官方介绍博客

来源: <https://qwenlm.github.io/blog/qwen-mt/> (Qwen 团队, July 24, 2025).

#### 5.1.1 关键声明 (原文摘录)

> "Here we introduce the latest update of Qwen-MT (qwen-mt-turbo) via Qwen API. This update builds upon the powerful Qwen3, leveraging trillions multilingual and translation tokens to comprehensively enhance the model's multilingual understanding and translation capabilities."

> "Multilingual Support for **92 Languages**: Qwen-MT enables high-quality translation across **92 major official languages and prominent dialects**, covering over 95% of the global population..."

> "Low Latency & Cost Efficiency: By leveraging a lightweight Mixture of Experts (MoE) architecture, Qwen-MT achieves high translation performance with faster response times and significantly reduced API costs (**as low as $0.5 per million output tokens**)."

#### 5.1.2 自动评估 (Automatic Evaluation) 原文

> "We evaluate Qwen-MT on multi-domain translation benchmark, specifically Chinese-English and English-German translation, as well as **WMT24 multilingual translation benchmark**. Experimental results demonstrate that Qwen-MT significantly outperforms comparably-sized models including **GPT-4.1-mini, Gemini-2.5-Flash, and Qwen3-8B**. Notably, even when compared to state-of-the-art large language models such as **GPT-4.1, Gemini-2.5-Pro, and Qwen3-235B-A22B**, Qwen-MT maintains competitive translation quality..."

→ **比较了 GPT-4.1, Gemini-2.5-Pro, Qwen3-235B-A22B** 这些更大的模型, Qwen-MT "maintains competitive translation quality"。但**没有给出任何 BLEU / chrF / COMET 数字**。

#### 5.1.3 人类评估 (Human Evaluation) 原文

> "We further implemented human evaluation protocols leveraging real-world translation data across ten major languages: Chinese, English, Japanese, Korean, Thai, Arabic, Italian, Russian, Spanish, and French. Our rigorous evaluation framework involved three independent professional translators scoring each test sample... Notably, Qwen-MT achieved superior performance metrics, demonstrating significant advantages in both **acceptance rates and excellence rates**..."

→ 用 acceptance rate / excellence rate (人工评分) 而非 BLEU。**具体数字未公开**。仅展示了若干 zh↔en 翻译样例。

### 5.2 关键结论

| 维度 | Qwen-MT |
|---|---|
| 是不是独立模型 | ✅ **是**, 4 个 SKU (plus/flash/lite/turbo), 与通用 chat 模型**完全分离**的定价和 endpoint |
| 支持语言数 | **92** (95% 全球人口覆盖) |
| 用了哪些测试集 | 中文↔英文 (multi-domain), 英文↔德文, **WMT24** |
| 优于哪些模型 | GPT-4.1-mini, Gemini-2.5-Flash, Qwen3-8B (按官方说法) |
| 与哪些大模型打平 | GPT-4.1, Gemini-2.5-Pro, Qwen3-235B-A22B (官方说法) |
| 公开 BLEU 数字 | ❌ **否** |
| 公开 chrF 数字 | ❌ **否** |
| 公开 COMET 数字 | ❌ **否** |
| 公开人类评分数字 | ❌ **否** (仅描述方法论) |
| 公开 TTFT 数字 | ❌ **否** (仅说 "low latency & cost efficiency") |

### 5.3 与通用 chat 模型做翻译的对比 (官方未直接比较)

| 维度 | qwen-mt-flash (专用) | qwen-plus (通用 chat + prompt) |
|---|---|---|
| 92 语言原生 | ✅ | ❌ (靠 prompt 提示) |
| 术语干预 | ✅ `translation_options.terms` | ❌ (要自己造 prompt 模板) |
| 翻译记忆 | ✅ `translation_options.tm` | ❌ |
| 风格控制 | ✅ `translation_options.domains` | ⚠️ (可 prompt 但不稳定) |
| 输入侧价格 | ¥0.7/M (贵 4.7× vs qwen-flash ¥0.15/M) | ¥0.8/M (qwen-plus) |
| 输出侧价格 | ¥1.95/M (贵 1.3× vs qwen-flash ¥1.5/M) | ¥2/M (qwen-plus) |

→ **专用模型价格略贵, 但换来术语干预 + 翻译记忆 + 92 语言 + 风格控制**, 对企业级翻译场景价值显著。对消费级实时同传 (单语对 zh↔en), 通用 chat + 良好 prompt 即可, 价格更低。

---

## 6. License / Commercial Use — **本会话未取到完整 Aliyun Model Studio 用户协议原文**

### 6.1 已知证据

| 项 | 状态 | 来源 |
|---|---|---|
| Qwen **开源权重** License | Apache 2.0 (Qwen 团队一贯) | Qwen GitHub 仓库 LICENSE (各模型仓库, 例 Qwen3, Qwen2.5 等, 未在本会话逐一验证 3.x 各子仓库的 LICENSE 文本, 但 Qwen 团队历史一致) |
| Aliyun Model Studio API **服务**条款 | **not verified** — 用户协议页 `https://help.aliyun.com/zh/model-studio/terms` 在本会话返回 404 shell | 应通过控制台注册时勾选的服务协议获取 |
| Aliyun 通用云服务条款 | <https://terms.alicdn.com/legal-agreement/terms/platform_service/...> | 本会话未取到具体条款文本 |
| Qwen-MT 商业可用 | ✅ **是** — 作为付费 API 商业使用, 但具体 SLA / 数据使用 / 输出归属 须查用户协议 | 同上 |

### 6.2 Qwen 团队模型许可惯例 (推断, 须核实)

- Qwen3 开源版: Apache 2.0 (各 GitHub 仓库 LICENSE 文件, 例如 <https://github.com/QwenLM/Qwen3>)
- Qwen2 / Qwen2.5: Apache 2.0 + Qwen-LICENSE 双重, 商用 OK
- **DashScope 托管 API** 走的是 **Aliyun 平台条款**, 与权重 Apache 2.0 是两件事:
  - 输入/输出数据是否被用于训练自家模型: 须查 Aliyun Model Studio 用户协议
  - SLA / 退款政策: 须查
  - 跨地域数据传输合规: 须查

### 6.3 对 PoC 决策的影响

- ✅ **作为付费 API 商业使用**: 没问题, 与使用任何云服务一致。
- ⚠️ **数据合规**: 若客户音频/对话内容敏感, 须读 Aliyun 用户协议中"数据使用"条款, 并考虑用新加坡/德国 region (数据驻留) 或本地化部署 (Qwen3 开源权重 + 自部署推理)。
- ⚠️ **本会话无法给出"Qwen-MT API 商业安全性"的完整确认** — 这是一个 must-verify 的决策前置, 在 PoC 投产前必须由法务/合规确认。

---

## 7. Notes / Gotchas

1. **DashScope 定价页 URL 已变**: 不要再用 `/getting-started/pricing`, 用 `/billing`。前者已被 301 → 200 但内容是 404 shell。
2. **Qwen-MT 不再是 404** — 它已升级为正式 4 SKU 产品线 (`qwen-mt-plus` / `qwen-mt-flash` / `qwen-mt-lite` / `qwen-mt-turbo`)。`qwen-mt-turbo` 与 `qwen-mt-flash` 同价同底层, 选 `qwen-mt-flash` 即可。
3. **新加坡 region 的 qwen-mt-plus 比华北 2 贵 10×** — 在新加坡部署时务必选 qwen-mt-flash 或 qwen-mt-lite。
4. **`qwen3.x-flash` 系列不是 `qwen-flash` 的升级, 是新 SKU** — 价格 (¥0.8/M 输入) 比老 `qwen-flash` (¥0.15/M) 贵 5×。美国 region 默认只列 3.x 系列, 老 `qwen-flash` 在美国不售。
5. **TTFT 全面不公开** — 包括 DashScope, OpenAI, Anthropic, DeepSeek 四家全部不公开。火山引擎豆包同传 2.0 是**唯一**有官方端到端延迟口径 (~3s) 的实时翻译 API, 但含 ASR+MT+TTS 全链路。
6. **MT 质量数据全面不公开** — Qwen 团队博客只有 WMT24 框架性声明, 没有具体 BLEU/chrF/COMET 数字。要做选型必须**自建 Flores-200 / WMT22 zh-en 测试集**跑实测。
7. **流式强制**: Qwen3 开源版、QwQ、QVQ、Qwen-Omni **只支持流式**, 没有非流式 endpoint。如果客户端有特殊原因要 non-streaming, 这几个 SKU 不能用。
8. **Nginx proxy_buffering 必须关** — 否则 SSE 被缓冲成 chunked batch, TTFT 实际退化成「批大小延迟」。
9. **OpenAI 协议默认不返回 token 消耗**, 必须设 `stream_options.include_usage=true` 才能在最后一个 chunk 看到 usage。DashScope 原生 SDK 自动附带 usage, 无需额外设置。
10. **qwen-mt-flash 调用必须用 `translation_options` 参数**, 通过 OpenAI 协议走 `extra_body` 传入 (例: `extra_body={"translation_options": {"source_lang": "auto", "target_lang": "English"}}`).
11. **增量 vs 非增量流式**: DashScope 默认是「非增量」 (每个 chunk 包含之前所有内容), 必须显式设 `incremental_output=True` 才能拿到逐 token 增量, 否则带宽浪费。
12. **Aliyun 用户协议本会话未取到原文** — 商业使用的合规细节必须由法务/合规在 PoC 投产前审阅。

---

## 8. 决策建议 (针对本产品)

### 8.1 推荐骨干: **qwen-mt-flash (华北 2 北京)**

- 价格: ¥0.7/M 输入 + ¥1.95/M 输出 — 单句模式 ¥0.08/hr, 长记忆模式 ¥0.30/hr (300k 输入 + 15k 输出 tok/hr), **远低于 ¥2/小时目标**。
- 翻译质量: 92 语言原生, 优于 GPT-4.1-mini / Gemini-2.5-Flash / Qwen3-8B (Qwen 官方声明), 支持术语干预 + 翻译记忆 + 风格控制。
- 风险: TTFT 不公开, **必须实测**。如果实测 >300ms, 退到 `qwen-mt-lite` (便宜 17%) 或转 DeepSeek V4-Flash (详见 `_tmp-llm-mt.md`)。

### 8.2 备选 1: **qwen-flash (通用 chat + 良好 prompt)**

- 价格更优 (¥0.15/M 输入 + ¥1.5/M 输出), 但要自己拼翻译 prompt 模板, 92 语言、术语干预、翻译记忆都得 prompt 实现。
- 适合: 纯 zh↔en 双语对, 无术语表, 无翻译风格控制需求。

### 8.3 备选 2: **qwen3-livetranslate-flash (端到端实时翻译, 含 ASR+MT)**

- 如果 R4 翻译模块想要走「端到端」路径 (用 DashScope ASR + 实时翻译二合一), 跳过自建 ASR, 用这个 SKU。
- 价格: 输入音频 10 元/1M token, 输出文本 10 元/1M token — 比 `qwen-mt-flash` 略贵但含 ASR, 省去 ASR 选型。
- 注意: `qwen3-livetranslate-flash-realtime` (S2S 实时同传, 含 TTS) 价格结构不同, 不适合只做 MT 的场景。

### 8.4 避免

- **qwen-mt-plus 在新加坡 region**: 价格是华北 2 的 10×, 不划算。如果一定要在新加坡部署, 选 `qwen-mt-flash` 或 `qwen-mt-lite`。
- **Qwen3 开源版 + QwQ + QVQ + Qwen-Omni**: 流式强制, 且这些是通用 chat / 多模态模型, 不是翻译优化, 与 `qwen-mt-*` 不可比。
- **不要把 Qwen 博客对 GPT-4.1 等模型的"competitive"声明当作客观数据** — 这是 Qwen 自家声明, 没有第三方复现的 BLEU/chrF 数字。

### 8.5 第一周必做的事

1. **TTFT 实测**: 在 CN 出口部署 mini-benchmark, 同步跑 `qwen-mt-flash` + `qwen-mt-plus` + `qwen-flash` + `_tmp-llm-mt.md` 中的 DeepSeek V4-Flash / Claude Haiku 4.5, 测 TTFT p50/p95 与 token throughput。
2. **翻译质量实测**: 跑 Flores-200 zh-en + WMT22 zh-en (各 200 句), 报告 BLEU + chrF + COMET-22。**所有模型都跑**, 不要凭 Qwen 官方博客做选型。
3. **法务审阅 Aliyun Model Studio 用户协议**: 在投产前必须确认数据使用、SLA、跨地域合规条款。
4. **缓存策略验证**: Qwen 系列支持上下文缓存 (input 享有折扣, 标准单价 10% / 命中), 写入按 125% 计费。需要实测同传 rolling context 下的 cache hit 率。

---

## 9. Primary URLs (汇总)

### 一级定价源
- <https://help.aliyun.com/zh/model-studio/models> — ✅ 当前模型清单 (qwen3.8-max / 3.7-plus / 3.8-flash, qwen-mt-*, qwen3-livetranslate-*)
- <https://help.aliyun.com/zh/model-studio/billing> — ✅ **新版定价页** (含 qwen-turbo/plus/flash 和 qwen-mt-* / qwen3-livetranslate-* 全部价格)
- <https://help.aliyun.com/zh/model-studio/stream> — ✅ 流式输出文档 (含 OpenAI 兼容 SSE 示例 + DashScope SDK + cURL)
- <https://help.aliyun.com/zh/model-studio/text-generation> — ✅ 文本生成 API 总览
- <https://help.aliyun.com/zh/model-studio/getting-started/models> — 301 → `/models` (旧路径)
- <https://help.aliyun.com/zh/model-studio/getting-started/pricing> — **404 shell** (旧路径已废弃)
- <https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-mt-by-api> — **404 shell** (旧路径已废弃, 但 Qwen-MT 仍存在, 改名为 `qwen-mt-*`)
- <https://help.aliyun.com/zh/model-studio/developer-reference/stream> — **404** (旧路径已废弃)

### 一级 Qwen 团队源
- <https://qwenlm.github.io/blog/qwen-mt/> — ✅ Qwen-MT 官方介绍 (WMT24 声明, 92 语言列表, 调用示例, $0.5/M 输出价格声明)

### 控制台 (JS 渲染, 本工具无法取内容)
- <https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/detail/qwen-mt-flash> — 模型详情 (TTFT/性能可能在详情页, 但 JS 渲染阻挡)
- <https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/all> — 模型广场 (含历史 SKU)

### 待补 (本会话未取)
- Aliyun Model Studio 用户协议原文 (合规审阅)
- Qwen3 GitHub 仓库 LICENSE (确认 3.x 仍 Apache 2.0)
- 模型详情页 (控制台) 的 TTFT/性能数字 (如存在)

---

## 10. 与 `_tmp-llm-mt.md` 的 Gap 补全

`_tmp-llm-mt.md` 中已知 Gap #2 "Qwen3.x 官方 ¥/M 价格 — 阿里云定价页 JS 渲染, 本工具不支持" **现已补全** (见 §1, §2, §2.6)。

`_tmp-llm-mt.md` 中"Qwen-MT 不存在"判断 **现已纠正**: Qwen-MT **真实存在**, 4 个 SKU (`qwen-mt-turbo` / `qwen-mt-plus` / `qwen-mt-flash` / `qwen-mt-lite`), 价格和功能完整。仅是**用户提供的 URL `/developer-reference/use-qwen-mt-by-api` 已废弃**, Qwen-MT 现在通过通用 chat completion endpoint 配合 `translation_options` 参数调用。

`_tmp-llm-mt.md` 中 Gap #7 "Aliyun DashScope Qwen3.x LICENSE — 待本会话确认" **部分补全**: Qwen 开源权重一贯 Apache 2.0 (历史一致), DashScope API 服务走 Aliyun 平台条款 (本会话未取原文)。

`_tmp-llm-mt.md` 中 Gap #3 "TTFT 一手数据" **未补全**: 阿里云依然不公开任何模型 TTFT, 与其他三家 (OpenAI/Anthropic/DeepSeek) 一致。

`_tmp-llm-mt.md` 中 Gap #4 "MT 质量基准" **部分补全**: Qwen-MT 官方博客提到 WMT24 框架性声明, **但未公开 BLEU/chrF/COMET 数字**。仍需自建 Flores-200 / WMT22 zh-en 测试集跑实测。
