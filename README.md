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
  five — each with its own shareable link, greeting message, cover photo, and
  recordings.
- **Works from any phone, no app required** — guests just open a link.
- **Recordings normalized to MP3** server-side (via ffmpeg) so playback and
  downloads work everywhere, regardless of whether the guest's browser
  recorded in webm/opus (Chrome/Firefox) or mp4/aac (Safari).
- **Local, offline speech-to-text transcripts** (via bundled whisper.cpp) —
  every message gets an automatic, searchable transcript. No third-party API
  ever sees your recordings.
- **QR code generation and a printable table card (PDF)** for displaying at a venue.
- **Auto-generated highlight reel** — one click to concatenate every message
  in a guestbook into a single shareable audio file.
- **Export a guestbook as a zip** of all its recordings — a permanent backup
  or keepsake.
- **Optional public listen-only album page**, off by default per guestbook,
  for sharing the whole collection with anyone who couldn't attend.
- **Webhook notifications** (ntfy, Discord, Slack, or any custom endpoint)
  when a guest leaves a message.
- **Scheduled auto-close** — set a date/time a guestbook stops accepting
  messages, instead of only a manual toggle.
- **Multiple admin accounts**, each scoped to only the guestbooks they created.
- **Rate limiting, security headers, and CSRF protection** on by default.
- Single SQLite database, single Docker volume — nothing else to run or manage.

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
`ADMIN_USERNAME`/`ADMIN_PASSWORD` are only used once, to seed that first admin
account on first boot — from then on, accounts live in the database, and you
can add more from the "Manage Admins" link on the dashboard (each admin only
sees the guestbooks they created).

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
| `ADMIN_USERNAME` | `admin` | Username used to seed the first admin account on first boot only. |
| `ADMIN_PASSWORD` | `changeme` | Password for that first-boot admin account. Change this. |
| `SESSION_SECRET` | *(insecure default)* | Secret used to sign the admin session cookie. Change this. |
| `PUBLIC_BASE_URL` | *(empty)* | Public URL of this instance, used to build QR codes and guest links. |
| `MAX_RECORDING_SECONDS` | `180` | Maximum length of a guest recording, enforced client- and server-side. |
| `MAX_UPLOAD_MB` | `50` | Maximum upload size for a single recording. |
| `MAX_COVER_UPLOAD_MB` | `20` | Maximum upload size for a guestbook cover photo. |
| `TRUST_PROXY` | `false` | Set to `true` if running behind a reverse proxy. This isn't just about rate limiting: it's also what lets the app trust `X-Forwarded-Proto`, which the admin session cookie needs to correctly mark itself HTTPS-only. Leave `false` only for local testing without a proxy (e.g. `http://localhost:8080`). |
| `ENABLE_TRANSCRIPTION` | `true` | Set to `false` to skip local speech-to-text (the whisper.cpp binary/model still ship in the image either way; this just turns the feature off). |
| `PORT` | `3000` | Port the app listens on inside the container. |
| `DATA_DIR` | `/data` | Where the SQLite database and recordings are stored. |

Build-time only (`docker build --build-arg ...`, for anyone building their own image):

| Build arg | Default | Description |
|---|---|---|
| `WHISPER_MODEL` | `base.en` | Which whisper.cpp model to bundle. Larger models (`small.en`, `medium.en`) trade image size and CPU time for better accuracy. |
| `WHISPER_VERSION` | `v1.9.1` | Pinned whisper.cpp release to build from source. |

## Data & backups

Everything Ringbook writes lives under the `/data` volume:

```
/data/ringbook.db          # event and recording metadata
/data/recordings/<id>/*.mp3
```

Back this up however you'd back up any Docker volume — the whole app's state
is these files. To restore, just mount a volume containing them at `/data`.

Each guestbook also has its own "Export All (.zip)" and "Highlight Reel"
buttons in the admin UI, both convenient one-off backups or keepsakes
independent of the volume.

### Upgrading from an image built before the container ran as non-root

The app now runs as the non-root `node` user (uid/gid `1000`) inside the
container. If your `/data` volume was created by an older image, its files
are still owned by `root` and the app will fail to start with a
`SQLITE_READONLY` error. Fix it once with:

```
docker run --rm -v <your_data_volume>:/data alpine chown -R 1000:1000 /data
```

Fresh volumes created by the current image already get the correct
ownership automatically.

## Using it

1. Log in at `/admin/login`.
2. Create a guestbook — give it a title, pick an occasion, and write a short
   greeting guests will see before recording. Optionally add a cover photo,
   a webhook to get notified of new messages, and a date to auto-close it.
3. Share the generated link, QR code, or printable table card PDF — put it
   on a table, text it to remote guests, whatever fits the event.
4. Guests open the link, record a message (with an optional name), and submit.
5. Come back to the guestbook's admin page any time to listen, read
   auto-generated transcripts, search messages, download individual
   recordings, close the guestbook to new submissions, download a highlight
   reel or zip export, or turn on the public listen-only album page to share
   the whole collection with people who couldn't attend.

## Local speech-to-text transcripts

Every recording gets an automatic transcript, generated entirely on your own
hardware by a bundled [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
binary and the `base.en` model (~142MB) — no audio or text ever leaves your
server. This is the one place Ringbook trades image size (~150MB extra) and
some CPU time for a feature; it's on by default but can be turned off with
`ENABLE_TRANSCRIPTION=false` if you'd rather not pay that cost. Transcription
runs as a single background job at a time, so it won't compete with
in-flight audio processing on a small box (Raspberry Pi, small VPS) — expect
a few seconds of processing per message on modest hardware, not instant.

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
