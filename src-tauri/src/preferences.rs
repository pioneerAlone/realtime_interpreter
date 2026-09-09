//! preferences.rs — 持久化 preset 配置（T-G-04）
//!
//! v0 hand-rolled JSON file at:
//!   ~/Library/Application Support/com.pioneeralone.realtime-interpreter/preferences.json
//! 不用 tauri-plugin-store（per D-G-11 · Open-Less 验证 · 跨窗广播更可靠）
//!
//! 决策来源: `.scratch/gui-rebuild-v0.md` §4.6 + §10.1 T-G-04
//! Ticket:    #30 (T-G-04)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// 单个 preset 的 v0 schema
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PresetDevices {
    pub microphone: String,
    pub translation_output: String,
    pub remote_input: String,
    pub monitor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Preset {
    pub id: String,
    pub name: String,
    /// "active" | "disabled-stub"
    pub status: String,
    /// 0..100
    pub progress: u8,
    pub devices: PresetDevices,
    /// "zh→en" | "en→zh" · v0 hardcode
    pub r3_direction: String,
    /// v0 hardcode "bilingual-stacked"
    pub r4_caption: String,
    pub description: String,
    pub last_launched: String,
    pub launch_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Preferences {
    pub schema_version: u32,
    pub active_id: String,
    pub presets: Vec<Preset>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            schema_version: 1,
            active_id: "daily-meeting".to_string(),
            presets: vec![
                Preset {
                    id: "daily-meeting".to_string(),
                    name: "日常会议".to_string(),
                    status: "active".to_string(),
                    progress: 100,
                    devices: PresetDevices {
                        microphone: "macbook-mic".to_string(),
                        translation_output: "blackhole-2ch".to_string(),
                        remote_input: "vb-cable".to_string(),
                        monitor: "iflybuds-nano".to_string(),
                    },
                    r3_direction: "zh→en".to_string(),
                    r4_caption: "bilingual-stacked".to_string(),
                    description: "v0 默认配置。适合一般商务会议 / 1v1 沟通。".to_string(),
                    last_launched: "3 天前".to_string(),
                    launch_count: 4,
                },
                Preset {
                    id: "demo-mode".to_string(),
                    name: "演示模式".to_string(),
                    status: "disabled-stub".to_string(),
                    progress: 25,
                    devices: PresetDevices {
                        microphone: "macbook-mic".to_string(),
                        translation_output: "blackhole-2ch".to_string(),
                        remote_input: "vb-cable".to_string(),
                        monitor: "iflybuds-nano".to_string(),
                    },
                    r3_direction: "zh→en".to_string(),
                    r4_caption: "bilingual-stacked".to_string(),
                    description: "演示场景（即将推出）。".to_string(),
                    last_launched: "—".to_string(),
                    launch_count: 0,
                },
                Preset {
                    id: "one-on-one".to_string(),
                    name: "1v1 沟通".to_string(),
                    status: "disabled-stub".to_string(),
                    progress: 0,
                    devices: PresetDevices {
                        microphone: "macbook-mic".to_string(),
                        translation_output: "blackhole-2ch".to_string(),
                        remote_input: "vb-cable".to_string(),
                        monitor: "iflybuds-nano".to_string(),
                    },
                    r3_direction: "zh→en".to_string(),
                    r4_caption: "bilingual-stacked".to_string(),
                    description: "1v1 沟通场景（即将推出）。".to_string(),
                    last_launched: "—".to_string(),
                    launch_count: 0,
                },
            ],
        }
    }
}

/// Preferences 状态 · 跨 IPC handler 共享
#[derive(Clone, Default, Debug)]
pub struct PreferencesState(pub Arc<RwLock<Preferences>>);

/// 计算 preferences.json 路径
///
/// Tauri 2 提供 `app.path().app_config_dir()` · 在 macOS 上是
/// `~/Library/Application Support/<bundle-id>/` · 我们用 `app_config_dir()`
/// 避免硬编码 bundle-id · 跨平台行为一致。
pub fn preferences_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::Ipc(format!("app_config_dir failed: {e}")))?;
    Ok(dir.join("preferences.json"))
}

/// 从磁盘加载 · 文件不存在返回 default
pub fn load(app: &AppHandle) -> AppResult<Preferences> {
    let path = preferences_path(app)?;
    if !path.exists() {
        return Ok(Preferences::default());
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| AppError::Ipc(format!("read preferences.json: {e}")))?;
    let prefs: Preferences = serde_json::from_str(&text)
        .map_err(|e| AppError::Ipc(format!("parse preferences.json: {e}")))?;
    Ok(prefs)
}

/// 原子写入：先写 tmp · rename 替换 · 避免半截文件污染
pub fn save(app: &AppHandle, prefs: &Preferences) -> AppResult<()> {
    let path = preferences_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Ipc(format!("mkdir preferences dir: {e}")))?;
    }
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(prefs)
        .map_err(|e| AppError::Ipc(format!("serialize preferences: {e}")))?;
    fs::write(&tmp, &text)
        .map_err(|e| AppError::Ipc(format!("write preferences tmp: {e}")))?;
    fs::rename(&tmp, &path)
        .map_err(|e| AppError::Ipc(format!("rename preferences: {e}")))?;
    Ok(())
}
