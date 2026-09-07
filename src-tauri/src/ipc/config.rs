//! Config IPC commands (get/set + API key status).
//! Stub for v0 scaffold; real bodies land in ticket #02 follow-ups.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[allow(dead_code)]
pub enum ApiKeyStatus {
    NotSet,
    Set,
    Invalid,
    Unreachable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub source_language: String,
    pub target_language: String,
    pub sample_rate: u32,
    pub denoise: bool,
    pub bypass: bool,
    pub bypass_output_target: String,
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    Ok(AppConfig {
        source_language: "zh".to_string(),
        target_language: "en".to_string(),
        sample_rate: 48000,
        denoise: false,
        bypass: false,
        bypass_output_target: "headphones".to_string(),
    })
}

#[tauri::command]
pub async fn set_config(_config: AppConfig) -> Result<(), String> {
    Err("not implemented — config persistence lands in v0.1".to_string())
}

#[tauri::command]
pub async fn get_api_key_status() -> Result<ApiKeyStatus, String> {
    Ok(ApiKeyStatus::NotSet)
}
