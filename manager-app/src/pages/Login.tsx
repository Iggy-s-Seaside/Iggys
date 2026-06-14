import { useState, useRef, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Waves, Delete, ChevronLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { InstallHelp } from '../components/InstallHelp';

/** Progressive lockout on the email fallback: 0s, 2s, 5s, 10s, 30s. */
const LOCKOUT_DELAYS = [0, 2000, 5000, 10000, 30000];

interface StaffPin { id: number; name: string; }

export function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'pin' | 'email'>('pin');

  // ── PIN flow ──
  const [staff, setStaff] = useState<StaffPin[] | null>(null);
  const [selected, setSelected] = useState<StaffPin | null>(null);
  const [pin, setPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // ── Email fallback ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const failCount = useRef(0);

  // Load the PIN-pad name list (names only; emails/hashes stay server-side).
  useEffect(() => {
    if (mode !== 'pin') return;
    let alive = true;
    supabase.functions
      .invoke('pin-login', { body: { action: 'list' } })
      .then(({ data }) => { if (alive) setStaff(Array.isArray(data?.staff) ? data.staff : []); })
      .catch(() => { if (alive) setStaff([]); });
    return () => { alive = false; };
  }, [mode]);

  const submitPin = useCallback(async (id: number, fullPin: string) => {
    setPinBusy(true);
    setPinError(null);
    try {
      const { data, error } = await supabase.functions.invoke('pin-login', {
        body: { action: 'login', id, pin: fullPin },
      });
      let errMsg: string | null = null;
      if (error) {
        errMsg = 'That PIN didn’t work.';
        try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.error) errMsg = ctx.error; } catch { /* keep */ }
      } else if (data?.error) {
        errMsg = data.error;
      }
      if (errMsg) { setPin(''); setPinError(errMsg); return; }
      // Exchange the one-time token minted by pin-login for a real session.
      const { error: otpErr } = await supabase.auth.verifyOtp({ email: data.email, token: data.token, type: 'email' });
      if (otpErr) { setPin(''); setPinError('Couldn’t sign in. Try email instead.'); return; }
      // Success → onAuthStateChange sets `user` → the <Navigate> below redirects.
    } finally {
      setPinBusy(false);
    }
  }, []);

  const pressDigit = (d: string) => {
    if (pinBusy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setPinError(null);
    if (next.length === 4 && selected) submitPin(selected.id, next);
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const isLocked = Date.now() < lockedUntil;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      failCount.current++;
      const delay = LOCKOUT_DELAYS[Math.min(failCount.current, LOCKOUT_DELAYS.length - 1)];
      if (delay > 0) {
        setLockedUntil(Date.now() + delay);
        toast.error(`Too many attempts. Try again in ${delay / 1000}s.`);
        setTimeout(() => setLockedUntil(0), delay);
      } else {
        toast.error(error);
      }
    } else {
      failCount.current = 0;
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-surface dark:to-bg p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Waves size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Iggy's Manager</h1>
          <p className="text-sm text-text-muted mt-1">
            {mode === 'pin' ? 'Tap your name and enter your PIN' : 'Sign in with email & password'}
          </p>
        </div>

        {mode === 'pin' ? (
          <div className="card p-6">
            {staff === null ? (
              <div className="py-10 flex justify-center"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
            ) : !selected ? (
              // ── Name picker ──
              staff.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-text-secondary">No PINs set up yet.</p>
                  <p className="text-xs text-text-muted mt-1">An owner sets staff PINs in Team. For now, sign in with email.</p>
                  <button onClick={() => setMode('email')} className="btn-primary mt-4 inline-flex">
                    Use email & password <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {staff.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelected(s); setPin(''); setPinError(null); }}
                      className="card-hover px-3 py-4 text-sm font-semibold text-text-primary text-center truncate active:scale-[0.98] transition-transform min-h-[56px]"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )
            ) : (
              // ── PIN pad ──
              <div>
                <button
                  onClick={() => { setSelected(null); setPin(''); setPinError(null); }}
                  className="btn-ghost -ml-2 mb-2 text-sm"
                >
                  <ChevronLeft size={16} /> {selected.name}
                </button>

                {/* 4 dots */}
                <div className="flex justify-center gap-3 my-5" aria-label="PIN entry">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                        pin.length > i ? 'bg-primary border-primary' : 'border-border'
                      } ${pinError ? 'border-danger' : ''}`}
                    />
                  ))}
                </div>

                {pinError && <p className="text-center text-sm text-danger mb-3">{pinError}</p>}
                {pinBusy && <div className="flex justify-center mb-3"><Loader2 size={18} className="animate-spin text-text-muted" /></div>}

                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      onClick={() => pressDigit(d)}
                      disabled={pinBusy}
                      className="card-hover text-xl font-semibold text-text-primary min-h-[56px] active:scale-[0.97] transition-transform disabled:opacity-50"
                    >
                      {d}
                    </button>
                  ))}
                  <span />
                  <button
                    onClick={() => pressDigit('0')}
                    disabled={pinBusy}
                    className="card-hover text-xl font-semibold text-text-primary min-h-[56px] active:scale-[0.97] transition-transform disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    onClick={() => { setPin((p) => p.slice(0, -1)); setPinError(null); }}
                    disabled={pinBusy || pin.length === 0}
                    aria-label="Delete"
                    className="flex items-center justify-center text-text-muted min-h-[56px] active:scale-[0.97] transition-transform disabled:opacity-30"
                  >
                    <Delete size={22} />
                  </button>
                </div>
              </div>
            )}

            <button onClick={() => setMode('email')} className="block w-full text-center text-xs text-text-muted hover:text-text-secondary mt-5">
              Sign in with email & password instead
            </button>
          </div>
        ) : (
          // ── Email fallback (break-glass / setup / recovery) ──
          <form onSubmit={handleEmailSubmit} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="login-email">Email</label>
              <input id="login-email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} className="input-field"
                placeholder="manager@iggysseaside.com" required />
            </div>
            <div>
              <label className="label" htmlFor="login-pw">Password</label>
              <input id="login-pw" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} className="input-field"
                placeholder="Enter your password" required />
            </div>
            <button type="submit" disabled={loading || isLocked} className="btn-primary w-full">
              {loading ? <Loader2 size={18} className="animate-spin" /> : isLocked ? 'Please wait…' : 'Sign In'}
            </button>
            <button type="button" onClick={() => setMode('pin')} className="block w-full text-center text-xs text-text-muted hover:text-text-secondary">
              Back to PIN sign-in
            </button>
          </form>
        )}

        <InstallHelp variant="banner" className="mt-4" />
      </div>
    </div>
  );
}
