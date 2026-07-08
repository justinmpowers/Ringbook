import { useCallback, useEffect, useRef, useState } from 'react';
import { MicIcon, StopIcon } from './icons.jsx';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

// Records mic audio and hands the finished blob back via onStop.
// Feature-detects a supported mimeType since Chrome/Firefox record webm/opus
// while Safari records mp4/aac - the server normalizes either into MP3.
export default function Recorder({ maxSeconds, onStop }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | recording | error
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    stopStream();
  }, [stopStream]);

  const startRecording = async () => {
    setError(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearInterval(intervalRef.current);
        const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stopStream();
        setStatus('idle');
        setElapsedSeconds(0);
        onStop(blob, durationSeconds);
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setStatus('recording');
      setElapsedSeconds(0);

      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setStatus('error');
      setError('Microphone access was denied or is unavailable. Please allow microphone access and try again.');
    }
  };

  if (status === 'error') {
    return (
      <div className="recorder recorder-error">
        <p>{error}</p>
        <button type="button" className="button-primary" onClick={startRecording}>Try Again</button>
      </div>
    );
  }

  if (status === 'recording') {
    const remaining = Math.max(0, maxSeconds - elapsedSeconds);
    return (
      <div className="recorder recorder-active">
        <div className="recorder-pulse-wrap" aria-hidden="true">
          <span className="recorder-pulse-ring" />
          <span className="recorder-pulse-ring recorder-pulse-ring-delay" />
          <span className="recorder-pulse-core"><MicIcon width={28} height={28} /></span>
        </div>
        <p className="recorder-timer">{elapsedSeconds}s <span>· {remaining}s left</span></p>
        <button type="button" className="button-stop" onClick={stopRecording}>
          <StopIcon width={16} height={16} /> Stop Recording
        </button>
      </div>
    );
  }

  return (
    <div className="recorder">
      <button type="button" className="button-record" onClick={startRecording} disabled={status === 'requesting'}>
        <MicIcon width={22} height={22} />
        {status === 'requesting' ? 'Requesting microphone…' : 'Start Recording'}
      </button>
    </div>
  );
}
