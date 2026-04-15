import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Shield, Power } from 'lucide-react';

const ROLES = ['Admin', 'Project Manager', 'Developer', 'QA', 'Product Manager', 'Standard User'];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    api.get('/users').then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const invite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteStatus(null);
    try {
      const res = await api.post('/users/invite', { email: inviteEmail });
      setInviteStatus({
        type: res.data.email_sent ? 'success' : 'warn',
        message: res.data.message || 'Invitation created',
        link: res.data.invite_link,
      });
      setInviteEmail('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      setInviteStatus({ type: 'error', message: msg });
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = (link) => {
    navigator.clipboard.writeText(link).then(() => {
      alert('Invite link copied to clipboard');
    });
  };

  const updateRole = async (userId, role) => {
    try {
      await api.put(`/users/${userId}/role`, { role });
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const toggleActive = async (userId, currentActive) => {
    try {
      await api.put(`/users/${userId}/status`, { is_active: !currentActive });
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  if (currentUser?.role !== 'Admin') return <div className="text-center py-12 text-ink-500">Admin access required</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Users</h1>
          <p className="text-ink-500 mt-1">{users.length} registered users</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-gradient text-white rounded-lg  text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Invite User
        </button>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { if (!inviteLoading) { setShowInvite(false); setInviteStatus(null); } }}>
          <form onClick={e => e.stopPropagation()} onSubmit={invite} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Invite User</h2>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required disabled={inviteLoading}
                className="w-full px-4 py-2.5 border border-ink-200 rounded-lg focus:ring-2 focus:ring-brand-300 outline-none disabled:opacity-50" />
            </div>
            {inviteStatus && (
              <div className={`text-sm px-4 py-3 rounded-lg border ${
                inviteStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                inviteStatus.type === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                <div>{inviteStatus.message}</div>
                {inviteStatus.link && (
                  <div className="mt-2 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Invite link</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteStatus.link}
                        onClick={e => e.target.select()}
                        className="flex-1 px-2 py-1.5 text-xs bg-white border border-ink-200 rounded font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyInviteLink(inviteStatus.link)}
                        className="px-3 py-1.5 text-xs bg-brand-gradient text-white rounded font-semibold"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-[11px] opacity-70">Share this link with the person you want to invite. It will auto-fill the registration form.</div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowInvite(false); setInviteStatus(null); }} disabled={inviteLoading}
                className="px-4 py-2 text-sm text-ink-600 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={inviteLoading}
                className="px-4 py-2 bg-brand-gradient text-white rounded-lg text-sm font-medium  disabled:opacity-50 min-w-[120px]">
                {inviteLoading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-ink-600">User</th>
                <th className="text-left px-5 py-3 font-medium text-ink-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-ink-600">Role</th>
                <th className="text-left px-5 py-3 font-medium text-ink-600">Status</th>
                <th className="text-left px-5 py-3 font-medium text-ink-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold">
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <span className="font-medium">{u.first_name} {u.last_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                      disabled={u.id === currentUser.id}
                      className="px-2 py-1 border border-ink-200 rounded text-xs outline-none disabled:opacity-50">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.id !== currentUser.id && (
                      <button onClick={() => toggleActive(u.id, u.is_active)}
                        className={`text-xs px-3 py-1 rounded-lg ${u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
