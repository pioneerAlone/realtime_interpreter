//! Topology IPC commands (ticket #06).
//!
//! Six commands:
//! - `check_topology` — re-runs the topology check synchronously and
//!   returns the latest `TopologyReport`. UI calls this from a
//!   "Re-check" button and right after the user picks a new device.
//! - `topology_status` — returns the cached `TopologyReport` from
//!   the most recent run. UI re-renders do **not** re-probe CoreAudio;
//!   they read this snapshot. (Avoids hammering CoreAudio during
//!   every state-driven re-render.)
//! - `fix_topology_hint` — returns a generic fix-it hint string
//!   (kept from the v0 scaffold for backward compat; richer hint
//!   text is per-row in `TopologyReport::checks[i].action`).
//! - `get_topology_prefs` — reads `TopologyPrefs` from
//!   `tauri-plugin-store` (file `topology-prefs.bin` in the app data
//!   dir). UI calls this on first mount to hydrate the picker state.
//! - `set_topology_prefs` — writes `TopologyPrefs` to the same
//!   store. Called by the UI when the user picks a different device
//!   in any of the four pickers. Also implicitly triggers a fresh
//!   `check_topology` (returns the new report so the UI re-renders
//!   without a second IPC round-trip).
//!
//! Device-loss listener (R6 hot-unplug) is wired in
//! `audio::monitor_macos` and emits the `device:lost` Tauri event on
//! the app handle when a topology-relevant device disappears. The
//! React UI listens to that event and prompts the user to re-check
//! the topology.
//!
//! Persistence path: `topology-prefs.bin` under
//! `$APP_DATA_DIR/topology-prefs.bin` per tauri-plugin-store's
//! `resolve_store_path`. The file is created on first set.

use std::sync::RwLock;

use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

use crate::audio::topology::{self, TopologyPrefs, TopologyReport, Verdict};

/// Filename (relative to app data dir) used by tauri-plugin-store.
const STORE_FILE: &str = "topology-prefs.bin";

/// Single JSON key holding the serialized `TopologyPrefs`.
const PREFS_KEY: &str = "prefs";

/// Global cache of the most recent topology check. Guarded by a
/// `std::sync::RwLock` because every `#[tauri::command]` is invoked
/// from the async-runtime thread, while the cache is also written
/// by the device-loss listener thread.
static CACHED_REPORT: RwLock<Option<TopologyReport>> = RwLock::new(None);

/// Global cache of the current `TopologyPrefs`. Avoids hitting the
/// store on every `check_topology` invocation; the cache is loaded
/// from disk once on first access and updated in-line with each
/// `set_topology_prefs` call.
static CACHED_PREFS: RwLock<Option<TopologyPrefs>> = RwLock::new(None);

/// Read the cached prefs, loading from tauri-plugin-store on first
/// access. Returns `TopologyPrefs::default()` if the store is empty.
fn load_prefs<R: Runtime>(app: &AppHandle<R>) -> TopologyPrefs {
    if let Ok(guard) = CACHED_PREFS.read() {
        if let Some(p) = guard.as_ref() {
            return p.clone();
        }
    }
    let loaded = read_prefs_from_store(app).unwrap_or_default();
    if let Ok(mut guard) = CACHED_PREFS.write() {
        *guard = Some(loaded.clone());
    }
    loaded
}

fn read_prefs_from_store<R: Runtime>(app: &AppHandle<R>) -> Option<TopologyPrefs> {
    let store = app.store(STORE_FILE).ok()?;
    let value = store.get(PREFS_KEY)?;
    serde_json::from_value(value).ok()
}

fn write_prefs_to_store<R: Runtime>(
    app: &AppHandle<R>,
    prefs: &TopologyPrefs,
) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("failed to open store {STORE_FILE}: {e}"))?;
    let value = serde_json::to_value(prefs)
        .map_err(|e| format!("failed to serialize prefs: {e}"))?;
    store.set(PREFS_KEY, value);
    store
        .save()
        .map_err(|e| format!("failed to save store {STORE_FILE}: {e}"))?;
    Ok(())
}

/// Run the topology check + update the cache + return the report.
#[tauri::command]
pub async fn check_topology(app: AppHandle) -> Result<TopologyReport, String> {
    let prefs = load_prefs(&app);
    let report = topology::run_check(&prefs);
    if let Ok(mut guard) = CACHED_REPORT.write() {
        *guard = Some(report.clone());
    }
    Ok(report)
}

/// Return the most recent cached topology report. UI re-renders go
/// here, not through `check_topology` (avoids re-enumerating
/// CoreAudio on every state change).
#[tauri::command]
pub async fn topology_status() -> Result<Option<TopologyReport>, String> {
    let guard = CACHED_REPORT
        .read()
        .map_err(|e| format!("topology cache poisoned: {e}"))?;
    Ok(guard.clone())
}

/// Generic fix-it hint. The richer per-row hint lives in
/// `TopologyReport::checks[i].action`. This is kept for backward
/// compat with the v0 scaffold (see issue #2 IPC list).
#[tauri::command]
pub async fn fix_topology_hint() -> Result<String, String> {
    Ok(String::from(
        "Topology fix hints: ensure BlackHole 2ch + BlackHole 16ch are installed via brew; \
         create an Aggregate Device in /Applications/Utilities/Audio MIDI Setup; \
         set the meeting software mic input to BlackHole 2ch; \
         set the meeting software speaker output to BlackHole 16ch. \
         Per-row actionable fix text is in `topology::check_topology` output `checks[].action`.",
    ))
}

/// Read the persisted `TopologyPrefs`. UI calls this once on mount
/// to populate the four device pickers; subsequent user picks go
/// through `set_topology_prefs`.
#[tauri::command]
pub async fn get_topology_prefs(app: AppHandle) -> Result<TopologyPrefs, String> {
    Ok(load_prefs(&app))
}

/// Persist `TopologyPrefs` + re-run the topology check + return the
/// updated `TopologyReport`. The UI calls this whenever the user
/// picks a different device in any of the four pickers.
///
/// Behavior:
/// - The store write happens **before** the topology check so a
///   crash mid-check still leaves the user's pick saved.
/// - The cached prefs are updated so subsequent `check_topology`
///   calls without an explicit set stay consistent.
/// - If the user picks a device name that does not exist in the
///   current CoreAudio enumeration (e.g. BlackHole was uninstalled
///   between launches), the picker shows the user's pick as the
///   "observed" value but the topology check returns Fail with an
///   actionable error. We do NOT silently clear the pick; that
///   would surprise users who have unplugged-then-replugged a VAC.
#[tauri::command]
pub async fn set_topology_prefs(
    app: AppHandle,
    prefs: TopologyPrefs,
) -> Result<TopologyReport, String> {
    write_prefs_to_store(&app, &prefs)?;
    if let Ok(mut guard) = CACHED_PREFS.write() {
        *guard = Some(prefs.clone());
    }
    let report = topology::run_check(&prefs);
    if let Ok(mut guard) = CACHED_REPORT.write() {
        *guard = Some(report.clone());
    }
    Ok(report)
}

/// Convenience: called by the device-loss listener thread to
/// invalidate the cache. The next UI render that hits
/// `topology_status` will see `None` and re-render an "unknown"
/// state until the user clicks "Re-check".
pub fn invalidate_cache() {
    if let Ok(mut guard) = CACHED_REPORT.write() {
        *guard = None;
    }
}

/// Convenience: tests / diagnostics can read whether the last
/// cached check passed.
#[allow(dead_code)]
pub fn last_verdict() -> Option<Verdict> {
    CACHED_REPORT
        .read()
        .ok()
        .and_then(|g| g.as_ref().map(|r| r.verdict))
}

/// Test helper: clear cached prefs (so the next `check_topology`
/// re-reads from store). Exposed for the unit test below.
#[cfg(test)]
fn reset_prefs_cache() {
    if let Ok(mut guard) = CACHED_PREFS.write() {
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_round_trip() {
        invalidate_cache();
        assert!(last_verdict().is_none());
        let prefs = TopologyPrefs::default();
        let report = topology::run_check(&prefs);
        *CACHED_REPORT.write().unwrap() = Some(report.clone());
        assert_eq!(last_verdict(), Some(report.verdict));
        reset_prefs_cache();
    }

    #[test]
    fn empty_prefs_check_runs() {
        // Smoke: the platform-unsupported stub returns Fail on Linux/macOS
        // without panicking. We only assert `run_check` returns a report
        // without erroring; the verdict is platform-dependent.
        let prefs = TopologyPrefs::default();
        let report = topology::run_check(&prefs);
        // We always populate `checked_at_ms` even on Fail.
        assert!(report.checked_at_ms > 0 || report.devices.is_empty());
    }
}