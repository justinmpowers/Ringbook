import { useState } from 'react';
import { api } from '../api.js';

export default function WebhookSettings({ event, onChange }) {
  const [url, setUrl] = useState(event.webhook_url || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.patch(`/events/${event.id}`, { webhook_url: url.trim() || null });
      onChange(updated);
      setMessage('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const result = await api.post(`/events/${event.id}/webhook/test`, {});
      if (result.ok) {
        setMessage('Test notification sent.');
      } else {
        setError(result.error || 'Test notification failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <form className="event-form" onSubmit={handleSave}>
      <label>
        Webhook URL (optional)
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://ntfy.sh/your-topic, a Discord/Slack webhook, or any custom endpoint"
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      {message && <p>{message}</p>}
      <div className="form-actions">
        {event.webhook_url && (
          <button type="button" onClick={handleTest} disabled={testing}>
            {testing ? 'Sending…' : 'Send Test Notification'}
          </button>
        )}
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
