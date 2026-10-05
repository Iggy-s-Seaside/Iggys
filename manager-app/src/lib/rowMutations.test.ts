import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { deleteRow, updateRow } from './rowMutations';

// Model PostgREST's zero-row RLS behavior: minimal responses succeed, but a
// requested single representation fails. This catches removal of the guard.
function database(affected: boolean) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (headers.get('Accept') !== 'application/vnd.pgrst.object+json') {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(affected ? { id: 6 } : {
      code: 'PGRST116',
      message: 'Cannot coerce the result to a single JSON object',
      details: 'The result contains 0 rows',
      hint: null,
    }), { status: affected ? 200 : 406, headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  return { client, fetch };
}

describe.each(['update', 'delete'] as const)('%s row confirmation', (operation) => {
  it('surfaces a zero-row write as an error so optimistic changes can roll back', async () => {
    const { client } = database(false);
    const result = operation === 'update'
      ? await updateRow(client, 'events', 6, { active: false })
      : await deleteRow(client, 'events', 6);
    expect(result.error?.code).toBe('PGRST116');
    expect(result.data).toBeNull();
  });

  it('confirms a persisted mutation and targets only the requested event', async () => {
    const { client, fetch } = database(true);
    const result = operation === 'update'
      ? await updateRow(client, 'events', 6, { active: false })
      : await deleteRow(client, 'events', 6);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 6 });
    const [url, request] = fetch.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('id')).toBe('eq.6');
    expect(request?.method).toBe(operation === 'update' ? 'PATCH' : 'DELETE');
    if (operation === 'update') expect(JSON.parse(request?.body as string)).toEqual({ active: false });
  });
});
