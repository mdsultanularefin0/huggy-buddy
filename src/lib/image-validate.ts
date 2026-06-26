// Client-side validation and optimization for brand image uploads.

export type BrandKind = "logo" | "icon";

const RULES: Record<BrandKind, {
  types: string[];
  exts: string[];
  maxBytes: number;
  minSide: number;
  maxSide: number;
  aspect?: { ratio: number; tolerance: number }; // w/h
  targetMaxSide: number; // for downscaling
}> = {
  logo: {
    types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    exts: ["png", "jpg", "jpeg", "webp", "svg"],
    maxBytes: 2 * 1024 * 1024,
    minSide: 64,
    maxSide: 4096,
    targetMaxSide: 1024,
  },
  icon: {
    types: ["image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"],
    exts: ["png", "webp", "svg", "ico"],
    maxBytes: 512 * 1024,
    minSide: 64,
    maxSide: 2048,
    aspect: { ratio: 1, tolerance: 0.05 },
    targetMaxSide: 512,
  },
};

function ext(file: File) {
  return (file.name.split(".").pop() || "").toLowerCase();
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

async function downscale(img: HTMLImageElement, file: File, maxSide: number): Promise<File> {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1) return file;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas encode failed"))), mime, 0.92),
  );
  const newName = file.name.replace(/\.[^.]+$/, mime === "image/jpeg" ? ".jpg" : ".png");
  return new File([blob], newName, { type: mime });
}

export async function validateAndOptimizeBrandImage(kind: BrandKind, file: File): Promise<File> {
  const rule = RULES[kind];

  if (!rule.types.includes(file.type) && !rule.exts.includes(ext(file))) {
    throw new Error(`Unsupported file type. Allowed: ${rule.exts.join(", ").toUpperCase()}`);
  }
  if (file.size > rule.maxBytes) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max ${(rule.maxBytes / 1024 / 1024).toFixed(1)} MB.`);
  }

  // SVG: skip dimension/optimization checks.
  if (file.type === "image/svg+xml" || ext(file) === "svg") return file;
  // ICO: skip canvas processing (not decodable reliably).
  if (file.type.includes("icon") || ext(file) === "ico") return file;

  const img = await loadImage(file);

  if (Math.min(img.width, img.height) < rule.minSide) {
    throw new Error(`Image too small (${img.width}×${img.height}). Minimum ${rule.minSide}px per side.`);
  }
  if (Math.max(img.width, img.height) > rule.maxSide) {
    throw new Error(`Image too large (${img.width}×${img.height}). Maximum ${rule.maxSide}px per side.`);
  }
  if (rule.aspect) {
    const r = img.width / img.height;
    if (Math.abs(r - rule.aspect.ratio) > rule.aspect.tolerance) {
      throw new Error(`Aspect ratio must be ${rule.aspect.ratio === 1 ? "square (1:1)" : rule.aspect.ratio.toFixed(2)}. Got ${r.toFixed(2)}.`);
    }
  }

  return downscale(img, file, rule.targetMaxSide);
}
