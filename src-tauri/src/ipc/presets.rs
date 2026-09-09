//! presets IPC commands (get / save / delete / set-active).
//!
//! T-G-04 实现：preferences.json 持久化 + 1 default preset "日常会议" + 启动 CTA 调 audio engine.
//! 真实 audio engine 接入属于 #03 (R3) / #04 (R4) ticket 范围。

use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::preferences::{self, Preset, Preferences, PreferencesState};

#[tauri::command]
pub async fn get_preferences(
    app: AppHandle,
    state: State<'_, PreferencesState>,
) -> Result<Preferences, String> {
    // 内存中没有就尝试从磁盘加载（首次启动 + 进程重启后）
    {
        let prefs = state.0.read().await;
        if !prefs.presets.is_empty() {
            return Ok(prefs.clone());
        }
    }
    let loaded = preferences::load(&app).map_err(|e| e.to_string())?;
    {
        let mut prefs = state.0.write().await;
        *prefs = loaded.clone();
    }
    Ok(loaded)
}

#[tauri::command]
pub async fn save_preset(
    app: AppHandle,
    state: State<'_, PreferencesState>,
    preset: Preset,
) -> Result<(), String> {
    let mut prefs = state.0.write().await;
    let pos = prefs.presets.iter().position(|p| p.id == preset.id);
    match pos {
        Some(idx) => prefs.presets[idx] = preset,
        None => prefs.presets.push(preset),
    }
    preferences::save(&app, &prefs).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_preset(
    app: AppHandle,
    state: State<'_, PreferencesState>,
    id: String,
) -> Result<(), String> {
    let mut prefs = state.0.write().await;
    // 不允许删 default preset
    if id == "daily-meeting" {
        return Err(AppError::Ipc("cannot delete default preset".to_string()).to_string());
    }
    prefs.presets.retain(|p| p.id != id);
    if prefs.active_id == id {
        prefs.active_id = "daily-meeting".to_string();
    }
    preferences::save(&app, &prefs).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_active_preset(
    app: AppHandle,
    state: State<'_, PreferencesState>,
    id: String,
) -> Result<(), String> {
    let mut prefs = state.0.write().await;
    if !prefs.presets.iter().any(|p| p.id == id) {
        return Err(AppError::Ipc(format!("unknown preset id: {id}")).to_string());
    }
    prefs.active_id = id;
    preferences::save(&app, &prefs).map_err(|e| e.to_string())?;
    Ok(())
}
