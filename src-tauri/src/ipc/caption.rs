//! caption IPC commands (T-G-07)
//!
//! 6 项能力 + 位置记忆：
//!   - get_caption_settings() 读 state
//!   - set_caption_position(x, y) 拖动时实时调
//!   - set_caption_opacity(value) 透明度 slider
//!   - set_caption_locked / click_through / share_hidden / display_index
//!
//! 决策来源: `.scratch/gui-rebuild-v0.md` §6 + §10.1 T-G-07
//! Ticket:    #33 (T-G-07)

use tauri::State;

use crate::error::AppError;
use crate::preferences::{self, CaptionSettings, PreferencesState};

#[tauri::command]
pub async fn get_caption_settings(
    state: State<'_, PreferencesState>,
) -> Result<CaptionSettings, String> {
    let prefs = state.0.read().await;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_position(
    state: State<'_, PreferencesState>,
    x: i32,
    y: i32,
) -> Result<CaptionSettings, String> {
    let mut prefs = state.0.write().await;
    prefs.caption_settings.position = Some(crate::preferences::Position { x, y });
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_opacity(
    state: State<'_, PreferencesState>,
    opacity: u8,
) -> Result<CaptionSettings, String> {
    if opacity > 100 {
        return Err(AppError::Ipc(format!("opacity 越界: {opacity}")).to_string());
    }
    let mut prefs = state.0.write().await;
    prefs.caption_settings.opacity = opacity;
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_locked(
    state: State<'_, PreferencesState>,
    locked: bool,
) -> Result<CaptionSettings, String> {
    let mut prefs = state.0.write().await;
    prefs.caption_settings.locked = locked;
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_click_through(
    state: State<'_, PreferencesState>,
    click_through: bool,
) -> Result<CaptionSettings, String> {
    let mut prefs = state.0.write().await;
    prefs.caption_settings.click_through = click_through;
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_share_hidden(
    state: State<'_, PreferencesState>,
    share_hidden: bool,
) -> Result<CaptionSettings, String> {
    let mut prefs = state.0.write().await;
    prefs.caption_settings.share_hidden = share_hidden;
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}

#[tauri::command]
pub async fn set_caption_display_index(
    state: State<'_, PreferencesState>,
    display_index: u8,
) -> Result<CaptionSettings, String> {
    let mut prefs = state.0.write().await;
    prefs.caption_settings.display_index = display_index;
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(prefs.caption_settings.clone())
}
