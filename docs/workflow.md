# Workflow: who does what

This project is built by one person working with two AI coding agents: Claude Code and Codex. This page says which agent does which step, on which model, and how work passes between steps. The goal is good reviews without burning through usage limits.

The project rules in `AGENTS.md` apply to every step and both agents. Both of them read that file.

## The flow for a feature

| Step | Who | Model | Output |
|---|---|---|---|
| 1. Brainstorm and spec | Claude | Opus | `docs/superpowers/specs/<date>-<name>-design.md`, approved by the owner and committed |
| 2. Spec review | Codex | GPT-6 Astra, Medium | `docs/reviews/<spec-name>.md` |
| 3. Resolve spec findings and plan | Claude | Opus | Spec findings resolved in the committed spec, then `docs/superpowers/plans/<date>-<name>.md` written and committed |
| 4. Implement | Claude | Sonnet | A branch, implemented inline from the plan with TDD, the full gate green, pushed, and a pull request |
| 5. Pull request review | Codex | GPT-6 Astra, Medium | `docs/reviews/pr-<N>.md` |
| 6. Fixes and hand checks | Claude, with owner for manual checks | Sonnet | Fix commits pushed to the same branch, hand-check results and gaps recorded in the pull request's Testing section |
| 7. Re-review | Codex | GPT-6 Astra, Light | Material fixes reviewed against the latest commit; repeat steps 6 and 7 until findings are resolved |
| 8. Merge | Owner | | Required checks green on the final commit, then a merge commit, never a squash |

- **Small fixes skip steps 1 to 3.** Anything that doesn't need a spec (see `AGENTS.md`, "How work flows") goes straight to implementation and pull request review.
- **The plan's review is optional.** Add a Codex review of the plan only when the plan is large or risky.
- **Resolve spec review findings before planning.** Update and commit the spec when a finding changes it. Ask the owner to approve it again only when scope or intended behavior changes; clarifications can proceed without another sign-off.
- **The owner approves the spec and merges the pull request.** Apart from changes to the approved scope or intended behavior, nothing else needs a sign-off in between.
- **Claude owns the hand-check checklist and records the results.** Claude runs checks it can perform locally; the owner runs any manual checks assigned to them. Keep unfinished checks explicit in the pull request's Testing section.
- **Checks apply to the final commit.** After fixes, rerun typecheck, lint and tests, plus build when pages or components changed. Required CI must pass on the final commit before merge.

## Codex model settings

Use the settings available in the owner's Codex app: GPT-6.1 Sol with Medium reasoning, or GPT-6 Astra with Light or Medium reasoning. Select the setting before starting the task. The main flow keeps Claude on specs, plans and feature implementation; these settings also cover tasks delegated to Codex.

| Codex task | Model | Reasoning effort |
|---|---|---|
| Brainstorming, spec writing or planning when taking over steps 1 or 3 | GPT-6 Astra | Medium |
| Spec review (step 2) | GPT-6 Astra | Medium |
| Optional plan review | GPT-6 Astra | Medium |
| Feature implementation or substantial fixes when taking over steps 4 or 6 | GPT-6.1 Sol | Medium; use Astra Medium if design decisions remain unresolved |
| Pull request review (step 5) | GPT-6 Astra | Medium |
| Focused re-review (step 7) | GPT-6 Astra | Light; Medium if fixes change the design or several code paths |
| Small, independent code fixes or UI polish | GPT-6.1 Sol | Medium |
| Straightforward documentation edits, formatting or issue triage | GPT-6.1 Sol | Medium |
| Browser hand checks with a defined checklist | GPT-6.1 Sol | Medium |
| Deep review of hosting, login, migrations or a difficult unresolved bug | GPT-6 Astra | Medium |

These are project starting points, not measured results for this repository. [OpenAI's model-selection guidance](https://developers.openai.com/api/docs/guides/model-selection) positions Sol for complex work where usage matters and Astra for demanding analysis; the task assignments above are our recommendations within the owner's available settings. Start with Sol Medium for routine work, Astra Light for focused re-reviews, and Astra Medium for design and broader reviews. Revisit the choices when available settings change or repeated misses show that a task needs a stronger setting. Merge stays with the owner.

## Why the roles are split this way

- **Codex reviews because it is a different model.** It catches what Claude's own reviewers miss. On pull request #43, Codex found a layout that broke at 1024 px and a sync answer that left the page loading forever, after two Claude reviews had passed both.
- **Opus resolves the design decisions.** Specs and plans capture decisions, constraints and acceptance tests so Sonnet can handle routine implementation. Implementation still needs judgment: adapt details when the code reveals something the plan missed, and flag any change to the spec before proceeding with it. The spec remains the authority.
- **Implementation runs inline, not as one subagent per task.** A separate implementer and reviewer per task costs a fresh context each time. With Codex reviewing the whole pull request, one implementer plus one review is enough.

## Working in parallel

Codex can take small, independent issues on branches of its own while Claude works on a feature. Good candidates are XS and S issues that touch different files, for example UI polish or deferred review findings. Each one gets its own branch and pull request. Feature work that builds on code Claude just wrote stays with Claude.

## Review files

Review notes go in `docs/reviews/`. Git ignores that folder: a review matters only until its findings are fixed, and the fix commits and pull request description are the lasting record. Name review files after what they review: `pr-43.md`, or the spec's file name.

Read a review against the current code before acting on it. Line numbers move. Record the reviewed commit SHA in pull request reviews so the next session knows what was checked.

Local sessions can read ignored review files in the same checkout. Cloud sessions and separate worktrees cannot rely on those files being present: include the relevant findings in the handoff prompt, or copy them into the pull request. Keep the fix commits and pull request description as the lasting record of how findings were resolved.

## Keeping usage down

- **One phase per session.** Clear the session between phases. The spec, the plan and the review files carry the handoff, not the chat history. A long session is expensive because the whole history is read again on every turn.
- **Commit specs and plans as soon as they are written,** so a new session reads them instead of reconstructing them.
- **Pick the cheapest model that can do the step** (see the table above). Use Opus to resolve design decisions and write the plan; use Sonnet for routine implementation.
- **Keep hand checks focused.** Claude prepares a short checklist tied to the changed behavior and assigns any owner-run checks explicitly. Record who checked what and any remaining gaps.

## Cloud sessions

Claude Code cloud sessions run on separate credits. Use them for work that needs neither `.env` nor the local database:

- **Implementing a finished plan.** A cloud session on Sonnet works on its own branch, runs typecheck, lint, tests and build, pushes, and opens the pull request. Live API checks and hand checks against a copy of `data/app.db` stay local, and the pull request says they are still open.
- **A deep review of a risky pull request,** such as hosting or login.

A cloud session starts from what is on GitHub, so push the branch first. Include any needed review findings and other non-sensitive handoff context that isn't committed in its prompt. Never include credentials, `.env` contents or private database data; checks that need them stay local.
