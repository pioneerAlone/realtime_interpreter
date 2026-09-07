//! Topology check IPC commands.
//! Stub for v0 scaffold; real bodies land in ticket #06 (topology-check).

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[allow(dead_code)]
pub enum TopologyStatus {
    Pass,
    Warn,
    Fail,
}

#[tauri::command]
pub async fn check_topology() -> Result<TopologyStatus, String> {
    Err("not implemented — see ticket #06 (topology-check)".to_string())
}

#[tauri::command]
pub async fn fix_topology_hint() -> Result<String, String> {
    Ok("Topology fix hints: ensure BlackHole 16ch is installed via `brew install blackhole-16ch`; create Aggregate Device in /Applications/Utilities/Audio MIDI Setup; select BH 16ch as meeting software's microphone input.".to_string())
}
