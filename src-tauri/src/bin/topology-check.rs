//! Standalone pre-flight topology checker (ticket #06).
//!
//! Run via `cargo run --bin topology-check`. This binary is what
//! the v0 demo flow runs *before* starting any session (per
//! `docs/spec/v0/06-deliverables.md` §4 demo step 2).
//!
//! Exit codes (per issue #6 AC3 + `docs/spec/v0/01-architecture.md`
//! §7 pre-flight topology check):
//! - 0: PASS (or WARN -- soft checks only). Topology usable for the
//!   session; UI may still surface the warning row.
//! - 1: FAIL. A required device is missing or a 误区 self-check
//!   detected an anti-pattern. The session must not start.
//!
//! Output is a human-readable red/amber/green panel on stdout, plus
//! the full `TopologyReport` as JSON on stdout when invoked with
//! `--json` (useful for the `verify-topology-check.js` script in
//! the v0 release flow).
//!
//! Uses `realtime_interpreter_lib::audio::topology` to enumerate
//! devices + run the checks. The audio module is gated on macOS; on
//! other platforms the binary still runs but the report verdict is
//! `Fail` with the platform-unsupported check.
//!
//! Prefs handling: this binary runs **standalone** (no Tauri
//! app handle), so it cannot reach `tauri-plugin-store`. CLI
//! overrides let a CI script pick specific devices for the
//! topology check without going through the UI store:
//!
//! - `--mic <name>`        : override `TopologyPrefs.mic_name`
//! - `--r3-out <name>`     : override `TopologyPrefs.r3_out_vac_name`
//! - `--r4-in <name>`      : override `TopologyPrefs.r4_in_vac_name`
//! - `--r4-out <name>`     : override `TopologyPrefs.r4_out_device_name`
//!
//! When no override is given, the binary falls back to heuristic
//! device search so the CLI smoke test still works on a fresh
//! install (matches the UI's first-launch behavior).

use realtime_interpreter_lib::audio::topology::{
    self, TopologyPrefs, TopologyReport, Verdict,
};

use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let json_mode = args.iter().any(|a| a == "--json");

    let prefs = parse_prefs_from_args(&args);
    let report = topology::run_check(&prefs);

    if json_mode {
        match serde_json::to_string_pretty(&report) {
            Ok(s) => println!("{}", s),
            Err(e) => {
                eprintln!("topology-check: failed to serialize report: {}", e);
                return ExitCode::from(2);
            }
        }
    } else {
        print_panel(&report);
    }

    match report.verdict {
        Verdict::Pass | Verdict::Warn => ExitCode::from(0),
        Verdict::Fail => ExitCode::from(1),
    }
}

fn print_panel(report: &TopologyReport) {
    let verdict_label = match report.verdict {
        Verdict::Pass => "\x1b[32mPASS\x1b[0m",
        Verdict::Warn => "\x1b[33mWARN\x1b[0m",
        Verdict::Fail => "\x1b[31mFAIL\x1b[0m",
    };

    println!("realtime_interpreter -- pre-flight topology check");
    println!("verdict: {}", verdict_label);
    println!();

    println!("Discovered audio devices:");
    if report.devices.is_empty() {
        println!("  (no devices visible to CoreAudio)");
    } else {
        for d in &report.devices {
            println!(
                "  - {} [{}]  in_ch={}  out_ch={}",
                d.name, d.transport, d.channel_count_in, d.channel_count_out
            );
        }
    }
    println!();

    println!("Checks:");
    for c in &report.checks {
        let sev = match c.severity {
            topology::Severity::Ok => "\x1b[32m  ok \x1b[0m",
            topology::Severity::Warn => "\x1b[33m warn\x1b[0m",
            topology::Severity::Fail => "\x1b[31m fail\x1b[0m",
        };
        println!("[{}] {}", sev, c.label);
        if let Some(observed) = &c.observed {
            println!("        observed: {}", observed);
        }
        if !c.action.is_empty() {
            println!("        fix: {}", c.action);
        }
    }
    println!();

    println!("Summary: {}", report.fix_summary);
}

/// Parse `--mic NAME / --r3-out NAME / --r4-in NAME / --r4-out NAME`
/// from argv into a `TopologyPrefs`. Anything missing stays `None`,
/// letting the topology layer fall back to heuristic search.
fn parse_prefs_from_args(args: &[String]) -> TopologyPrefs {
    let mut prefs = TopologyPrefs::default();
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--mic" if i + 1 < args.len() => {
                prefs.mic_name = Some(args[i + 1].clone());
                i += 2;
            }
            "--r3-out" if i + 1 < args.len() => {
                prefs.r3_out_vac_name = Some(args[i + 1].clone());
                i += 2;
            }
            "--r4-in" if i + 1 < args.len() => {
                prefs.r4_in_vac_name = Some(args[i + 1].clone());
                i += 2;
            }
            "--r4-out" if i + 1 < args.len() => {
                prefs.r4_out_device_name = Some(args[i + 1].clone());
                i += 2;
            }
            _ => i += 1,
        }
    }
    prefs
}
