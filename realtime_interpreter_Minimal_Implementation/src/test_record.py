#!/usr/bin/env python3
"""
音频采集测试 - 录制5秒并保存为wav, 验证麦克风采集是否正常
用法: python3 test_record.py
"""
import sounddevice as sd
import numpy as np
import wave
import sys

# 配置
DEVICE_ID = 3          # MacBook Air麦克风
SAMPLE_RATE = 16000    # 测试16000Hz
CHANNELS = 1
DURATION = 5           # 录制5秒
OUTPUT_FILE = "test_mic_16k.wav"

print("=" * 60)
print("  麦克风采集测试")
print("=" * 60)
print(f"  设备ID: {DEVICE_ID}")
print(f"  采样率: {SAMPLE_RATE}Hz")
print(f"  时长: {DURATION}秒")
print(f"  输出: {OUTPUT_FILE}")
print()
print("  请对着麦克风说话, 5秒后自动保存...")
print()

# 录制
print("[录制] 开始...")
recording = sd.rec(
    int(DURATION * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=CHANNELS,
    dtype="int16",
    device=DEVICE_ID,
)
sd.wait()
print(f"[录制] 完成, 数据形状: {recording.shape}")

# 检查数据
data = recording[:, 0]
rms = np.sqrt(np.mean(data.astype(np.float32) ** 2))
peak = np.max(np.abs(data))
print(f"[分析] RMS: {rms:.1f} (归一化: {rms/32768:.3f})")
print(f"[分析] 峰值: {peak} (归一化: {peak/32768:.3f})")
print(f"[分析] 非零样本: {np.count_nonzero(data)}/{len(data)}")

if rms < 100:
    print("  ⚠️  RMS 太低, 麦克风可能没采集到声音!")
elif peak >= 32767:
    print("  ⚠️  峰值溢出, 麦克风增益太大, 请调低系统麦克风音量!")
else:
    print("  ✅  音频数据看起来正常")

# 保存为wav
with wave.open(OUTPUT_FILE, "wb") as wf:
    wf.setnchannels(CHANNELS)
    wf.setsampwidth(2)  # 16-bit
    wf.setframerate(SAMPLE_RATE)
    wf.writeframes(data.tobytes())

print(f"\n[保存] 已保存到 {OUTPUT_FILE}")
print(f"  播放命令: afplay {OUTPUT_FILE}")
print()
print("  听完后告诉我: 声音正常吗? 有没有变调/变速/杂音?")
