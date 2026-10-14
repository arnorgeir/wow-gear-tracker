# Workflow: who does what

This project is built by one person working with two AI coding agents: Claude Code and Codex. This page says which agent does which step, on which model, and how work passes between steps. The goal is good reviews without burning through usage limits.

The project rules in `AGENTS.md` apply to every step and both agents. Both of them read that file.

## The flow for a feature

| Step | Who | Model | Board status | Output |
|---|---|---|---|---|
| 1. `spec`: brainstorm and spec | Claude | Opus | Speccing | `docs/superpowers/specs/<date>-<name>-design.md`, approved by the owner and committed |
| 2. `spec-review` | Codex | GPT-6 Astra, Medium | Speccing | `docs/reviews/<spec-name>.md` |
| 3. `plan`: resolve spec findings and plan | Claude | Opus | Speccing, then Ready | Spec findings resolved in the committed spec, then `docs/superpowers/plans/<date>-<name>.md` written and committed, and linked from each issue it covers |
| 4. `implement` | Claude | Sonnet | In progress, then In review | A branch, implemented inline from the plan with TDD, the full gate green, pushed, and a pull request; then the review loop runs steps 5 to 8 |
| 5. `pr-review` | Codex | GPT-6 Astra, Medium | In review | `docs/reviews/pr-<N>.md` |
| 6. `fix`: resolve code findings | Claude | Sonnet | In review | Fix commits pushed to the same branch, required checks rerun |
| 7. `re-review` | Codex | GPT-6 Astra, Light | In review | Material fixes reviewed against the latest commit; repeat `fix` and `re-review` until findings are resolved |
| 8. `validate`: complete checks and evidence | Claude, with owner for assigned checks | Sonnet | In review | Required checks completed or existing evidence recorded in PR Testing; no code change required |
| 9. Merge | Owner | | Done, on its own when the pull request closes the issue | Required checks green on the final commit, then a merge commit, never a squash |

- **A step sets its status when it starts,** after claiming the issues as `AGENTS.md` ("Issue board") describes. `plan` moves the issues to Ready when the plan is committed, and `implement` moves them to In review when it opens the pull request. An issue the pull request only covers in part (`Part of #N`, not `Closes #N`) goes back to the status it had: it stays open after the merge, and In review would be wrong.
- **Small fixes skip steps 1 to 3.** Anything that doesn't need a spec (see `AGENTS.md`, "How work flows") goes from Backlog or Ready straight to `implement` and `pr-review`.
- **The plan's review is optional.** Add a Codex review of the plan only when the plan is large or risky.
- **Resolve spec review findings before planning.** Update and commit the spec when a finding changes it. Ask the owner to approve it again only when scope or intended behavior changes; clarifications can proceed without another sign-off.
- **The owner approves the spec and merges the pull request.** Apart from changes to the approved scope or intended behavior, nothing else needs a sign-off in between.
- **Claude owns the hand-check checklist and records the results.** Claude runs checks it can perform locally; the owner runs any manual checks assigned to them. Keep unfinished checks explicit in the pull request's Testing section.
- **Checks apply to the final commit.** After fixes, rerun typecheck, lint and tests, plus build when pages or components changed. Required CI must pass on the final commit before merge.

## Review loop

Steps 5 to 8 run on their own. When `implement` opens the pull request, the same session continues with the `review-loop` skill (`.claude/skills/review-loop/`) instead of handing a prompt back to the owner:

- **A fresh reviewer reviews each round:** Codex through `codex exec` when the CLI is installed and logged in, otherwise a fresh Claude subagent on Opus. The pull request says which one ran.
- **Fixes run on Sonnet, as `fix` does.** A session can't switch its own model, so a loop running on Opus hands each round's fixes to a Sonnet subagent. Findings that need a design decision, or touch concurrency, migrations or security, go to an Opus subagent instead.
- **At most 3 rounds of review and fix.** The loop stops early when a review passes. Findings still open after round 3 go in the pull request for the owner.
- **The loop stops and asks** when a fix would change the spec's scope or intended behavior, when a finding contradicts the spec, or when a check needs the owner.
- **It ends with `validate`** and one report: each round's outcome, the fixes, anything open, and the owner's checks. The owner reads the pull request and merges.

The manual steps below still work: run them one at a time when a loop stopped, or when the reviewer should be a session the owner starts.

One-time setup for Codex reviews: `npm i -g @openai/codex`, then `codex login`.

## Filing issues

Claude creates and edits issues with the `file-issue` skill (`.claude/skills/file-issue/`), on Sonnet. It checks for duplicates, sets the area and cloud labels and the board's Layer, Size and Status, and keeps the body short: the problem, the owner's own details and any open questions. Design waits for `spec`; an issue with open design choices goes to Needs spec instead.

## Handing off between steps

Start a step with its name and the issue or pull request it works on:

```
Run workflow step spec for #63 and #66.
Run workflow step pr-review for PR #72.
```

The agent reads this page for what the step involves, then finds the rest on GitHub: the issue, the spec and plan linked from it, and the pull request.

Every step ends with a **Next** block, so the owner never has to look up the flow:

```
Next: spec-review, Codex (GPT-6 Astra, Medium), new session
> Run workflow step spec-review for #64. Spec: docs/superpowers/specs/2026-10-04-reorder-members-design.md
```

- **Name the step, who runs it, and the model,** and say whether it needs a new session. Between phases it always does (see "Keeping usage down").
- **Put everything the next step can't find on its own into the prompt:** the spec path before the plan links it, the branch, the worktree path when the step runs outside the main checkout, or review findings for a cloud session.
- **Say first when the owner has to act before the next step,** such as approving the spec, running hand checks or merging.
- **Choose the next step from the review outcome below.** Use `fix` for code findings and `validate` for unfinished checks or missing evidence. When both are clear, hand off to the owner to merge. Skip steps that have no work.

## Review outcomes and validation

Every `pr-review` and `re-review` report, including its final chat response, states two outcomes separately:

- **Code review:** `Changes requested` with actionable findings, or `Passed — no code changes requested`. Name the reviewed commit. A passed local review does not itself submit a GitHub approval or authorize a merge.
- **Validation:** `Complete` or `Pending`, naming the exact required checks and their evidence. An unperformed check, an undocumented result and a failed check are different states; say which applies.

| Code review | Validation | Next |
|---|---|---|
| Changes requested | Any | `fix`, then `re-review`; carry remaining checks forward |
| Passed | Pending | `validate`; explicitly say no code fix is requested |
| Passed | Complete | Owner merges after confirming required GitHub checks and approval on the final head |

Only actionable defects belong in the findings list. Missing validation evidence belongs in the validation list. Tie each required check to the spec, plan or repository gate; optional suggestions do not become merge blockers. Missing wording is not proof a check failed or never ran: ask the validation step to record existing evidence or run the check if needed.

`validate` completes the named checks and records who checked what, the tested commit, results and remaining gaps in PR Testing. Accept adequate existing evidence without repeating a check merely because the reviewer did not run it personally. A validation-only task needs no empty fix commit.

- If validation completes with no code changes and the reviewed head is unchanged, hand off directly to the owner to merge. Updating PR Testing alone does not require another code review.
- If a check exposes a defect, record the concrete failure and hand off to `fix`, followed by `re-review` on the new head. Code changes require the normal final-commit checks.
- If validation remains blocked, name the specific missing access or owner action and keep `validate` pending. Do not relabel it as a code finding.

Example of a clean review with unfinished validation:

```
Code review: Passed at <SHA> — no code changes requested.
Validation: Pending — Method-outage browser check not run.

Next: validate, Claude (Sonnet), new session
> Run workflow step validate for PR #N. Complete the Method-outage browser check and record the result in PR Testing. No code fix is requested; if it passes without code changes, hand off to the owner to merge.
```

## Using one agent

The "Who" column is the owner's setup, not a requirement. A contributor with only Claude Code or only Codex runs every step with it, and picks that tool's closest model tier from the table. Keep the reviews independent: run `spec-review`, `pr-review` and `re-review` in a fresh session that didn't write what it reviews, and on a different model when one is available.

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

To spec several features at once, give each its own worktree, as the next section describes.

## When using worktrees to spec multiple issues at once

Specs for independent issues can run side by side while implementation continues elsewhere. Each one gets its own git worktree: a second checkout of the repository with its own branch, files and `.next` folder. Work in one worktree never touches another's files, and the main checkout stays free for the owner's `npm run dev`.

### Lifecycle

1. **One worktree per independent feature,** or per group of related issues that share one spec. Not one long-lived worktree per app section: a worktree that outlives its feature only carries stale context into the next one.
2. **Claim first, then branch from fresh `origin/main`.** Claim the issues as `AGENTS.md` ("Issue board") describes, then create the worktree. The branch follows the usual naming rules; name the folder after the work.

   ```sh
   git fetch origin
   git worktree add -b feat/reorder-members ../wgt-reorder-members origin/main
   ```

3. **Keep the worktree and branch from spec to merge.** `spec`, `spec-review`, `plan`, `implement` and the review loop all run in the same folder on the same branch. Each phase still starts a fresh session (see "Keeping usage down"), and reviews stay independent: the reviewing session didn't write what it reviews.
4. **Every Next block names the worktree:** its path, the branch, the issue numbers, and the spec and plan paths once they exist. A fresh session can't guess which checkout to work in.
5. **A worktree claims nothing.** Issue ownership and board status follow "Issue board" unchanged, and two worktrees never work on the same issue. Issues whose specs would change the same files or decide the same question go in one worktree, or wait for each other.
6. **Review files stay in their checkout.** Git ignores `docs/reviews/` (see "Review files"), so a review written in one worktree doesn't exist in another or in a cloud session. Write the review in the worktree that owns the branch. When a step runs anywhere else, put the findings in the Next prompt or copy the file across.
7. **Rebase and recheck before `implement`.** A spec can wait days for approval while `main` moves. Before implementing, run `git fetch origin` and `git rebase origin/main`, then reread the spec and plan against what merged since: schema, `src/core` modules, shared components and anything else the plan touches. Update the spec when something changed; a change to scope or intended behavior goes back to the owner, as in "The flow for a feature".
8. **Concurrent specs settle shared decisions once.** When two specs touch the same schema table, architecture rule or UI pattern, the first one to reach `plan` decides and the other references that decision instead of inventing its own. Say so in both specs.
9. **Spec work needs no running app.** `spec`, `spec-review` and `plan` read code and docs, so the worktree needs no `npm install`, dev server or database. Setup starts at `implement`:
   - Run `npm install` in the worktree before the gate.
   - Building in a worktree is safe: it has its own `.next`. To run `npm run dev` there while the main checkout serves port 3000, pick another port: `npm run dev -- -p 3001`.
   - `.env` and `data/` are ignored, so a new worktree has neither. Live tests and hand checks need `.env` copied in, and a copy of `data/app.db`. Never point the worktree at the main checkout's database: the branch's migrations would run against it.
10. **Clean up when the pull request merges or closes.** From the main checkout:

    ```sh
    git fetch origin
    git worktree remove ../wgt-reorder-members
    git branch -d feat/reorder-members
    git worktree prune
    ```

    `git branch -d` refuses a branch it can't see merged. Check that the pull request merged on GitHub before forcing it with `-D`. `git worktree list` shows what is left.

### Example

Two independent specs run while a feature is in its review loop:

```
C:\workspace\wow-gear-tracker     main checkout, owner's npm run dev on :3000
C:\workspace\wgt-tier-stats       feat/tier-stats        implement and review loop, #120
C:\workspace\wgt-reorder-members  feat/reorder-members   spec, #64 and #66
C:\workspace\wgt-crest-cap        feat/crest-cap         spec-review, #88
```

Nobody builds or switches branches in the main checkout. When the reorder spec is approved and committed, its Next block names the worktree:

```
Next: spec-review, Codex (GPT-6 Astra, Medium), new session in C:\workspace\wgt-reorder-members
> Run workflow step spec-review for #64 and #66. Worktree: C:\workspace\wgt-reorder-members, branch feat/reorder-members. Spec: docs/superpowers/specs/2026-10-04-reorder-members-design.md
```

And when its plan is committed, the handoff to `implement` carries the rebase:

```
Next: implement, Claude (Sonnet), new session in C:\workspace\wgt-reorder-members
> Run workflow step implement for #64 and #66. Worktree: C:\workspace\wgt-reorder-members, branch feat/reorder-members. Rebase onto origin/main first and recheck the plan against what merged since. Plan: docs/superpowers/plans/2026-10-05-reorder-members.md
```

## Review files

Review notes go in `docs/reviews/`. Git ignores that folder: a review matters only until its findings are fixed, and the fix commits and pull request description are the lasting record. Name review files after what they review: `pr-43.md`, or the spec's file name.

Read a review against the current code before acting on it. Line numbers move. Record the reviewed commit SHA in pull request reviews so the next session knows what was checked.

Local sessions can read ignored review files in the same checkout. Cloud sessions and separate worktrees cannot rely on those files being present: include the relevant findings in the handoff prompt, or copy them into the pull request. Keep the fix commits and pull request description as the lasting record of how findings were resolved.

## Keeping usage down

- **One phase per session.** Clear the session between phases. The spec, the plan and the review files carry the handoff, not the chat history. A long session is expensive because the whole history is read again on every turn.
- **Commit specs and plans as soon as they are written,** so a new session reads them instead of reconstructing them.
- **Pick the cheapest model that can do the step** (see the table above). Use Opus to resolve design decisions and write the plan; use Sonnet for routine implementation.
- **Keep hand checks focused.** Claude prepares a short checklist tied to the changed behavior and assigns any owner-run checks explicitly. Record who checked what and any remaining gaps.

## Caveman usage by step

The Caveman skills keep chat, handoffs and simple findings short. Load only the skills the current step needs. Repository rules, clarity and complete evidence come first: a skill shapes how a step runs, and never removes what this page or `AGENTS.md` requires.

| Step | Caveman use | Still required |
|---|---|---|
| `spec` and `plan` | Concise discussion and handoffs; no skill for the documents themselves | Full rationale, alternatives, acceptance criteria and edge cases in the spec and plan |
| `implement` | `caveman:lean-build` to keep scope tight | The approved plan, the architecture rules, and a failing test first |
| `fix` | `caveman:investigate-first` when the cause is unclear; `caveman:surgical-patch` for the repair | Evidence of the cause, and a test that covers the regression |
| `spec-review`, `pr-review` and `re-review` | `caveman:caveman-review` to word simple findings | Severity, location, trigger, impact and enough evidence to justify each finding; complex findings get a full explanation |
| `validate` and the gate before any handoff | `caveman:verify-and-stop` | Every required automated and manual check; a focused test run never replaces the full gate |
| Commits and pull requests | The repo's `commit` skill, which wraps `caveman:caveman-commit`; pull requests follow the terse rules in `AGENTS.md` | Required sections, exact identifiers, negations, testing gaps, and no AI attribution |
| Filing issues and merging | None | The `file-issue` skill and the merge rules, as written |

- **Specs and plans stay readable.** Never run `caveman:caveman-compress` on a spec, plan or other authoritative document.
- **Implementation stays inline.** `caveman:cavecrew` is only for delegation the owner authorized separately, and never replaces an independent review.
- **Verification stops only when every required check and acceptance condition is met.** Name any check that couldn't run or isn't finished.
- **Existing commit and pull request rules win.** A skill's default never overrides a required format or required evidence.
- **This covers the skills only.** It doesn't configure the Caveman proxy, enable its cloud measurement, or claim measured savings. Those get evaluated separately.
- **Trial it over a few issues** and judge it by how clear the handoffs were and how much review rework followed, before using it more widely.

## Cloud sessions

Claude Code cloud sessions run on separate credits. Use them for work that needs neither `.env` nor the local database:

- **Implementing a finished plan.** A cloud session on Sonnet works on its own branch, runs typecheck, lint, tests and build, pushes, and opens the pull request. Live API checks and hand checks against a copy of `data/app.db` stay local, and the pull request says they are still open.
- **A deep review of a risky pull request,** such as hosting or login.

Issues carry `cloud: spec` when their spec needs nothing local, and `cloud: implement` when their code and tests don't either. `gh issue list --label "cloud: spec"` finds candidates.

Start one from claude.ai/code or the Claude app with the same prompt a local step would get, such as `Run workflow step implement for #64.` It doesn't need the owner's PC to be on. A cloud session starts from what is on GitHub, so push the branch first. Include any needed review findings and other non-sensitive handoff context that isn't committed in its prompt. Never include credentials, `.env` contents or private database data; checks that need them stay local.
