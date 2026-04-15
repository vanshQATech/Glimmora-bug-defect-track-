import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Bell, Check, CheckCheck } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetch();
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    fetch();
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="text-ink-500 mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 text-sm text-brand-600 border border-indigo-200 rounded-lg hover:bg-brand-50">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-white card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-ink-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-ink-400">
            <Bell className="w-10 h-10 mx-auto mb-2" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-4 px-5 py-4 ${n.is_read ? '' : 'bg-brand-50/50'}`}>
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-brand-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  {n.message && <p className="text-sm text-ink-500 mt-0.5">{n.message}</p>}
                  <p className="text-xs text-ink-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {n.entity_type && n.entity_id && (
                    <Link to={`/${n.entity_type === 'project' ? 'projects' : n.entity_type + 's'}/${n.entity_id}`}
                      className="text-xs text-brand-600 hover:underline">View</Link>
                  )}
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} className="p-1 text-ink-400 hover:text-brand-600">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
