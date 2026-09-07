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

use realtime_interpreter_lib::audio::topology::{self, TopologyReport, Verdict};

use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let json_mode = args.iter().any(|a| a == "--json");

    let report = topology::run_check();

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
