//! Session IPC commands (R3 / R4 start / stop / status).
//!
//! T-G-04 stub：start_session / stop_session 接受调用并返回新 state。
//! 真实 audio pipeline 接入属于 ticket #03 (R3) 和 #04 (R4) 范围 —
//! 本 ticket 只验证 preferences.json 持久化 + preset 切换 + 启动 CTA 调通。

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Channel {
    R3,
    R4,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionState {
    Idle,
    Starting,
    Running,
    Stopping,
    Error,
}

#[tauri::command]
pub async fn start_session(
    channel: Channel,
    state: State<'_, AppState>,
) -> Result<SessionState, String> {
    state
        .set_status(channel, SessionState::Running)
        .await;
    Ok(SessionState::Running)
}

#[tauri::command]
pub async fn stop_session(
    channel: Channel,
    state: State<'_, AppState>,
) -> Result<SessionState, String> {
    state
        .set_status(channel, SessionState::Idle)
        .await;
    Ok(SessionState::Idle)
}

#[tauri::command]
pub async fn session_status(
    channel: Channel,
    state: State<'_, AppState>,
) -> Result<SessionState, String> {
    Ok(state.get_status(channel).await)
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<(Channel, SessionState)>, String> {
    Ok(state.list_status().await)
}
