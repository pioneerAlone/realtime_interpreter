//! Subtitle IPC commands (append / clear).
//! Stub for v0 scaffold; real bodies land in ticket #04 (R4 audio) + #05 (subtitle UI).

use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Subtitle {
    pub id: String,
    pub timestamp_ms: i64,
    pub speaker: String,
    pub source_text: String,
    pub translation_text: String,
    pub is_final: bool,
}

#[tauri::command]
pub async fn append_subtitle(
    source_text: String,
    translation_text: String,
    speaker: String,
) -> Result<Subtitle, String> {
    if source_text.is_empty() {
        return Err("source_text is empty".to_string());
    }
    Ok(Subtitle {
        id: Uuid::new_v4().to_string(),
        timestamp_ms: chrono_now_ms(),
        speaker,
        source_text,
        translation_text,
        is_final: true,
    })
}

#[tauri::command]
pub async fn clear_subtitles() -> Result<u32, String> {
    Ok(0)
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
