//! Audio subsystem: device enumeration + topology pre-flight check +
//! device-change hot-unplug detector.
//!
//! Module split per platform:
//! - **macOS** (`devices_macos.rs`, `monitor_macos.rs`): CoreAudio FFI
//!   via `coreaudio-sys` 0.2. `monitor_macos` wires
//!   `AudioObjectAddPropertyListener` on the system root for the
//!   `kAudioHardwarePropertyDevices` selector so that the React UI
//!   is notified when a BlackHole device is hot-unplugged.
//! - **non-macOS** (`devices_stub.rs`, `monitor_stub.rs`): empty
//!   stubs. Topology check on these platforms returns Fail with a
//!   "platform unsupported" check (v0 is macOS-first per
//!   `docs/spec/v0/00-overview.md`).
//!
//! `topology.rs` consumes the `AudioDevice` enumeration and runs the
//! 4-device wiring validation + the 3-misconception self-check
//! described in `docs/spec/v0/01-architecture.md` §7 and
//! `docs/spec/v0/06-deliverables.md` §3.1.

#[cfg(target_os = "macos")]
pub mod devices_macos;

#[cfg(not(target_os = "macos"))]
pub mod devices_stub;

#[cfg(target_os = "macos")]
pub mod monitor_macos;

#[cfg(not(target_os = "macos"))]
pub mod monitor_stub;

#[cfg(target_os = "macos")]
pub use devices_macos::enumerate_devices;

#[cfg(not(target_os = "macos"))]
pub use devices_stub::enumerate_devices;

pub mod topology;

pub use topology::TopologyPrefs;
