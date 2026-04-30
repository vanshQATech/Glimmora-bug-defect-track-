import { useState } from 'react';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import api from '../utils/api';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Brand className="h-10" showText />
        </div>

        <div className="bg-white border border-ink-200 rounded-2xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">Check your inbox</h2>
              <p className="text-ink-500 text-sm leading-relaxed mb-6">
                If <strong>{email}</strong> is registered, we've sent a password reset link to that address. Check your spam folder if you don't see it within a few minutes.
              </p>
              <Link to="/login" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-ink-900">Forgot your password?</h2>
                <p className="text-ink-500 text-sm mt-1">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-lg text-sm">{error}</div>
                )}

                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="input"
                    placeholder="you@glimmora.ai"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Sending…' : 'Send reset link'}
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
