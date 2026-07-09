import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import AudioPlayer from '../components/AudioPlayer.jsx';
import { occasionIcon } from '../occasions.js';
import { counterLabel } from '../messageCounter.js';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PublicAlbumPage() {
  const { slug } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | not-found | ready
  const [album, setAlbum] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get(`/public/events/${slug}/album`);
        if (cancelled) return;
        setAlbum(data);
        setPhase('ready');
      } catch (err) {
        if (!cancelled) setPhase('not-found');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (phase === 'loading') {
    return <p className="page-center">Loading…</p>;
  }

  if (phase === 'not-found') {
    return <p className="page-center">This guestbook album isn't available.</p>;
  }

  const OccasionIcon = occasionIcon(album.occasion);

  return (
    <div className="guest-page page-center">
      <div className="guest-card">
        {Boolean(album.has_cover_image) && (
          <div className="guest-cover">
            <img src={`/api/public/events/${slug}/cover?v=${encodeURIComponent(album.updated_at)}`} alt="" />
          </div>
        )}
        <div className="guest-card-body">
          {album.occasion && (
            <p className="eyebrow"><OccasionIcon width={14} height={14} /> {album.occasion} Guestbook</p>
          )}
          <h1>{album.title}</h1>
          {album.greeting && <p className="greeting">{album.greeting}</p>}
          <p className="message-counter">{counterLabel(album.occasion, album.recordings.length)}</p>

          {album.recordings.length > 0 && (
            <ul className="recordings-list album-list">
              {album.recordings.map((recording) => (
                <li key={recording.id} className="recording-row">
                  <div className="recording-meta">
                    <strong>{recording.guest_name || 'Anonymous'}</strong>
                    <span>{new Date(recording.created_at).toLocaleDateString()} · {formatDuration(recording.duration_seconds)}</span>
                  </div>
                  <AudioPlayer recordingId={recording.id} src={`/api/public/recordings/${recording.id}/stream`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
