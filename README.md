# Ringbook

A self-hosted voicemail guestbook. Guests leave a spoken message and it's saved
forever — like a wedding guestbook, but you can hear the laughter, the
"congrats!", the awkward pause before someone hangs up. Works for weddings,
birthdays, funerals, retirements, baby showers, reunions — any moment worth
keeping in people's own voices. No third-party service holding your
recordings; you run it, you own the memories.

Guests don't dial a phone number — they open a link or scan a QR code and
record a message right from their phone's browser microphone. One Docker
image runs the whole thing: the web app, the database, and audio processing.

## Features

- **Multiple guestbooks in one instance** — a wedding this year, a reunion in
  five — each with its own shareable link, greeting message, and recordings.
- **Works from any phone, no app required** — guests just open a link.
- **Recordings normalized to MP3** server-side (via ffmpeg) so playback and
  downloads work everywhere, regardless of whether the guest's browser
  recorded in webm/opus (Chrome/Firefox) or mp4/aac (Safari).
- **QR code generation** for printing or displaying at a venue.
- **Export a guestbook as a zip** of all its recordings — a permanent backup
  or keepsake.
- **Single admin login**, single SQLite database, single Docker volume —
  nothing else to run or manage.

## Quick start

```bash
git clone <this-repo> ringbook
cd ringbook
docker compose up -d --build
```

Every merge to `main` also publishes a ready-to-use image to
`ghcr.io/justinmpowers/ringbook:latest` — if you don't need to build it
yourself, point `docker-compose.yml`'s `image:` at that instead of `build: .`
and skip the clone entirely.

Edit `docker-compose.yml` first and set at least:

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login.
- `SESSION_SECRET` — a long random string (e.g. `openssl rand -hex 32`).
- `PUBLIC_BASE_URL` — the URL guests will actually reach this instance at
  (e.g. `https://guestbook.example.com`). This is embedded in the generated
  QR codes and shareable links, so it needs to be correct before you print
  anything.

Then visit `PUBLIC_BASE_URL/admin/login` (or `http://localhost:8080/admin/login`
if testing locally) to log in and create your first guestbook.

## HTTPS is required for guests to record

Browsers only allow microphone access (`getUserMedia`) on secure origins —
HTTPS, or `localhost`. Ringbook itself only serves plain HTTP; it's designed
to sit behind a reverse proxy (Caddy, Traefik, nginx, etc.) that terminates
TLS, which is how most self-hosted setups already work. Point your proxy at
the container's port `3000` and make sure `PUBLIC_BASE_URL` matches the
public HTTPS URL.

If you just want to try it out locally without a proxy, `http://localhost:8080`
works fine for recording since `localhost` is itself a secure context — it's
only non-`localhost` HTTP (e.g. a bare LAN IP) that browsers will block.

## Configuration

All configuration is via environment variables (set in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Admin login username. |
| `ADMIN_PASSWORD` | `changeme` | Admin login password. Change this. |
| `SESSION_SECRET` | *(insecure default)* | Secret used to sign the admin session cookie. Change this. |
| `PUBLIC_BASE_URL` | *(empty)* | Public URL of this instance, used to build QR codes and guest links. |
| `MAX_RECORDING_SECONDS` | `180` | Maximum length of a guest recording, enforced client- and server-side. |
| `MAX_UPLOAD_MB` | `50` | Maximum upload size for a single recording. |
| `PORT` | `3000` | Port the app listens on inside the container. |
| `DATA_DIR` | `/data` | Where the SQLite database and recordings are stored. |

## Data & backups

Everything Ringbook writes lives under the `/data` volume:

```
/data/ringbook.db          # event and recording metadata
/data/recordings/<id>/*.mp3
```

Back this up however you'd back up any Docker volume — the whole app's state
is these files. To restore, just mount a volume containing them at `/data`.

Each guestbook also has its own "Export All (.zip)" button in the admin UI,
which is a convenient one-off backup or keepsake independent of the volume.

## Using it

1. Log in at `/admin/login`.
2. Create a guestbook — give it a title, pick an occasion, and write a short
   greeting guests will see before recording.
3. Share the generated link or QR code — print it, put it on a table card,
   text it to remote guests, whatever fits the event.
4. Guests open the link, record a message (with an optional name), and submit.
5. Come back to the guestbook's admin page any time to listen, download
   individual messages, close the guestbook to new submissions, or export
   everything as a zip.

## Development

The image is a multi-stage build: a Vite/React frontend compiled to static
assets, and an Express backend that serves both the API and those assets.

```bash
cd backend && npm install && npm run dev    # API on :3000
cd frontend && npm install && npm run dev   # Vite dev server on :5173, proxies /api to :3000
```

`backend/src/db.js` creates the SQLite schema on startup — no separate
migration step. Rebuild the production image with `docker compose up -d --build`.

## License

GPL-2.0 — see [LICENSE](LICENSE).
