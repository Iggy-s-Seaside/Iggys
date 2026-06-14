import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
 * The role resolves asynchronously (a DB RPC), so we WAIT on roleResolved before
 * deciding — otherwise an owner is momentarily seen as the fail-closed 'employee'
 * and wrongly bounced to /waitlist. Once resolved, a disallowed role goes to
 * /waitlist (the one surface every role can reach).
 */
export function RequireRole({ allow, children }: RequireRoleProps) {
  const { roleResolved } = useAuth();
  const { can } = useRole();

  if (!roleResolved) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!can(allow)) {
    return <Navigate to="/waitlist" replace />;
  }

  return <>{children}</>;
}

export default RequireRole;
