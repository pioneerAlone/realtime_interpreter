//! Device IPC commands (list / select mic / select output).
//! Stub for v0 scaffold; real bodies land in ticket #06 (topology).

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub channels: u32,
    pub is_default: bool,
}

#[tauri::command]
pub async fn list_devices() -> Result<Vec<AudioDevice>, String> {
    Err("not implemented — see ticket #06 (topology-check)".to_string())
}

#[tauri::command]
pub async fn set_mic(_device_id: String) -> Result<(), String> {
    Err("not implemented — see ticket #06".to_string())
}

#[tauri::command]
pub async fn set_output(_device_id: String) -> Result<(), String> {
    Err("not implemented — see ticket #06".to_string())
}

#[tauri::command]
pub async fn get_topo_summary() -> Result<String, String> {
    Ok("topology summary not yet implemented — see ticket #06".to_string())
}
