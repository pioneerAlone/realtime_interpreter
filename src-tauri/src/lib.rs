//! realtime_interpreter — Tauri 2 application library.
//!
//! v0 scaffold: Tauri builder + multi-window + tray menu + global
//! hotkeys + NSPanel conversion of the subtitle capsule. The audio
//! pipelines, Doubao WebSocket client, and OGG demuxer are stubs
//! that later tickets (#03-#13) fill in.

mod error;
mod ipc;
mod platform;
mod state;

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Entry point invoked from `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::new();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(state.clone())
        .setup(move |app| {
            // Build the tray menu (per ticket #2 Implementation notes).
            let tray_menu = build_tray_menu(app.handle())?;
            let _tray = TrayIconBuilder::with_id("main-tray")
                .menu(&tray_menu)
                .icon(default_tray_icon())
                .icon_as_template(true)
                .show_menu_on_left_click(false)
                .tooltip("realtime_interpreter")
                .on_menu_event(|app, event| {
                    handle_tray_event(app, event.id().0.as_str());
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = tray.app_handle().get_webview_window("main").map(|w| {
                            let _ = w.show();
                            let _ = w.set_focus();
                        });
                    }
                })
                .build(app)?;
            app.manage(Arc::new(_tray));

            // Register global hotkeys (per D20 + ticket #2):
            //   Right Option               — toggle subtitle visibility
            //   Ctrl+Alt+P                 — toggle 原声直出 (Bypass)
            //   Ctrl+Alt+H                 — hide subtitle window
            let app_handle = app.handle().clone();
            let shortcuts = vec![
                (Shortcut::new(Some(Modifiers::empty()), Code::AltRight), "toggle_subtitle"),
                (
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyP),
                    "toggle_bypass",
                ),
                (
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyH),
                    "hide_subtitle",
                ),
            ];

            let gs = app.global_shortcut();
            for (shortcut, event) in shortcuts {
                let event_name: &'static str = Box::leak(event.to_string().into_boxed_str());
                let app_for_handler = app_handle.clone();
                if let Err(e) = gs.on_shortcut(shortcut, move |_app, _shortcut, ev| {
                    if ev.state() == ShortcutState::Pressed {
                        handle_global_hotkey(&app_for_handler, event_name);
                    }
                }) {
                    tracing::warn!(error = %e, "failed to register global shortcut");
                }
            }

            // Convert the subtitle webview window into a non-activating
            // NSPanel once it has been built. This is a no-op on
            // non-macOS platforms.
            if let Some(sub_window) = app.get_webview_window("subtitle") {
                if let Err(e) = platform::macos::convert_capsule_to_nspanel(app.handle(), &sub_window) {
                    tracing::warn!(error = %e, "NSPanel conversion failed (non-fatal)");
                }
            }

            // Mark the app state as ready for IPC.
            let state_clone = state.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = state_clone.mark_ready().await {
                    tracing::error!(error = ?e, "failed to mark app state ready");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::diagnostics::ping,
            ipc::diagnostics::version,
            ipc::diagnostics::bootstrap_ready,
            ipc::diagnostics::latency_probe,
            ipc::session::start_session,
            ipc::session::stop_session,
            ipc::session::session_status,
            ipc::session::list_sessions,
            ipc::device::list_devices,
            ipc::device::set_mic,
            ipc::device::set_output,
            ipc::device::get_topo_summary,
            ipc::subtitle::append_subtitle,
            ipc::subtitle::clear_subtitles,
            ipc::topology::check_topology,
            ipc::topology::fix_topology_hint,
            ipc::config::get_config,
            ipc::config::set_config,
            ipc::config::get_api_key_status,
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running realtime_interpreter application");
}

fn build_tray_menu(app: &AppHandle<Wry>) -> AppResult<Menu<Wry>> {
    let start_r3 = MenuItem::with_id(app, "start_r3", "Start R3", true, None::<&str>)
        .map_err(menu_error)?;
    let stop_r3 = MenuItem::with_id(app, "stop_r3", "Stop R3", false, None::<&str>)
        .map_err(menu_error)?;
    let start_r4 = MenuItem::with_id(app, "start_r4", "Start R4", true, None::<&str>)
        .map_err(menu_error)?;
    let stop_r4 = MenuItem::with_id(app, "stop_r4", "Stop R4", false, None::<&str>)
        .map_err(menu_error)?;
    let bypass = MenuItem::with_id(
        app,
        "toggle_bypass",
        "原声直出 (Bypass)  ⌃⌥P",
        true,
        None::<&str>,
    )
    .map_err(menu_error)?;
    let show_subtitle = MenuItem::with_id(
        app,
        "show_subtitle",
        "Show Subtitle  ⌥",
        true,
        None::<&str>,
    )
    .map_err(menu_error)?;
    let hide_subtitle = MenuItem::with_id(
        app,
        "hide_subtitle",
        "Hide Subtitle  ⌃⌥H",
        true,
        None::<&str>,
    )
    .map_err(menu_error)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)
        .map_err(menu_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(menu_error)?;

    Menu::with_items(
        app,
        &[
            &start_r3,
            &stop_r3,
            &separator,
            &start_r4,
            &stop_r4,
            &separator,
            &bypass,
            &separator,
            &show_subtitle,
            &hide_subtitle,
            &separator,
            &quit,
        ],
    )
    .map_err(menu_error)
}

fn handle_tray_event(app: &AppHandle<Wry>, id: &str) {
    match id {
        "start_r3" => {
            let _ = app.emit("tray:start_r3", ());
        }
        "stop_r3" => {
            let _ = app.emit("tray:stop_r3", ());
        }
        "start_r4" => {
            let _ = app.emit("tray:start_r4", ());
        }
        "stop_r4" => {
            let _ = app.emit("tray:stop_r4", ());
        }
        "toggle_bypass" => {
            let _ = app.emit("tray:toggle_bypass", ());
        }
        "show_subtitle" => {
            if let Some(w) = app.get_webview_window("subtitle") {
                let _ = w.show();
            }
        }
        "hide_subtitle" => {
            if let Some(w) = app.get_webview_window("subtitle") {
                let _ = w.hide();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn handle_global_hotkey(app: &AppHandle<Wry>, event: &str) {
    match event {
        "toggle_subtitle" => {
            if let Some(w) = app.get_webview_window("subtitle") {
                let is_visible = w.is_visible().unwrap_or(false);
                if is_visible {
                    let _ = w.hide();
                } else {
                    let _ = w.show();
                }
            }
        }
        "toggle_bypass" => {
            let _ = app.emit("tray:toggle_bypass", ());
        }
        "hide_subtitle" => {
            if let Some(w) = app.get_webview_window("subtitle") {
                let _ = w.hide();
            }
        }
        _ => {}
    }
}

fn menu_error(e: tauri::Error) -> AppError {
    AppError::Ipc(format!("menu construction failed: {e}"))
}

/// Fallback tray icon (1x1 transparent PNG) when the default
/// window icon is unavailable. Real icon assets land in ticket #13.
fn default_tray_icon() -> tauri::image::Image<'static> {
    // Pre-decoded 16x16 transparent PNG.
    const TRANSPARENT_PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00, 0x1D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    tauri::image::Image::from_bytes(TRANSPARENT_PNG).expect("fallback PNG is valid")
}
