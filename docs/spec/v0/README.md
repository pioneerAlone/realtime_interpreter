# v0 Spec — 实时双向同传 (双通道版)

> Spec for the parent project at `/Users/wangbo/proj/realtime_interpreter`.
> Generated 2026-09-06 after round 2 of `/grill-with-docs` closed.
> Aligned with `docs/decisions/round-2-grill.md` (D1–D17).
> Spec drafts are written under git in `docs/spec/v0/` but **not yet
> committed** — pending user review.

## Reading order

1. **`00-overview.md`** — Product summary, in/out scope, 8 acceptance
   criteria (AC1–AC8), 5 PoC contradictions reconciled normatively,
   risk register R1–R7, 7 open decisions (`[REVIEW]`).
2. **`01-architecture.md`** — Top-level diagram, process/thread model,
   module layout, R3 + R4 data flow, IPC surface, macOS specifics,
   Open-Less borrowing checklist (architecture only, no code).
3. **`02-audio-pipeline.md`** — R3 + R4 audio pipelines in full detail,
   frame sizing, ring buffer, opus stream decode + custom OGG demuxer,
   audio device hot-plug, sample rate handling, 原声直出 path.
4. **`03-b-channel-subtitle.md`** — Subtitle schema, s2t event code
   reconciliation (650–655), floating subtitle window (Tauri-NSPanel),
   B-channel audio capture, 原声直出 toggle UX, speaker ID.
5. **`04-latency-budget.md`** — 10-stage waterfall locked in (2270 ms
   best / 2570 ms realistic, 430–730 ms margin), R1–R5 risk register,
   recovery actions if measured > 3000 ms, v1 ≤ 2 s path notes.
6. **`05-tech-stack-decisions.md`** — ADR-lite decision log.
7. **`06-deliverables.md`** — v0 binary, docs, tests, demo scenario,
   out-of-scope deferral list.

## How to review

- Each spec section marks items needing user confirmation as
  **`[REVIEW]`**. A consolidated priority ordering is in
  `00-overview.md` §7.1.
- For a quick scan, read `00-overview.md` §4 (PoC contradictions
  reconciled) and §7 (open decisions) first.
- The latency waterfall is the most contested section — read
  `04-latency-budget.md` §1–§2 and `latency-budget-v0.md` together.
- For architecture changes, all `[REVIEW]` items in `01-architecture.md`
  §9 + `02-audio-pipeline.md` §9 + `03-b-channel-subtitle.md` §7
  should be reviewed together (they're coupled).

## Source documents (the spec's primary citations)

- `docs/research/poc-docs-take.md` — PoC distillation (309 lines)
- `docs/research/openless-take.md` — Open-Less GUI stack take (218 lines)
- `docs/research/latency-budget-v0.md` — 10-stage waterfall (203 lines)
- `docs/decisions/round-2-grill.md` — 17 round-2 decisions (D1–D17)
- `docs/agents/issue-tracker.md` — GitHub tracker conventions
- `AGENTS.md` — workspace conventions
- `.scratch/macos-siminterpret-poc/map.md` — wayfinder destination

## Status (as of 2026-09-06)

- 5 of 7 spec drafts complete: `00-overview`, `01-architecture`,
  `02-audio-pipeline`, `03-b-channel-subtitle`, `04-latency-budget`.
- 2 drafts pending: `05-tech-stack-decisions`, `06-deliverables`
  (background agent still running).
- Once all 7 drafts land + user reviews + approves, the spec is
  handed to `/to-spec` for formal ADR extraction and ticket generation.
