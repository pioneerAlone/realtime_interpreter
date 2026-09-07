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

use std::panic::{catch_unwind, AssertUnwindSafe};
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
        .plugin(tauri_nspanel::init())
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
                // Catch panics from Carbon's `RegisterEventHotKey` — on first run
                // macOS may not have granted Accessibility/Input Monitoring
                // permission, and tauri-plugin-global-shortcut does not return
                // Result for permission errors, it can panic deep in Carbon.
                let register_result = catch_unwind(AssertUnwindSafe(|| {
                    gs.on_shortcut(shortcut, move |_app, _shortcut, ev| {
                        if ev.state() == ShortcutState::Pressed {
                            handle_global_hotkey(&app_for_handler, event_name);
                        }
                    })
                }));
                if let Err(e) = register_result {
                    tracing::warn!(error = ?e, "global shortcut register panicked (likely macOS permission denied); will retry after user grants Accessibility");
                }
            }

            // Convert the subtitle webview window into a non-activating
            // NSPanel once it has been built. This is a no-op on
            // non-macOS platforms. Wrapped in catch_unwind because
            // tauri-nspanel v2's RawNSPanel::from_window can panic
            // when the webview is not fully constructed yet.
            if let Some(sub_window) = app.get_webview_window("subtitle") {
                let convert_result = catch_unwind(AssertUnwindSafe(|| {
                    platform::macos::convert_capsule_to_nspanel(app.handle(), &sub_window)
                }));
                match convert_result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => tracing::warn!(error = %e, "NSPanel conversion returned error (non-fatal)"),
                    Err(panic) => tracing::warn!(?panic, "NSPanel conversion panicked (non-fatal); capsule stays as default webview"),
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

/// Fallback tray icon (32x32 RGBA PNG) when the default
/// window icon is unavailable. Real branded icon lands in ticket #13.
fn default_tray_icon() -> tauri::image::Image<'static> {
    // Pre-decoded 32x32 fully-transparent RGBA PNG (all-zero pixels).
    // Generated by Python zlib with compression level 9 and dumped
    // to a Rust byte array. Valid PNG signature + IHDR + IDAT + IEND
    // with color type 6 (RGBA), bit depth 8.
    const TRANSPARENT_PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20, 0x08, 0x06, 0x00, 0x00, 0x00, 0x73, 0x7A, 0x7A, 0xF4, 0x00, 0x00, 0x00, 0x1A, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA, 0xED, 0xC1, 0x01, 0x01, 0x00, 0x00, 0x00, 0x82, 0x20, 0xFF, 0xAF, 0x6E, 0x48, 0x40, 0x01, 0x00, 0x00, 0x00, 0xEF, 0x06, 0x10, 0x20, 0x00, 0x01, 0xC9, 0xB5, 0xC3, 0xB1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    tauri::image::Image::from_bytes(TRANSPARENT_PNG).expect("fallback PNG is valid")
}
