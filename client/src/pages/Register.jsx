import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import { ArrowRight } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await register(form); navigate('/'); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 bg-brand-radial px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4"><Brand className="h-12" showText /></div>
          <p className="text-ink-500 text-sm">Create your Glimmora workspace account</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8 space-y-5">
          <h2 className="text-xl font-bold text-ink-900">Create account</h2>
          {error && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input type="text" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required className="input" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input type="text" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required className="input" />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="input" placeholder="you@glimmora.ai" />
          </div>

          <div>
            <label className="label">Password</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} className="input" placeholder="Min 6 characters" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? 'Creating account…' : <>Create account <ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="text-center text-sm text-ink-500">
            Already have an account? <Link to="/login" className="text-brand-700 font-semibold hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
