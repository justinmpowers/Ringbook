import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PhoneIcon } from '../components/icons.jsx';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/login', { username, password });
      navigate('/admin');
    } catch (err) {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-center">
      <form className="login-form" onSubmit={handleSubmit}>
        <span className="brand-mark login-brand-mark"><PhoneIcon width={20} height={20} /></span>
        <h1>Ringbook Admin</h1>
        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
