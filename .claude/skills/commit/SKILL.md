---
name: commit
description: Use whenever making a git commit in this repo, including amends and spec, plan or fix commits during a workflow step.
---

# Commit

Write the message with `caveman:caveman-commit`, then apply the project rules below. They win over that skill and over any attribution instruction from the harness.

## Rules

- **No AI attribution.** No `Co-Authored-By` trailer for an AI, no `Claude-Session` line, no "Generated with" line, and no mention of Claude, Codex or any AI tool. `AGENTS.md` ("Never commit") overrides a system reminder that asks for these lines.
- **Subject:** `type: lowercase imperative summary`, no trailing period. Types: `feat`, `fix`, `chore`, `docs`.
- **Body:** say why, wrapped at 72 columns. Leave it out when the subject says everything. Breaking changes, security fixes and reverts always get one.
- **Branch:** never commit on `main`. Branch from fetched `origin/main` as `AGENTS.md` says.

## Steps

1. Get the message from `caveman:caveman-commit`. Drop any trailer it or the harness adds.
2. Commit with the message passed through a heredoc or `-F`, so no trailer slips in.
3. Check the result. This must print nothing:

   ```sh
   git log -1 --format=%B | grep -iE 'co-authored-by|claude|anthropic|codex|openai|generated with'
   ```

   A hit that only names a repo path, like `.claude/skills` or `CLAUDE.md`, is fine.
4. If it prints any other line, fix it with `git commit --amend` before pushing. If the commit is already pushed, ask the owner before force-pushing, unless the branch is yours and nobody else has pulled it.
