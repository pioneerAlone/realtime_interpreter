# Issue tracker: GitHub

> **Setup-time status (2026-09-06):** This repo is configured for **GitHub Issues** as the long-term home for issues, specs, and wayfinder tickets. The chosen template is `issue-tracker-github.md` from the `setup-matt-pocock-skills` skill.
>
> However, the run that wrote this file detected **three blocking conditions** that prevent `gh` from talking to GitHub today. They are recorded here so the next operator (human or agent) can finish the bring-up; **the configuration itself is correct — only the runtime environment is not yet ready**.
>
> **Blockers observed at setup time**
> 1. `git rev-parse --show-toplevel` → `fatal: not a git repository`. This repo has no `.git/`. GitHub Issues are addressed by `owner/repo`; without a git remote, `gh` cannot infer the target.
> 2. `gh auth status` → `The token in default is invalid. (HTTP 401)`. The `pioneerAlone` account on `github.com` is logged in but the stored token is rejected. Until `gh auth login -h github.com` succeeds, every `gh issue …` call will 401.
> 3. `curl https://github.com/…` and `gh auth login` both time out on TCP. `github.com` is not reachable from this machine right now (DNS / firewall / proxy issue). Even with a valid token, calls cannot reach the API.
>
> **To finish the bring-up**, all three must be resolved in order:
> - `git init && git remote add origin git@github.com:<owner>/realtime_interpreter.git` (replace `<owner>` with the intended GitHub owner, then push once so the repo exists on the server).
> - `gh auth login -h github.com` (or paste a fresh token into `gh auth login --with-token`).
> - Restore network egress to `github.com:443` (check proxy / VPN / DNS).
>
> Until then, skills like `/triage`, `/to-tickets`, `/to-spec`, and `/wayfinder` should be considered **degraded** for this repo — the convention is right, the wire is down.

---

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
