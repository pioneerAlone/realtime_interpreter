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
#[serde(rename_all = "camelCase")]
pub struct PresetDevices {
    pub microphone: String,
    pub translation_output: String,
    pub remote_input: String,
    pub monitor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
    // 检测 v1 旧 snake_case 格式（pre-camelCase fix）· 自动迁移
    let text = migrate_legacy_snake_case(&text);
    let prefs: Preferences = serde_json::from_str(&text)
        .map_err(|e| AppError::Ipc(format!("parse preferences.json: {e}")))?;
    Ok(prefs)
}

/// Migration: 旧版本（schema_version 1 · snake_case 字段）→ 新版本（schema_version 2+ · camelCase）
/// 检测到旧 snake_case keys 时 · 在内存里 rename 后再 deserialize
/// 写入时 Rust serde 自动用 camelCase（`#[serde(rename_all = "camelCase")]`）· 旧文件被覆盖
fn migrate_legacy_snake_case(text: &str) -> String {
    // 检测 v1 旧 schema + snake_case presence
    let has_legacy = text.contains("\"active_id\"")
        || text.contains("\"translation_output\"")
        || text.contains("\"r3_direction\"")
        || text.contains("\"r4_caption\"")
        || text.contains("\"last_launched\"")
        || text.contains("\"launch_count\"")
        || text.contains("\"remote_input\"")
        || text.contains("\"schema_version\": 1")
        || text.contains("\"schema_version\":1");
    if !has_legacy {
        return text.to_string();
    }
    // 用 serde_json::Value 转换 keys
    match serde_json::from_str::<serde_json::Value>(text) {
        Ok(mut v) => {
            rename_keys_recursive(&mut v);
            v.to_string()
        }
        Err(_) => text.to_string(),
    }
}

fn rename_keys_recursive(v: &mut serde_json::Value) {
    use serde_json::Value;
    if let Value::Object(map) = v {
        // 收集要 rename 的 keys
        let to_rename: Vec<(String, String)> = map
            .keys()
            .filter_map(|k| {
                let new_k = snake_to_camel(k);
                if &new_k != k {
                    Some((k.clone(), new_k))
                } else {
                    None
                }
            })
            .collect();
        for (old, new) in to_rename {
            if let Some(val) = map.remove(&old) {
                map.insert(new, val);
            }
        }
        for (_, v) in map.iter_mut() {
            rename_keys_recursive(v);
        }
    } else if let Value::Array(arr) = v {
        for item in arr.iter_mut() {
            rename_keys_recursive(item);
        }
    }
}

fn snake_to_camel(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;
    for c in s.chars() {
        if c == '_' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_ascii_uppercase());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }
    result
}

/// 同步保存（用于非 async caller · 比如 Tauri command handler）
#[allow(dead_code)]
pub fn save_caller_blocking(prefs: &Preferences) -> AppResult<()> {
    // 提取路径 + 写文件（不带 app 句柄）· 调用方需自己保证 dir 创建
    let home = std::env::var("HOME").unwrap_or_default();
    let path = std::path::PathBuf::from(home)
        .join("Library/Application Support/com.pioneeralone.realtime-interpreter/preferences.json");
    save_to_path(&path, prefs)
}

/// 原子写入：先写 tmp · rename 替换 · 避免半截文件污染
pub fn save(app: &AppHandle, prefs: &Preferences) -> AppResult<()> {
    let path = preferences_path(app)?;
    save_to_path(&path, prefs)
}

fn save_to_path(path: &std::path::Path, prefs: &Preferences) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Ipc(format!("mkdir preferences dir: {e}")))?;
    }
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(prefs)
        .map_err(|e| AppError::Ipc(format!("serialize preferences: {e}")))?;
    fs::write(&tmp, &text)
        .map_err(|e| AppError::Ipc(format!("write preferences tmp: {e}")))?;
    fs::rename(&tmp, path)
        .map_err(|e| AppError::Ipc(format!("rename preferences: {e}")))?;
    Ok(())
}
