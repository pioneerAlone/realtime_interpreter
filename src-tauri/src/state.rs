//! Application-wide state (shared across IPC handlers and audio threads).
//!
//! For v0 scaffold this is a thin wrapper around tokio's `OnceCell` so
//! that later tickets (e.g. #03 R3 audio, #10 protobuf) can attach
//! their long-lived resources (Doubao WebSocket clients, audio ring
//! buffers, etc.) without changing the `Tauri::Builder` invocation.

use std::sync::Arc;

use tokio::sync::RwLock;

use crate::error::AppResult;

/// Marker for the bootstrap state. The real fields are populated by
/// later tickets (e.g. `R3Session`, `R4Session`, `BypassRouter`).
#[derive(Default, Debug)]
pub struct AppStateInner {
    /// Set to `true` once the Tauri builder has finished initialization.
    pub ready: bool,
}

#[derive(Clone, Default, Debug)]
pub struct AppState(pub Arc<RwLock<AppStateInner>>);

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn mark_ready(&self) -> AppResult<()> {
        let mut inner = self.0.write().await;
        inner.ready = true;
        Ok(())
    }
}
