//! Platform-specific helpers (macOS only at v0).
//!
//! `mod macos` is a stub on non-macOS so the crate still compiles for
//! cross-platform CI / docs builds.

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(not(target_os = "macos"))]
pub mod macos {
    use crate::error::AppResult;
    use tauri::{AppHandle, WebviewWindow};

    pub fn convert_capsule_to_nspanel(
        _app: &AppHandle,
        _window: &WebviewWindow,
    ) -> AppResult<()> {
        Ok(())
    }
}
