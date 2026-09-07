//! Topology IPC commands (ticket #06).
//!
//! Three commands:
//! - `check_topology` -- re-runs the topology check synchronously and
//!   returns the latest `TopologyReport`. UI calls this from a
//!   "Re-check" button.
//! - `topology_status` -- returns the cached `TopologyReport` from
//!   the most recent run. UI re-renders do **not** re-probe CoreAudio;
//!   they read this snapshot. (Avoids hammering CoreAudio during
//!   every state-driven re-render.)
//! - `fix_topology_hint` -- returns a generic fix-it hint string
//!   (kept from the v0 scaffold for backward compat; richer hint
//!   text is per-row in `TopologyReport::checks[i].action`).
//!
//! Device-loss listener (R6 hot-unplug) is wired in
//! `platform::macos` and emits the `device:lost` Tauri event on the
//! app handle when a topology-relevant device disappears. The
//! React UI listens to that event and prompts the user to
//! re-check the topology.

use std::sync::RwLock;

use crate::audio::topology::{self, TopologyReport, Verdict};

/// Global cache of the most recent topology check. Guarded by a
/// `std::sync::RwLock` because every `#[tauri::command]` is invoked
/// from the async-runtime thread, while the cache is also written
/// by the device-loss listener thread.
static CACHED_REPORT: RwLock<Option<TopologyReport>> = RwLock::new(None);

/// Run the topology check + update the cache + return the report.
#[tauri::command]
pub async fn check_topology() -> Result<TopologyReport, String> {
    let report = topology::run_check();
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
    CACHED_REPORT.read().ok().and_then(|g| g.as_ref().map(|r| r.verdict))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_round_trip() {
        invalidate_cache();
        assert!(last_verdict().is_none());
        let report = topology::run_check();
        *CACHED_REPORT.write().unwrap() = Some(report.clone());
        assert_eq!(last_verdict(), Some(report.verdict));
    }
}
