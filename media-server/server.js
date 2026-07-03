/**
 * Standalone Media Upload Server (images + videos)
 * ------------------------------------------------
 * Deploy this on your own hosting (cPanel Node app, VPS, Render, Railway, etc.)
 * as a backup CDN for your storefront.
 *
 * Endpoints:
 *   POST   /upload         -> multipart/form-data, field "file" (requires API key)
 *   GET    /files/:name    -> serves the uploaded file
 *   GET    /list           -> JSON list of uploaded files (requires API key)
 *   DELETE /files/:name    -> delete a file (requires API key)
 *   GET    /health         -> { ok: true }
 *
 * Install:
 *   cd media-server
 *   npm install
 *   cp .env.example .env   # then edit API_KEY
 *   node server.js
 */

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || "change-me";
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 200); // 200 MB default (video-friendly)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|video\/(mp4|webm|quicktime|x-matroska))$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

// --- storage ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = crypto.randomBytes(12).toString("hex");
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// --- auth middleware ---
function requireKey(req, res, next) {
  const key = req.header("x-api-key") || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// --- routes ---
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/upload", requireKey, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided (field name: 'file')" });
  const url = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/files/${req.file.filename}`;
  res.json({
    ok: true,
    filename: req.file.filename,
    size: req.file.size,
    mime: req.file.mimetype,
    url,
  });
});

app.get("/list", requireKey, (_req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).map((name) => {
    const stat = fs.statSync(path.join(UPLOAD_DIR, name));
    return {
      name,
      size: stat.size,
      created: stat.birthtime,
      url: `${PUBLIC_BASE_URL.replace(/\/$/, "")}/files/${name}`,
    };
  });
  res.json({ count: files.length, files });
});

app.delete("/files/:name", requireKey, (req, res) => {
  const target = path.join(UPLOAD_DIR, path.basename(req.params.name));
  if (!fs.existsSync(target)) return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(target);
  res.json({ ok: true });
});

// public serving with long-cache headers
app.use(
  "/files",
  express.static(UPLOAD_DIR, {
    maxAge: "365d",
    immutable: true,
    fallthrough: false,
  }),
);

// error handler
app.use((err, _req, res, _next) => {
  console.error("[media-server]", err.message);
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[media-server] listening on :${PORT}`);
  console.log(`[media-server] upload dir: ${UPLOAD_DIR}`);
  console.log(`[media-server] public base: ${PUBLIC_BASE_URL}`);
});
