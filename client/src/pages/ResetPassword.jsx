import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Brand from '../components/Brand';
import api from '../utils/api';
import { Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
        <div className="text-center">
          <p className="text-ink-600 mb-4">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-brand-700 hover:underline font-medium">Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Brand className="h-10" showText />
        </div>

        <div className="bg-white border border-ink-200 rounded-2xl p-8 shadow-sm">
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">Password updated!</h2>
              <p className="text-ink-500 text-sm mb-4">Redirecting you to sign in…</p>
              <Link to="/login" className="text-brand-700 hover:underline text-sm font-medium">Sign in now</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-ink-900">Set new password</h2>
                <p className="text-ink-500 text-sm mt-1">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}

                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="input pr-10"
                      placeholder="At least 6 characters"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className="input"
                    placeholder="Re-enter your password"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Updating…' : 'Update password'}
                </button>

                <div className="text-center">
                  <Link to="/login" className="text-sm text-ink-500 hover:text-brand-700 inline-flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Back to sign in
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
