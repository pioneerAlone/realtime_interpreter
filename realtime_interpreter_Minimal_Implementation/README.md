# 实时中英双向同传系统 (Realtime Interpreter)

> 实时语音翻译 + 零样本音色克隆 + 虚拟麦克风回灌会议软件
> 单侧部署，客户零安装，隐蔽使用

## 项目概述

本项目实现一个跨平台桌面软件，让用户在与外国客户开会时：
- **你说中文** → 客户听到**英文**（你的音色）
- **客户说英文** → 你看到**中英双语字幕**
- 仅你自己安装软件，客户无需任何操作
- 通过虚拟声卡（BlackHole / VB-Cable）回灌到 Zoom / Teams / 腾讯会议

## 当前状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段1: Mac A通道（中→英语音输出） | 🔄 验证中 | 鉴权已通过，翻译链路已跑通，播放端采样率问题调试中 |
| 阶段2: Mac B通道（英→中字幕） | ⏳ 待开发 | 系统音频回采 + 悬浮字幕窗 |
| 阶段3: Windows 适配 | ⏳ 待开发 | VB-Cable + WASAPI |
| 阶段4: Electron 桌面应用 | ⏳ 待开发 | GUI + 会议纪要 + 配置管理 |

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  你的麦克风  │────▶│  A通道:中→英  │────▶│  BlackHole   │
│  (说中文)   │     │  AST 2.0 s2s │     │  (虚拟声卡)  │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  Zoom/Teams  │
                                          │  (麦克风=BH) │
                                          └──────┬───────┘
                                                 │
┌─────────────┐     ┌──────────────┐              │
│  悬浮字幕窗  │◀────│  B通道:英→中  │◀─────────────┘
│  (中英双语)  │     │  AST 2.0 t2t │     (系统音频回采)
└─────────────┘     └──────────────┘
```

## 目录结构

```
realtime_interpreter/
├── README.md                    # 本文件
├── requirements.txt             # Python 依赖
├── src/
│   ├── mac_ast2_s2s_v2.py       # 主验证脚本 (A通道: 中→英语音输出)
│   ├── auth_test.py             # 鉴权组合自动测试
│   ├── test_record.py           # 麦克风采集测试
│   ├── opus_decoder.py          # Ogg/Opus 流解码器
│   ├── resample.py              # PCM 重采样工具
│   └── ast_proto/               # Protobuf 绑定 (从 Doppelvoice 移植)
├── scripts/
│   └── run_mac_verify.sh        # Mac 环境一键搭建 + 验证
├── config/
│   └── config.example.py        # 配置示例 (复制后修改)
└── docs/
    ├── 01_技术可行性报告.md       # 技术方案可行性分析
    ├── 02_项目架构与技术栈.md     # 完整架构设计与技术选型
    └── 03_性能与成本分析.md       # 延迟分析与 Token 费用测算
```

## 快速开始 (macOS)

### 1. 前置条件

- macOS 12+ (Apple Silicon / Intel 均可)
- Python 3.9 ~ 3.12 (**不支持 3.13+**, sounddevice 无预编译 wheel)
- 已安装 BlackHole 2ch (虚拟声卡)
  ```bash
  brew install blackhole-2ch
  ```

### 2. 获取 API Key

1. 登录火山引擎语音控制台: https://console.volcengine.com/speech/new/setting/apikeys
2. 创建 API Key (新版)
3. 确认已开通"同声传译大模型"服务

### 3. 环境搭建

```bash
cd realtime_interpreter
bash scripts/run_mac_verify.sh
```

脚本会自动：
- 检测 Python 版本 (要求 3.9~3.12)
- 创建虚拟环境 `.venv`
- 安装依赖 (sounddevice, numpy, websockets, protobuf, soundfile)
- 验证 protobuf 绑定

### 4. 配置

编辑 `src/mac_ast2_s2s_v2.py`，填写：

```python
# ===== 必须配置 =====
API_KEY = "你的语音控制台新版API Key"   # 从 console.volcengine.com/speech/new/setting/apikeys 获取

# 音频设备 ID (用 --list-devices 查看)
MIC_DEVICE_ID = 3        # MacBook Air 麦克风
OUTPUT_DEVICE_ID = 2     # BlackHole 2ch (翻译输出到虚拟声卡)
```

查看设备列表：
```bash
source .venv/bin/activate
cd src
python mac_ast2_s2s_v2.py --list-devices
```

### 5. 运行验证

```bash
# 方式1: 一键脚本 (推荐, 自动处理路径)
bash scripts/run_mac_verify.sh --run

# 方式2: 手动 (注意必须 cd 到 src/ 目录)
source .venv/bin/activate
cd src
python mac_ast2_s2s_v2.py
```

### 6. 会议软件配置

1. 打开 Zoom / Teams / 腾讯会议
2. **麦克风** 选择 `BlackHole 2ch`
3. **扬声器** 选择你的耳机或扬声器（不要选 BlackHole）
4. 对着电脑说中文，客户会听到英文（你的音色）

> ⚠️ **必须戴耳机**，否则翻译后的英文会从扬声器出来被麦克风再次采集，形成回声。

## 鉴权说明

火山引擎同传 API 支持两种鉴权方式，**推荐使用新版 X-Api-Key**：

| 鉴权方式 | Header | 获取地址 |
|----------|--------|----------|
| ✅ 新版 (推荐) | `X-Api-Key` + `X-Api-Resource-Id` | console.volcengine.com/speech/new/setting/apikeys |
| 旧版 (兼容) | `X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id` | console.volcengine.com/speech/app |

**Resource ID 固定值**: `volc.service_type.10053`

测试鉴权：
```bash
cd src
python auth_test.py
```

## API 协议要点

- **接口**: `wss://openspeech.bytedance.com/api/v4/ast/v2/translate`
- **协议**: 纯 Protobuf 二进制 (TranslateRequest / TranslateResponse)，无 JSON 包装
- **输入音频**: 16000Hz / 16bit / mono PCM (format="wav")
- **输出音频**: ogg_opus 48000Hz (PCM 格式目前 API 不生效)
- **零样本克隆**: speaker_id 留空即可，API 会自动从输入音频提取音色
- **事件码**: StartSession=100, TaskRequest=200, FinishSession=102, SessionStarted=150, TTSResponse=352, TTSSentenceEnd=351

## 虚拟声卡配置

### macOS (BlackHole)

| 用途 | 设备 | 说明 |
|------|------|------|
| 翻译输出 | BlackHole 2ch | 程序输出翻译后的英文 |
| 会议麦克风 | BlackHole 2ch | Zoom/Teams 从这里采集 |
| 系统音频回采 | BlackHole 16ch + 多输出设备 | B通道采集客户声音 (待实现) |

### Windows (VB-Cable)

| 用途 | 设备 | 说明 |
|------|------|------|
| 翻译输出 | CABLE Input | 程序输出翻译后的英文 |
| 会议麦克风 | CABLE Output | Zoom/Teams 从这里采集 |

## 已知问题与调试

### 播放声音变调/杂音

- 确认输出设备的原生采样率（脚本会自动打印）
- 检查 `debug_audio/` 目录下保存的 wav 文件是否正常
- 尝试更换输出设备测试

### 麦克风没有声音

- 运行 `cd src && python test_record.py` 录制 5 秒测试
- 检查系统设置 → 隐私与安全性 → 麦克风 → 终端/iTerm 是否有权限
- 确认没有其他应用占用麦克风

### 鉴权 401

- 确认 API Key 来自**语音控制台** (console.volcengine.com/speech/new/setting/apikeys)，不是方舟控制台
- 运行 `cd src && python auth_test.py` 测试所有鉴权组合
- 确认已开通"同声传译大模型"服务

## 参考项目

- [Doppelvoice](https://github.com/Tianqi-Bu/Doppelvoice) - MIT, Python+PySide6, Windows, 完整同传实现 (本项目 protobuf 协议参考来源)
- [openless](https://github.com/Open-Less/openless) - Rust+Tauri, ASR 为主, 鉴权实现参考
- [TransEcho](https://github.com/tianpomin/TransEcho) - macOS 字幕工具, Tauri UI 参考

## 飞书在线文档

- [技术方案可行性报告](https://my.feishu.cn/docx/Q4rIdzUono0ppwxVCnecIeNQnze)
- [项目架构与技术栈](https://my.feishu.cn/docx/LOSrdRWUtob48xx3fL2c2tw2nWb)
- [性能与成本分析](https://my.feishu.cn/docx/E3s7dbeBZowYkkxhszJce6UInWg)

## 许可证

MIT
