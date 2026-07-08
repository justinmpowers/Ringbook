import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import EventForm from '../components/EventForm.jsx';
import { LogoutIcon, PhoneIcon, PlusIcon } from '../components/icons.jsx';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await api.get('/auth/me');
        const data = await api.get('/events');
        if (!cancelled) setEvents(data);
      } catch (err) {
        if (!cancelled) navigate('/admin/login');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleCreate = async (values) => {
    try {
      const event = await api.post('/events', values);
      setShowForm(false);
      navigate(`/admin/events/${event.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/admin/login');
  };

  if (!events) return <p className="page-center">Loading…</p>;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="brand">
          <span className="brand-mark"><PhoneIcon width={18} height={18} /></span>
          <h1>Ringbook</h1>
        </div>
        <button type="button" onClick={handleLogout}>
          <LogoutIcon width={16} height={16} /> Log Out
        </button>
      </header>

      <div className="admin-toolbar">
        <button type="button" className="button-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : (<><PlusIcon width={16} height={16} /> New Guestbook</>)}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {showForm && (
        <div className="card">
          <EventForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {events.length === 0 && !showForm && (
        <p className="empty-state">No guestbooks yet. Create one to get a shareable link and QR code.</p>
      )}

      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <Link to={`/admin/events/${event.id}`} className="card event-list-item">
              <div>
                <strong>{event.title}</strong>
                <span className="event-meta">{event.occasion} · {event.recording_count} message{event.recording_count === 1 ? '' : 's'}</span>
              </div>
              <span className={`badge ${event.is_active ? 'badge-active' : 'badge-closed'}`}>
                {event.is_active ? 'Open' : 'Closed'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
