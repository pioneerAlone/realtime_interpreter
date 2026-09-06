#!/usr/bin/env python3
"""
配置示例文件
复制此文件为 config.py 并修改以下配置项
"""

# ==================== 鉴权配置 (二选一) ====================

# 【推荐】新版语音控制台 API Key
# 获取地址: https://console.volcengine.com/speech/new/setting/apikeys
API_KEY = "your-api-key-here"

# 【旧版兼容】语音控制台 App Key + Access Key
# 获取地址: https://console.volcengine.com/speech/app
APP_KEY = ""          # 留空则使用上面的 API_KEY
ACCESS_KEY = ""       # 留空则使用上面的 API_KEY

# ==================== 固定配置 (不要改) ====================

RESOURCE_ID = "volc.service_type.10053"
WS_URL = "wss://openspeech.bytedance.com/api/v4/ast/v2/translate"

# ==================== 音频设备配置 ====================

# 用以下命令查看设备列表:
#   python mac_ast2_s2s_v2.py --list-devices

MIC_DEVICE_ID = 3        # 麦克风 (MacBook Air麦克风)
OUTPUT_DEVICE_ID = 2     # 翻译输出 (BlackHole 2ch)

# ==================== 翻译配置 ====================

SOURCE_LANGUAGE = "zh"   # 源语言: 中文
TARGET_LANGUAGE = "en"   # 目标语言: 英文

# ==================== 音频参数 ====================

INPUT_SAMPLE_RATE = 16000   # 输入采样率 (API 要求 16000)
INPUT_CHANNELS = 1            # 输入声道 (单声道)
FRAME_SAMPLES = 1280          # 每帧采样数 (80ms @ 16000Hz)

# ==================== 播放配置 ====================

JITTER_BUFFER_MS = 80        # 播放抖动缓冲 (ms)
OUTPUT_SAMPLE_RATE = 48000   # 输出采样率 (ogg_opus 解码后)

# ==================== 调试配置 ====================

DEBUG_SAVE_AUDIO = True       # 保存翻译后的音频到 debug_audio/ 目录
DENOISE_SERVER = False        # 服务端降噪 (关闭以保留音色细节)
SPEAKER_ID = ""               # 音色ID (空=零样本克隆, 自动从输入提取)
