import type { ContentType } from "@prisma/client";
import { FORMAT_BY_TYPE, FORMAT_META, buildPostText, type Script } from "@/lib/script";
import { CopyButton } from "./copy-button";

type PlanItem = {
  type: ContentType;
  caption: string | null;
  objective: string | null;
  script: Script;
  visualBrief: string | null;
  seoKeywords: string[];
  hashtags: string[];
  seoTitle: string | null;
  metaDescription: string | null;
  slug: string | null;
  body: string | null;
};

const card = "rounded-lg border border-neutral bg-white p-4";
const h = "mb-2 text-sm font-semibold text-primary";

// Read-only rendering of the planning pack. Used for clients and for roles that can't edit.
export function PlanView({ item }: { item: PlanItem }) {
  const fm = FORMAT_META[FORMAT_BY_TYPE[item.type]];
  const { script } = item;
  const hasScript = script.hook || script.cta || script.blocks.length > 0;
  const isArticle = FORMAT_BY_TYPE[item.type] === "article";

  return (
    <div className="space-y-4 text-sm text-primary">
      {item.objective && (
        <section className={card}>
          <h2 className={h}>Objective</h2>
          <p className="whitespace-pre-wrap">{item.objective}</p>
        </section>
      )}

      {hasScript && (
        <section className={card}>
          <h2 className={h}>{isArticle ? "Outline" : "Script"}</h2>
          {script.hook && (
            <p className="mb-3"><span className="font-medium">Hook: </span>{script.hook}</p>
          )}
          <ol className="space-y-3">
            {script.blocks.map((b, i) => (
              <li key={i} className="rounded-md bg-background p-3">
                <div className="mb-1 text-xs font-semibold">
                  {fm.blockLabel} {i + 1}
                  {b.title ? ` — ${b.title}` : ""}
                  {b.duration ? <span className="ml-2 font-normal text-primary/50">{b.duration}</span> : null}
                </div>
                {b.copy && <p className="whitespace-pre-wrap">{b.copy}</p>}
                {b.visual && <p className="mt-1 whitespace-pre-wrap text-xs text-primary/60">Visual: {b.visual}</p>}
              </li>
            ))}
          </ol>
          {script.cta && (
            <p className="mt-3"><span className="font-medium">CTA: </span>{script.cta}</p>
          )}
          {item.visualBrief && (
            <p className="mt-3 whitespace-pre-wrap text-xs text-primary/60">Direction: {item.visualBrief}</p>
          )}
        </section>
      )}

      {isArticle && (item.seoTitle || item.metaDescription || item.slug || item.body) && (
        <section className={card}>
          <h2 className={h}>Article</h2>
          {item.seoTitle && <p><span className="font-medium">SEO title: </span>{item.seoTitle}</p>}
          {item.metaDescription && <p><span className="font-medium">Meta: </span>{item.metaDescription}</p>}
          {item.slug && <p><span className="font-medium">Slug: </span>/{item.slug}</p>}
          {item.body && <div className="mt-3 whitespace-pre-wrap border-t border-neutral pt-3">{item.body}</div>}
        </section>
      )}

      <section className={card}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Caption</h2>
          {(item.caption || item.hashtags.length > 0) && (
            <CopyButton text={buildPostText(item.caption, item.hashtags)} label="Copy caption + hashtags" />
          )}
        </div>
        <div className="whitespace-pre-wrap">{item.caption || <span className="text-primary/50">No caption yet.</span>}</div>
        {item.hashtags.length > 0 && (
          <p className="mt-3 text-secondary">{item.hashtags.map((t) => `#${t}`).join(" ")}</p>
        )}
        {item.seoKeywords.length > 0 && (
          <p className="mt-3 text-xs text-primary/60">
            <span className="font-medium">Keywords: </span>
            {item.seoKeywords.join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
