import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import { Eye, EyeOff, ArrowRight, Shield, Zap, Users } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); navigate(location.state?.from || '/'); }
    catch (err) { setError(err.response?.data?.error || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* Left panel — brand showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-gradient overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0%, transparent 50%), radial-gradient(circle at 80% 80%, white 0%, transparent 50%)' }} />
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="bg-white rounded-2xl p-4 w-fit shadow-pop">
            <Brand className="h-12" />
          </div>

          <div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1]">
              Ship bug-free.<br/>
              <span className="text-brand-100">Every release.</span>
            </h1>
            <p className="text-brand-50/90 text-lg mt-6 max-w-md leading-relaxed">
              The premium bug tracking and work management platform for Glimmora International.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: Zap, text: 'Lightning-fast issue tracking & triage' },
                { icon: Users, text: 'Role-based workflows for QA, dev & PM' },
                { icon: Shield, text: 'Enterprise-grade audit & reporting' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-white/90">{f.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-white/60">© {new Date().getFullYear()} Glimmora International. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center"><Brand className="h-10" showText /></div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-ink-900 tracking-tight">Welcome back</h2>
            <p className="text-ink-500 mt-2">Sign in to continue to your workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input" placeholder="you@glimmora.ai" />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required className="input pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Signing in…' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-center text-sm text-ink-500">
              Don't have an account? <Link to="/register" className="text-brand-700 font-semibold hover:underline">Create one</Link>
            </p>

            <div className="text-center text-[11px] text-ink-400 pt-3 border-t border-ink-100">
              Default admin: admin@bugtrack.com / admin123
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
