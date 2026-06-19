import type { Role } from '../hooks/useRole';

/**
 * DEV-ONLY auth bypass for local visual QA of authenticated pages.
 *
 * SAFETY — this can never be reached in production:
 *  - It is gated on `import.meta.env.DEV`, which Vite statically replaces with
 *    `false` in a production build. So `devAuthEnabled()` folds to `false` and
 *    every caller's bypass branch is dead-code-eliminated from the prod bundle.
 *  - It is ALSO opt-in via a localStorage flag, so even a normal `vite dev`
 *    session uses real auth unless the flag is explicitly set.
 *
 * Enable (dev browser console):  localStorage.setItem('iggy-dev-auth','1'); location.reload()
 * Disable:                       localStorage.removeItem('iggy-dev-auth'); location.reload()
 *
 * It does NOT mint a real Supabase session, so RLS-protected queries return no
 * rows — pages render in their empty / loading states. That's exactly what's
 * needed to verify layout, touch targets, the notch, loading skeletons, and modal
 * styling without touching production auth or data.
 */
export const DEV_AUTH_FLAG = 'iggy-dev-auth';

export function devAuthEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(DEV_AUTH_FLAG) === '1';
  } catch {
    return false;
  }
}

export const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'claude-qa@dev.local',
  app_metadata: {},
  user_metadata: { name: 'Claude QA' },
  aud: 'authenticated',
  created_at: new Date(0).toISOString(),
};

export const DEV_ROLE: Role = 'owner';
