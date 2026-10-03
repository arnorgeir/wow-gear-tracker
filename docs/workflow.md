# Workflow: who does what

This project is built by one person working with two AI coding agents: Claude Code and Codex. This page says which agent does which step, on which model, and how work passes between steps. The goal is good reviews without burning through usage limits.

The project rules in `AGENTS.md` apply to every step and both agents. Both of them read that file.

## The flow for a feature

| Step | Who | Model | Output |
|---|---|---|---|
| 1. Brainstorm and spec | Claude | Opus | `docs/superpowers/specs/<date>-<name>-design.md`, approved by the owner and committed |
| 2. Spec review | Codex | default | `docs/reviews/<spec-name>.md` |
| 3. Plan | Claude | Opus | `docs/superpowers/plans/<date>-<name>.md`, written after reading the spec review, then committed |
| 4. Implement | Claude | Sonnet | A branch, implemented inline from the plan with TDD, the full gate green, pushed, and a pull request |
| 5. Pull request review | Codex | default | `docs/reviews/pr-<N>.md` |
| 6. Fixes and hand checks | Claude | Sonnet | Fix commits pushed to the same branch, and the pull request's Testing section updated |
| 7. Merge | Owner | | A merge commit, never a squash |

- **Small fixes skip steps 1 to 3.** Anything that doesn't need a spec (see `AGENTS.md`, "How work flows") goes straight to implementation and pull request review.
- **The plan's review is optional.** Add a Codex review of the plan only when the plan is large or risky.
- **The owner approves the spec and merges the pull request.** Nothing else needs a sign-off in between.

## Why the roles are split this way

- **Codex reviews because it is a different model.** It catches what Claude's own reviewers miss. On pull request #43, Codex found a layout that broke at 1024 px and a sync answer that left the page loading forever, after two Claude reviews had passed both.
- **Opus does the thinking steps only.** Brainstorming, specs and plans need judgment. A plan that contains the code to write turns implementation into transcription and testing, which Sonnet handles well at a fraction of the cost.
- **Implementation runs inline, not as one subagent per task.** A separate implementer and reviewer per task costs a fresh context each time. With Codex reviewing the whole pull request, one implementer plus one review is enough.

## Working in parallel

Codex can take small, independent issues on branches of its own while Claude works on a feature. Good candidates are XS and S issues that touch different files, for example UI polish or deferred review findings. Each one gets its own branch and pull request. Feature work that builds on code Claude just wrote stays with Claude.

## Review files

Review notes go in `docs/reviews/`. Git ignores that folder: a review matters only until its findings are fixed, and the fix commits and pull request description are the lasting record. Name review files after what they review: `pr-43.md`, or the spec's file name.

Read a review against the current code before acting on it. Line numbers move.

## Keeping usage down

- **One phase per session.** Clear the session between phases. The spec, the plan and the review files carry the handoff, not the chat history. A long session is expensive because the whole history is read again on every turn.
- **Commit specs and plans as soon as they are written,** so a new session reads them instead of reconstructing them.
- **Pick the cheapest model that can do the step** (see the table above). Opus is for judgment, not for typing out a plan.
- **Keep hand checks short.** Long browser automation sessions use many turns. A checklist the owner runs by hand is often cheaper.

## Cloud sessions

Claude Code cloud sessions run on separate credits. Use them for work that needs neither `.env` nor the local database:

- **Implementing a finished plan.** A cloud session on Sonnet works on its own branch, runs typecheck, lint, tests and build, pushes, and opens the pull request. Live API checks and hand checks against a copy of `data/app.db` stay local, and the pull request says they are still open.
- **A deep review of a risky pull request,** such as hosting or login.

A cloud session starts from what is on GitHub, so push the branch first, and put anything it needs that isn't committed into its prompt.
