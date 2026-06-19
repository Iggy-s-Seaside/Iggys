import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * The three-role RBAC model.
 *   owner    — Bradley / family. Full access.
 *   manager  — operational. Everything except owner-only admin.
 *   employee — waitlist + own schedule + checklists only. (default, fail-closed)
 */
export type Role = 'owner' | 'manager' | 'employee';

export interface UseRole {
  /** Resolved role for the signed-in user. Defaults to 'employee' (fail-closed). */
  role: Role;
  /** True only for the bar owner / family. */
  isOwner: boolean;
  /** True for owner OR manager — the "full operational" tier. */
  isManager: boolean;
  /** Gate helper: does the current role appear in this allow-list? */
  can: (roles: Role[]) => boolean;
}

/**
 * Reads the role the integrator exposes on AuthContext (resolved server-side
 * via the get_my_role RPC) and derives the common gate predicates.
 *
 * This is a read-only consumer of AuthContext — it never mutates auth state.
 */
export function useRole(): UseRole {
  const { role } = useAuth();
  // Fail closed: if the context hasn't resolved a role yet, treat as employee.
  const resolved: Role = role ?? 'employee';

  return useMemo(() => ({
    role: resolved,
    isOwner: resolved === 'owner',
    isManager: resolved === 'owner' || resolved === 'manager',
    can: (roles: Role[]) => roles.includes(resolved),
  }), [resolved]);
}
