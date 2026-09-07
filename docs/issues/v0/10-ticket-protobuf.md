## Goal

Land the `prost`-generated Rust protobuf bindings from the Doppelvoice `.proto` source (MIT-licensed, vendored under Apache-2.0) — covering the s2s `TaskRequest(200)` / `TTSResponse(352)` / `TTSSentenceEnd(351)` frames AND the s2t 650–655 subtitle events — so that R3 and R4 sessions have typed serialization for both outbound and inbound messages on the same WebSocket.

## Acceptance criteria

- **D16 — Full event superset handled**: bindings cover s2s events 100/150/200/211/221/351/352/999 (per `poc-docs-take.md` §3 row "Event codes the PoC handles") AND s2t events 650/651/652 (SourceSubtitle) + 653/654/655 (TranslationSubtitle). Unknown event codes are parsed as the protobuf `Unknown` variant and logged, never silently dropped, never panicked.
- **`TaskRequest` outbound** (s2s mode): typed Rust struct with `mode`, `source_language` (`zh` hard-coded per D23), `target_language` (`en` hard-coded per D23), `speaker_id` (`""` per D14), `denoise` (`false` per D24-related doctrine), `format` (`"ogg_opus"` — `format="pcm"` is not honored per `poc-docs-take.md` §4.1), `source_audio` (16 kHz mono frames).
- **`Subtitle` structured** (s2t mode): typed Rust struct per `03-b-channel-subtitle.md` §1 — `id`, `timestamp_ms`, `speaker`, `source_text`, `translation_text`, `is_final`.
- **License clarity**: vendored `.proto` carries an `Apache-2.0` SPDX header per `06-deliverables.md` §1.3; `Cargo.toml` notes the provenance (Doppelvoice is MIT — we can copy the `.proto` with copyright preserved per `poc-docs-take.md` §6 row).

## Implementation notes

- **Modules to be built**: `src-tauri/src/doubao/proto.rs` (re-export of `prost`-generated types); `src-tauri/proto/doppelvoice/v1/translate.proto` (vendored `.proto` source — obtained from Doppelvoice, MIT-licensed, Apache-2.0 attribution preserved per `poc-docs-take.md` §6 "ast_proto/" row); `build.rs` (calls `tonic-build` or `prost-build` to generate Rust types at build time); `src-tauri/src/doubao/event.rs` (event code dispatcher — matches events 100/150/200/211/221/351/352/650–655/999; logs unknown variants; never panics).
- **Crate choice** (per `04-latency-budget.md` Appendix C "Protobuf" row + `05-tech-stack-decisions.md` ADR-0006): `prost 0.13.x` + `tonic 0.12.x` (verify versions at impl). `prost-build` for code-gen; `prost` for runtime encode/decode.
- **`.proto` source provenance** (per `poc-docs-take.md` §6 + ADR-0006): the original `.proto` is **not** in the PoC repo per `poc-docs-take.md` §7 "What the PoC does not contain" — must be obtained from the Doppelvoice repo (MIT) or written from the Wire-compatible binary schema. Action item at ticket kickoff: confirm with the user where the `.proto` lives (or accept a known-good copy committed to `proto/`).
- **Build pipeline**: `build.rs` invokes `prost_build::Config::new().compile_protos(&["proto/doppelvoice/v1/translate.proto"], &["proto/"])?;` so generated types land in `OUT_DIR/doppelvoice.v1.translate.rs` and are re-exported via `pub mod doppelvoice { include!(concat!(env!("OUT_DIR"), "/doppelvoice.v1.translate.rs")); }`.
- **Event code dispatch** (per D16): a `pub enum DoubaoEvent { TaskStarted, TtsSentenceStart, TtsSentenceEnd, TtsResponseChunk, SourceSubtitleStart, SourceSubtitleComplete, SourceSubtitleDelta, TranslationSubtitleStart, TranslationSubtitleComplete, TranslationSubtitleDelta, Unknown(u32) }` and a `parse(code: u32, payload: &[u8]) -> Result<DoubaoEvent, DecodeError>` that matches all known codes and maps unknown codes to `Unknown(n)` (never silently drop).
- **Reference decisions**: D14 (canonical event superset), D16 (full superset 100/150/200/351/352/650–655/999), D23 (zh↔en hard-coded), ADR-0006 (prost-generated Rust).
- **Spec cross-refs**: `01-architecture.md` §3 (module layout — `doubao/proto.rs`); `03-b-channel-subtitle.md` §1 (Subtitle schema + event reconciliation table 650–655); `04-latency-budget.md` Appendix C "Protobuf" row (prost + tonic); `05-tech-stack-decisions.md` ADR-0006 (prost decision + license path); `poc-docs-take.md` §3 (event codes the PoC handles) + §6 `ast_proto/` row.

## Test plan

Single acceptance seam. Verified by:
- Build smoke: `cargo build` succeeds; `cargo build --release` succeeds; generated types are importable from `crate::doubao::proto::*`.
- Round-trip integration test `src-tauri/tests/proto_roundtrip.rs`: construct a `TaskRequest` outbound frame, serialize to bytes, deserialize, assert structural equality. Same for `TtsResponse` chunk inbound and for each of the 6 s2t subtitle events.
- Unknown event test: feed an event with an unknown code (e.g., 12345), assert the parser returns `DoubaoEvent::Unknown(12345)` and does NOT panic.
- Self-meeting test (ticket #12) exercises the bindings end-to-end (R3 outbound `TaskRequest`, R3 inbound `TTSResponse(352)`, R4 inbound `SourceSubtitleComplete` + `TranslationSubtitleComplete`).
- Latency-probe binary (ticket #07) uses the bindings for both R3 + R4.

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml + `prost`/`tonic`/`prost-build` deps).
- **Action item at ticket kickoff**: obtain the `.proto` source from Doppelvoice (MIT, vendored Apache-2.0 per `06-deliverables.md` §1.3). Without it, this ticket cannot proceed.
- **Blocks #03** (R3 audio) and #04 (R4 audio) — both encode/decode through these bindings.

## Out of scope for this ticket

- **Writing a `.proto` from scratch if Doppelvoice refuses to share** — out of scope for v0 (escalate to user); v0 requires the canonical Doppelvoice `.proto`.
- **gRPC / HTTP/2 transport** — v0 uses WebSocket (`tokio-tungstenite`) only; tonic is included for prost-build compatibility but no gRPC server/client is built.
- **Schema migration / versioning** — v0 ships one `.proto` revision; future versions are v1+ work.
- **Custom error types for protobuf decode failures** — minimal error mapping only; panics on truly malformed protobuf (treated as a fatal bug).
