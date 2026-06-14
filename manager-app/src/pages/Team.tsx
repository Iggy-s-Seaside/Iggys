import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, KeyRound, Trash2, Copy, Check, Loader2, ShieldCheck, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useConfirm } from '../hooks/useConfirm';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface ManagerUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_me: boolean;
}

interface TempCredential {
  email: string;
  password: string;
  kind: 'created' | 'reset';
}

function relativeTime(iso: string | null) {
  if (!iso) return 'never';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

async function callManageUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) {
    // supabase-js wraps non-2xx in FunctionsHttpError; surface the server message
    let message = error.message;
    try {
      const ctx = await (error as { context?: Response }).context?.json();
      if (ctx?.error) message = ctx.error;
    } catch { /* keep generic message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** One-time temp password reveal — shown once, copy and send it to the person. */
function CredentialReveal({ cred, onDone }: { cred: TempCredential; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cred.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select it manually');
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-primary-50 dark:bg-primary/10 border border-primary/30">
      <p className="text-sm font-semibold text-text-primary mb-1">
        {cred.kind === 'created' ? 'Account created' : 'Password reset'} for {cred.email}
      </p>
      <p className="text-xs text-text-muted mb-3">
        This temporary password is shown <span className="font-semibold">once</span> — copy it and
        hand it to them now. They can change it on this page after signing in.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-sm font-mono text-text-primary select-all break-all">
          {cred.password}
        </code>
        <button onClick={copy} className="btn-secondary px-3 min-h-[40px] shrink-0" aria-label="Copy temp password">
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
        </button>
      </div>
      <button onClick={onDone} className="text-xs font-medium text-text-muted hover:text-text-primary mt-3">
        Done — hide this
      </button>
    </div>
  );
}

/**
 * Per-device push toggle. Subscribes THIS browser to Web Push and stores the
 * subscription so the server can reach it. Safe no-op until VITE_VAPID_PUBLIC_KEY is
 * set — in that case it shows a quiet setup hint instead of a live switch.
 */
function NotificationsToggle() {
  const { supported, needsConfig, permission, subscribed, busy, enable, disable } = usePushSubscription();

  const toggle = async () => {
    if (busy) return;
    if (subscribed) {
      const res = await disable();
      if (res.ok) toast.success('Notifications off for this device');
      else toast.error(res.reason || 'Could not turn off notifications');
      return;
    }
    const res = await enable();
    if (res.ok) toast.success('Notifications on for this device');
    else if (res.reason === 'permission denied') {
      toast.error('Notifications are blocked — allow them in your browser settings');
    } else if (res.reason === 'permission dismissed') {
      // User closed the prompt without choosing; no need to nag.
    } else {
      toast.error(res.reason || 'Could not turn on notifications');
    }
  };

  return (
    <div className="card p-5 mb-6">
      <h2 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
        <Bell size={15} className="text-primary" /> Notifications on this device
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Get a push alert on this phone or browser for new inquiries, low stock, and Luna's heads-ups.
        This is per-device — turn it on wherever you want to be reached.
      </p>

      {needsConfig ? (
        <p className="text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2.5">
          Set <code className="font-mono text-text-secondary">VITE_VAPID_PUBLIC_KEY</code> to enable.
        </p>
      ) : !supported ? (
        <p className="text-xs text-text-muted bg-surface-hover border border-border rounded-lg px-3 py-2.5">
          This browser doesn't support push notifications.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {subscribed ? 'On for this device' : 'Off for this device'}
            </p>
            {permission === 'denied' && (
              <p className="text-xs text-danger mt-0.5">
                Blocked in browser settings — allow notifications, then try again.
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={subscribed}
            aria-label="Notifications on this device"
            aria-busy={busy}
            onClick={toggle}
            disabled={busy}
            className="relative inline-flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] disabled:opacity-60"
          >
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                subscribed ? 'bg-primary' : 'bg-surface-active'
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform shadow-sm ${
                  subscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              >
                {busy && <Loader2 size={10} className="animate-spin text-text-muted" />}
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Team() {
  const [users, setUsers] = useState<ManagerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cred, setCred] = useState<TempCredential | null>(null);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const confirm = useConfirm();

  const fetchUsers = useCallback(async () => {
    try {
      const data = await callManageUsers({ action: 'list' });
      setUsers((data.users as ManagerUser[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load managers');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email || adding) return;
    setAdding(true);
    try {
      const data = await callManageUsers({ action: 'create', email });
      setCred({ email, password: data.temp_password, kind: 'created' });
      setNewEmail('');
      toast.success('Manager added');
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add manager');
    }
    setAdding(false);
  };

  const handleReset = async (u: ManagerUser) => {
    if (busyId) return;
    const ok = await confirm({
      title: 'Reset password',
      message: `Reset the password for ${u.email}? Their current password stops working immediately.`,
      confirmLabel: 'Reset password',
      danger: true,
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      const data = await callManageUsers({ action: 'reset_password', user_id: u.id });
      setCred({ email: u.email ?? '', password: data.temp_password, kind: 'reset' });
      toast.success('Password reset');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset password');
    }
    setBusyId(null);
  };

  const handleRemove = async (u: ManagerUser) => {
    if (busyId) return;
    const ok = await confirm({
      title: 'Remove manager',
      message: `Remove ${u.email}? They lose dashboard access immediately.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      await callManageUsers({ action: 'delete', user_id: u.id });
      toast.success('Manager removed');
      fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove manager');
    }
    setBusyId(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPw) return;
    if (pw1.length < 8) {
      toast.error('Use at least 8 characters');
      return;
    }
    if (pw1 !== pw2) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password changed');
      setPw1('');
      setPw2('');
    }
    setChangingPw(false);
  };

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary/10">
          <Users size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Team</h1>
          <p className="text-sm text-text-muted">Manager accounts for this dashboard</p>
        </div>
      </div>
      <p className="text-xs text-text-muted flex items-center gap-1.5 mb-6">
        <ShieldCheck size={13} className="text-primary shrink-0" />
        There is no public sign-up — accounts can only be created here.
      </p>

      {cred && <div className="mb-6"><CredentialReveal cred={cred} onDone={() => setCred(null)} /></div>}

      {/* Managers list */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Managers</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-surface-hover animate-pulse" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {u.email}
                    {u.is_me && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        you
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">Last sign-in {relativeTime(u.last_sign_in_at)}</p>
                </div>
                <button
                  onClick={() => handleReset(u)}
                  disabled={busyId === u.id}
                  title="Reset password"
                  aria-label={`Reset password for ${u.email}`}
                  className="p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  {busyId === u.id ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                </button>
                {!u.is_me && (
                  <button
                    onClick={() => handleRemove(u)}
                    disabled={busyId === u.id}
                    title="Remove manager"
                    aria-label={`Remove ${u.email}`}
                    className="p-2 rounded-lg text-text-muted hover:bg-surface-hover hover:text-danger transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add manager */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
          <UserPlus size={15} className="text-primary" /> Add a manager
        </h2>
        <p className="text-xs text-text-muted mb-4">
          Creates the account instantly and gives you a one-time temp password to hand them.
        </p>
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="their-email@example.com"
            aria-label="New manager email"
            className="input-field flex-1"
            required
          />
          <button type="submit" disabled={adding || !newEmail.trim()} className="btn-primary px-4 min-h-[44px] shrink-0">
            {adding ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
          </button>
        </form>
      </div>

      {/* Notifications on this device */}
      <NotificationsToggle />

      {/* Change my password */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
          <KeyRound size={15} className="text-primary" /> Change my password
        </h2>
        <p className="text-xs text-text-muted mb-4">At least 8 characters. Takes effect immediately.</p>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            className="input-field w-full"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            autoComplete="new-password"
            className="input-field w-full"
          />
          <button type="submit" disabled={changingPw || !pw1 || !pw2} className="btn-primary px-4 min-h-[44px]">
            {changingPw ? <Loader2 size={16} className="animate-spin" /> : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
