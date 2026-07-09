import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import EventForm from '../components/EventForm.jsx';
import QRCodeDisplay from '../components/QRCodeDisplay.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import CoverImageUploader from '../components/CoverImageUploader.jsx';
import WebhookSettings from '../components/WebhookSettings.jsx';
import {
  ArrowLeftIcon, CheckIcon, CopyIcon, DownloadIcon, LockIcon, PencilIcon, TrashIcon, UnlockIcon,
} from '../components/icons.jsx';
import { occasionIcon } from '../occasions.js';

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
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleToggleAlbum = async (e) => {
    const updated = await api.patch(`/events/${id}`, { public_album_enabled: e.target.checked ? 1 : 0 });
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

  const term = searchTerm.trim().toLowerCase();
  const visibleRecordings = term
    ? recordings.filter((r) => (r.guest_name || '').toLowerCase().includes(term)
      || (r.transcript || '').toLowerCase().includes(term))
    : recordings;

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
              <div className="event-detail-title">
                <span className="occasion-badge occasion-badge-lg">
                  {(() => { const Icon = occasionIcon(event.occasion); return <Icon width={20} height={20} />; })()}
                </span>
                <h1>{event.title}</h1>
              </div>
              <span className={`badge ${event.is_active ? 'badge-active' : 'badge-closed'}`}>
                {event.is_active ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="event-meta">{event.occasion}</p>
            {event.greeting && <p>{event.greeting}</p>}
            {event.is_active && event.scheduled_close_at && (
              <p className="event-meta">Closes automatically on {new Date(event.scheduled_close_at).toLocaleString()}</p>
            )}
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

      <div className="card">
        <h2>Guestbook Photo</h2>
        <p className="event-meta">Shown to guests above the recorder — a couple's photo, a portrait, whatever fits the occasion.</p>
        <CoverImageUploader event={event} onChange={setEvent} />
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
        <a className="button-primary-link" href={`/api/events/${event.id}/table-card.pdf`}>
          <DownloadIcon width={15} height={15} /> Printable Table Card (PDF)
        </a>

        <label className="album-toggle">
          <input type="checkbox" checked={Boolean(event.public_album_enabled)} onChange={handleToggleAlbum} />
          Let guests browse and listen to this guestbook
        </label>
        {Boolean(event.public_album_enabled) && (
          <div className="share-link">
            <code>{guestLink}/album</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${guestLink}/album`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (<><CheckIcon width={15} height={15} /> Copied!</>) : (<><CopyIcon width={15} height={15} /> Copy Album Link</>)}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Notifications</h2>
        <p className="event-meta">
          Get pinged when a guest leaves a message — works with ntfy, Discord and Slack webhooks, or any custom endpoint.
        </p>
        <WebhookSettings event={event} onChange={setEvent} />
      </div>

      <div className="card">
        <div className="recordings-header">
          <h2>Recordings ({recordings.length})</h2>
          {recordings.length > 0 && (
            <div className="recordings-header-actions">
              <a href={`/api/events/${event.id}/highlight-reel.mp3`}>
                <DownloadIcon width={15} height={15} /> Highlight Reel
              </a>
              <a className="button-primary-link" href={`/api/events/${event.id}/export.zip`}>
                <DownloadIcon width={15} height={15} /> Export All (.zip)
              </a>
            </div>
          )}
        </div>

        {recordings.length === 0 ? (
          <p className="empty-state">No messages yet. Share the link or QR code above to start collecting them.</p>
        ) : (
          <>
            <input
              type="text"
              className="recordings-search"
              placeholder="Search transcripts and names…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {visibleRecordings.length === 0 ? (
              <p className="empty-state">No recordings match "{searchTerm}".</p>
            ) : (
              <ul className="recordings-list">
                {visibleRecordings.map((recording) => (
                  <li key={recording.id} className="recording-row">
                    <div className="recording-meta">
                      <strong>{recording.guest_name || 'Anonymous'}</strong>
                      <span>{new Date(recording.created_at).toLocaleString()} · {formatDuration(recording.duration_seconds)}</span>
                    </div>
                    <AudioPlayer recordingId={recording.id} />
                    {(recording.transcript_status === 'pending' || recording.transcript_status === 'processing') && (
                      <p className="transcript-status">Transcribing…</p>
                    )}
                    {recording.transcript_status === 'done' && recording.transcript && (
                      <p className="transcript-text">{recording.transcript}</p>
                    )}
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
          </>
        )}
      </div>
    </div>
  );
}
