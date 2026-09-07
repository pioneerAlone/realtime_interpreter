//! macOS-specific NSPanel conversion for the floating subtitle window.
//!
//! Per D20: uses the `tauri-nspanel` git-branch `v2` API to convert a
//! regular Tauri webview window into a non-activating NSPanel. This
//! gives the subtitle window its key macOS-native properties:
//! - non-activating panel (does not steal keyboard focus)
//! - floating level (appears above full-screen Spaces)
//! - becomes key only on click
//! - works when modal dialogs are open
//!
//! Architecture inspiration: Open-Less `src-tauri/src/lib.rs` L539-614
//! (architecture only, no code copy; the AGPL-3.0-only license on
//! `crates/openless-core/src/` and `openless-all/app/src-tauri/src/`
//! means we cannot copy any code from those paths, per D6 / ADR-0011).

#[cfg(target_os = "macos")]
mod imp {
    use tauri::{AppHandle, WebviewWindow};
    use tauri_nspanel::{ManagerExt, WebviewWindowExt};

    use crate::error::{AppError, AppResult};

    pub fn convert_capsule_to_nspanel(
        app: &AppHandle,
        window: &WebviewWindow,
    ) -> AppResult<()> {
        let label = window.label().to_string();
        tracing::info!(window = %label, "converting capsule to NSPanel");

        // Convert the Tauri webview window into an NSPanel handle.
        let panel = window
            .to_panel()
            .map_err(|e| AppError::Ipc(format!("nspanel convert failed: {e}")))?;

        // Apply the macOS-native NSPanel flags. These are the same
        // setters used by Open-Less's fullscreen example (architecture
        // inspiration, not code copy).
        panel.set_floating_panel(true);
        panel.set_hides_on_deactivate(false);
        panel.set_becomes_key_only_if_needed(true);
        panel.set_works_when_modal(true);

        // Register the panel under the WebviewPanelManager so that
        // other windows (e.g. the main window) can find it by label.
        let _ = app.get_webview_panel(&label);

        Ok(())
    }
}

#[cfg(target_os = "macos")]
pub use imp::convert_capsule_to_nspanel;
