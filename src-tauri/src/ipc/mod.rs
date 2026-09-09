//! IPC command surface (per docs/spec/v0/01-architecture.md §6).
//!
//! v0 scaffold: each domain module declares a single stub command
//! returning a deterministic placeholder. Real bodies land in
//! tickets #03-#13.

pub mod config;
pub mod device;
pub mod diagnostics;
pub mod engine;
pub mod presets;
pub mod session;
pub mod subtitle;
pub mod topology;
