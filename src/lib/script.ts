import { z } from "zod";
import type { ContentType } from "@prisma/client";

/**
 * A content "script" is a hook + ordered blocks + CTA. The block label changes by format
 * (Scene / Slide / Frame / Section) but the shape is the same, so one editor covers everything.
 */
export type ScriptFormat = "video" | "slides" | "frames" | "article" | "post";

export const FORMAT_BY_TYPE: Record<ContentType, ScriptFormat> = {
  INSTAGRAM_REEL: "video",
  YOUTUBE_VIDEO: "video",
  YOUTUBE_SHORTS: "video",
  INSTAGRAM_CAROUSEL: "slides",
  PINTEREST_PIN: "post",
  INSTAGRAM_STORY: "frames",
  INSTAGRAM_STATIC: "post",
  FACEBOOK_POST: "post",
  LINKEDIN_POST: "post",
  GOOGLE_BUSINESS_POST: "post",
  REDDIT_CONTENT: "post",
  QUORA_CONTENT: "post",
  BLOG: "article",
  EMAIL_CAMPAIGN: "article",
};

export const FORMAT_META: Record<
  ScriptFormat,
  { blockLabel: string; addLabel: string; copyLabel: string; visualLabel: string; showDuration: boolean; hint: string }
> = {
  video: {
    blockLabel: "Scene",
    addLabel: "Add scene",
    copyLabel: "Voiceover / on-screen text",
    visualLabel: "Visual / shot",
    showDuration: true,
    hint: "Hook first (first 3 seconds), then scenes, then CTA.",
  },
  slides: {
    blockLabel: "Slide",
    addLabel: "Add slide",
    copyLabel: "Slide text",
    visualLabel: "Design note",
    showDuration: false,
    hint: "Slide 1 is the cover hook. Last slide is the CTA.",
  },
  frames: {
    blockLabel: "Frame",
    addLabel: "Add frame",
    copyLabel: "Text on frame",
    visualLabel: "Visual / sticker (poll, quiz, link)",
    showDuration: false,
    hint: "One frame per story tile, in posting order.",
  },
  article: {
    blockLabel: "Section",
    addLabel: "Add section",
    copyLabel: "Section outline / talking points",
    visualLabel: "Image / graphic",
    showDuration: false,
    hint: "Use sections for the outline (H2s). Write the full text in the body below.",
  },
  post: {
    blockLabel: "Point",
    addLabel: "Add point",
    copyLabel: "Talking point",
    visualLabel: "Visual note",
    showDuration: false,
    hint: "Optional for simple posts. Use the caption for the final copy.",
  },
};

export const isVideoType = (t: ContentType) => FORMAT_BY_TYPE[t] === "video";
export const isArticleType = (t: ContentType) => FORMAT_BY_TYPE[t] === "article";

export const blockSchema = z.object({
  title: z.string().trim().max(200).default(""),
  copy: z.string().trim().max(4000).default(""),
  visual: z.string().trim().max(2000).default(""),
  duration: z.string().trim().max(20).default(""),
});

export const scriptSchema = z.object({
  hook: z.string().trim().max(500).default(""),
  blocks: z.array(blockSchema).max(40).default([]),
  cta: z.string().trim().max(500).default(""),
});

export type ScriptBlock = z.infer<typeof blockSchema>;
export type Script = z.infer<typeof scriptSchema>;

export const emptyScript = (): Script => ({ hook: "", blocks: [], cta: "" });

/** Safely read the Json column back into a Script. */
export function readScript(value: unknown): Script {
  const parsed = scriptSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyScript();
}

export function isScriptEmpty(s: Script) {
  return !s.hook && !s.cta && s.blocks.every((b) => !b.title && !b.copy && !b.visual);
}

/** "  #Skin Care, skincare  " -> ["skin-care"...]. Hashtags are stored without '#', no spaces. */
export function cleanHashtag(raw: string) {
  return raw
    .replace(/^#+/, "")
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}_]+/gu, "")
    .slice(0, 60);
}

export function cleanKeyword(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}

function dedupe(list: string[], key: (s: string) => string) {
  const seen = new Set<string>();
  return list.filter((v) => {
    const k = key(v);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeHashtags(list: string[]) {
  return dedupe(list.map(cleanHashtag), (s) => s.toLowerCase()).slice(0, 40);
}

export function normalizeKeywords(list: string[]) {
  return dedupe(list.map(cleanKeyword), (s) => s.toLowerCase()).slice(0, 30);
}

/** Caption + hashtags exactly as it would be pasted into the platform. */
export function buildPostText(caption: string | null | undefined, hashtags: string[]) {
  const tags = hashtags.map((h) => `#${h}`).join(" ");
  return [caption?.trim(), tags].filter(Boolean).join("\n\n");
}

/** Platform guidance shown next to the caption field. */
export const CAPTION_LIMITS: Partial<Record<ContentType, number>> = {
  INSTAGRAM_REEL: 2200,
  INSTAGRAM_CAROUSEL: 2200,
  INSTAGRAM_STATIC: 2200,
  INSTAGRAM_STORY: 2200,
  FACEBOOK_POST: 63206,
  LINKEDIN_POST: 3000,
  YOUTUBE_VIDEO: 5000,
  YOUTUBE_SHORTS: 100,
  PINTEREST_PIN: 500,
  GOOGLE_BUSINESS_POST: 1500,
};

export const HASHTAG_SOFT_LIMIT: Partial<Record<ContentType, number>> = {
  INSTAGRAM_REEL: 15,
  INSTAGRAM_CAROUSEL: 15,
  INSTAGRAM_STATIC: 15,
  LINKEDIN_POST: 5,
  YOUTUBE_VIDEO: 15,
  YOUTUBE_SHORTS: 5,
  PINTEREST_PIN: 20,
};

/** Snapshot stored on each ContentVersion so every save is restorable / diffable. */
export type ContentSnapshot = {
  title: string;
  type: ContentType;
  caption: string | null;
  objective: string | null;
  script: Script;
  visualBrief: string | null;
  cta: string | null;
  seoKeywords: string[];
  hashtags: string[];
  seoTitle: string | null;
  metaDescription: string | null;
  slug: string | null;
  body: string | null;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Which parts of the planning pack are filled in — drives the badges on the day plan. */
export function planCompleteness(item: {
  type: ContentType;
  caption: string | null;
  script: unknown;
  seoKeywords: string[];
  hashtags: string[];
  body: string | null;
}) {
  const script = readScript(item.script);
  return {
    script: !isScriptEmpty(script),
    caption: !!item.caption?.trim(),
    seo: item.seoKeywords.length > 0,
    hashtags: item.hashtags.length > 0,
    body: isArticleType(item.type) ? !!item.body?.trim() : true,
  };
}
