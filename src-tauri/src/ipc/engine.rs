//! engine IPC commands (T-G-06)
//!
//! 4 个 Tauri commands：
//!   - get_engine_credentials() 读状态
//!   - set_api_key(key) 校验 + 标 api_key_set=true + 更新 masked_key（末 4 位）
//!   - clear_api_key() 清空
//!   - test_engine_connection() v0 stub · sleep 200-600ms + 返 success + random RTT
//!
//! v0 实际不写 macOS Keychain · TODO v0.1 用 `keyring` crate 实装
//! 决策来源: `.scratch/gui-rebuild-v0.md` §7 + §10.1 T-G-06
//! Ticket:    #32 (T-G-06)

use std::time::Duration;
use tauri::State;

use crate::error::AppError;
use crate::preferences::{self, EngineCredentials, PreferencesState};

#[tauri::command]
pub async fn get_engine_credentials(
    state: State<'_, PreferencesState>,
) -> Result<EngineCredentials, String> {
    let prefs = state.0.read().await;
    Ok(prefs.engine_credentials.clone())
}

#[tauri::command]
pub async fn set_api_key(
    state: State<'_, PreferencesState>,
    key: String,
) -> Result<EngineCredentials, String> {
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::Ipc("API Key 不能为空".to_string()).to_string());
    }
    let masked = if trimmed.len() >= 4 {
        trimmed[trimmed.len() - 4..].to_string()
    } else {
        trimmed.clone()
    };
    let new_creds = EngineCredentials {
        api_key_set: true,
        masked_key: masked,
        last_test_at: None,
        last_test_result: None,
        last_rtt_ms: None,
        last_node: None,
        last_error: None,
    };
    let mut prefs = state.0.write().await;
    prefs.engine_credentials = new_creds.clone();
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(new_creds)
}

#[tauri::command]
pub async fn clear_api_key(
    state: State<'_, PreferencesState>,
) -> Result<EngineCredentials, String> {
    let new_creds = EngineCredentials::default();
    let mut prefs = state.0.write().await;
    prefs.engine_credentials = new_creds.clone();
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(new_creds)
}

#[tauri::command]
pub async fn test_engine_connection(
    state: State<'_, PreferencesState>,
) -> Result<EngineCredentials, String> {
    let creds = state.0.read().await.engine_credentials.clone();
    if !creds.api_key_set {
        return Err(AppError::Ipc("API Key 未设置".to_string()).to_string());
    }

    // v0 stub: sleep 200-600ms + 随机 RTT + 95% 概率 success
    // 真实 v0.1 用 tokio-tungstenite 连 volc.service_type.10053 + 测 RTT
    let sleep_ms: u64 = 250 + (rand_u64() % 350);
    tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

    // 模拟 RTT < sleep_ms（WebSocket 握手 + 首包响应）
    let rtt_ms: u32 = (sleep_ms as u32 * 4 / 5) + (rand_u64() % 80) as u32;
    let success = rand_u64() % 20 != 0; // 95% 成功
    let now = chrono_like_now();

    let new_creds = if success {
        EngineCredentials {
            api_key_set: true,
            masked_key: creds.masked_key,
            last_test_at: Some(now),
            last_test_result: Some("success".to_string()),
            last_rtt_ms: Some(rtt_ms),
            last_node: Some("火山引擎北京节点".to_string()),
            last_error: None,
        }
    } else {
        EngineCredentials {
            api_key_set: true,
            masked_key: creds.masked_key,
            last_test_at: Some(now),
            last_test_result: Some("fail".to_string()),
            last_rtt_ms: None,
            last_node: Some("火山引擎北京节点".to_string()),
            last_error: Some("连接超时".to_string()),
        }
    };

    let mut prefs = state.0.write().await;
    prefs.engine_credentials = new_creds.clone();
    preferences::save_caller_blocking(&prefs).map_err(|e| e.to_string())?;
    Ok(new_creds)
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/// 简易时间戳（避免引入 chrono · 写 "x 分钟前" 格式）
fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{} 秒前", now)
}

/// 简易随机 u64（避免引入 rand crate）
fn rand_u64() -> u64 {
    use std::cell::Cell;
    use std::time::{SystemTime, UNIX_EPOCH};
    thread_local! {
        static SEED: Cell<u64> = const { Cell::new(0) };
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    SEED.with(|s| {
        let mut v = s.get();
        v ^= now;
        v = v.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        s.set(v);
        v
    })
}
