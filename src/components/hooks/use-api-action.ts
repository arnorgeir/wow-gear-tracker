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
