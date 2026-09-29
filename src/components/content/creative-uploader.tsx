"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCreativeLink, prepareCreativeUpload, registerCreative, type CreativeResult } from "@/app/(app)/actions/creatives";
import { ACCEPT_ATTR, formatBytes, validateUpload } from "@/lib/creatives";

type Row = { key: string; name: string; size: number; state: "queued" | "uploading" | "done" | "error"; pct: number; error?: string };

// Some browsers report "" for .mov/.mp4 — fall back to the extension.
const EXT_MIME: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" };
const mimeOf = (f: File) => f.type || EXT_MIME[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

function putWithProgress(url: string, file: File, mime: string, onPct: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload was rejected (${xhr.status}). Check the R2 bucket's CORS settings.`)));
    xhr.onerror = () => reject(new Error("Network error during upload. If this keeps happening, check the R2 bucket's CORS settings."));
    xhr.send(file);
  });
}

export function CreativeUploader({ contentId, hint, storageReady }: { contentId: string; hint: string; storageReady: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [link, linkAction, linkPending] = useActionState<CreativeResult, FormData>(addCreativeLink, null);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function start(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    // 01, 02, 03… uploads in name order, so carousel slides and story frames land in the right sequence.
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const queued = list.map((f, i) => ({ key: `${Date.now()}-${i}`, file: f }));
    setRows(queued.map(({ key, file }) => ({ key, name: file.name, size: file.size, state: "queued", pct: 0 })));
    setBusy(true);

    for (const { key, file } of queued) {
      const mime = mimeOf(file);
      const bad = validateUpload({ mimeType: mime, size: file.size });
      if (bad) { patch(key, { state: "error", error: bad }); continue; }
      try {
        patch(key, { state: "uploading" });
        const prep = await prepareCreativeUpload({ contentId, fileName: file.name, mimeType: mime, size: file.size });
        if (!prep.ok) throw new Error(prep.message);
        await putWithProgress(prep.uploadUrl, file, mime, (pct) => patch(key, { pct }));
        const reg = await registerCreative({ contentId, storageKey: prep.storageKey, fileName: file.name, mimeType: mime });
        if (!reg?.ok) throw new Error(reg?.message ?? "Couldn't save the upload");
        patch(key, { state: "done", pct: 100 });
      } catch (e) {
        patch(key, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-primary/70">{hint}</p>

      {storageReady ? (
        <div>
          <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral bg-background px-4 py-6 text-center hover:border-secondary ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <span className="font-medium text-primary">{busy ? "Uploading…" : "Choose files to upload"}</span>
            <span className="text-xs text-primary/50">Images, MP4/MOV/WebM video, PDF — select several at once for a carousel</span>
            <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} disabled={busy} onChange={(e) => start(e.target.files)} className="sr-only" />
          </label>
        </div>
      ) : (
        <p role="note" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          File uploads need Cloudflare R2 to be configured (R2_* variables). Until then, add the creative as a link below.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {rows.map((r) => (
            <li key={r.key} className="rounded-md border border-neutral bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{r.name} <span className="text-primary/50">{formatBytes(r.size)}</span></span>
                <span className={`shrink-0 text-xs ${r.state === "error" ? "text-danger" : r.state === "done" ? "text-success" : "text-primary/60"}`}>
                  {r.state === "queued" && "Waiting"}
                  {r.state === "uploading" && `${r.pct}%`}
                  {r.state === "done" && "✓ Done"}
                  {r.state === "error" && "Failed"}
                </span>
              </div>
              {r.state === "uploading" && (
                <div className="mt-1.5 h-1 overflow-hidden rounded bg-neutral" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-secondary transition-all" style={{ width: `${r.pct}%` }} />
                </div>
              )}
              {r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-md border border-neutral bg-white px-3 py-2" open={!storageReady}>
        <summary className="cursor-pointer text-primary/80">Or add a link (Google Drive, Frame.io, Dropbox…)</summary>
        <form action={linkAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <input type="hidden" name="id" value={contentId} />
          <input name="url" type="url" required placeholder="https://…" aria-label="Link" className="rounded-md border border-neutral px-3 py-2" />
          <input name="label" placeholder="Label (optional)" aria-label="Label" className="rounded-md border border-neutral px-3 py-2" />
          <button type="submit" disabled={linkPending} className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-60">{linkPending ? "Adding…" : "Add link"}</button>
        </form>
        {link && <p role="status" className={`mt-2 text-xs ${link.ok ? "text-success" : "text-danger"}`}>{link.message}</p>}
      </details>
    </div>
  );
}
