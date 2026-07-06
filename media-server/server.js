/**
 * Standalone Media Upload Server (images + videos)
 * ------------------------------------------------
 * Auto-transcodes big/high-bitrate videos above configured thresholds
 * (default: > 1080p OR > 8 Mbps) down to 1080p H.264 ~5 Mbps.
 *
 * Endpoints:
 *   POST   /upload         -> multipart/form-data, field "file" (requires API key)
 *   GET    /files/:name    -> serves the uploaded/transcoded file
 *   GET    /list           -> JSON list of uploaded files (requires API key)
 *   DELETE /files/:name    -> delete a file (requires API key)
 *   GET    /health         -> { ok: true }
 */

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
require("dotenv").config();

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || "change-me";
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 500);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Video transcode thresholds — anything above these gets downscaled/re-encoded
const MAX_HEIGHT = Number(process.env.MAX_HEIGHT || 1080);         // 1080p cap
const MAX_BITRATE_KBPS = Number(process.env.MAX_BITRATE_KBPS || 8000); // 8 Mbps cap
const TARGET_BITRATE = process.env.TARGET_BITRATE || "5000k";      // encode target
const TARGET_AUDIO_BITRATE = process.env.TARGET_AUDIO_BITRATE || "128k";

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|video\/(mp4|webm|quicktime|x-matroska))$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

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

function requireKey(req, res, next) {
  const key = req.header("x-api-key") || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// --- video helpers ---
function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function transcode(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .audioBitrate(TARGET_AUDIO_BITRATE)
      .videoBitrate(TARGET_BITRATE)
      .outputOptions([
        `-vf scale=-2:'min(${MAX_HEIGHT},ih)'`, // cap height, keep aspect, even width
        "-preset veryfast",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
      ])
      .on("end", () => resolve())
      .on("error", reject)
      .save(outputPath);
  });
}

async function maybeTranscodeVideo(file) {
  try {
    const info = await probe(file.path);
    const v = (info.streams || []).find((s) => s.codec_type === "video");
    if (!v) return { transcoded: false, reason: "no video stream" };

    const height = v.height || 0;
    const bitrateKbps = Math.round(Number(info.format?.bit_rate || 0) / 1000);
    const ext = path.extname(file.filename).toLowerCase();
    const webFriendly = ext === ".mp4" || ext === ".webm";
    const tooTall = height > MAX_HEIGHT;
    const tooFat = bitrateKbps > MAX_BITRATE_KBPS;

    if (webFriendly && !tooTall && !tooFat) {
      return { transcoded: false, height, bitrateKbps };
    }

    const outName = path.basename(file.filename, path.extname(file.filename)) + ".mp4";
    const outPath = path.join(UPLOAD_DIR, outName);
    console.log(
      `[transcode] ${file.filename} height=${height} bitrate=${bitrateKbps}kbps -> ${outName}`,
    );
    await transcode(file.path, outPath);

    // Replace original with transcoded output (unless same name already)
    if (outPath !== file.path) fs.unlinkSync(file.path);
    const stat = fs.statSync(outPath);

    return {
      transcoded: true,
      filename: outName,
      size: stat.size,
      originalHeight: height,
      originalBitrateKbps: bitrateKbps,
    };
  } catch (err) {
    console.error("[transcode] failed:", err.message);
    return { transcoded: false, error: err.message };
  }
}

// --- routes ---
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/upload", requireKey, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided (field name: 'file')" });

  let filename = req.file.filename;
  let size = req.file.size;
  let transcodeInfo = null;

  if (req.file.mimetype.startsWith("video/")) {
    const result = await maybeTranscodeVideo(req.file);
    if (result.transcoded) {
      filename = result.filename;
      size = result.size;
    }
    transcodeInfo = result;
  }

  const url = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/files/${filename}`;
  res.json({
    ok: true,
    filename,
    size,
    mime: req.file.mimetype,
    url,
    transcode: transcodeInfo,
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

app.use(
  "/files",
  express.static(UPLOAD_DIR, {
    maxAge: "365d",
    immutable: true,
    fallthrough: false,
  }),
);

app.use((err, _req, res, _next) => {
  console.error("[media-server]", err.message);
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[media-server] listening on :${PORT}`);
  console.log(`[media-server] upload dir: ${UPLOAD_DIR}`);
  console.log(`[media-server] transcode: >${MAX_HEIGHT}p or >${MAX_BITRATE_KBPS}kbps -> ${TARGET_BITRATE}`);
});
