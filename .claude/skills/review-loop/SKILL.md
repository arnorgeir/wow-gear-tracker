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
- **Fixes run on the model `docs/workflow.md` gives `fix`: Sonnet.** A session can't change its own model. When this session is Sonnet, fix inline. Otherwise hand the round's fixes to one Agent subagent, `general-purpose` with `model: sonnet`: give it the branch, the head SHA, the review file's findings and these fix rules, and wait for its report. Use `model: opus` instead when a finding needs a design decision the spec and plan don't settle, or touches concurrency, migrations or security. Then check the pushed commits yourself before the next review.
- **A finding you reject** gets a line in the pull request saying why. It doesn't count as fixed.

## Steps

1. **Claim.** Read the pull request and its issues. Follow "Starting a step claims its issues" in `AGENTS.md`. Status stays In review.
2. **Review.** Write the review prompt below to the scratchpad, filling in the pull request number, head SHA, round, spec and plan. Then run one reviewer:
   - Codex: `codex exec -m gpt-6-astra -s workspace-write -c model_reasoning_effort="medium" -o <scratchpad>/codex-last.txt - < <prompt file>` from the repository root, in the background with a 30-minute timeout. Rounds 2 and 3 use `"low"` unless the fixes changed the design or several code paths. If `codex` is missing, isn't logged in (`codex login status`) or fails, use the Claude reviewer for that round and say so.
   - Claude: the Agent tool, `general-purpose`, `model: opus`, with the same prompt. Wait for its completion notice.
3. **Read the result** from `docs/reviews/pr-<N>.md`. Check each finding against the current code before acting on it.
4. **Act on the outcome:**
   - Changes requested, round under 3: fix, push, and go back to step 2 for the new head.
   - Changes requested in round 3: fix what is clear, then stop reviewing. List what remains in the pull request.
   - Passed: go to step 5.
5. **Validate.** Run the open checks you can run, as the `validate` step describes. Record results, the tested commit and remaining gaps in the pull request's Testing section, in the format `AGENTS.md` sets. Then bring the rest of the description up to date with the final head, section by section from `.github/pull_request_template.md`: How to test with setup commands that work for this branch's worktree, and Screenshots retaken when a fix changed what they show.
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
