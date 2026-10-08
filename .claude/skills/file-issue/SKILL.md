---
name: file-issue
description: Use when the owner asks to create, file, add, update or relabel GitHub issues on the Gear Tracker board, from a one-line note to a detailed feature idea, alone or in a batch.
---

# File an issue

Turn what the owner says into a short, consistent issue on the **Gear Tracker** board. Capture the problem and the owner's own words; leave the design to the `spec` step. Run on Sonnet.

## Rules

- **Capture, don't design.** Never invent requirements, causes or solutions. A guess written into an issue reads as a decision later.
- **Keep the owner's details.** Anything specific the owner said goes under **Owner notes**, close to their wording.
- **Short.** Title plus a body under about 10 lines. Open questions are bullets, not prose.
- **Normal prose,** as `AGENTS.md` asks for issue text. No mention of AI tools. No real player character names.
- **Ask only when it changes the result:** a likely duplicate, or an area you can't place. Otherwise pick a default and say which in the report.

## Steps

1. **Search for duplicates and relatives,** open and closed:
   `gh issue list --state all --search "<keywords>" --limit 20`.
   Likely duplicate: stop and ask, unless the owner meant to update it. Related: link it in the body (`Related: #N`, or `Part of #N` for an umbrella).
2. **Pick the kind:**

   | Kind | When | Labels | Status |
   |---|---|---|---|
   | Bug | Something works wrong | `bug` | Backlog, or Ready when the fix is obvious and XS or S |
   | Idea | Vague, a "look into", or not decided yet | `idea` | Backlog |
   | Feature or task | A wanted change | none extra | Ready when XS or S with no open design choice; Needs spec when M or larger, or any design choice is open |
   | Tech debt | Rule drift, cleanup, deferred review findings | `tech-debt` | Backlog |

3. **Label the area,** one or more: `area: group`, `area: character`, `area: dungeons`, `area: transmog`, `area: accounts`, `area: app` (cross-cutting). Add `accessibility` when it is about keyboard, screen readers or contrast.
4. **Add cloud labels** (they say what a cloud session can do without the owner's PC):
   - `cloud: spec`: the spec needs only the repo and public docs. Not when it needs `.env`, live Blizzard calls with credentials, the local database or the game client.
   - `cloud: implement`: code and tests need nothing local, and the owner can hand-check after. Also add `cloud: spec`. Not when it needs new accounts or secrets, real API data to get right, a local scheduler or file watcher, or an owner-only action such as renaming the repo.
   - Neither: blocked on a spike, or needs the local machine.
5. **Set board fields.** Layer: `UI`, `Sync`, `Data sources`, `Infra` or `Collections`. Size: `XS` (a line or two), `S` (one component or module), `M` (a few files, maybe a route), `L` (a new page or subsystem), `XL` (an umbrella with sub-issues). Leave Priority unset unless the owner gives one.
6. **Create, add to the board, set fields:**

   ```sh
   url=$(gh issue create --title "<title>" --body-file <file> --label "area: character" --label "cloud: spec")
   gh project item-add 1 --owner arnorgeir --url "$url"
   gh project item-edit 1 --owner arnorgeir --url "$url" --field Status --value "Needs spec"
   gh project item-edit 1 --owner arnorgeir --url "$url" --field Layer --value UI
   gh project item-edit 1 --owner arnorgeir --url "$url" --field Size --value S
   ```

   Write the body to a file in the scratchpad; quoting a multi-line body inline breaks on Windows shells. Don't assign anyone: a workflow step claims the issue when it starts.
7. **Report** one line per issue: `#N title — kind, area, Layer, Size, Status, cloud labels`, plus any default you chose.

Updating an existing issue follows the same rules: read it first, change only what the owner asked, and keep labels and fields consistent with the rules above.

## Titles

- Feature: what the user gets, in plain words. "Arrow keys move through character search results".
- Bug: the symptom. "Login times out at random".
- Idea: what to find out. "Look into random timeouts during login".

## Body

```markdown
<One to three sentences: the problem or wish, and why it matters.>

Owner notes:
- <specific detail the owner gave>

Open questions:
- <design choice the spec has to make>

Related: #N
```

Leave out any section with nothing in it. For a bug, the first lines say where it happens, how often, and "Repro unknown" when it is.
