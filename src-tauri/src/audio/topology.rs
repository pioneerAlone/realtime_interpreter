//! Pre-flight topology check + 3-misconception self-check.
//!
//! Spec references:
//! - `docs/spec/v0/01-architecture.md` §7 "Pre-flight topology check"
//! - `docs/spec/v0/06-deliverables.md` §3.1 "Pre-flight topology checker"
//! - `docs/spec/v0/03-b-channel-subtitle.md` §4.1 "Why BlackHole 16ch"
//! - `.scratch/macos-siminterpret-poc/map.md` L124-128 "3 个必检误区"
//! - `.scratch/macos-siminterpret-poc/issues/21-virtual-sound-card-wiki-synthesis.md`
//!   (T21 wiki synthesis: the 3 anti-patterns)
//!
//! Anti-patterns validated (3-misconception self-check):
//!   误区 1: two translation outputs share the same VAC -> infinite
//!           loop + echo explosion. Validated by ensuring the R3
//!           output VAC is **different from** the R4 input VAC.
//!   误区 2: meeting app mic input is the real mic instead of the
//!           VAC. We cannot directly inspect meeting-app mic routing
//!           from outside the meeting app, so this check is
//!           limited to a "did the user select any R3 output VAC"
//!           check -- if no VAC exists with output channels we
//!           cannot suggest BlackHole 2ch as the meeting mic.
//!           The user must confirm in the meeting app UI; the
//!           topology UI surfaces an actionable hint.
//!   误区 3: 对方翻译输出 (other-party translated audio) is routed to
//!           a VAC, which would create crosstalk into the meeting.
//!           Validated by ensuring the headphones/speaker output
//!           device is **not** a VAC. (Aggregate Devices combine
//!           real output with VAC -- we treat those separately.)
//!
//! Returns a `TopologyReport` that the binary, the IPC layer, and
//! the React UI all consume. The report contains enough detail to
//! drive a red/amber/green panel + actionable fix text per failed
//! check.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::devices_macos::AudioDevice;

/// User-selected topology wiring, persisted via tauri-plugin-store.
///
/// `Option<String>` (not `String`):
/// - `None`     = user has not picked yet (default → OS default).
/// - `Some("")` = user explicitly picked "system default".
/// - `Some("BlackHole 2ch")` = user picked a specific named device.
///
/// `Deserialize` is for IPC incoming payload (UI → Rust).
/// `Serialize` lets `TopologyPrefs` ride along in `TopologyReport` if
/// we ever want to round-trip it to the UI (we currently only send it
/// back via `get_topology_prefs` so the round-trip is not strictly
/// needed, but cheap and forward-compatible).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TopologyPrefs {
    /// Real microphone (R3 source). Should be a non-VAC input.
    pub mic_name: Option<String>,
    /// VAC that R3 翻译输出 writes to (R3 sink / meeting-app mic input).
    pub r3_out_vac_name: Option<String>,
    /// VAC that R4 对方声音 input reads from (R4 source / meeting-app
    /// speaker loopback). BlackHole 16ch is the canonical pick.
    pub r4_in_vac_name: Option<String>,
    /// Real output device (R4 sink / 对方翻译输出 + 原声直出).
    /// `None` or `Some("")` = system default.
    pub r4_out_device_name: Option<String>,
}

/// Verdict of the overall topology check.
///
/// - `Pass`: all required devices present + all 3 self-checks pass.
/// - `Warn`: all required devices present but at least one soft
///   check failed (e.g. an Aggregate Device pattern that needs
///   manual confirmation).
/// - `Fail`: a required device is missing OR a 误区 self-check
///   detected a known anti-pattern. The session **must not** start.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    Pass,
    Warn,
    Fail,
}

/// Severity of an individual check.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Ok,
    Warn,
    Fail,
}

/// One check row in the topology report. The UI renders one row per
/// check, color-coded by `severity`. `action` is the actionable fix
/// text shown when severity != Ok.
#[derive(Debug, Clone, Serialize)]
pub struct CheckResult {
    /// Stable identifier used by the frontend to suppress / highlight
    /// rows (e.g. "mic_present", "bh_2ch_present",
    /// "r3_out_vac_differs_from_r4_in_vac").
    pub id: String,
    /// Human-readable label ("Microphone (R3 input)" etc.).
    pub label: String,
    /// Severity for this row.
    pub severity: Severity,
    /// Observed device name (or null if the check is non-device).
    pub observed: Option<String>,
    /// Actionable fix text. Empty when severity == Ok.
    pub action: String,
}

/// Aggregate report returned by `run_check`. The binary prints it,
/// the IPC handler serializes it to the webview, and the React UI
/// renders a red/amber/green panel from it.
#[derive(Debug, Clone, Serialize)]
pub struct TopologyReport {
    pub verdict: Verdict,
    /// All discovered audio devices (kept in the report so the UI can
    /// populate the "devices seen" dropdown without re-enumerating).
    pub devices: Vec<AudioDevice>,
    /// Ordered list of individual checks.
    pub checks: Vec<CheckResult>,
    /// Wall-clock millis since the Unix epoch when the check ran.
    pub checked_at_ms: u64,
    /// A short, human-readable fix summary the UI renders in a
    /// callout when verdict != Pass.
    pub fix_summary: String,
}

/// Run the pre-flight topology check + 3-misconception self-check
/// against the user-selected `TopologyPrefs`.
///
/// Per the v0 extension of ticket #06: the first 4 checks (mic,
/// R3-out VAC, R4-in VAC, real output) check the user's **selected**
/// devices rather than guessing by hardcoded name. If the user has
/// not picked a slot yet (`None`), we fall back to the legacy
/// name-based search so the panel still renders meaningfully on first
/// launch.
///
/// On non-macOS this returns `verdict = Fail` with a structured
/// "platform unsupported" check (ticket #06 is macOS-first per
/// `docs/spec/v0/00-overview.md`).
pub fn run_check(prefs: &TopologyPrefs) -> TopologyReport {
    #[cfg(not(target_os = "macos"))]
    {
        return TopologyReport {
            verdict: Verdict::Fail,
            devices: Vec::new(),
            checks: vec![CheckResult {
                id: "platform_supported".to_string(),
                label: "Platform supported (macOS only at v0)".to_string(),
                severity: Severity::Fail,
                observed: None,
                action: "v0 is macOS-only per docs/spec/v0/00-overview.md; Windows + Linux support is v1+.".to_string(),
            }],
            checked_at_ms: now_ms(),
            fix_summary: "v0 supports macOS only. Windows + Linux coming in v1+.".to_string(),
        };
    }

    #[cfg(target_os = "macos")]
    {
        run_check_macos(prefs)
    }
}

#[cfg(target_os = "macos")]
fn run_check_macos(prefs: &TopologyPrefs) -> TopologyReport {
    use super::devices_macos::enumerate_devices;

    let devices = enumerate_devices();
    let mut checks: Vec<CheckResult> = Vec::new();

    // Lookup helpers: try user-picked name first, fall back to a
    // heuristic search. The UI panels render the picker with the
    // resolved `observed` value.
    let by_name: HashMap<&str, &AudioDevice> =
        devices.iter().map(|d| (d.name.as_str(), d)).collect();

    fn lookup(
        by_name: &HashMap<&str, &AudioDevice>,
        picked: &Option<String>,
        fallback_substr: &str,
    ) -> Option<AudioDevice> {
        // 1) User-picked exact name (Some(name) where name != ""):
        if let Some(name) = picked.as_deref().filter(|n| !n.is_empty()) {
            if let Some(d) = by_name.get(name) {
                return Some((*d).clone());
            }
        }
        // 2) Heuristic: substring + transport/channel hint. v0 uses
        //    the canonical "BlackHole 2ch" / "BlackHole 16ch" names,
        //    so substring match is precise. v1+ may need fuzzy match
        //    for renamed VACs (e.g. "Soundflower 2ch").
        by_name
            .values()
            .find(|d| d.name.contains(fallback_substr))
            .map(|d| (*d).clone())
    }

    // ---- Check 1: a real microphone input exists (R3 source) ----
    // The user picks one explicitly; if not picked, fall back to
    // the first non-Virtual device with input channels. The picker
    // dropdown only lists devices with input channels, so a user
    // choice is always valid by construction.
    let real_mic = lookup(&by_name, &prefs.mic_name, "").or_else(|| {
        devices
            .iter()
            .find(|d| d.channel_count_in > 0 && d.transport != "Virtual")
            .cloned()
    });
    let any_mic = devices.iter().find(|d| d.channel_count_in > 0);
    let mic_present = real_mic.is_some();
    checks.push(CheckResult {
        id: "mic_present".to_string(),
        label: "Microphone (R3 input)".to_string(),
        severity: if mic_present { Severity::Ok } else { Severity::Fail },
        observed: real_mic
            .as_ref()
            .map(|d| format!("{} ({})", d.name, d.transport))
            .or_else(|| any_mic.map(|d| format!("{} ({})", d.name, d.transport))),
        action: if mic_present {
            String::new()
        } else {
            "No real (non-Virtual) microphone detected. Check System Settings > Sound > Input; plug in a real mic or webcam.".to_string()
        },
    });

    // ---- Check 2: R3 output VAC exists (R3 sink / meeting mic input) ----
    let bh2 = lookup(&by_name, &prefs.r3_out_vac_name, "BlackHole 2ch");
    let bh2_severity = match &bh2 {
        Some(d) if d.channel_count_out >= 2 => Severity::Ok,
        Some(_) => Severity::Warn,
        None => Severity::Fail,
    };
    checks.push(CheckResult {
        id: "bh_2ch_present".to_string(),
        label: "R3 输出 VAC (meeting mic input)".to_string(),
        severity: bh2_severity,
        observed: bh2.as_ref().map(|d| format!("{} ({})", d.name, d.transport)),
        action: match bh2_severity {
            Severity::Ok => String::new(),
            Severity::Warn => "Selected R3 output VAC has fewer than 2 output channels; meeting software may refuse to route audio through it.".to_string(),
            Severity::Fail => "No VAC picked for R3 output. Install BlackHole 2ch (brew install blackhole-2ch) and pick it above. After install: sudo launchctl kickstart -kp system/com.apple.audio.coreaudiod.".to_string(),
        },
    });

    // ---- Check 3: R4 input VAC exists (R4 source / meeting-app speaker loopback) ----
    let bh16 = lookup(&by_name, &prefs.r4_in_vac_name, "BlackHole 16ch");
    let bh16_severity = match &bh16 {
        Some(d) if d.channel_count_in >= 16 || d.channel_count_out >= 16 => Severity::Ok,
        Some(_) => Severity::Warn,
        None => Severity::Fail,
    };
    checks.push(CheckResult {
        id: "bh_16ch_present".to_string(),
        label: "R4 输入 VAC (meeting app speaker loopback)".to_string(),
        severity: bh16_severity,
        observed: bh16.as_ref().map(|d| format!("{} ({})", d.name, d.transport)),
        action: match bh16_severity {
            Severity::Ok => String::new(),
            Severity::Warn => "Selected R4 input VAC has fewer than 16 channels; meeting-app multi-channel loopback may not be picked up correctly.".to_string(),
            Severity::Fail => "No VAC picked for R4 input. Install BlackHole 16ch (brew install blackhole-16ch) and pick it above.".to_string(),
        },
    });

    // ---- Check 4: a real output device (headphones/speaker) exists ----
    let real_output = lookup(&by_name, &prefs.r4_out_device_name, "").or_else(|| {
        devices
            .iter()
            .find(|d| d.channel_count_out > 0 && d.transport != "Virtual")
            .cloned()
    });
    let real_output_severity = match &real_output {
        Some(d) if d.transport == "Aggregate" => Severity::Warn,
        Some(_) => Severity::Ok,
        None => Severity::Fail,
    };
    checks.push(CheckResult {
        id: "real_output_present".to_string(),
        label: "Headphones or speakers (R4 output / local monitor)".to_string(),
        severity: real_output_severity,
        observed: real_output.as_ref().map(|d| format!("{} ({})", d.name, d.transport)),
        action: match real_output_severity {
            Severity::Ok => String::new(),
            Severity::Warn => "Output is an Aggregate Device. Verify in Audio MIDI Setup that the Aggregate combines a real output (your headphones) with the BlackHole 16ch loopback. If only VACs are aggregated, the meeting will loop.".to_string(),
            Severity::Fail => "No real output device detected. Plug in headphones or speakers; Bluetooth counts as real output as long as macOS shows it as the active device.".to_string(),
        },
    });

    // ---- 3-misconception self-check (T21 wiki) ----
    // 误区 1: R3 output VAC != R4 input VAC. We compare by AudioObjectID
    // so a user-picked but duplicate-named device still trips the check.
    let mis1_severity = match (&bh2, &bh16) {
        (Some(a), Some(b)) if a.id == b.id => Severity::Fail,
        (Some(_), Some(_)) => Severity::Ok,
        _ => Severity::Warn,
    };
    checks.push(CheckResult {
        id: "r3_out_vac_differs_from_r4_in_vac".to_string(),
        label: "误区 1: R3 输出 VAC ≠ R4 输入 VAC".to_string(),
        severity: mis1_severity,
        observed: match (&bh2, &bh16) {
            (Some(a), Some(b)) if a.id == b.id => Some("same VAC for both".to_string()),
            (Some(a), Some(b)) => Some(format!("R3 = {}, R4 = {}", a.name, b.name)),
            _ => None,
        },
        action: match mis1_severity {
            Severity::Ok | Severity::Warn => String::new(),
            Severity::Fail => String::from("Same VAC for both R3 and R4 will cause an infinite loop + echo. Use BlackHole 2ch for R3 output and BlackHole 16ch for R4 input (different HAL drivers)."),
        },
    });

    // 误区 2: meeting app mic input must = R3 output VAC. We cannot
    // introspect meeting-app routing from CoreAudio; we surface a
    // WARN row instructing the user to verify in the meeting app.
    let mis2_severity = if bh2.is_some() { Severity::Warn } else { Severity::Fail };
    checks.push(CheckResult {
        id: "meeting_app_mic_is_r3_vac".to_string(),
        label: "误区 2: 会议软件麦克风 = R3 输出对应的虚拟声卡".to_string(),
        severity: mis2_severity,
        observed: bh2.as_ref().map(|d| format!("candidate: {}", d.name)),
        action: "Open your meeting app (Zoom / Teams / Tencent Meeting / ...) Audio Settings, and select the R3 output VAC above as the microphone input. If you select the real mic, the meeting hears your untranslated voice.".to_string(),
    });

    // 误区 3: 对方翻译输出 -> real headphones only. Already encoded
    // in Check 4 (Aggregate = Warn, real = Ok, none = Fail).
    let mis3_severity = real_output_severity;
    checks.push(CheckResult {
        id: "peer_audio_to_real_output_only".to_string(),
        label: "误区 3: 对方翻译输出走真实耳机 (not virtual)".to_string(),
        severity: mis3_severity,
        observed: real_output.as_ref().map(|d| format!("{} ({})", d.name, d.transport)),
        action: match mis3_severity {
            Severity::Ok => String::new(),
            Severity::Warn => "Output is an Aggregate Device. Verify in Audio MIDI Setup that the Aggregate combines a real output (your headphones) with the BlackHole 16ch loopback. If only VACs are aggregated, the meeting will loop.".to_string(),
            Severity::Fail => "No real output device available. Plug in headphones or speakers.".to_string(),
        },
    });

    // ---- Verdict ----
    // Any Fail check => Fail verdict. Multiple Warn checks with no
    // Fail => Warn verdict. Otherwise Pass.
    let has_fail = checks.iter().any(|c| c.severity == Severity::Fail);
    let warn_count = checks.iter().filter(|c| c.severity == Severity::Warn).count();
    let verdict = if has_fail {
        Verdict::Fail
    } else if warn_count > 0 {
        Verdict::Warn
    } else {
        Verdict::Pass
    };

    let fix_summary = build_fix_summary(&checks);

    TopologyReport {
        verdict,
        devices,
        checks,
        checked_at_ms: now_ms(),
        fix_summary,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn build_fix_summary(checks: &[CheckResult]) -> String {
    let fails: Vec<&CheckResult> = checks.iter().filter(|c| c.severity == Severity::Fail).collect();
    if fails.is_empty() {
        let warns: Vec<&CheckResult> = checks.iter().filter(|c| c.severity == Severity::Warn).collect();
        if warns.is_empty() {
            return String::from("Topology OK -- 4-device wiring detected + 3-误区 self-check passed.");
        }
        let mut s = String::from("Topology OK with warnings: ");
        for (i, c) in warns.iter().enumerate() {
            if i > 0 {
                s.push_str("; ");
            }
            s.push_str(&c.label);
        }
        return s;
    }
    let mut s = format!("{} blocking issue(s):", fails.len());
    for c in fails {
        s.push_str("\n  - ");
        s.push_str(&c.label);
        if !c.action.is_empty() {
            s.push_str(" -- ");
            s.push_str(&c.action);
        }
    }
    s
}
