import type { ContentType } from "@prisma/client";
import { FORMAT_BY_TYPE, type ScriptFormat } from "@/lib/script";

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = { video: 1024 * MB, image: 25 * MB, pdf: 50 * MB } as const;

const MIME_KIND: Record<string, keyof typeof UPLOAD_LIMITS> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "application/pdf": "pdf",
};

export const ACCEPT_ATTR = Object.keys(MIME_KIND).join(",");

export const mediaKind = (mime: string | null | undefined): keyof typeof UPLOAD_LIMITS | null => (mime ? (MIME_KIND[mime] ?? null) : null);

/** Returns an error message, or null when the file is acceptable. */
export function validateUpload(p: { mimeType: string; size: number }): string | null {
  const kind = mediaKind(p.mimeType);
  if (!kind) return "That file type isn't supported. Use JPG, PNG, WebP, GIF, MP4, MOV, WebM or PDF.";
  if (!Number.isFinite(p.size) || p.size <= 0) return "That file is empty.";
  if (p.size > UPLOAD_LIMITS[kind]) return `That ${kind} is over the ${UPLOAD_LIMITS[kind] / MB} MB limit.`;
  return null;
}

export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").replace(/\.{2,}/g, ".").slice(-120);
  return cleaned || "file";
}

export function buildStorageKey(contentId: string, round: number, fileName: string, id: string) {
  return `content/${contentId}/r${round}/${id}-${safeFileName(fileName)}`;
}

/** A client-supplied key must belong to this content item — never trust it blindly. */
export const keyBelongsTo = (contentId: string, key: string) =>
  key.startsWith(`content/${contentId}/`) && !key.includes("..") && key.length < 300;

export function parseHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const CREATIVE_HINT: Record<ScriptFormat, string> = {
  video: "Upload the finished video (MP4 / MOV / WebM, up to 1 GB). Reels and Shorts are 9:16.",
  slides: "Upload each slide as an image. Name them 01, 02, 03… — they're placed in that order.",
  frames: "Upload one image or video per story frame, named in posting order (01, 02…).",
  post: "Upload the final image (or a PDF) for this post.",
  article: "Optional: upload the hero image or the formatted document.",
};

export const creativeHint = (t: ContentType) => CREATIVE_HINT[FORMAT_BY_TYPE[t]];

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n >= 1024 * MB) return `${(n / (1024 * MB)).toFixed(1)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
