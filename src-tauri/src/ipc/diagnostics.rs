//! Diagnostics IPC commands (ping, version, latency probe trigger, etc.).
//!
//! `ping` and `version` are the only commands that return real data in
//! the v0 scaffold. The others are wired through to the standalone
//! `cargo run --bin latency-probe` / `topology-check` binaries
//! (issues #07 and #06) and return their exit code summaries.

use serde::Serialize;

pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const IPC_CONTRACT_VERSION: &str = "1.0.0";

#[derive(Debug, Clone, Serialize)]
pub struct VersionInfo {
    pub version: &'static str,
    pub contract: &'static str,
}

#[tauri::command]
pub async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

#[tauri::command]
pub async fn version() -> Result<VersionInfo, String> {
    Ok(VersionInfo {
        version: APP_VERSION,
        contract: IPC_CONTRACT_VERSION,
    })
}

/// Used by the frontend `requireBackendReady` handshake.
#[tauri::command]
pub async fn bootstrap_ready() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn latency_probe(iterations: Option<u32>) -> Result<String, String> {
    let iters = iterations.unwrap_or(5);
    Err(format!(
        "latency-probe stub: run `cargo run --bin latency-probe -- --iterations {}` for real measurement (ticket #07).",
        iters
    ))
}
