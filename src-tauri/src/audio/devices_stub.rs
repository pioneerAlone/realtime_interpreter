//! Non-macOS stub for audio device enumeration.
//!
//! Per `docs/spec/v0/00-overview.md`, v0 is macOS-first. The
//! pre-flight topology check therefore reports a structured
//! "platform unsupported" error on non-macOS rather than failing
//! silently. v1+ (per `25-macos-vs-windows-platform-diff.md`) will
//! add WASAPI loopback enumeration on Windows.

use super::topology::AudioDevice;

/// Returns an empty list. The topology check layer is responsible
/// for distinguishing "no devices found" from "platform not
/// supported" by inspecting `cfg!(target_os)`. See
/// `topology.rs::run_check`.
pub fn enumerate_devices() -> Vec<AudioDevice> {
    Vec::new()
}
