export default function QRCodeDisplay({ eventId, altText }) {
  return (
    <img
      className="qr-code"
      src={`/api/events/${eventId}/qrcode.png`}
      alt={altText || 'QR code linking to the guestbook'}
      width={200}
      height={200}
    />
  );
}
