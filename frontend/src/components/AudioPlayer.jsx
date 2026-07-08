export default function AudioPlayer({ recordingId }) {
  return (
    <audio controls preload="none" src={`/api/recordings/${recordingId}/stream`}>
      Your browser does not support audio playback.
    </audio>
  );
}
