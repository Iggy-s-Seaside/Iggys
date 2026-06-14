import { Navigate } from 'react-router-dom';
import { useRole, type Role } from '../../hooks/useRole';

interface RequireRoleProps {
  /** Roles permitted to view the wrapped content. */
  allow: Role[];
  children: React.ReactNode;
}

/**
 * Route-level role gate. Composes UNDER ProtectedRoute, so the user is already
 * authenticated by the time this renders — we only check role here.
 *
 * If the resolved role isn't in `allow`, we bounce to /waitlist, the one
 * surface every role (including employee) is allowed to reach.
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
  const { can } = useRole();

  if (!can(allow)) {
    return <Navigate to="/waitlist" replace />;
  }

  return <>{children}</>;
}

export default RequireRole;
