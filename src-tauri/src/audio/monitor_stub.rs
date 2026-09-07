//! Non-macOS stub for the device-change hot-unplug detector.
//!
//! On non-macOS platforms the topology check itself returns Fail
//! with a "platform unsupported" check (see `topology.rs::run_check`),
//! so no device monitoring is required. This stub exists so the
//! `mod audio` declaration compiles cross-platform for `cargo check`
//! on Linux/Windows CI.

use tauri::AppHandle;

/// No-op on non-macOS. Returns immediately.
pub fn install(_app_handle: AppHandle) {}
