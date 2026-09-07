# CONTEXT.md — realtime_interpreter

> Project domain glossary (per `/domain-modeling` skill, lazy-created
> when first needed). For v0 the project is a scaffold; this file will
> be populated as tickets #03-#13 introduce new domain concepts
> (audio routing, WebSocket events, topology checks, etc.).

## Domain terms (alphabetical)

- **AST 2.0 S2S**: 火山引擎 Doubao 同传 2.0 Speech-to-Speech mode; server-side streaming that takes Chinese audio and returns TTS-cloned English audio (per docs/spec/v0/01-architecture.md §5).
- **AST 2.0 S2T**: 火山引擎 Doubao 同传 2.0 Speech-to-Text mode; server-side streaming that takes English audio and returns bilingual subtitle events (650-655 event codes per docs/research/poc-docs-take.md §5 Q13).
- **Aggregate Device**: macOS Audio MIDI Setup construct that bundles multiple physical/virtual audio devices into one logical device the OS sees as a single endpoint (per docs/spec/v0/02-audio-pipeline.md Appendix A.4).
- **BlackHole 16ch**: virtual audio driver (D16) used as a 16-channel output for meeting software (mic input) and a 16-channel loopback for program input via Aggregate Device (per docs/spec/v0/02-audio-pipeline.md Appendix A.2-A.3).
- **capsule**: Open-Less term for the floating secondary window; in this project it is the subtitle NSPanel (per docs/spec/v0/03-b-channel-subtitle.md §2.1).
- **cosine similarity**: voice-identity similarity metric used in the D30-Q3 reconnect acceptance criterion (cosine ≥ 0.85 between chunk before drop and chunk after reconnect).
- **Denial-of-context / soundfile whole-sentence decode**: anti-pattern replaced by the inline OGG demuxer (per D9 / D21; ticket #08).
- **NSPanel**: macOS NSWindow subclass that does not activate the owning app; used for the floating subtitle window so it does not steal keyboard focus from the meeting software (per D20; ticket #02 / D6).
- **R3 / R4 / 原声直出**: the three labelled flows:
  - R3 = you-speak → client-hears (s2s, S2S)
  - R4 = client-speaks → you-read (s2t, S2T)
  - 原声直出 (bypass) = parallel-route to physical headphones so you hear original English with 0 ms delay (per D24; ticket #11)
- **speaker_id=""**: Doubao API convention for zero-shot voice clone; the API extracts the speaker's voice profile from the input audio stream (per D30-Q1, ticket #02 audio stub).
- **Topography check**: pre-flight 4-device wiring check that validates mic + BH 2ch + BH 16ch + Aggregate Device presence (per ticket #06).

## Decided terms (D1-D30)

See `docs/decisions/round-2-grill.md` (D1-D17) +
`docs/decisions/round-2-confirmations.md` (D18-D25) +
`docs/decisions/round-3-confirmations.md` (D26-D30).
