import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Calendar } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-ink-500 mt-1">Your account information</p>
      </div>

      <div className="bg-white border border-ink-100 rounded-xl shadow-card overflow-hidden">
        <div className="p-6 bg-brand-gradient text-white flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold border-2 border-white/30">
            {initials || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.first_name} {user.last_name}</h2>
            <p className="text-white/80 text-sm">{user.role}</p>
          </div>
        </div>

        <div className="divide-y divide-ink-100">
          <Row icon={User} label="Name" value={`${user.first_name} ${user.last_name}`} />
          <Row icon={Mail} label="Email" value={user.email} />
          <Row icon={Shield} label="Role" value={user.role} />
          {user.created_at && <Row icon={Calendar} label="Member since" value={new Date(user.created_at).toLocaleDateString()} />}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={logout}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50">
          Log out
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">{label}</div>
        <div className="text-sm text-ink-900 font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
