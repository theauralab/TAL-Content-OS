import { removeCreative } from "@/app/(app)/actions/creatives";
import { formatBytes, mediaKind } from "@/lib/creatives";
import { ConfirmButton } from "@/components/common/confirm-button";

export type GalleryCreative = {
  id: string;
  round: number;
  kind: "FILE" | "LINK";
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  linkUrl: string | null;
  createdAt: Date;
};

const src = (id: string) => `/api/creatives/${id}`;

function Tile({ c, canRemove }: { c: GalleryCreative; canRemove: boolean }) {
  const kind = c.kind === "FILE" ? mediaKind(c.mimeType) : null;
  return (
    <figure className="overflow-hidden rounded-lg border border-neutral bg-background">
      {kind === "image" && (
        <a href={src(c.id)} target="_blank" rel="noreferrer" className="block">
          {/* Signed-URL redirect, so a plain <img> (not next/image) is the right tool. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(c.id)} alt={c.fileName} loading="lazy" className="max-h-96 w-full object-contain bg-white" />
        </a>
      )}
      {kind === "video" && <video controls preload="metadata" src={src(c.id)} className="max-h-[28rem] w-full bg-black" />}
      {(kind === "pdf" || c.kind === "LINK") && (
        <a href={src(c.id)} target="_blank" rel="noreferrer" className="flex h-32 items-center justify-center bg-white text-sm font-medium text-primary hover:text-secondary">
          {c.kind === "LINK" ? "Open link ↗" : "Open PDF ↗"}
        </a>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className="min-w-0 truncate text-primary" title={c.fileName}>{c.fileName}</span>
        <span className="flex shrink-0 items-center gap-3 text-primary/60">
          {c.sizeBytes ? <span>{formatBytes(c.sizeBytes)}</span> : null}
          {c.kind === "FILE" && <a href={`${src(c.id)}?download=1`} className="hover:text-primary hover:underline">Download</a>}
          {canRemove && (
            <form action={removeCreative}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton message={`Remove ${c.fileName}?`} className="text-danger hover:underline">Remove</ConfirmButton>
            </form>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/** Newest round first, each round in slide/frame order. Older rounds are kept for reference. */
export function CreativeGallery({ creatives, activeRound, canRemove }: { creatives: GalleryCreative[]; activeRound: number; canRemove: boolean }) {
  const rounds = [...new Set(creatives.map((c) => c.round))].sort((a, b) => b - a);
  if (rounds.length === 0) return <p className="text-sm text-primary/50">Nothing uploaded yet.</p>;
  return (
    <div className="space-y-5">
      {rounds.map((r) => {
        const list = creatives.filter((c) => c.round === r);
        const latest = r === rounds[0];
        return (
          <div key={r}>
            {(rounds.length > 1 || latest) && (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/60">
                Version {r}
                {latest && rounds.length > 1 ? " · latest" : ""}
              </h3>
            )}
            <div className={`grid gap-3 ${list.length > 1 ? "sm:grid-cols-2" : ""} ${latest ? "" : "opacity-70"}`}>
              {list.map((c) => <Tile key={c.id} c={c} canRemove={canRemove && r === activeRound} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
