## Goal

Land the 2-header Doubao auth module — exclusively `X-Api-Key` + `X-Api-Resource-Id`, with API key sourced from macOS Keychain and validated against 语音控制台 (not 方舟控制台) — so that R3 and R4 sessions can open authenticated WebSocket connections with no 3-header fallback code.

## Acceptance criteria

- **D12 / ADR-0003**: Only the 2-header scheme is implemented. `X-Api-App-Key` + `X-Api-Access-Key` + `X-Api-Resource-Id` (the 3-header scheme that `02_项目架构与技术栈.md` L128 still lists but is stale per `poc-docs-take.md` §3 reconciliation) is **NOT** supported. Code that tries to send it returns a hard error, not a silent fallback.
- **API key from 语音控制台** (per `poc-docs-take.md` §3 + D12): the settings UI surfaces a setup hint pointing users at the 语音控制台 (not 方舟控制台), because 方舟 keys empirically do not work for 同传 2.0.
- **macOS Keychain storage**: API key persisted via the `keyring` crate (per `openless-take.md` §1 "Persistence" row). Never written to plaintext JSON. Verified by inspecting `~/Library/Keychains/login.keychain-db` and confirming no API key in `~/.config/realtime_interpreter/*.json`.
- **Validation probe**: `ipc/config::validate` runs an auth probe against Doubao (port of `auth_test.py` per `poc-docs-take.md` §6) — sends a 1 s synthetic audio probe, asserts the WS handshake succeeds with the 2-header scheme + the user's API key. Exposed as a settings-window "Test Connection" button.

## Implementation notes

- **Modules to be built**: `src-tauri/src/doubao/auth.rs` (2-header scheme only; `X-Api-Key` + `X-Api-Resource-Id`; rejects 3-header with compile-time error type); `src-tauri/src/ipc/config.rs` (`config::get` returns full config with API key masked, `config::set` validates + persists via `keyring` for API key + JSON for the rest, `config::validate` runs the auth probe).
- **Crate choice**: `keyring` 2.x for macOS Keychain (per `openless-take.md` §1 row — pattern only, no code copy); `tokio-tungstenite` 0.24.x for the probe WS connection.
- **Probe algorithm** (per `poc-docs-take.md` §6 `auth_test.py` row): open WS to `wss://openspeech.bytedance.com/api/v4/ast/v2/translate` with 2 headers; send a 1 s 16 kHz mono synthetic sine wave as a single `TaskRequest(200)`; expect any response (200-series or error event) within 5 s — if connection opens and the server processes the request without an immediate auth failure, auth is valid.
- **Settings window UX**: "Test Connection" button calls `config::validate`; shows "✓ Connected" green or "✗ Auth failed — check API key is from 语音控制台" amber with the actionable hint.
- **Compile-time enforcement of 2-header-only**: a `pub struct AuthHeaders` with exactly two private fields (`api_key: String`, `resource_id: String`) and a `pub fn new(...)` constructor that panics if a 3rd header is supplied. There is no `add_header` method — no API exists to add a third header. The 3-header doc row in `02_项目架构与技术栈.md` is stale per `poc-docs-take.md` §3 reconciliation.
- **Reference decisions**: D12 (2-header only, no fallback).
- **Spec cross-refs**: `05-tech-stack-decisions.md` ADR-0003 (Auth scheme decision + doc discrepancy resolution); `poc-docs-take.md` §3 row "Auth scheme" (canonical 2-header) + §4.2 (PoC reconciliation); `00-overview.md` §4.2 (auth scheme reconciliation normative for v0); `01-architecture.md` §6 (IPC `config.rs` shape).
- **Do NOT copy code** from `realtime_interpreter_Minimal_Implementation/src/auth_test.py` (git-ignored); the probe algorithm is referenced via `poc-docs-take.md` §6 but no code lines move.

## Test plan

Single acceptance seam. Verified by:
- Manual smoke: enter a valid 2-header key from 语音控制台 in settings, click "Test Connection" — green check. Inspect `~/Library/Keychains/login.keychain-db` shows the entry; `~/.config/realtime_interpreter/*.json` shows `"api_key": "***masked***"`.
- Negative test: enter an invalid key — "Test Connection" returns amber with "Auth failed".
- Negative test: try to send a 3-header request via the Rust API — compile error or runtime panic, not a silent fallback.
- Compile-time guard: a unit-style integration test asserts `AuthHeaders::new` with a third header fails to construct (either compile error via type system or runtime error via `Result`).
- Self-meeting test (ticket #12) requires auth to succeed — i.e., the test setup script must seed a valid API key.

## Dependencies

- **Blocked by #02** (Tauri shell + Cargo.toml pinning of `keyring` crate + `tokio-tungstenite`).
- **Blocks #03** (R3 audio) and #04 (R4 audio) — both consume `AuthHeaders` to open the Doubao WS.

## Out of scope for this ticket

- **3-header scheme fallback** — D12 explicitly forbids it; the API surface makes it impossible to construct.
- **方舟控制台 key support** — empirically doesn't work per `poc-docs-take.md` §3; settings UI surfaces a hint pointing at 语音控制台.
- **OAuth / token refresh flows** — API key is static; refresh is not a Doubao 同传 2.0 concept.
- **Multi-tenant / multi-account** — v0 has one API key per installation; account management is v1+.
- **Probing Doubao S2S vs S2T separately** — a single 2-header auth applies to both modes (same endpoint per D13 spirit); no per-mode auth state.
