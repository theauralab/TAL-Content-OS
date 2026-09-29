import { describe, expect, it } from "vitest";
import { buildStorageKey, keyBelongsTo, mediaKind, parseHttpUrl, safeFileName, validateUpload } from "@/lib/creatives";

const MB = 1024 * 1024;

describe("validateUpload", () => {
  it("accepts supported types within their limits", () => {
    expect(validateUpload({ mimeType: "video/mp4", size: 300 * MB })).toBeNull();
    expect(validateUpload({ mimeType: "image/png", size: 2 * MB })).toBeNull();
    expect(validateUpload({ mimeType: "application/pdf", size: 10 * MB })).toBeNull();
  });
  it("rejects executables, scripts and svg (script-capable)", () => {
    for (const t of ["application/x-msdownload", "text/html", "image/svg+xml", "application/javascript", ""]) {
      expect(validateUpload({ mimeType: t, size: 1000 }), t).not.toBeNull();
    }
  });
  it("enforces size limits per kind and rejects empty files", () => {
    expect(validateUpload({ mimeType: "image/jpeg", size: 26 * MB })).toMatch(/limit/);
    expect(validateUpload({ mimeType: "video/mp4", size: 1025 * MB })).toMatch(/limit/);
    expect(validateUpload({ mimeType: "video/mp4", size: 0 })).toMatch(/empty/);
    expect(validateUpload({ mimeType: "video/mp4", size: NaN })).not.toBeNull();
  });
  it("classifies media", () => {
    expect(mediaKind("video/quicktime")).toBe("video");
    expect(mediaKind("image/webp")).toBe("image");
    expect(mediaKind("text/plain")).toBeNull();
  });
});

describe("storage keys", () => {
  it("sanitises file names so they can't escape the folder", () => {
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("../../etc/passwd")).not.toContain("..");
    expect(safeFileName("My Reel (final) v2.mp4")).toBe("My-Reel-final-v2.mp4");
    expect(safeFileName("***")).toBe("file");
  });
  it("builds a key inside the content item's folder", () => {
    const key = buildStorageKey("c123", 2, "01 cover.png", "ab12");
    expect(key).toBe("content/c123/r2/ab12-01-cover.png");
    expect(keyBelongsTo("c123", key)).toBe(true);
  });
  it("refuses keys that belong to another item or use traversal", () => {
    expect(keyBelongsTo("c123", "content/c999/r1/x.png")).toBe(false);
    expect(keyBelongsTo("c123", "content/c123/../c999/x.png")).toBe(false);
    expect(keyBelongsTo("c123", "other/c123/x.png")).toBe(false);
    expect(keyBelongsTo("c123", "content/c123/" + "a".repeat(400))).toBe(false);
  });
});

describe("parseHttpUrl", () => {
  it("only allows http(s) links — no javascript: or data: URLs", () => {
    expect(parseHttpUrl("https://drive.google.com/file/d/1")).toContain("https://drive.google.com");
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/html,<script>")).toBeNull();
    expect(parseHttpUrl("not a url")).toBeNull();
  });
});
