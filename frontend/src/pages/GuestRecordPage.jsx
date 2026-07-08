import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import Recorder from '../components/Recorder.jsx';
import Confetti from '../components/Confetti.jsx';
import { BookIcon, CheckIcon, PhoneIcon } from '../components/icons.jsx';
import { occasionIcon } from '../occasions.js';

const SOLEMN_OCCASIONS = new Set(['Funeral']);

export default function GuestRecordPage() {
  const { slug } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | not-found | closed | ready | preview | submitting | done | error
  const [event, setEvent] = useState(null);
  const [config, setConfig] = useState({ maxRecordingSeconds: 180 });
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const audioUrlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [eventData, configData] = await Promise.all([
          api.get(`/public/events/${slug}`),
          api.get('/public/config'),
        ]);
        if (cancelled) return;
        setEvent(eventData);
        setConfig(configData);
        setPhase(eventData.is_active ? 'ready' : 'closed');
      } catch (err) {
        if (!cancelled) setPhase('not-found');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const handleStop = (blob) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setRecordedBlob(blob);
    setPreviewUrl(url);
    setPhase('preview');
  };

  const handleReRecord = () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setRecordedBlob(null);
    setPreviewUrl(null);
    setPhase('ready');
  };

  const handleSubmit = async () => {
    setPhase('submitting');
    setErrorMessage('');
    try {
      const extension = recordedBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const formData = new FormData();
      formData.append('audio', recordedBlob, `message.${extension}`);
      if (guestName.trim()) formData.append('guest_name', guestName.trim());

      await api.post(`/public/events/${slug}/recordings`, formData);
      setPhase('done');
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong saving your message.');
      setPhase('preview');
    }
  };

  if (phase === 'loading') {
    return <p className="page-center">Loading…</p>;
  }

  if (phase === 'not-found') {
    return <p className="page-center">This guestbook link doesn't exist.</p>;
  }

  if (phase === 'closed') {
    return (
      <div className="guest-page page-center">
        <div className="guest-card">
          <div className="guest-card-status">
            <BookIcon className="status-icon" width={40} height={40} />
            <h1>{event.title}</h1>
            <p>This guestbook is no longer accepting new messages. Thanks for stopping by!</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const celebratory = !SOLEMN_OCCASIONS.has(event.occasion);
    return (
      <div className="guest-page page-center">
        <div className="guest-card">
          <div className="guest-card-status">
            <div className="status-icon-wrap">
              {celebratory && <Confetti />}
              <CheckIcon className="status-icon status-icon-success" width={40} height={40} />
            </div>
            <h1>Message saved!</h1>
            <p>Thank you for leaving your voice in the {event.title} guestbook.</p>
            <button type="button" className="button-primary" onClick={() => { setGuestName(''); setPhase('ready'); }}>
              Leave Another Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  const OccasionIcon = occasionIcon(event.occasion);

  return (
    <div className="guest-page page-center">
      <div className="guest-card">
        {Boolean(event.has_cover_image) && (
          <div className="guest-cover">
            <img src={`/api/public/events/${slug}/cover?v=${encodeURIComponent(event.updated_at)}`} alt="" />
          </div>
        )}
        <div className="guest-card-body">
          {event.occasion && (
            <p className="eyebrow"><OccasionIcon width={14} height={14} /> {event.occasion} Guestbook</p>
          )}
          <h1>{event.title}</h1>
          {event.greeting && <p className="greeting">{event.greeting}</p>}

          <div key={phase} className="fade-item">
            {(phase === 'ready') && (
              <Recorder maxSeconds={config.maxRecordingSeconds} onStop={handleStop} />
            )}

            {(phase === 'preview' || phase === 'submitting') && (
              <div className="preview">
                <span className="preview-label">Your message</span>
                <audio controls src={previewUrl} />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={phase === 'submitting'}
                />
                {errorMessage && <p className="error-text">{errorMessage}</p>}
                <div className="preview-actions">
                  <button type="button" onClick={handleReRecord} disabled={phase === 'submitting'}>
                    Re-record
                  </button>
                  <button type="button" className="button-primary" onClick={handleSubmit} disabled={phase === 'submitting'}>
                    {phase === 'submitting' ? 'Saving…' : 'Save to Guestbook'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="guest-footer"><PhoneIcon width={12} height={12} /> Ringbook</p>
    </div>
  );
}
