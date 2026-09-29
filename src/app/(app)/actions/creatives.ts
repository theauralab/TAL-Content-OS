"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { broadcast, requireContent, requireUser } from "@/lib/access";
import { CREATIVE_UPLOAD_STATUSES, creativeRoundAfterProduction } from "@/lib/content";
import { buildStorageKey, keyBelongsTo, parseHttpUrl, validateUpload } from "@/lib/creatives";
import { deleteObject, headObject, presignUpload, storageConfigured } from "@/lib/storage";

export type UploadPrep = { ok: true; uploadUrl: string; storageKey: string } | { ok: false; message: string };
export type CreativeResult = { ok: boolean; message: string } | null;

const isManager = (role: string) => role === "SUPER_ADMIN" || role === "AGENCY_MANAGER";

/** Loads the item and checks the caller may add creatives to it right now. */
async function loadForUpload(contentId: string) {
  const user = await requireUser();
  if (!can(user.role, "asset", "create")) throw new Error("Your role can't upload creatives");
  const item = await requireContent(contentId, user);
  if (!CREATIVE_UPLOAD_STATUSES.includes(item.status)) {
    throw new Error("Creatives can be added after the plan is approved, until they're sent to the client");
  }
  // The round this upload belongs to: continue the current one, or open the next after a judged round.
  const round = item.status === "IN_PRODUCTION" ? item.creativeRound : creativeRoundAfterProduction(item.status, item.creativeRound);
  return { user, item, round };
}

const prepSchema = z.object({
  contentId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive(),
});

/** Step 1 of an upload: validate, then hand the browser a short-lived URL to PUT the file straight to R2. */
export async function prepareCreativeUpload(input: z.infer<typeof prepSchema>): Promise<UploadPrep> {
  try {
    const p = prepSchema.parse(input);
    const bad = validateUpload({ mimeType: p.mimeType, size: p.size });
    if (bad) return { ok: false, message: bad };
    if (!storageConfigured()) return { ok: false, message: "File storage isn't set up yet — add a link instead, or configure Cloudflare R2." };

    const { item, round } = await loadForUpload(p.contentId);
    const storageKey = buildStorageKey(item.id, round, p.fileName, randomBytes(6).toString("hex"));
    return { ok: true, storageKey, uploadUrl: await presignUpload(storageKey, p.mimeType) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't start the upload" };
  }
}

const regSchema = prepSchema.extend({ storageKey: z.string().min(1).max(300) }).omit({ size: true });

/** Step 2: the browser says it's done. We verify the object really exists before recording it. */
export async function registerCreative(input: z.infer<typeof regSchema>): Promise<CreativeResult> {
  try {
    const p = regSchema.parse(input);
    const { user, item, round } = await loadForUpload(p.contentId);
    if (!keyBelongsTo(item.id, p.storageKey)) return { ok: false, message: "That upload doesn't belong to this item" };

    const head = await headObject(p.storageKey);
    if (!head) return { ok: false, message: "The upload didn't finish — please try again" };
    const bad = validateUpload({ mimeType: p.mimeType, size: head.size });
    if (bad) {
      await deleteObject(p.storageKey);
      return { ok: false, message: bad };
    }
    if (await prisma.creative.findFirst({ where: { storageKey: p.storageKey } })) return { ok: false, message: "That file was already added" };

    await addToRound({ user, item, round, data: { kind: "FILE", fileName: p.fileName, mimeType: p.mimeType, sizeBytes: head.size, storageKey: p.storageKey } });
    return { ok: true, message: "Uploaded" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't save the upload" };
  }
}

const linkSchema = z.object({
  id: z.string().min(1),
  url: z.string().trim().min(1, "Paste a link"),
  label: z.string().trim().max(120).optional(),
});

/** For big files that live elsewhere (Drive, Frame.io, Dropbox…) — or before R2 is configured. */
export async function addCreativeLink(_prev: CreativeResult, formData: FormData): Promise<CreativeResult> {
  try {
    const parsed = linkSchema.safeParse({ id: formData.get("id"), url: formData.get("url"), label: (formData.get("label") as string) || undefined });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const url = parseHttpUrl(parsed.data.url);
    if (!url) return { ok: false, message: "That doesn't look like a valid link (it must start with https://)" };

    const { user, item, round } = await loadForUpload(parsed.data.id);
    const label = parsed.data.label || new URL(url).hostname.replace(/^www\./, "");
    await addToRound({ user, item, round, data: { kind: "LINK", fileName: label, linkUrl: url } });
    return { ok: true, message: "Link added" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't add the link" };
  }
}

type Loaded = Awaited<ReturnType<typeof loadForUpload>>;

async function addToRound(p: {
  user: Loaded["user"];
  item: Loaded["item"];
  round: number;
  data: { kind: "FILE" | "LINK"; fileName: string; mimeType?: string; sizeBytes?: number; storageKey?: string; linkUrl?: string };
}) {
  const { user, item, round, data } = p;
  await prisma.$transaction(async (tx) => {
    // The first upload of a round is what starts production — no separate button to forget.
    if (item.status !== "IN_PRODUCTION") {
      const res = await tx.contentItem.updateMany({
        where: { id: item.id, status: item.status },
        data: { status: "IN_PRODUCTION" satisfies ContentStatus, creativeRound: round, updatedBy: user.id },
      });
      if (res.count !== 1) throw new Error("Someone else just changed this item — refresh and try again");
    }
    const position = await tx.creative.count({ where: { contentItemId: item.id, round, deletedAt: null } });
    await tx.creative.create({ data: { contentItemId: item.id, round, position, uploadedBy: user.id, ...data } });
    await tx.activityLog.create({
      data: { userId: user.id, action: "creative_added", entityType: "ContentItem", entityId: item.id, metadata: { fileName: data.fileName, round } },
    });
  });
  await broadcast({
    organizationId: user.organizationId,
    clientId: item.brand.clientId,
    toClient: false, // work in progress stays internal until it's sent for review
    title: "Creative uploaded",
    body: `${item.title} — ${data.fileName}`,
    contentId: item.id,
  });
  revalidatePath(`/content/${item.id}`);
  revalidatePath(`/clients/${item.brand.clientId}/brands/${item.brandId}`);
}

export async function removeCreative(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const creative = await prisma.creative.findFirst({ where: { id, deletedAt: null } });
  if (!creative) throw new Error("Creative not found");

  const item = await requireContent(creative.contentItemId, user); // tenant check
  if (!can(user.role, "asset", "create")) throw new Error("Your role can't remove creatives");
  if (!isManager(user.role) && creative.uploadedBy !== user.id) throw new Error("You can only remove your own uploads");
  // Only work in progress can be removed. A round that has been sent to the client is part of the record.
  if (item.status !== "IN_PRODUCTION" || creative.round !== item.creativeRound) {
    throw new Error("This round has already been sent to the client, so it can't be removed");
  }

  await prisma.creative.update({ where: { id }, data: { deletedAt: new Date() } });
  if (creative.kind === "FILE" && creative.storageKey && storageConfigured()) {
    await deleteObject(creative.storageKey);
  }
  await prisma.activityLog.create({
    data: { userId: user.id, action: "creative_removed", entityType: "ContentItem", entityId: item.id, metadata: { fileName: creative.fileName } },
  });
  revalidatePath(`/content/${item.id}`);
}
