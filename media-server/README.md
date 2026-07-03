# Media Server (backup CDN for images + videos)

A tiny standalone Node/Express server you can drop on any hosting (cPanel Node.js app, VPS, Render, Railway, Fly, etc.) to store and serve uploaded media. Auto-transcodes oversized videos (>1080p or >8 Mbps) down to 1080p H.264 ~5 Mbps.

---

## Deploy on cPanel (Node.js Selector / Passenger)

Your hosting plan needs: **Node.js 18+**, **SSH access**, and **outbound HTTPS**.

### 1. Upload the folder

Upload the whole `media-server/` directory to your home dir (e.g. `~/media-server`) — **not** inside `public_html`. Use File Manager (zip → upload → extract) or SSH/rsync.

### 2. Create the Node.js app

cPanel → **Setup Node.js App** → **Create Application**:

| Field | Value |
|---|---|
| Node.js version | 18.x or higher |
| Application mode | Production |
| Application root | `media-server` |
| Application URL | e.g. `media.yourdomain.com` (create the subdomain first) |
| Application startup file | `server.js` |

Click **Create**.

### 3. Install dependencies

cPanel shows a "Run NPM Install" button — click it. Or via SSH:

```bash
source /home/USER/nodevenv/media-server/18/bin/activate && cd ~/media-server
npm install --omit=dev
```

### 4. Environment variables

In the same Node.js App page → **Environment variables**, add (from `.env.example`):

```
API_KEY=<long random string>
UPLOAD_DIR=/home/USER/media-server/uploads
PUBLIC_BASE_URL=https://media.yourdomain.com
MAX_FILE_MB=500
MAX_HEIGHT=1080
MAX_BITRATE_KBPS=8000
TARGET_BITRATE=5000k
TARGET_AUDIO_BITRATE=128k
```

Do **not** set `PORT` — Passenger injects it. Then click **Save** and **Restart**.

### 5. Enable SSL

cPanel → **SSL/TLS Status** → **Run AutoSSL** for `media.yourdomain.com`.

### 6. Test

```bash
curl https://media.yourdomain.com/health
# → {"ok":true}

curl -X POST https://media.yourdomain.com/upload \
  -H "x-api-key: $API_KEY" \
  -F "file=@./hero.mp4"
```

---

## Common cPanel gotchas

- **`ffmpeg-static` fails with EACCES / ENOENT** — the bundled binary lost the execute bit during upload. SSH in and run:
  ```bash
  chmod +x ~/media-server/node_modules/ffmpeg-static/ffmpeg
  chmod +x ~/media-server/node_modules/ffprobe-static/bin/linux/x64/ffprobe
  ```
  Then restart the app. Prefer running `npm install` **on the server** (step 3) rather than uploading `node_modules` from your laptop, so the correct Linux x64 binaries are fetched.

- **413 Payload Too Large** — cPanel's front-end nginx/apache caps upload size. Ask your host to raise `client_max_body_size` (nginx) or `LimitRequestBody` (apache) on the subdomain, or lower `MAX_FILE_MB`.

- **Uploads succeed but `/files/...` 404s** — `UPLOAD_DIR` was relative and Passenger's CWD differs from your SSH shell. Set `UPLOAD_DIR` to an absolute path like `/home/USER/media-server/uploads`.

- **Transcoding runs forever / kills the process** — shared hosting CPU/RAM limits. Lower `TARGET_BITRATE` (e.g. `2500k`) and `MAX_HEIGHT` (e.g. `720`), or upgrade the plan.

- **"Application failed to start"** — check `~/media-server/stderr.log` or cPanel → **Errors**. Usually a missing env var or `npm install` never ran.

- **Files disappear after restart** — you set `UPLOAD_DIR` inside a temp path. Keep it under your home dir so cPanel backups cover it.

---

## Endpoints

| Method | Path            | Auth | Purpose                             |
| ------ | --------------- | ---- | ----------------------------------- |
| GET    | `/health`       | no   | Health check                        |
| POST   | `/upload`       | yes  | multipart field `file`              |
| GET    | `/files/:name`  | no   | Serve the file (long cache)         |
| GET    | `/list`         | yes  | List all uploaded files             |
| DELETE | `/files/:name`  | yes  | Delete a file                       |

Auth header: `x-api-key: <API_KEY>`. Keep the key secret — it grants upload + delete.

## Local dev

```bash
cd media-server
npm install
cp .env.example .env      # set API_KEY + PUBLIC_BASE_URL
npm start
```
