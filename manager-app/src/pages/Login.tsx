import { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Waves } from 'lucide-react';
import toast from 'react-hot-toast';

/** Progressive lockout: 0s, 2s, 5s, 10s, 30s after successive failures */
const LOCKOUT_DELAYS = [0, 2000, 5000, 10000, 30000];

export function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const failCount = useRef(0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const isLocked = Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Waves size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Iggy's Manager</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to manage your bar</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="manager@iggysseaside.com"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || isLocked}
            className="btn-primary w-full"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : isLocked ? 'Please wait...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
