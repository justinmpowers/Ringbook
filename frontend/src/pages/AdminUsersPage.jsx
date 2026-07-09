import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../components/icons.jsx';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const load = async () => {
    try {
      const [meData, usersData] = await Promise.all([
        api.get('/auth/me'),
        api.get('/auth/users'),
      ]);
      setMe(meData);
      setUsers(usersData);
    } catch (err) {
      if (err.status === 401) navigate('/admin/login');
      else if (err.status === 403) navigate('/admin');
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/auth/users', { username, password });
      setUsername('');
      setPassword('');
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this admin account?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      await load();
    } catch (err) {
      window.alert(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError('');
    setPasswordMessage('');
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('Password updated.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!users || !me) return <p className="page-center">Loading…</p>;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/admin" className="back-link"><ArrowLeftIcon width={16} height={16} /> Dashboard</Link>
      </header>

      <div className="card">
        <h2>Admin Accounts</h2>
        <ul className="event-list">
          {users.map((user) => (
            <li key={user.id} className="card event-list-item">
              <div className="event-list-body">
                <strong>{user.username}</strong>
                <span className="event-meta">
                  {user.is_owner ? 'Owner · ' : ''}
                  {user.event_count} guestbook{user.event_count === 1 ? '' : 's'}
                  {user.id === me.id ? ' · you' : ''}
                </span>
              </div>
              {user.id !== me.id && !user.is_owner && (
                <button type="button" onClick={() => handleDelete(user.id)}>
                  <TrashIcon width={14} height={14} /> Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {showForm ? (
          <form className="event-form" onSubmit={handleCreate}>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
            {createError && <p className="error-text">{createError}</p>}
            <div className="form-actions">
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create Admin'}
              </button>
            </div>
          </form>
        ) : (
          <div className="admin-toolbar">
            <button type="button" className="button-primary" onClick={() => setShowForm(true)}>
              <PlusIcon width={16} height={16} /> New Admin
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Change Your Password</h2>
        <form className="event-form" onSubmit={handleChangePassword}>
          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {passwordError && <p className="error-text">{passwordError}</p>}
          {passwordMessage && <p>{passwordMessage}</p>}
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={changingPassword}>
              {changingPassword ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
