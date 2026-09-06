"""Ogg/Opus 流解码器。

豆包 TTS s2s 会返回 ogg_opus 分片：TTSSentenceStart 后会陆续到来 TTSResponse（每个携带
ogg chunk），TTSSentenceEnd 标记整句结束。单个 TTSResponse 通常不是完整 OGG 文件，需要
累积到句末一次性交给 soundfile 解码。
"""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import soundfile as sf
# logger removed, use print instead


class OggOpusDecoder:
    """累积一句内的 ogg_opus 分片，在 finalize 时解码为 int16 PCM。

    防御：服务端如果只发 sentence_start 不发 sentence_end（恶意/bug），
    `_chunks` 会无界增长致 OOM。`MAX_BUF_BYTES` = 64 MB 上限：超过后强制
    丢弃所有累积，相当于这句话被服务端"挂起"。正常一句 ogg_opus ≤ ~50 KB，
    64 MB 留 1000+ 倍冗余。
    """

    MAX_BUF_BYTES = 64 * 1024 * 1024

    def __init__(self) -> None:
        self._chunks: list[bytes] = []
        self._size: int = 0  # cached running total to avoid sum() on each feed

    def feed(self, chunk: bytes) -> None:
        if not chunk:
            return
        if self._size + len(chunk) > self.MAX_BUF_BYTES:
            print(f"[opus] WARNING: buffer would exceed {self.MAX_BUF_BYTES} bytes, dropping {len(self._chunks)} chunks")
            self._chunks.clear()
            self._size = 0
            return
        self._chunks.append(chunk)
        self._size += len(chunk)

    def has_data(self) -> bool:
        return bool(self._chunks)

    def size(self) -> int:
        return self._size

    def peek_blob(self) -> bytes:
        """返回当前累积的 ogg blob（不清除内部数据）。用于调试落盘。"""
        if not self._chunks:
            return b""
        return b"".join(self._chunks)

    def drain(self, target_sr: int) -> bytes:
        """解码累积数据到 int16 mono PCM bytes。调用后内部清空。"""
        if not self._chunks:
            return b""
        blob = b"".join(self._chunks)
        self._chunks = []
        self._size = 0

        try:
            data, sr = sf.read(io.BytesIO(blob), dtype="float32")
        except Exception as e:
            print(f"[opus] WARNING: decode FAILED: {e}; blob_len={len(blob)} head_hex={blob[:32].hex()}")
            return b""

        if data.ndim > 1:
            data = data.mean(axis=1)

        native_duration = len(data) / sr
        print(f"\n[opus] 解码: blob={len(blob)}B → {len(data)} samples @ {sr}Hz → target {target_sr}Hz, duration={native_duration:.2f}s")

        pcm16 = np.clip(data * 32767.0, -32768, 32767).astype(np.int16)
        if sr != target_sr:
            from resample import resample_int16
            pcm16 = resample_int16(pcm16, sr, target_sr)

        # 验证时长一致（重采样后 duration 应保持不变）
        out_duration = len(pcm16) / target_sr
        if abs(out_duration - native_duration) > 0.05:  # 50ms 容差
            print(f"[opus] WARNING: 重采样 duration 不一致: 源 {native_duration:.3f}s → 输出 {out_duration:.3f}s")

        return pcm16.tobytes()

    def reset(self) -> None:
        self._chunks = []
        self._size = 0
