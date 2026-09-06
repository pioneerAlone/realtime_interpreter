#!/usr/bin/env python3
"""
实时同传阶段1最小验证 v2 (macOS / A通道 中→英)
基于 Doppelvoice 成熟实现移植：纯 protobuf 协议 + ogg_opus 解码

修复 v1 的问题：
  1. 协议从 JSON 改为纯 protobuf (TranslateRequest/TranslateResponse)
  2. 鉴权支持新版(X-Api-Key)和旧版(X-Api-App-Key+Access-Key)
  3. target_audio 用 ogg_opus 48kHz (PCM 格式 API 目前不生效)
  4. source_audio.format = "wav" (不是 pcm)
  5. 等 SessionStarted(150) 后再发音频
  6. TTSResponse 累积 ogg_opus，TTSSentenceEnd 后用 soundfile 解码
  7. 队列满时丢最旧帧 (修复 QueueFull)
  8. 连接断开自动停止采集

用法:
  python3 mac_ast2_s2s_v2.py --list-devices    # 枚举设备
  python3 mac_ast2_s2s_v2.py                    # 运行验证
"""
from __future__ import annotations

import argparse
import asyncio
import io
import queue
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import sounddevice as sd
import websockets

# ── protobuf 绑定 (从 Doppelvoice 移植) ──
from ast_proto.products.understanding.ast import ast_service_pb2
from ast_proto.common import events_pb2

EventType = events_pb2.Type
STATUS_SUCCESS = 20000000

# ============================================================
#  配置区 (请填写)
# ============================================================
# 鉴权方式二选一：
#   新版控制台: 填 API_KEY (从 console.volcengine.com/ark 的 API Key 管理获取)
#   旧版控制台: 填 APP_KEY + ACCESS_KEY
API_KEY = ""          # 新版: 只需这一个
APP_KEY = ""          # 旧版: App Key
ACCESS_KEY = ""       # 旧版: Access Key

RESOURCE_ID = "volc.service_type.10053"
WS_URL = "wss://openspeech.bytedance.com/api/v4/ast/v2/translate"

# 音频设备 (用 --list-devices 查看 ID)
MIC_DEVICE_ID = 3        # MacBook Air麦克风 (根据你的设备列表修改)
OUTPUT_DEVICE_ID = 2     # BlackHole 2ch

# 音频参数
INPUT_SAMPLE_RATE = 16000
INPUT_BITS = 16
INPUT_CHANNELS = 1
FRAME_MS = 80                              # 每包音频时长
OUTPUT_FORMAT = "ogg_opus"                 # API 目前只支持 ogg_opus
OUTPUT_SAMPLE_RATE = 48000                 # ogg_opus 固定 48kHz
JITTER_BUFFER_MS = 120                     # 播放缓冲 (ogg_opus句末解码, 建议100-150ms, 太小会爆音)

# 翻译参数
SOURCE_LANG = "zh"
TARGET_LANG = "en"
MODE = "s2s"                               # s2s=语音输出, s2t=仅字幕
SPEAKER_ID = ""                            # 空=零样本克隆
DENOISE = False                            # False 保留音色细节

# ============================================================

FRAME_SAMPLES = int(INPUT_SAMPLE_RATE * FRAME_MS / 1000)
SILENCE_FRAME = b"\x00" * (FRAME_SAMPLES * 2)


@dataclass
class Stats:
    start_time: float = field(default_factory=time.time)
    sentences: int = 0
    packets_sent: int = 0
    packets_recv: int = 0
    first_audio_time: Optional[float] = None
    last_latency_ms: float = 0
    mic_level: float = 0
    out_level: float = 0
    connected: bool = False
    # 静音检测
    last_voice_time: float = field(default_factory=time.time)
    silence_cleared: bool = False


# 静音检测参数
SILENCE_THRESHOLD = 0.015    # 麦克风电平低于此值视为静音 (归一化 0~1)
SILENCE_CLEAR_MS = 2000      # 静音持续多久后清空字幕和播放队列 (ms)


stats = Stats()
stop_event = threading.Event() if False else asyncio.Event()  # type: ignore


# ── 设备枚举 ──
def list_devices():
    print("\n" + "=" * 70)
    print("  音频设备列表 (请记录麦克风和 BlackHole 的 ID)")
    print("=" * 70)
    print(f"  {'ID':>3}  {'名称':<40} {'输入':>4} {'输出':>4}  {'采样率':>6}")
    print("-" * 70)
    devices = sd.query_devices()
    for i, d in enumerate(devices):
        name = d["name"][:38]
        print(f"  {i:>3}  {name:<40} {d['max_input_channels']:>4} {d['max_output_channels']:>4}  {int(d['default_samplerate']):>6}")
    print("-" * 70)
    print(f"  默认输入设备: {sd.default.device[0]}")
    print(f"  默认输出设备: {sd.default.device[1]}")
    print()


# ── OggOpus 累积解码器 (简化版, 去掉loguru) ──
class OggOpusDecoder:
    MAX_BUF_BYTES = 64 * 1024 * 1024

    def __init__(self):
        self._chunks: list[bytes] = []
        self._size = 0

    def feed(self, chunk: bytes):
        if not chunk:
            return
        if self._size + len(chunk) > self.MAX_BUF_BYTES:
            print(f"[opus] 缓冲超限, 丢弃 {len(self._chunks)} 个分片")
            self._chunks.clear()
            self._size = 0
            return
        self._chunks.append(chunk)
        self._size += len(chunk)

    def drain(self, target_sr: int) -> bytes:
        if not self._chunks:
            return b""
        blob = b"".join(self._chunks)
        self._chunks = []
        self._size = 0
        try:
            import soundfile as sf
            data, sr = sf.read(io.BytesIO(blob), dtype="float32")
        except Exception as e:
            print(f"[opus] 解码失败: {e}, blob_len={len(blob)}")
            return b""
        if data.ndim > 1:
            data = data.mean(axis=1)
        pcm16 = np.clip(data * 32767.0, -32768, 32767).astype(np.int16)
        if sr != target_sr:
            from resample import resample_int16
            pcm16 = resample_int16(pcm16, sr, target_sr)
        return pcm16.tobytes()

    def reset(self):
        self._chunks = []
        self._size = 0


# ── 麦克风采集 (线程安全, 队列满丢最旧) ──
def mic_callback(indata, frames, time_info, status):
    if status:
        pass
    # 自动检测数据类型, 统一转成 int16 PCM
    if np.issubdtype(indata.dtype, np.floating):
        # float32 (-1~1) → int16
        pcm_data = np.clip(indata[:, 0] * 32767.0, -32768, 32767).astype(np.int16)
        rms = float(np.sqrt(np.mean(indata[:, 0].astype(np.float32) ** 2))) if len(indata) > 0 else 0
    else:
        # int16
        pcm_data = indata[:, 0].astype(np.int16)
        rms = float(np.sqrt(np.mean(indata[:, 0].astype(np.float32) ** 2)) / 32768.0) if len(indata) > 0 else 0
    pcm = pcm_data.tobytes()
    stats.mic_level = rms
    try:
        audio_queue.put_nowait(pcm)
    except queue.Full:
        try:
            audio_queue.get_nowait()
            audio_queue.put_nowait(pcm)
        except queue.Empty:
            pass


audio_queue: queue.Queue = queue.Queue(maxsize=50)

# ── 播放缓冲 (Doppelvoice 专业实现: bytearray环形缓冲 + 锁 + 蓄能机制) ──
import threading as _threading
_playback_buf = bytearray()
_playback_lock = _threading.Lock()
_playback_started = False
_playback_underruns = 0
_playback_min_start_bytes = 0
_playback_restart_bytes = 0
_playback_max_buf_bytes = 0
_playback_silence = b""
_out_sr = 48000  # 输出设备采样率 (main函数里设置)


def push_playback_pcm(pcm_bytes: bytes) -> None:
    """将解码后的PCM推入播放缓冲 (线程安全)。超上限丢最早数据防漂移。"""
    if not pcm_bytes:
        return
    with _playback_lock:
        _playback_buf.extend(pcm_bytes)
        if _playback_max_buf_bytes and len(_playback_buf) > _playback_max_buf_bytes:
            excess = len(_playback_buf) - _playback_max_buf_bytes
            del _playback_buf[:excess]


def flush_playback() -> None:
    """清空播放缓冲 (重连/静音时使用)。"""
    global _playback_started
    with _playback_lock:
        _playback_buf.clear()
        _playback_started = False


# ── 播放回调 (运行在音频线程, RawOutputStream直接写原始字节) ──
def playback_callback(outdata, frames, time_info, status):
    global _playback_started, _playback_underruns
    need = frames * 2  # int16 mono
    threshold = _playback_min_start_bytes if _playback_underruns == 0 else _playback_restart_bytes
    with _playback_lock:
        if not _playback_started:
            if len(_playback_buf) >= threshold:
                _playback_started = True
            else:
                # 蓄能阶段: 输出静音
                outdata[:need] = _playback_silence[:need]
                return
        if len(_playback_buf) >= need:
            # 直接slice写ctypes buffer, 零拷贝
            outdata[:need] = bytes(_playback_buf[:need])
            del _playback_buf[:need]
            # 输出电平 (从原始字节计算RMS)
            arr = np.frombuffer(outdata[:need], dtype=np.int16)
            stats.out_level = float(np.sqrt(np.mean(arr.astype(np.float32) ** 2)) / 32768.0) if len(arr) > 0 else 0
        else:
            # underrun: 能吐多少吐多少, 其余静音
            have = len(_playback_buf)
            if have > 0:
                outdata[:have] = bytes(_playback_buf[:have])
                outdata[have:need] = _playback_silence[:need - have]
                _playback_buf.clear()
            else:
                outdata[:need] = _playback_silence[:need]
            _playback_underruns += 1
            _playback_started = False  # 重新进入蓄能阶段
            stats.out_level = 0


# ── 构建鉴权 header ──
def build_headers() -> list[tuple[str, str]]:
    connect_id = str(uuid.uuid4())
    if API_KEY:
        # 新版控制台鉴权
        return [
            ("X-Api-Key", API_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
        ]
    else:
        # 旧版控制台鉴权
        return [
            ("X-Api-App-Key", APP_KEY),
            ("X-Api-Access-Key", ACCESS_KEY),
            ("X-Api-Resource-Id", RESOURCE_ID),
            ("X-Api-Connect-Id", connect_id),
        ]


# ── 主流程 ──
async def main():
    if MIC_DEVICE_ID is None or OUTPUT_DEVICE_ID is None:
        print("[错误] 请先设置 MIC_DEVICE_ID 和 OUTPUT_DEVICE_ID")
        print("       运行 python3 mac_ast2_s2s_v2.py --list-devices 查看设备")
        return

    if not API_KEY and not (APP_KEY and ACCESS_KEY):
        print("[错误] 请配置鉴权:")
        print("       新版: 填写 API_KEY")
        print("       旧版: 填写 APP_KEY + ACCESS_KEY")
        return

    print("\n" + "=" * 70)
    print("  实时同传阶段1验证 v2 (macOS / A通道 中→英)")
    print("=" * 70)
    print(f"  引擎: 豆包 AST 2.0 s2s | 零样本克隆 | ogg_opus 输出")
    print(f"  输入: {INPUT_SAMPLE_RATE}Hz/{INPUT_BITS}bit/mono | 输出: {OUTPUT_FORMAT} {OUTPUT_SAMPLE_RATE}Hz")
    print(f"  麦克风设备ID: {MIC_DEVICE_ID}")
    print(f"  输出设备ID: {OUTPUT_DEVICE_ID} (BlackHole)")
    print(f"  鉴权: {'新版 X-Api-Key' if API_KEY else '旧版 App-Key+Access-Key'}")
    print(f"  本地降噪: 关闭 | denoise(服务端): {DENOISE}")
    print(f"  Jitter Buffer: {JITTER_BUFFER_MS}ms")
    print("=" * 70)
    print("  验证方法:")
    print("    1. 打开 Zoom/Teams/腾讯会议")
    print("    2. 麦克风选择 'BlackHole 2ch'")
    print("    3. 对着电脑说中文，客户应听到英文(你的音色)")
    print("    4. 观察控制台延迟和电平")
    print("    5. Ctrl+C 退出")
    print("=" * 70 + "\n")

    # 启动麦克风采集
    print("[采集] 麦克风采集启动...")
    mic_stream = sd.InputStream(
        device=MIC_DEVICE_ID,
        samplerate=INPUT_SAMPLE_RATE,
        channels=INPUT_CHANNELS,
        dtype="int16",
        blocksize=FRAME_SAMPLES,
        callback=mic_callback,
    )
    mic_stream.start()

    # 启动播放 (输出到 BlackHole)
    # 查询输出设备的原生采样率
    out_dev = sd.query_devices(OUTPUT_DEVICE_ID)
    out_sr = int(out_dev["default_samplerate"])
    print(f"[播放] 输出设备ID={OUTPUT_DEVICE_ID}, 原生采样率={out_sr}Hz")

    # 初始化播放缓冲参数 (Doppelvoice 专业实现)
    global _playback_min_start_bytes, _playback_restart_bytes, _playback_max_buf_bytes, _playback_silence, _out_sr
    _out_sr = out_sr
    bytes_per_ms = out_sr * 2 // 1000  # int16 mono
    frames_per_chunk = int(out_sr * 0.02)  # 20ms一块
    _playback_min_start_bytes = JITTER_BUFFER_MS * bytes_per_ms
    _playback_restart_bytes = max(_playback_min_start_bytes // 3, 80 * bytes_per_ms)
    _playback_max_buf_bytes = 30_000 * bytes_per_ms  # 30秒上限
    _playback_silence = b"\x00" * (frames_per_chunk * 2)

    play_stream = sd.RawOutputStream(
        device=OUTPUT_DEVICE_ID,
        samplerate=out_sr,
        channels=1,
        dtype="int16",
        blocksize=frames_per_chunk,
        latency="low",
        callback=playback_callback,
    )
    play_stream.start()
    print(f"[播放] 已启动 (RawOutputStream, 蓄能={JITTER_BUFFER_MS}ms, 低延迟模式)")

    opus_decoder = OggOpusDecoder()
    session_id = ""
    audio_req_template = None

    try:
        # 连接 WebSocket
        print(f"[WS] 正在连接 {WS_URL} ...")
        headers = build_headers()
        async with websockets.connect(
            WS_URL,
            additional_headers=headers,
            max_size=4 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=30,
            close_timeout=5,
        ) as ws:
            print("[WS] 已连接, 发送 StartSession...")

            # 发送 StartSession
            session_id = str(uuid.uuid4())
            req = ast_service_pb2.TranslateRequest()
            req.request_meta.SessionID = session_id
            req.event = EventType.StartSession
            req.user.uid = "ast_py_client"
            req.user.did = "ast_py_client"
            req.source_audio.format = "wav"
            req.source_audio.rate = INPUT_SAMPLE_RATE
            req.source_audio.bits = INPUT_BITS
            req.source_audio.channel = INPUT_CHANNELS
            req.request.mode = MODE
            req.request.source_language = SOURCE_LANG
            req.request.target_language = TARGET_LANG
            if SPEAKER_ID:
                req.request.speaker_id = SPEAKER_ID
            req.denoise = DENOISE
            if MODE == "s2s":
                req.target_audio.format = OUTPUT_FORMAT
                req.target_audio.rate = OUTPUT_SAMPLE_RATE

            await ws.send(req.SerializeToString())

            # 等 SessionStarted
            raw = await asyncio.wait_for(ws.recv(), timeout=15)
            resp = ast_service_pb2.TranslateResponse()
            resp.ParseFromString(raw)
            if resp.event == EventType.SessionStarted:
                print(f"[WS] 会话已开始 (session_id={session_id[:8]}...), 可以开始说话了！")
                stats.connected = True
            else:
                status = resp.response_meta.StatusCode if resp.HasField("response_meta") else 0
                msg = resp.response_meta.Message if resp.HasField("response_meta") else ""
                print(f"[错误] 会话启动失败: event={resp.event} status={status} msg={msg}")
                return

            # 构建音频发送模板
            audio_req_template = ast_service_pb2.TranslateRequest()
            audio_req_template.request_meta.SessionID = session_id
            audio_req_template.event = EventType.TaskRequest
            audio_req_template.source_audio.format = "wav"
            audio_req_template.source_audio.rate = INPUT_SAMPLE_RATE
            audio_req_template.source_audio.bits = INPUT_BITS
            audio_req_template.source_audio.channel = INPUT_CHANNELS

            # 启动监控任务
            monitor_task = asyncio.create_task(monitor_loop())

            # 主循环: 发送音频 + 接收响应
            sender_task = asyncio.create_task(sender_loop(ws, audio_req_template))
            await receiver_loop(ws, opus_decoder, out_sr)

    except websockets.ConnectionClosed as e:
        print(f"\n[WS] 连接关闭: code={e.code} reason={e.reason}")
    except asyncio.TimeoutError:
        print("\n[错误] 等待 SessionStarted 超时 (15s)")
        print("       可能原因: API Key 错误 / 服务未开通 / 网络不通")
    except Exception as e:
        print(f"\n[错误] {type(e).__name__}: {e}")
    finally:
        stats.connected = False
        mic_stream.stop()
        mic_stream.close()
        play_stream.stop()
        play_stream.close()
        print_stats()


# ── 发送音频循环 ──
async def sender_loop(ws, audio_req_template):
    last_send = time.time()
    while True:
        try:
            pcm = audio_queue.get_nowait()
        except queue.Empty:
            # 静音时发静音包保活 (每80ms一包)
            await asyncio.sleep(0.01)
            if time.time() - last_send > 0.08:
                pcm = SILENCE_FRAME
            else:
                continue
        try:
            audio_req_template.source_audio.binary_data = pcm
            await ws.send(audio_req_template.SerializeToString())
            stats.packets_sent += 1
            last_send = time.time()
        except Exception as e:
            print(f"[WS] 发送失败: {e}")
            break


# ── 接收响应循环 ──
async def receiver_loop(ws, opus_decoder: OggOpusDecoder, out_sr: int):
    async for raw in ws:
        if not isinstance(raw, (bytes, bytearray)):
            continue
        stats.packets_recv += 1
        try:
            resp = ast_service_pb2.TranslateResponse()
            resp.ParseFromString(raw)
        except Exception as e:
            print(f"[WS] protobuf解码失败: {e}")
            continue

        event = resp.event

        # 原文
        if event == EventType.SourceSubtitleResponse and resp.text:
            print(f"\r[原文] {resp.text}", end="", flush=True)
        elif event == EventType.SourceSubtitleEnd:
            print()  # 换行

        # 译文
        if event == EventType.TranslationSubtitleResponse and resp.text:
            print(f"\r[译文] {resp.text}", end="", flush=True)
        elif event == EventType.TranslationSubtitleEnd:
            print()

        # TTS 音频
        if event == EventType.TTSSentenceStart:
            opus_decoder.reset()
        elif event == EventType.TTSResponse and resp.data:
            opus_decoder.feed(resp.data)
            if stats.first_audio_time is None:
                stats.first_audio_time = time.time()
        elif event == EventType.TTSSentenceEnd:
            # 解码 (最基本调用, 兼容所有版本的 opus_decoder)
            pcm_bytes = opus_decoder.drain(out_sr)
            if pcm_bytes:
                stats.sentences += 1

                # 调试: 保存解码后的PCM为wav (不依赖opus_decoder特殊方法)
                try:
                    import wave
                    import os
                    debug_dir = "debug_audio"
                    os.makedirs(debug_dir, exist_ok=True)
                    wav_path = os.path.join(debug_dir, f"tts_{stats.sentences:03d}.wav")
                    with wave.open(wav_path, "wb") as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(out_sr)
                        wf.writeframes(pcm_bytes)
                    duration_ms = len(pcm_bytes) / 2 / out_sr * 1000
                    print(f"\n[调试] 已保存: {wav_path} ({len(pcm_bytes)}B, {duration_ms:.0f}ms @ {out_sr}Hz)")
                except Exception as e:
                    print(f"\n[调试] 保存wav失败: {e}")

                # 计算延迟 (从说话开始到第一句音频可播放)
                if stats.first_audio_time:
                    stats.last_latency_ms = int((time.time() - stats.first_audio_time) * 1000)
                    stats.first_audio_time = None
                # 推入播放缓冲 (bytearray环形缓冲, 自动处理上限和线程安全)
                push_playback_pcm(pcm_bytes)

        # 错误
        status = resp.response_meta.StatusCode if resp.HasField("response_meta") else 0
        if status and status != STATUS_SUCCESS:
            msg = resp.response_meta.Message if resp.HasField("response_meta") else ""
            print(f"\n[错误] 服务端错误: code={status} msg={msg}")
            if status in (45000001, 45000002, 45000151):
                break  # 参数错误/空音频/格式错误, 不可恢复


# ── 监控循环 ──
async def monitor_loop():
    while stats.connected:
        elapsed = time.time() - stats.start_time

        # ── 静音检测: 不说话时自动清空字幕和播放缓冲 ──
        if stats.mic_level > SILENCE_THRESHOLD:
            stats.last_voice_time = time.time()
            if stats.silence_cleared:
                stats.silence_cleared = False
                print("\r[状态] 检测到语音, 恢复翻译..." + " " * 30)
        else:
            silence_ms = (time.time() - stats.last_voice_time) * 1000
            if silence_ms > SILENCE_CLEAR_MS and not stats.silence_cleared:
                stats.silence_cleared = True
                # 清空播放缓冲
                flush_playback()
                print(f"\r[状态] 静音 {int(silence_ms)}ms, 已清空字幕和播放缓冲" + " " * 10)

        # 计算播放缓冲深度 (ms)
        with _playback_lock:
            buf_ms = int(len(_playback_buf) / 2 / _out_sr * 1000)

        bar_mic = "█" * int(min(stats.mic_level, 1.0) * 10) + "░" * (10 - int(min(stats.mic_level, 1.0) * 10))
        bar_out = "█" * int(min(stats.out_level, 1.0) * 10) + "░" * (10 - int(min(stats.out_level, 1.0) * 10))
        print(
            f"\r[监控] 时长:{elapsed:5.1f}s | "
            f"延迟:{stats.last_latency_ms:>4}ms | "
            f"翻译:{stats.sentences:>3}句 | "
            f"发:{stats.packets_sent:>4} 收:{stats.packets_recv:>4} | "
            f"缓冲:{buf_ms:>4}ms | "
            f"麦:[{bar_mic}] 译:[{bar_out}]",
            end="", flush=True,
        )
        await asyncio.sleep(0.5)


# ── 统计输出 ──
def print_stats():
    elapsed = time.time() - stats.start_time
    print("\n" + "=" * 50)
    print("  最终统计")
    print("=" * 50)
    print(f"  会话时长: {elapsed:.1f}s")
    print(f"  翻译句数: {stats.sentences}")
    print(f"  发送包数: {stats.packets_sent}")
    print(f"  接收包数: {stats.packets_recv}")
    print(f"  最后延迟: {stats.last_latency_ms}ms")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--list-devices", action="store_true", help="枚举音频设备")
    args = parser.parse_args()

    if args.list_devices:
        list_devices()
    else:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            stats.connected = False
            print("\n\n[用户中断] 正在退出...")
            print_stats()
