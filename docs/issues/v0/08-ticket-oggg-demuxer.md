## Goal

Land the inline OGG demuxer (~50 LoC) that strips the 2-byte `OpusHead` from the first packet of each sentence and feeds each subsequent `OpusPacket` to the `opus` crate's `Decoder::decode(packet, &mut pcm, false)` for per-chunk streaming decode — so that R3 stage 8 hits the 5 ms budget and AC1's first-sound ≤ 3000 ms median is reachable.

## Acceptance criteria

- **AC1 — A-channel first-sound ≤ 3000 ms median** (soft at v0 per D18): the demuxer replaces the PoC's 200–500 ms whole-sentence `soundfile` decode path with the per-chunk streaming decode — saves 195–495 ms (the single biggest v0 win per D9 + `04-latency-budget.md` §2.3).
- **Appendix D test #5 — SNR > 40 dB** (the highest-risk integration test per `04-latency-budget.md` §4 R3 mitigation): encode 1 s of test speech locally, send through the demuxer + `opus` decoder, assert decoded PCM matches the original within SNR > 40 dB. Verified by integration test under `src-tauri/tests/opus_demux.rs`.
- **Per-chunk decode cost ≤ 0.1 ms** (target ~0.06 ms per 20 ms packet per `02_项目架构与技术栈.md` L185–207 cited `16-streaming-first-sound-optimization.md` L61). Verified by a micro-benchmark in the same integration test.
- **No silent drops / no panics on bad input**: malformed OGG packets log a warning and skip the packet; never silently drop, never panic (per D16 spirit). Verified by a negative-path test in the same integration test.

## Implementation notes

- **Modules to be built**: `src-tauri/src/audio/opus_decode.rs` (contains the inline demuxer + `opus::Decoder::new(48000, opus::Channels::Stereo)` invocation). Approximately 50 LoC inline per `04-latency-budget.md` Appendix E decision 2 + `02-audio-pipeline.md` §5 + D21 (locked inline, no separate `opus-ogg-demux` crate at v0).
- **Demuxer responsibilities** (per `02-audio-pipeline.md` §5.1 enumeration): (1) strip the 2-byte `OpusHead` from the first packet of each sentence; (2) detect `OpusTags` once per stream and ignore; (3) feed each subsequent `OpusPacket` to `Decoder::decode(packet, &mut pcm, false)`; (4) push PCM samples to the ring (stage 7).
- **Why inline is locked (D21)**: no off-the-shelf Rust crate does streaming OGG/Opus demuxing at the granularity needed. `opus` crate is the decoder only; `ogg` crate is blocking; `lewton` is Vorbis-only; `pyogg` / `opuslib` are Python-only. Inline keeps the binary lean and lets v0 ship the demuxer without depending on an unmaintained crate.
- **Fallback compiled in behind a feature flag** (per `04-latency-budget.md` §4 R3 mitigation): the `soundfile`-equivalent whole-sentence decode path (using `ogg` + `opus` crates reading whole OGG stream) is compiled in behind `#[cfg(feature = "soundfile-fallback")]` so a v0.1 release can ship the fallback if the demuxer has bugs. v0 ships with the demuxer as canonical.
- **Decoder API** (verify exact version at impl; `opus` ~0.3.x is current per `04-latency-budget.md` Appendix C stage 8): `let mut dec = opus::Decoder::new(48000, opus::Channels::Stereo)?;` then per chunk `dec.decode(&packet, &mut pcm, false)` returning decoded sample count.
- **Reference decisions**: D9 (Opus stream decode NOT `soundfile`), D21 (inline demuxer, ~50 LoC, no `soundfile` fallback as canonical).
- **Spec cross-refs**: `02-audio-pipeline.md` §5 (Opus stream decode design + why custom demuxer is required) + §5.2 (fallback policy) + §5.3 (test plan); `04-latency-budget.md` §2 stage 8 (5 ms target, single biggest win) + §4 R3 (HIGHEST RISK) + Appendix C stage 8 (Rust crate choices) + Appendix D test 5 (SNR > 40 dB); `05-tech-stack-decisions.md` ADR-0004 (Opus decode decision).
- **Do NOT copy code** from `realtime_interpreter_Minimal_Implementation/opus_decoder.py` (git-ignored per AGENTS.md); the design intent is referenced via `poc-docs-take.md` §6 `opus_decoder.py` row but no code lines move.

## Test plan

Single acceptance seam. Per `04-latency-budget.md` Appendix D test 5 (SNR > 40 dB) + `02-audio-pipeline.md` §5.3:
- Integration test `src-tauri/tests/opus_demux.rs::decodes_known_pattern_with_high_snr`: encode 1 s of known-pattern audio with the same `opus` encoder used by Doubao (or a pre-recorded fixture), feed to the demuxer + decoder, compute SNR between input and decoded output, assert > 40 dB.
- Integration test `::decodes_chunks_without_whole_sentence_wait`: feed 5 simulated `TTSResponse(352)` chunks as they arrive (no `TTSSentenceEnd(351)` wait), assert all 5 produce PCM and the cumulative sample count matches expected.
- Integration test `::handles_malformed_packet_without_panic`: feed a deliberately corrupted packet, assert warning logged + packet skipped + decoder state remains usable for the next valid packet.
- Micro-benchmark (loose, not gating): measure per-chunk decode time over 1000 chunks, assert p99 ≤ 0.1 ms (well under the 0.5 ms per-stage budget; gives margin for the rest of stage 8 overhead).
- Latency-probe binary (ticket #07) runs end-to-end with the demuxer and asserts median ≤ 3000 ms — but that depends on the full R3 stack (ticket #03).

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml pinning of `opus` crate).
- **Blocks #03** (R3 audio pipeline assembly) — stage 8 of the R3 waterfall consumes this demuxer.
- **Blocks #07** (latency-probe binary) — the probe needs the demuxer in place to hit AC1's ≤ 3 s target.

## Out of scope for this ticket

- **Whole-sentence decode fallback as the canonical path** — D21 explicitly forbids this; the fallback is `#[cfg(feature = "soundfile-fallback")]` only.
- **Vorbis / Speex / other codec support** — Opus only.
- **Network jitter buffering / WS frame reassembly** — that lives in `audio/ring.rs` (stage 7), not in this ticket.
- **Streaming metadata parsing** — `OpusTags` is detected once and ignored per the demuxer responsibilities; no tags-based features.
