export default function AudioPlayer({ recordingId, src }) {
  return (
    <audio controls preload="none" src={src || `/api/recordings/${recordingId}/stream`}>
      Your browser does not support audio playback.
    </audio>
  );
}
