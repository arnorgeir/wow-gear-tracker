# Nightly repo scan

You are scanning a fresh checkout of `arnorgeir/wow-gear-tracker` at `origin/main`. Read `AGENTS.md` and `docs/workflow.md` first: they are the project rules. Then look for problems worth an issue and file the best of them on the **Gear Tracker** board. Nobody is watching this run.

## Hard limits

- **Read-only on code.** Never edit tracked files, commit, push, or open a pull request. The only things you create are issue body files in the system temp folder and GitHub issues.
- **At most 5 issues per run.** Rank candidates by value to the project and file the top ones. Fewer is fine; zero is fine when nothing clears the bar.
- **No guesses as findings.** Every issue cites real `file:line` locations you read. If you can't point at the code, drop it.
- **Never write real player character names** in an issue.

## What to look for

Name each finding with one category:

| Category | Means | Label |
|---|---|---|
| bug | Code that does the wrong thing for some real input or state | `bug` |
| pattern | Drift from a rule in `AGENTS.md`, or one job done three different ways | `tech-debt` |
| architecture | A module doing two jobs, a layer boundary crossed, a seam that will hurt | `tech-debt` |
| improvement | Missing tests on branching logic, error handling gaps, slow paths, UX rough edges | `enhancement` |
| feature idea | Something users would plausibly want, grounded in what the app already does | `idea` |

Prefer bugs and real rule breaks over style. Skip formatting nits, lint-level issues CI already catches, and anything a TODO comment already tracks.

## Dedupe

Before filing anything, list existing issues:

```sh
gh issue list --state open --limit 300 --json number,title,labels
gh issue list --state closed --label nightly-scan --limit 200 --json number,title,stateReason
```

Drop a candidate when an open issue covers it, or when an earlier `nightly-scan` issue for the same thing was closed (closed means the owner already decided). When an open issue is related but different, link it as `Related: #N`.

## Filing

Follow `.claude/skills/file-issue/SKILL.md` for titles, body shape, area labels, cloud labels, and the Layer and Size fields, with these overrides:

- Labels: `nightly-scan`, the category label from the table above, one or more `area:` labels, and cloud labels per the skill.
- Body starts with `Category: <category>` on its own line, then the skill's body shape. Put the cited `file:line` locations in the body.
- Board Status is always **Backlog**. The owner triages.
- Don't assign anyone.

Write each body to a file in the system temp folder (`$TEMP` or `/tmp`). Run each command on its own, with no `$(...)` or pipes: the run only allows plain `gh issue`, `gh project` and `gh label` commands. `gh issue create` prints the new issue's URL; use it in the next commands.

```sh
gh issue create --title "<title>" --body-file <file> --label nightly-scan --label <category label> --label "area: <area>"
gh project item-add 1 --owner arnorgeir --url <url>
gh project item-edit 1 --owner arnorgeir --url <url> --field Status --value Backlog
gh project item-edit 1 --owner arnorgeir --url <url> --field Layer --value <Layer>
gh project item-edit 1 --owner arnorgeir --url <url> --field Size --value <Size>
```

If a `gh project` command fails, keep the issue and note the failure in the report.

## Dry run

If the first line of this prompt says `DRY RUN`, do everything except create or edit anything on GitHub. Print each issue you would file in full: title, labels, Layer, Size, and body.

## Report

End with one line per issue: `#N title | category | area | Layer | Size`, or `DRY title | ...` in a dry run. Then one line listing candidates you dropped as duplicates, with the issue they matched.
