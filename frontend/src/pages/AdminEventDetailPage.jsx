import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import EventForm from '../components/EventForm.jsx';
import QRCodeDisplay from '../components/QRCodeDisplay.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import {
  ArrowLeftIcon, CheckIcon, CopyIcon, DownloadIcon, LockIcon, PencilIcon, TrashIcon, UnlockIcon,
} from '../components/icons.jsx';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminEventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const guestLink = `${window.location.origin}/r/${event?.slug}`;

  const loadAll = async () => {
    try {
      const [eventData, recordingsData] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/recordings`),
      ]);
      setEvent(eventData);
      setRecordings(recordingsData);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
      } else {
        setError(err.message);
      }
    }
  };

  useEffect(() => { loadAll(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async (values) => {
    const updated = await api.patch(`/events/${id}`, values);
    setEvent(updated);
    setEditing(false);
  };

  const handleToggleActive = async () => {
    const updated = await api.patch(`/events/${id}`, { is_active: event.is_active ? 0 : 1 });
    setEvent(updated);
  };

  const handleDeleteRecording = async (recordingId) => {
    if (!window.confirm('Delete this recording? This cannot be undone.')) return;
    await api.delete(`/recordings/${recordingId}`);
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(guestLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) return <p className="page-center error-text">{error}</p>;
  if (!event) return <p className="page-center">Loading…</p>;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/admin" className="back-link"><ArrowLeftIcon width={16} height={16} /> All Guestbooks</Link>
      </header>

      <div className="card">
        {editing ? (
          <EventForm
            initialValues={event}
            submitLabel="Save Changes"
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="event-detail-heading">
              <h1>{event.title}</h1>
              <span className={`badge ${event.is_active ? 'badge-active' : 'badge-closed'}`}>
                {event.is_active ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="event-meta">{event.occasion}</p>
            {event.greeting && <p>{event.greeting}</p>}
            <div className="form-actions">
              <button type="button" onClick={() => setEditing(true)}>
                <PencilIcon width={15} height={15} /> Edit
              </button>
              <button type="button" onClick={handleToggleActive}>
                {event.is_active
                  ? (<><LockIcon width={15} height={15} /> Close Guestbook</>)
                  : (<><UnlockIcon width={15} height={15} /> Reopen Guestbook</>)}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card share-card">
        <h2>Share with guests</h2>
        <QRCodeDisplay eventId={event.id} altText={`QR code for ${event.title}`} />
        <div className="share-link">
          <code>{guestLink}</code>
          <button type="button" onClick={handleCopyLink}>
            {copied ? (<><CheckIcon width={15} height={15} /> Copied!</>) : (<><CopyIcon width={15} height={15} /> Copy Link</>)}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="recordings-header">
          <h2>Recordings ({recordings.length})</h2>
          {recordings.length > 0 && (
            <a className="button-primary-link" href={`/api/events/${event.id}/export.zip`}>
              <DownloadIcon width={15} height={15} /> Export All (.zip)
            </a>
          )}
        </div>

        {recordings.length === 0 ? (
          <p className="empty-state">No messages yet. Share the link or QR code above to start collecting them.</p>
        ) : (
          <ul className="recordings-list">
            {recordings.map((recording) => (
              <li key={recording.id} className="recording-row">
                <div className="recording-meta">
                  <strong>{recording.guest_name || 'Anonymous'}</strong>
                  <span>{new Date(recording.created_at).toLocaleString()} · {formatDuration(recording.duration_seconds)}</span>
                </div>
                <AudioPlayer recordingId={recording.id} />
                <div className="recording-actions">
                  <a href={`/api/recordings/${recording.id}/download`}><DownloadIcon width={14} height={14} /> Download</a>
                  <button type="button" onClick={() => handleDeleteRecording(recording.id)}>
                    <TrashIcon width={14} height={14} /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
