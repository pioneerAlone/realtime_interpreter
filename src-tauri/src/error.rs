//! Crate-wide error type.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("IPC handler error: {0}")]
    Ipc(String),

    #[error("Tauri runtime error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Audio I/O error: {0}")]
    Audio(String),

    #[error("Doubao protocol error: {0}")]
    Protocol(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Topology check error: {0}")]
    Topology(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
