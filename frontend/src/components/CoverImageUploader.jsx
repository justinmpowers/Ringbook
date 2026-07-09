import { useRef, useState } from 'react';
import { api } from '../api.js';
import { ImageIcon, TrashIcon } from './icons.jsx';

export default function CoverImageUploader({ event, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const coverUrl = event.has_cover_image
    ? `/api/public/events/${event.slug}/cover?v=${encodeURIComponent(event.updated_at)}`
    : null;

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const updated = await api.post(`/events/${event.id}/cover`, formData);
      onChange(updated);
    } catch (err) {
      setError(err.message || 'Could not upload that photo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove this photo?')) return;
    const updated = await api.delete(`/events/${event.id}/cover`);
    onChange(updated);
  };

  return (
    <div className="cover-uploader">
      {coverUrl ? (
        <div className="cover-preview">
          <img src={coverUrl} alt="" />
          <div className="cover-preview-actions">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Change Photo'}
            </button>
            <button type="button" onClick={handleRemove} disabled={uploading}>
              <TrashIcon width={14} height={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="cover-dropzone" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImageIcon width={22} height={22} />
          {uploading ? 'Uploading…' : 'Add a photo for guests to see'}
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
