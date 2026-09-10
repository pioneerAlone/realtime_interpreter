//! Application-wide state (shared across IPC handlers and audio threads).
//!
//! v0 scaffold: thin wrapper around tokio RwLock for session status map.
//! T-G-04 加 SessionStatusMap 让 start_session / stop_session stub 能存 state。

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::error::AppResult;
use crate::ipc::session::{Channel, SessionState};

pub type SessionStatusMap = HashMap<Channel, SessionState>;

#[derive(Default, Debug)]
pub struct AppStateInner {
    /// Set to `true` once the Tauri builder has finished initialization.
    pub ready: bool,
    /// R3 / R4 通道的当前状态 · start_session / stop_session 写入
    pub sessions: SessionStatusMap,
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

    pub async fn set_status(&self, channel: Channel, state: SessionState) {
        let mut inner = self.0.write().await;
        inner.sessions.insert(channel, state);
    }

    pub async fn get_status(&self, channel: Channel) -> SessionState {
        let inner = self.0.read().await;
        inner
            .sessions
            .get(&channel)
            .copied()
            .unwrap_or(SessionState::Idle)
    }

    pub async fn list_status(&self) -> Vec<(Channel, SessionState)> {
        let inner = self.0.read().await;
        let mut out: Vec<(Channel, SessionState)> = inner
            .sessions
            .iter()
            .map(|(c, s)| (*c, *s))
            .collect();
        if out.is_empty() {
            out.push((Channel::R3, SessionState::Idle));
            out.push((Channel::R4, SessionState::Idle));
        }
        out
    }
}
