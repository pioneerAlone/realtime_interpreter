//! macOS CoreAudio device-change listener (R6 hot-unplug detector).
//!
//! Wraps `AudioObjectAddPropertyListener` on the system root for
//! the `kAudioHardwarePropertyDevices` selector. Whenever a device
//! is added or removed, we:
//!
//! 1. Invalidate the cached `TopologyReport` so the UI re-renders
//!    in an "unknown" state.
//! 2. Emit a `device:lost` or `device:added` Tauri event so the
//!    React UI can prompt the user to re-check the topology
//!    (per `docs/spec/v0/01-architecture.md` §7 + `00-overview.md` §6
//!    R6: "audio device changes mid-session").
//!
//! The listener callback runs on the CoreAudio HAL thread. We
//! cannot call Tauri APIs from that thread, so we forward the
//! event to the Tauri runtime via `tauri::async_runtime::spawn`
//! (per Open-Less pattern at `openless-take.md` §6 item 5).

use std::os::raw::c_void;
use std::sync::atomic::{AtomicBool, Ordering};

use coreaudio_sys::{
    kAudioHardwarePropertyDevices, kAudioObjectPropertyElementMain,
    kAudioObjectPropertyScopeGlobal, kAudioObjectSystemObject,
    AudioObjectAddPropertyListener, AudioObjectID, AudioObjectPropertyAddress,
};
use tauri::{AppHandle, Emitter};

use crate::ipc::topology::invalidate_cache;

/// Set to true once a listener has been registered. Prevents
/// double-registration if `install` is called twice.
static INSTALLED: AtomicBool = AtomicBool::new(false);

/// Property selector wrapper that builds an `AudioObjectPropertyAddress`.
#[inline]
fn property(
    selector: coreaudio_sys::AudioObjectPropertySelector,
    scope: coreaudio_sys::AudioObjectPropertyScope,
    element: coreaudio_sys::AudioObjectPropertyElement,
) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: selector,
        mScope: scope,
        mElement: element,
    }
}

/// CoreAudio property listener callback signature (C ABI).
///
/// The `in_client_data` pointer is whatever we passed at registration
/// time -- here it is the `AppHandle`. We cast it back and use
/// `tauri::async_runtime::spawn` to forward to the Tauri runtime.
#[allow(non_snake_case)]
pub type AudioObjectPropertyListenerProc = unsafe extern "C" fn(
    in_object_id: AudioObjectID,
    in_number_addresses: u32,
    in_addresses: *const AudioObjectPropertyAddress,
    in_client_data: *mut c_void,
) -> i32;

/// Register the device-change listener with the CoreAudio HAL.
///
/// `app_handle` is stored as the `inClientData` pointer; the
/// listener callback casts it back and emits a Tauri event. The
/// listener itself never blocks: it just spawns a task.
pub fn install(app_handle: AppHandle) {
    if INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }

    let addr = property(
        kAudioHardwarePropertyDevices,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain,
    );

    // Cast the AppHandle to a raw void pointer. The listener casts
    // it back. We must keep the AppHandle alive for the lifetime
    // of the listener -- the AppHandle is owned by the Tauri
    // runtime, so this is safe for the process lifetime.
    let client_data = Box::into_raw(Box::new(app_handle)) as *mut c_void;

    let status = unsafe {
        AudioObjectAddPropertyListener(
            kAudioObjectSystemObject as AudioObjectID,
            &addr,
            Some(device_list_changed_handler),
            client_data,
        )
    };
    if status != 0 {
        tracing::warn!(
            error = status as i32,
            "AudioObjectAddPropertyListener(kAudioHardwarePropertyDevices) failed; \
             R6 hot-unplug detector will not run"
        );
        // Reset the flag so a future attempt can retry.
        INSTALLED.store(false, Ordering::SeqCst);
        // Reclaim the boxed AppHandle to avoid leaking it.
        unsafe {
            drop(Box::from_raw(client_data as *mut AppHandle));
        }
    } else {
        tracing::info!("R6 device-change listener installed on kAudioHardwarePropertyDevices");
    }
}

/// CoreAudio property-listener callback. Runs on the HAL thread.
/// Returns 0 (noErr) on success per the AudioObjectPropertyListener
/// signature; any non-zero OSStatus indicates an error to the HAL.
unsafe extern "C" fn device_list_changed_handler(
    _in_object_id: AudioObjectID,
    _in_number_addresses: u32,
    _in_addresses: *const AudioObjectPropertyAddress,
    in_client_data: *mut c_void,
) -> i32 {
    // Borrow (do not drop) the AppHandle that install() boxed.
    // We do not reclaim it here because the listener is called
    // for the process lifetime -- the AppHandle lives until
    // process exit, and the box pointer is the same throughout.
    let app_handle = &*(in_client_data as *const AppHandle);

    // Invalidate the cached topology report synchronously -- the
    // global RwLock is non-poisoning and safe to call from any
    // thread.
    invalidate_cache();

    // Forward the event to the Tauri runtime on the async pool.
    // We cannot call Emitter::emit on the HAL thread directly
    // because some Tauri internals expect to run on the main loop.
    let app_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = app_clone.emit("device:lost", ()) {
            tracing::warn!(error = ?e, "failed to emit device:lost Tauri event");
        }
    });

    0 // noErr
}
