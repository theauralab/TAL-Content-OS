"use client";

import { useMemo, useState } from "react";
import type { ContentType } from "@prisma/client";
import { updateContent } from "@/app/(app)/actions/content";
import { TYPE_LABEL } from "@/lib/content";
import {
  CAPTION_LIMITS,
  FORMAT_BY_TYPE,
  FORMAT_META,
  HASHTAG_SOFT_LIMIT,
  buildPostText,
  cleanHashtag,
  cleanKeyword,
  slugify,
  type Script,
  type ScriptBlock,
} from "@/lib/script";
import { TagInput } from "./tag-input";
import { CopyButton } from "./copy-button";
import { SubmitButton } from "./submit-button";

export type EditorItem = {
  id: string;
  title: string;
  type: ContentType;
  scheduledFor: string; // yyyy-mm-dd or ""
  scheduledTime: string; // HH:mm or ""
  caption: string;
  objective: string;
  script: Script;
  visualBrief: string;
  cta: string;
  seoKeywords: string[];
  hashtags: string[];
  seoTitle: string;
  metaDescription: string;
  slug: string;
  body: string;
};

const input = "w-full rounded-md border border-neutral px-3 py-2 text-sm";
const card = "rounded-lg border border-neutral bg-white p-4";
const label = "mb-1 block text-xs font-medium text-primary/70";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "text-success" : "text-primary/50"}>
      {ok ? "✓" : "○"} {children}
    </li>
  );
}

const has = (haystack: string, needle: string) => !!needle && haystack.toLowerCase().includes(needle.toLowerCase());

export function ContentEditor({ item }: { item: EditorItem }) {
  const [title, setTitle] = useState(item.title);
  const [type, setType] = useState<ContentType>(item.type);
  const [caption, setCaption] = useState(item.caption);
  const [hook, setHook] = useState(item.script.hook);
  const [blocks, setBlocks] = useState<ScriptBlock[]>(item.script.blocks);
  const [scriptCta, setScriptCta] = useState(item.script.cta);
  const [keywords, setKeywords] = useState(item.seoKeywords);
  const [hashtags, setHashtags] = useState(item.hashtags);
  const [seoTitle, setSeoTitle] = useState(item.seoTitle);
  const [meta, setMeta] = useState(item.metaDescription);
  const [slug, setSlug] = useState(item.slug);
  const [body, setBody] = useState(item.body);

  const format = FORMAT_BY_TYPE[type];
  const fm = FORMAT_META[format];
  const isArticle = format === "article";
  const limit = CAPTION_LIMITS[type];
  const primary = keywords[0] ?? "";

  const scriptJson = useMemo(() => JSON.stringify({ hook, blocks, cta: scriptCta }), [hook, blocks, scriptCta]);
  const postText = buildPostText(caption, hashtags);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  const setBlock = (i: number, patch: Partial<ScriptBlock>) =>
    setBlocks((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form action={updateContent} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="script" value={scriptJson} />
      <input type="hidden" name="seoKeywords" value={JSON.stringify(keywords)} />
      <input type="hidden" name="hashtags" value={JSON.stringify(hashtags)} />

      {/* Basics */}
      <section className={`${card} grid gap-3`}>
        <div>
          <label className={label}>Title / hook line</label>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={input} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Format</label>
            <select name="type" value={type} onChange={(e) => setType(e.target.value as ContentType)} className={input}>
              {Object.entries(TYPE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Post date</label>
            <input type="date" name="scheduledFor" defaultValue={item.scheduledFor} className={input} />
          </div>
          <div>
            <label className={label}>Post time (orders stories within a day)</label>
            <input type="time" name="scheduledTime" defaultValue={item.scheduledTime} className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Objective — why are we posting this?</label>
          <input name="objective" defaultValue={item.objective} placeholder="e.g. Educate on sleep posture, drive to product page" className={input} />
        </div>
      </section>

      {/* Script */}
      <section className={card}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">{isArticle ? "Outline" : "Script"}</h2>
          <span className="text-xs text-primary/50">{fm.hint}</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label}>{format === "video" ? "Hook (first 3 seconds)" : format === "slides" ? "Cover hook" : "Hook / opening line"}</label>
            <input value={hook} onChange={(e) => setHook(e.target.value)} className={input} />
          </div>

          {blocks.map((b, i) => (
            <div key={i} className="rounded-md border border-neutral bg-background p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-primary">{fm.blockLabel} {i + 1}</span>
                <span className="flex gap-2 text-primary/60">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-primary disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="hover:text-primary disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => setBlocks((bs) => bs.filter((_, idx) => idx !== i))} className="hover:text-danger" aria-label="Remove">Remove</button>
                </span>
              </div>
              <div className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                  <input value={b.title} onChange={(e) => setBlock(i, { title: e.target.value })} placeholder={`${fm.blockLabel} title`} className={input} />
                  {fm.showDuration && (
                    <input value={b.duration} onChange={(e) => setBlock(i, { duration: e.target.value })} placeholder="e.g. 0:03" className={input} />
                  )}
                </div>
                <textarea value={b.copy} onChange={(e) => setBlock(i, { copy: e.target.value })} rows={2} placeholder={fm.copyLabel} className={input} />
                <textarea value={b.visual} onChange={(e) => setBlock(i, { visual: e.target.value })} rows={1} placeholder={fm.visualLabel} className={input} />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setBlocks((bs) => [...bs, { title: "", copy: "", visual: "", duration: "" }])}
            className="rounded-md border border-dashed border-secondary px-3 py-1.5 text-sm text-primary hover:bg-background"
          >
            + {fm.addLabel}
          </button>

          <div>
            <label className={label}>Call to action</label>
            <input value={scriptCta} onChange={(e) => setScriptCta(e.target.value)} placeholder="e.g. Tap the link in bio to book" className={input} />
          </div>
          <div>
            <label className={label}>Design / shoot direction</label>
            <textarea name="visualBrief" defaultValue={item.visualBrief} rows={2} placeholder="Overall look, references, props, location, music…" className={input} />
          </div>
        </div>
      </section>

      {/* Blog */}
      {isArticle && (
        <section className={`${card} grid gap-3`}>
          <h2 className="text-sm font-semibold text-primary">Article</h2>
          <div>
            <label className={label}>SEO title <span className="text-primary/40">({seoTitle.length}/60)</span></label>
            <input name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Meta description <span className="text-primary/40">({meta.length}/160)</span></label>
            <textarea name="metaDescription" value={meta} onChange={(e) => setMeta(e.target.value)} rows={2} className={input} />
          </div>
          <div>
            <label className={label}>URL slug</label>
            <div className="flex gap-2">
              <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={input} />
              <button type="button" onClick={() => setSlug(slugify(seoTitle || title))} className="shrink-0 rounded-md border border-neutral px-3 text-xs hover:border-secondary">
                From title
              </button>
            </div>
          </div>
          <div>
            <label className={label}>Body <span className="text-primary/40">({words} words)</span></label>
            <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={16} className={`${input} font-mono`} />
          </div>
        </section>
      )}

      {/* Caption + SEO + hashtags */}
      <section className={`${card} grid gap-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">{isArticle ? "Promo caption & SEO" : "Caption, SEO & hashtags"}</h2>
          <CopyButton text={postText} label="Copy caption + hashtags" />
        </div>
        <div>
          <label className={label}>
            Caption
            {limit ? <span className={`ml-2 ${caption.length > limit ? "text-danger" : "text-primary/40"}`}>{caption.length}/{limit}</span> : null}
          </label>
          <textarea name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} className={input} />
        </div>
        <div>
          <label className={label}>SEO keywords <span className="text-primary/40">— first one is the primary keyword</span></label>
          <TagInput values={keywords} onChange={setKeywords} clean={cleanKeyword} placeholder="Type a keyword, press Enter" />
          {primary && (
            <ul className="mt-2 space-y-0.5 text-xs">
              <Check ok={has(title, primary)}>Primary keyword in title</Check>
              <Check ok={has(caption.slice(0, 125), primary)}>Primary keyword in the first line of the caption</Check>
              {isArticle && <Check ok={has(seoTitle, primary)}>Primary keyword in SEO title</Check>}
              {isArticle && <Check ok={has(meta, primary)}>Primary keyword in meta description</Check>}
              {isArticle && <Check ok={has(slug, primary.toLowerCase().replace(/\s+/g, "-"))}>Primary keyword in slug</Check>}
              {isArticle && <Check ok={has(body, primary)}>Primary keyword in body</Check>}
            </ul>
          )}
        </div>
        <div>
          <label className={label}>Hashtags</label>
          <TagInput values={hashtags} onChange={setHashtags} prefix="#" clean={cleanHashtag} placeholder="#skincare, #glowup — paste a whole list" softLimit={HASHTAG_SOFT_LIMIT[type]} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>Save changes</SubmitButton>
        <span className="text-xs text-primary/50">Every save keeps a version you can look back at.</span>
      </div>
    </form>
  );
}
