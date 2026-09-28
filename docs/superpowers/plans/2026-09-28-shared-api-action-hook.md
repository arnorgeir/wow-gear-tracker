# Shared API Action Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the call-a-route-then-refresh cycle that five client components each hand-roll with one pure function and one thin hook.

**Architecture:** All branching — parsing the response, reading a route's `{ error }` message, handling an unreachable server — lives in a pure `runApiAction()` in `src/components/shared/api-action.ts`, which takes `fetch` as a parameter and is tested with the repo's existing `fake-fetch`. `useApiAction()` in `src/components/hooks/use-api-action.ts` is a thin wrapper adding `busy` and `error` state and the `router.refresh()` or `router.push()` that follows. Components keep their own copy and their own message formatting.

**Tech Stack:** TypeScript, React 19 client components, Next.js 16 App Router, Vitest 5 in a Node environment.

**Spec:** `docs/superpowers/specs/2026-09-28-component-and-module-split-design.md` (PR 1)

## Global Constraints

- Node 24 or later. No new dependencies of any kind: the spec's non-goals forbid adding a test framework, jsdom or testing-library.
- Tests are `src/**/*.test.ts` — `.ts`, never `.tsx` — and run in `environment: 'node'`. A test that needs a DOM cannot exist in this repo, so no test may render a component that uses hooks.
- Fake `fetch` comes from `src/test/fake-fetch.ts` via `fakeFetch`, `json` and `on`. Never mock modules.
- User-facing copy uses the typographic apostrophe `’`, matching the existing strings: `Couldn’t reach the app server.`
- Commit subjects are Conventional Commits, lowercase and imperative. No AI attribution in any commit message.
- Before calling the work done: `npm run typecheck && npm run lint && npm test`, plus `npm run build` because components change.
- No behavior changes except the three named in Task 6, which are written into the pull request description.
- **`src/components/StaleSync.tsx` is not touched by any task.** It fires parallel requests from a mount effect rather than from a user action, and the hook tracks one in-flight call, so routing it through `useApiAction` would distort both. Leaving it alone is decision 3 of the spec, not an oversight — do not "finish the job" by converting it.

## Review Focus

- **A route that replies with no JSON body** (a 204, or an HTML error page from a crash) must yield a result rather than throwing. Test in Task 1.
- **A response whose `{ error }` is not a string** (null, a number, a nested object) must fall back to the caller's message instead of rendering `[object Object]`. Test in Task 1.
- **An unreachable server** (`fetch` rejects, laptop offline) must clear `busy` and produce a readable message, never an unhandled rejection. Test in Task 1; `RemoveCharacterButton` has this bug today.
- **A second click while a request is in flight** must stay impossible: every button's `disabled` must still be driven by `busy`. No DOM test can assert this, so it is a hand check in Task 6.
- **A failed sync must still refresh the route,** because the server records the failure on the character row and only a refresh surfaces it. Preserved by `refresh-always` in Task 3 and hand-checked in Task 6.

---

### Task 1: The pure `runApiAction`

**Files:**
- Create: `src/components/shared/api-action.ts`
- Test: `src/components/shared/api-action.test.ts`

**Interfaces:**
- Consumes: `fakeFetch`, `json`, `on` from `src/test/fake-fetch.ts`.
- Produces: `runApiAction<T>(fetchFn: typeof fetch, url: string, init?: RequestInit, fallbackError?: string): Promise<ApiActionResult<T>>` and `interface ApiActionResult<T> { ok: boolean; data: T | null; error: string | null }`. Task 2 calls it.

- [ ] **Step 1: Write the failing test**

Create `src/components/shared/api-action.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import { runApiAction } from './api-action';

describe('runApiAction', () => {
  it('returns the parsed body when the route succeeds', async () => {
    const { fn, calls } = fakeFetch([on('/api/characters/1', () => json({ id: 1, changed: true }))]);
    const result = await runApiAction<{ id: number; changed: boolean }>(fn, '/api/characters/1', { method: 'POST' });
    expect(result).toEqual({ ok: true, data: { id: 1, changed: true }, error: null });
    expect(calls[0].init?.method).toBe('POST');
  });

  it('returns the message the route put in its error body', async () => {
    const { fn } = fakeFetch([on('/api/characters', () => json({ error: 'That character is already tracked.' }, 400))]);
    const result = await runApiAction(fn, '/api/characters');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('That character is already tracked.');
    expect(result.data).toBeNull();
  });

  it('falls back to the given message when the error body has no usable message', async () => {
    const { fn } = fakeFetch([on('/api/x', () => json({ error: { code: 12 } }, 500))]);
    const result = await runApiAction(fn, '/api/x', undefined, 'Couldn’t do that.');
    expect(result.error).toBe('Couldn’t do that.');
  });

  it('reports an unreachable server instead of rejecting', async () => {
    const fn = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    const result = await runApiAction(fn, '/api/x');
    expect(result).toEqual({ ok: false, data: null, error: 'Couldn’t reach the app server.' });
  });

  it('succeeds with null data when the route sends no JSON', async () => {
    const { fn } = fakeFetch([on('/api/x', () => new Response(null, { status: 204 }))]);
    const result = await runApiAction(fn, '/api/x');
    expect(result).toEqual({ ok: true, data: null, error: null });
  });

  it('uses the fallback when a failed response has no body at all', async () => {
    const { fn } = fakeFetch([on('/api/x', () => new Response(null, { status: 503 }))]);
    const result = await runApiAction(fn, '/api/x', undefined, 'Service is asleep.');
    expect(result.error).toBe('Service is asleep.');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/components/shared/api-action.test.ts`
Expected: FAIL — `Failed to resolve import "./api-action"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/shared/api-action.ts`:

```ts
/** The outcome of a call to one of this app's route handlers. */
export interface ApiActionResult<T> {
  ok: boolean;
  data: T | null;
  /** A message safe to show: the route's own `{ error }` text, or the caller's fallback. Null when the call succeeded. */
  error: string | null;
}

const UNREACHABLE = 'Couldn’t reach the app server.';
const DEFAULT_FALLBACK = 'Something went wrong. Check the server log.';

const messageFrom = (body: unknown, fallback: string): string => {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === 'string' && error.trim() !== '' ? error : fallback;
};

/**
 * Calls a route handler and reads its reply. Route handlers answer a failure with `{ error }`
 * holding a message that is safe to show, so a failed call reports that text rather than a status
 * code. Takes `fetch` as a parameter so tests can pass a fake one.
 */
export async function runApiAction<T>(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
  fallbackError: string = DEFAULT_FALLBACK,
): Promise<ApiActionResult<T>> {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch {
    return { ok: false, data: null, error: UNREACHABLE };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, data: null, error: messageFrom(body, fallbackError) };
  return { ok: true, data: body as T | null, error: null };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/shared/api-action.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/api-action.ts src/components/shared/api-action.test.ts
git commit -m "feat: add a shared runApiAction for route handler calls"
```

---

### Task 2: The `useApiAction` hook, with its first consumer

A hook with no caller cannot be reviewed, so it lands with the simplest of the five, `RefreshButton`.

**Files:**
- Create: `src/components/hooks/use-api-action.ts`
- Modify: `src/components/RefreshButton.tsx` (whole file, 21 lines)

**Interfaces:**
- Consumes: `runApiAction`, `ApiActionResult` from Task 1.
- Produces: `useApiAction()` returning `{ busy: boolean; error: string | null; run: <T>(url: string, init?: RequestInit, options?: RunOptions) => Promise<ApiActionResult<T>> }`, and `interface RunOptions { fallbackError?: string; after?: 'refresh' | 'refresh-always' | 'none' | { push: string } }`. Tasks 3, 4 and 5 call it.

- [ ] **Step 1: Write the hook**

There is no test step here, and that is deliberate: this repo has no DOM test environment, so a hook's state cannot be exercised. That is precisely why Task 1 holds every branch worth asserting and this file holds none.

Create `src/components/hooks/use-api-action.ts`:

```ts
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { runApiAction, type ApiActionResult } from '@/components/shared/api-action';

export interface RunOptions {
  /** Shown when the route's reply carries no message of its own. */
  fallbackError?: string;
  /**
   * What happens once the request finishes. `refresh` re-renders the route on success only.
   * `refresh-always` re-renders even after a failure, which is how a failed sync surfaces the
   * error the server recorded on the character. `none` leaves navigation to the caller.
   */
  after?: 'refresh' | 'refresh-always' | 'none' | { push: string };
}

/** Tracks one in-flight call to a route handler, with the busy flag and error message that go with it. */
export function useApiAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(url: string, init?: RequestInit, options: RunOptions = {}): Promise<ApiActionResult<T>> {
    setBusy(true);
    setError(null);
    const result = await runApiAction<T>(fetch, url, init, options.fallbackError);
    setBusy(false);
    if (!result.ok) setError(result.error);

    const after = options.after ?? 'refresh';
    if (after === 'refresh-always' || (after === 'refresh' && result.ok)) router.refresh();
    else if (typeof after === 'object' && result.ok) router.push(after.push);
    return result;
  }

  return { busy, error, run };
}
```

- [ ] **Step 2: Rewrite `RefreshButton` to use it**

Today the component swallows a failure with `.catch(() => null)` and refreshes regardless. `refresh-always` keeps that exactly, which matters: a failed sync writes `lastSyncError` on the character row, and only a refresh shows it.

Replace the whole of `src/components/RefreshButton.tsx`:

```tsx
'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function RefreshButton({ id }: { id: number }) {
  // A failed sync still refreshes: the server records the failure on the character, and the
  // refreshed page is what shows it.
  const { busy, run } = useApiAction();
  return (
    <button type="button" onClick={() => run(`/api/characters/${id}/sync?force=1`, { method: 'POST' }, { after: 'refresh-always' })} disabled={busy}
      className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
```

- [ ] **Step 3: Verify the suite and the types**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 159 tests pass (153 existing plus Task 1's 6).

- [ ] **Step 4: Commit**

```bash
git add src/components/hooks/use-api-action.ts src/components/RefreshButton.tsx
git commit -m "feat: add the useApiAction hook and use it in RefreshButton"
```

---

### Task 3: `RemoveCharacterButton` and `CharacterSettings`

Two components of the same shape, reviewed together because rejecting one would mean rejecting both.

**Files:**
- Modify: `src/components/RemoveCharacterButton.tsx` (whole file, 24 lines)
- Modify: `src/components/CharacterSettings.tsx:15-22` (the `patch` function and its `useRouter`)

**Interfaces:**
- Consumes: `useApiAction` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Rewrite `RemoveCharacterButton`**

The `window.confirm` stays in the component: it is a browser prompt, not part of the request cycle. This also fixes a real bug — today a network failure on `DELETE` throws an unhandled rejection and leaves the button disabled forever.

Replace the whole of `src/components/RemoveCharacterButton.tsx`:

```tsx
'use client';

import { useApiAction } from '@/components/hooks/use-api-action';

export function RemoveCharacterButton({ id, name, redirectTo }: { id: number; name: string; redirectTo?: string }) {
  const { busy, run } = useApiAction();
  async function remove() {
    if (!window.confirm(`Remove ${name} from the tracker?`)) return;
    await run(`/api/characters/${id}`, { method: 'DELETE' }, {
      after: redirectTo ? { push: redirectTo } : 'refresh',
      fallbackError: `Couldn’t remove ${name}.`,
    });
  }
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${name}`}
      className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Rewrite the top of `CharacterSettings`**

Today `patch` awaits the call and refreshes unconditionally, so `refresh-always` preserves it. Remove the `useRouter` import and the `patch` body; leave every `onChange` and all the markup untouched.

In `src/components/CharacterSettings.tsx`, replace these lines:

```tsx
import { useRouter } from 'next/navigation';
```

with:

```tsx
import { useApiAction } from '@/components/hooks/use-api-action';
```

and replace:

```tsx
  const router = useRouter();
  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/characters/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    router.refresh();
  }
```

with:

```tsx
  const { run } = useApiAction();
  const patch = (body: Record<string, unknown>) =>
    run(`/api/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, { after: 'refresh-always' });
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean, 159 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/RemoveCharacterButton.tsx src/components/CharacterSettings.tsx
git commit -m "refactor: use the shared action hook for removing and patching a character"
```

---

### Task 4: `SimcPaste`

The first consumer that needs the parsed response. Message formatting stays in the component — the spec's PR 2 extracts it to `import-message.ts`, and doing it here would blur two pull requests.

**Files:**
- Modify: `src/components/SimcPaste.tsx:1-42` (imports, state and `submit`)

**Interfaces:**
- Consumes: `useApiAction` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Rewrite the logic half of the component**

Replace everything from the imports down to the end of `submit` with:

```tsx
'use client';

import { useState } from 'react';
import { useApiAction } from '@/components/hooks/use-api-action';

interface ImportResponse { changed?: boolean; equipped?: number; bags?: number; vault?: number }

export function SimcPaste({ id }: { id: number }) {
  const { busy, error, run } = useApiAction();
  const [text, setText] = useState('');
  const [imported, setImported] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setImported(null);
    const result = await run<ImportResponse>(`/api/characters/${id}/simc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }, { fallbackError: 'Couldn’t import that SimC text.' });
    if (!result.ok) return;
    setText('');
    setImported(result.data?.changed
      ? `Imported ${result.data.equipped} equipped, ${result.data.bags} bag and ${result.data.vault} Great Vault items.`
      : 'Nothing changed since your last paste.');
  }
```

- [ ] **Step 2: Point the message paragraph at the new state**

The old single `message` object became two values: `error` from the hook, and `imported` for the success text. Replace the message block at the bottom of the form:

```tsx
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-[#f3c9a2]' : 'text-upgrade'}`}>
              {message.text}
            </p>
          )}
```

with:

```tsx
          {error && <p role="alert" className="text-sm text-[#f3c9a2]">{error}</p>}
          {imported && <p role="status" className="text-sm text-upgrade">{imported}</p>}
```

Both `role` values and both colors are unchanged, so the rendered markup for either outcome is identical to today's.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/SimcPaste.tsx
git commit -m "refactor: use the shared action hook for the SimC paste box"
```

---

### Task 5: `AddCharacterBar`

The sixth call site, which the spec missed. Its `add` is the same cycle with a response-dependent redirect.

**Files:**
- Modify: `src/components/AddCharacterBar.tsx:1-10` (imports), `:26-36` (state) and `:70-83` (the `add` function)

**Interfaces:**
- Consumes: `useApiAction` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Swap the hand-rolled state for the hook**

Keep `useRouter`: the redirect target depends on the response id, so `add` pushes it itself with `after: 'none'`. Keep every other piece of state, including `manual`, which carries its own search-unavailable message.

Replace the `busy` and `error` state declarations:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
```

with:

```tsx
  const { busy, error, run } = useApiAction();
```

Add the import beside the others:

```tsx
import { useApiAction } from '@/components/hooks/use-api-action';
```

- [ ] **Step 2: Rewrite `add`**

Replace the whole `add` function:

```tsx
  async function add(body: Record<string, unknown>) {
    const result = await run<{ id?: number }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, ...body }),
    }, { fallbackError: 'Couldn’t add that character.', after: 'none' });
    if (!result.ok || !result.data?.id) return;
    setTerm('');
    setResults([]);
    router.push(`/characters/${result.data.id}`);
  }
```

- [ ] **Step 3: Handle the one remaining `setError` call**

The search-unavailable path calls `setError`, which no longer exists. That message is about the search field rather than the add request, so give it its own state. Add beside the other state:

```tsx
  const [searchError, setSearchError] = useState<string | null>(null);
```

In the search effect, replace `setError('Search is unavailable. Pick the realm yourself.')` with `setSearchError('Search is unavailable. Pick the realm yourself.')`, and change the error paragraph at the end of the component:

```tsx
      {error && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error}</p>}
```

to:

```tsx
      {(error ?? searchError) && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error ?? searchError}</p>}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddCharacterBar.tsx
git commit -m "refactor: use the shared action hook when adding a character"
```

---

### Task 6: Hand verification, spec amendment, and the pull request

No DOM test can cover these five interactions, so they get checked in a browser, and what was checked goes in the pull request description.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-component-and-module-split-design.md` (PR 1 section)

- [ ] **Step 1: Amend the spec to match what was built**

Two things the spec got wrong, both discovered while planning. In its PR 1 section, replace the `Tests:` paragraph with:

```markdown
Tests: `shared/api-action.test.ts` covers the success path, a route's own error message, a non-string error body, an unreachable server, a body that is not JSON, and an empty failed response. The hook itself has no test: this repo runs Vitest in a Node environment with no DOM, so hook state cannot be exercised, which is the reason every branch lives in the pure function instead. The six components have no automated tests today and get none here; the risk is stated in the pull request description and checked by hand.
```

And in the component table, add the row the spec missed:

```markdown
| `AddCharacterBar` | own `busy`, `error`, fetch, push | `useApiAction`, keeps its own `searchError` |
```

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Open http://localhost:3000.

- [ ] **Step 3: Check all five interactions**

- [ ] Add a character by name: the button disables while adding, and the page lands on the new character.
- [ ] Add a name that does not exist: the message from the route appears, and the bar stays usable.
- [ ] **Refresh** on a character page: it reads "Refreshing…" while busy, then the page updates.
- [ ] Change **Compare as** and **Dungeon priority uses**: the page re-renders with the new list.
- [ ] Paste SimC text and import: the counts message appears in green. Paste rubbish: the error appears in the warm color, and the textarea keeps its text.
- [ ] Remove a character: the confirm appears, and declining it leaves the character in place.

- [ ] **Step 4: Run the full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean, 159 tests pass.

- [ ] **Step 5: Commit and open the pull request**

```bash
git add docs/superpowers/specs/2026-09-28-component-and-module-split-design.md
git commit -m "docs: correct the spec's PR 1 tests and component list"
git push -u origin chore/use-api-action
```

The description follows `AGENTS.md`: a framing sentence, `## What changes`, `## Testing` naming the hand checks and the absence of component tests, and `Spec: docs/superpowers/specs/2026-09-28-component-and-module-split-design.md`. It must also state the three deliberate behavior changes:

- A failed `DELETE` no longer leaves the remove button disabled forever, since an unreachable server is now caught.
- A failed character add shows the route's message where a rejected `fetch` previously produced an unhandled rejection.
- `SimcPaste` renders its error and success messages as two elements rather than one, with the same roles and colors.
