//! Session IPC commands (R3 / R4 start / stop / status).
//! Stub for v0 scaffold; real bodies land in tickets #03 (R3) and #04 (R4).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Channel {
    R3,
    R4,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[allow(dead_code)]
pub enum SessionState {
    Idle,
    Starting,
    Running,
    Stopping,
    Error,
}

#[tauri::command]
pub async fn start_session(_channel: Channel) -> Result<SessionState, String> {
    Err("not implemented — see ticket #03 (R3) or #04 (R4)".to_string())
}

#[tauri::command]
pub async fn stop_session(_channel: Channel) -> Result<SessionState, String> {
    Err("not implemented — see ticket #03 (R3) or #04 (R4)".to_string())
}

#[tauri::command]
pub async fn session_status(_channel: Channel) -> Result<SessionState, String> {
    Ok(SessionState::Idle)
}

#[tauri::command]
pub async fn list_sessions() -> Result<Vec<(Channel, SessionState)>, String> {
    Ok(vec![(Channel::R3, SessionState::Idle), (Channel::R4, SessionState::Idle)])
}
