# realtime_interpreter

macOS-first, open-source real-time EN↔ZH interpreter built on Tauri 2 + React 18 +
Rust. Competes with 金喜同声传译双通道版 by streaming mic audio to 火山引擎 Doubao
同传 2.0 (s2s mode) for A-channel speech-to-speech translation, and pulling bilingual
subtitles from the same backend (s2t mode) for the B-channel meeting feed.

- **v0 target**: ≤3000 ms first-sound latency, R3 + R4 dual-channel on M2 MacBook Air.
- **Stack**: Tauri 2.11, cpal 0.15, tokio-tungstenite, opus, prost, BlackHole 16ch.
- **Spec**: `docs/spec/v0/00-overview.md` (planned) + `docs/spec/v0/01-architecture.md`.
- **Decisions**: `docs/decisions/round-{1,2,3}-confirmations.md` (30 decisions locked).

Per D30-Q4 (privacy disclosure, locked 2026-09-07,
`docs/decisions/round-3-confirmations.md` D30-Q4), realtime_interpreter sends the
following data **off your machine** in real time:

| Data | Destination | Frequency | Lifetime |
|---|---|---|---|
| Your voice (R3 input audio) | 火山引擎 Doubao 同传 2.0 servers (`volc.service_type.10053`) | Every 80 ms frame during R3 session | Streamed; not stored by Volcengine per docs |
| 对方 voice (R4 input audio via BlackHole 16ch loopback) | Same as above | Every 80 ms frame during R4 session | Streamed; not stored |
| API key (`X-Api-Key`) | Same as above (TLS header) | Once per WS handshake | Held in macOS Keychain |
| Device IDs / analytics / crash reports | **None — not sent anywhere** | — | — |
| Audio recorded to disk | **None — realtime_interpreter never persists audio** | — | — |

**Volcengine's data retention** is governed by their
[terms of service](https://www.volcengine.com/terms). realtime_interpreter
does not have visibility into server-side retention beyond what's in
their public docs.

**Local storage**:
- API key → macOS Keychain only (not `~/.config` plaintext).
- Device selections, window position, font size → `tauri-plugin-store` JSON in app data dir.
- No audio logs.
