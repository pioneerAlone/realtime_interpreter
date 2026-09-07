//! Placeholder for the latency probe (ticket #07).
//!
//! v0 scaffold: prints a placeholder line and exits 0. The real
//! implementation lands in ticket #07 (Rust binary that runs 5× and
//! reports median first-sound latency).

use std::env;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let iterations = if let Some(pos) = args.iter().position(|a| a == "--iterations") {
        args.get(pos + 1)
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(5)
    } else {
        5
    };
    println!(
        "latency-probe placeholder — see ticket #07 (iterations={})",
        iterations
    );
    std::process::exit(0);
}
