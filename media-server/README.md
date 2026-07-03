# Media Server (backup CDN for images + videos)

A tiny standalone Node/Express server you can drop on any hosting (cPanel Node.js app, VPS, Render, Railway, Fly, etc.) to store and serve uploaded media.

## Deploy

```bash
cd media-server
npm install
cp .env.example .env      # then set a strong API_KEY and your PUBLIC_BASE_URL
npm start
```

On **cPanel** → *Setup Node.js App*:
- Application root: `media-server`
- Startup file: `server.js`
- Add env vars from `.env.example`
- Run `npm install` from the cPanel UI, then Start.

Point a subdomain (e.g. `media.yourdomain.com`) at the app and set `PUBLIC_BASE_URL` to that URL.

## Endpoints

| Method | Path            | Auth | Purpose                             |
| ------ | --------------- | ---- | ----------------------------------- |
| GET    | `/health`       | no   | Health check                        |
| POST   | `/upload`       | yes  | multipart field `file`              |
| GET    | `/files/:name`  | no   | Serve the file (long cache)         |
| GET    | `/list`         | yes  | List all uploaded files             |
| DELETE | `/files/:name`  | yes  | Delete a file                       |

Send auth as header `x-api-key: <API_KEY>`.

## Upload from curl

```bash
curl -X POST https://media.yourdomain.com/upload \
  -H "x-api-key: $API_KEY" \
  -F "file=@./hero.mp4"
```

Response:
```json
{ "ok": true, "url": "https://media.yourdomain.com/files/1720000000-abcd.mp4", ... }
```

## Notes

- Default max file size: **200 MB** (override via `MAX_FILE_MB`).
- Allowed types: PNG/JPEG/GIF/WEBP/AVIF/SVG and MP4/WEBM/MOV/MKV.
- Files are stored on disk under `UPLOAD_DIR` — back that folder up with your normal hosting backups.
- Keep the `API_KEY` secret; anyone with it can upload/delete.
