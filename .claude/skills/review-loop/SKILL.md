---
name: review-loop
description: Use after implement opens a pull request, or when the owner asks to review, fix and validate a pull request without handing prompts back and forth. Runs pr-review, fix, re-review and validate on its own, at most 3 review rounds.
---

# Review loop

Runs steps 5 to 8 of `docs/workflow.md` without the owner relaying prompts. The owner reads the pull request at the end.

## Rules

- **At most 3 review rounds.** A round is one review plus the fixes it asks for. Stop early when a review passes.
- **Reviews stay independent.** The reviewer is a fresh session that didn't write the code: Codex when the `codex` command works, otherwise a fresh Claude subagent on Opus. Say in the pull request which reviewer ran each round.
- **Stop and ask the owner** when a fix would change the spec's scope or intended behavior, when a finding contradicts the spec, or when a check needs the owner. Never resolve those alone.
- **Fixes follow the `fix` step:** failing test first, one commit per finding with a body that says why, the full gate green (typecheck, lint, test, and the worktree build when pages or components changed), then push.
- **A finding you reject** gets a line in the pull request saying why. It doesn't count as fixed.

## Steps

1. **Claim.** Read the pull request and its issues. Follow "Starting a step claims its issues" in `AGENTS.md`. Status stays In review.
2. **Review.** Write the review prompt below to the scratchpad, filling in the pull request number, head SHA, round, spec and plan. Then run one reviewer:
   - Codex: `codex exec --sandbox workspace-write -c model_reasoning_effort="medium" - < <prompt file>` from the repository root, with a 30-minute timeout. Rounds 2 and 3 may use `"low"`. If `codex` is missing, can't log in or fails, use the Claude reviewer for that round and say so.
   - Claude: the Agent tool, `general-purpose`, `model: opus`, with the same prompt. Wait for its completion notice.
3. **Read the result** from `docs/reviews/pr-<N>.md`. Check each finding against the current code before acting on it.
4. **Act on the outcome:**
   - Changes requested, round under 3: fix, push, and go back to step 2 for the new head.
   - Changes requested in round 3: fix what is clear, then stop reviewing. List what remains in the pull request.
   - Passed: go to step 5.
5. **Validate.** Run the open checks you can run, as the `validate` step describes. Record results, the tested commit and remaining gaps in the pull request's Testing section, in the format `AGENTS.md` sets.
6. **Report** to the owner in one message: the pull request link, each round's reviewer and outcome, what each fix changed, findings left open or rejected, and checks only the owner can run. End with the Next block: merge by the owner, or the step that is blocked.

## Review prompt

```
Run workflow step pr-review for PR #<N> (round <R> of 3) at commit <SHA>.
Spec: <spec path>. Plan: <plan path>.
Follow docs/workflow.md ("Review outcomes and validation") and AGENTS.md.
Review only; change no code or git state. Write docs/reviews/pr-<N>.md, replacing any earlier round's file.
Open the file with these two lines, then the findings:
Code review: Changes requested | Passed — at <SHA>
Validation: Complete | Pending — <checks>
Give each finding an ID (R<round>.<n>), a severity (P1 to P3), a file and line, and a reproduction or a concrete failure scenario.
<round 2 and 3: the earlier findings and the fix commit for each, so the review checks them first>
```
