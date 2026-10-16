Closes #N.
<!-- No issue: one sentence framing the change instead. `Part of #N` when the issue stays open. -->

## What changes

- **Lead-in:** what moved and why, in a line or two (#N).

## Screenshots

<!--
Required when a page looks or behaves differently. Delete the section when nothing visible changed.
Before and after for changed UI, after only for new UI. Crop to the part that changed.
Captured from the e2e harness with made-up characters only, never from data/app.db.
How: docs/workflow.md ("Screenshots in pull requests").
-->

| Before | After |
|---|---|
| ![before](url) | ![after](url) |

## Data

<!-- Schema changes, migrations and cache version bumps. Delete the section when none moved. -->

## How to test

<!--
For the owner, ready to follow without reading the diff. Exact commands and URLs, no placeholders left.
-->

**Setup**

```sh
cd C:\workspace\wgt-<name>
npm run dev -- -p 3001
```

**Steps**

1. Open http://localhost:3001/<page>. Do <action>. Expect <result>.
2. …

**Edge cases worth a look:** <empty states, long names, narrow screens, errors>.

**Already covered by tests, skip:** <what automated tests prove>.

## Testing

- **Tests:** N passing (`npm test`), e2e N passing.
- **Gate:** typecheck, lint and build clean.
- **Checked by hand:** what, on which commit.
- **Not covered:** what nobody has checked yet, and why.

Spec: docs/superpowers/specs/<file>
