import { useState } from 'react';
import { OCCASIONS } from '../occasions.js';

function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Create Guestbook' }) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [occasion, setOccasion] = useState(initialValues?.occasion || OCCASIONS[0]);
  const [greeting, setGreeting] = useState(initialValues?.greeting || '');
  const [scheduledCloseAt, setScheduledCloseAt] = useState(toLocalInputValue(initialValues?.scheduled_close_at));
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        occasion,
        greeting,
        scheduled_close_at: scheduledCloseAt ? new Date(scheduledCloseAt).toISOString() : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sam & Jordan's Wedding" required />
      </label>
      <label>
        Occasion
        <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
          {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label>
        Greeting for guests
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Leave us a voicemail! Tell a story, share your congratulations, or just say hi."
          rows={3}
        />
      </label>
      <label>
        Automatically close at (optional)
        <input
          type="datetime-local"
          value={scheduledCloseAt}
          onChange={(e) => setScheduledCloseAt(e.target.value)}
        />
      </label>
      <div className="form-actions">
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
