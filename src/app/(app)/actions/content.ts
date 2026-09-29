"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContentStatus, ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireBrand, requireContent, broadcast } from "@/lib/access";
import {
  allowedNext,
  CLIENT_DECISION_TARGET,
  CLIENT_LOCKED_STATUSES,
  CLIENT_REVIEW_STAGE,
  CLIENT_VISIBLE,
  creativeRoundAfterProduction,
  STATUS_LABEL,
} from "@/lib/content";
import { notifyClientReview } from "@/lib/notify";
import { allowedContentTypes } from "@/lib/services";
import { getClientServiceState } from "@/app/(app)/actions/services";
import { parseHttpUrl } from "@/lib/creatives";
import {
  ContentSnapshot,
  normalizeHashtags,
  normalizeKeywords,
  planCompleteness,
  readScript,
  scriptSchema,
  slugify,
} from "@/lib/script";

// Dates are stored as UTC midnight so a post scheduled for the 12th shows on the 12th for everyone.
function parseDate(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const contentFields = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  type: z.nativeEnum(ContentType),
  caption: z.string().max(5000).optional(),
});

const optText = (max: number) => z.string().trim().max(max).optional();

function jsonField(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Couldn't read ${name} — please reload the page and try again`);
  }
}

function parseTime(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string" || !v) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

function readFields(formData: FormData) {
  const parsed = contentFields.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    caption: (formData.get("caption") as string) || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}

/** Planning pack: script, keywords, hashtags, blog fields. Every field is optional. */
function readPlan(formData: FormData) {
  const text = (name: string, max: number) => {
    const r = optText(max).safeParse((formData.get(name) as string) || undefined);
    if (!r.success) throw new Error(`${name} is too long`);
    return r.data || null;
  };

  const scriptRaw = jsonField(formData, "script");
  const script = scriptRaw === undefined ? readScript(null) : scriptSchema.parse(scriptRaw);
  const kw = z.array(z.string()).max(60).parse(jsonField(formData, "seoKeywords") ?? []);
  const tags = z.array(z.string()).max(80).parse(jsonField(formData, "hashtags") ?? []);

  const slugRaw = text("slug", 120);
  return {
    objective: text("objective", 1000),
    script,
    visualBrief: text("visualBrief", 4000),
    cta: text("cta", 500),
    seoKeywords: normalizeKeywords(kw),
    hashtags: normalizeHashtags(tags),
    seoTitle: text("seoTitle", 120),
    metaDescription: text("metaDescription", 320),
    slug: slugRaw ? slugify(slugRaw) : null,
    body: text("body", 100000),
    scheduledTime: parseTime(formData.get("scheduledTime")),
  };
}

type Plan = ReturnType<typeof readPlan>;

function snapshotOf(
  fields: { title: string; type: ContentType; caption: string | null },
  plan: Omit<Plan, "scheduledTime">,
): ContentSnapshot {
  return {
    title: fields.title,
    type: fields.type,
    caption: fields.caption,
    objective: plan.objective,
    script: plan.script,
    visualBrief: plan.visualBrief,
    cta: plan.cta,
    seoKeywords: plan.seoKeywords,
    hashtags: plan.hashtags,
    seoTitle: plan.seoTitle,
    metaDescription: plan.metaDescription,
    slug: plan.slug,
    body: plan.body,
  };
}

function refresh(clientId: string, brandId: string, contentId: string) {
  revalidatePath(`/clients/${clientId}/brands/${brandId}`);
  revalidatePath(`/content/${contentId}`);
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
}

export async function createContent(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "create")) throw new Error("Not permitted to create content");

  const fields = readFields(formData);
  const brand = await requireBrand(String(formData.get("brandId")), user);
  const serviceState = await getClientServiceState(brand.clientId);
  if (!allowedContentTypes(serviceState).includes(fields.type)) {
    throw new Error("This content type isn't covered by this client's enabled services");
  }
  const plan = readPlan(formData);
  const snapshot = snapshotOf({ ...fields, caption: fields.caption ?? null }, plan);

  const item = await prisma.contentItem.create({
    data: {
      brandId: brand.id,
      type: fields.type,
      title: fields.title,
      caption: fields.caption ?? null,
      scheduledFor: parseDate(formData.get("scheduledFor")),
      scheduledTime: plan.scheduledTime,
      objective: plan.objective,
      script: plan.script,
      visualBrief: plan.visualBrief,
      cta: plan.cta,
      seoKeywords: plan.seoKeywords,
      hashtags: plan.hashtags,
      seoTitle: plan.seoTitle,
      metaDescription: plan.metaDescription,
      slug: plan.slug,
      body: plan.body,
      createdBy: user.id,
      versions: {
        create: { versionNumber: 1, caption: fields.caption ?? null, snapshot, createdBy: user.id },
      },
    },
  });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "created", entityType: "ContentItem", entityId: item.id, metadata: { title: item.title } },
  });
  await broadcast({
    organizationId: user.organizationId,
    clientId: brand.clientId,
    toClient: false,
    title: "New content",
    body: `${item.title} — ${brand.name}`,
    contentId: item.id,
  });
  refresh(brand.clientId, brand.id, item.id);
  // Land on the item so the planning pack (script, SEO, hashtags) can be filled in straight away.
  redirect(`/content/${item.id}`);
}

export async function updateContent(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "update")) throw new Error("Not permitted to edit content");

  const fields = readFields(formData);
  const item = await requireContent(String(formData.get("id")), user);
  if (CLIENT_LOCKED_STATUSES.includes(item.status)) {
    throw new Error("This is with the client for review, so it's locked. Pull it back first if you need to change it.");
  }
  const plan = readPlan(formData);

  const caption = fields.caption ?? null;
  const next = snapshotOf({ ...fields, caption }, plan);
  const prev = snapshotOf(
    { title: item.title, type: item.type, caption: item.caption },
    {
      objective: item.objective,
      script: readScript(item.script),
      visualBrief: item.visualBrief,
      cta: item.cta,
      seoKeywords: item.seoKeywords,
      hashtags: item.hashtags,
      seoTitle: item.seoTitle,
      metaDescription: item.metaDescription,
      slug: item.slug,
      body: item.body,
    },
  );
  const changed = JSON.stringify(prev) !== JSON.stringify(next);
  const last = changed
    ? await prisma.contentVersion.aggregate({ where: { contentItemId: item.id }, _max: { versionNumber: true } })
    : null;

  await prisma.contentItem.update({
    where: { id: item.id },
    data: {
      type: fields.type,
      title: fields.title,
      caption,
      scheduledFor: parseDate(formData.get("scheduledFor")),
      scheduledTime: plan.scheduledTime,
      objective: plan.objective,
      script: plan.script,
      visualBrief: plan.visualBrief,
      cta: plan.cta,
      seoKeywords: plan.seoKeywords,
      hashtags: plan.hashtags,
      seoTitle: plan.seoTitle,
      metaDescription: plan.metaDescription,
      slug: plan.slug,
      body: plan.body,
      updatedBy: user.id,
      ...(changed
        ? {
            versions: {
              create: {
                versionNumber: (last?._max.versionNumber ?? 0) + 1,
                caption,
                snapshot: next,
                createdBy: user.id,
              },
            },
          }
        : {}),
    },
  });
  await broadcast({
    organizationId: user.organizationId,
    clientId: item.brand.clientId,
    toClient: CLIENT_VISIBLE.includes(item.status),
    title: "Content updated",
    body: fields.title,
    contentId: item.id,
  });
  refresh(item.brand.clientId, item.brandId, item.id);
}

export async function changeStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "update")) throw new Error("Not permitted to change status");

  const to = z.nativeEnum(ContentStatus).parse(formData.get("to"));
  const item = await requireContent(String(formData.get("id")), user);

  if (!allowedNext(user.role, item.status).includes(to)) {
    throw new Error(`You can't move this from ${STATUS_LABEL[item.status]} to ${STATUS_LABEL[to]}`);
  }

  // Guards: don't put half-finished work in front of the client, and don't schedule without a date.
  if (to === "CLIENT_REVIEW") {
    const c = planCompleteness(item);
    if (!c.script && !c.caption) throw new Error("Add a script or a caption before sending the plan to the client");
  }
  if (to === "CREATIVE_REVIEW") {
    const n = await prisma.creative.count({ where: { contentItemId: item.id, round: item.creativeRound, deletedAt: null } });
    if (n === 0) throw new Error("Upload the creative (or add a link to it) before sending it to the client");
  }
  if (to === "SCHEDULED" && !item.scheduledFor) throw new Error("Set a publish date before marking this as scheduled");

  const extra: { creativeRound?: number; publishedAt?: Date; publishedUrl?: string } = {};
  if (to === "IN_PRODUCTION") extra.creativeRound = creativeRoundAfterProduction(item.status, item.creativeRound);
  if (to === "PUBLISHED") {
    extra.publishedAt = new Date();
    const raw = String(formData.get("publishedUrl") ?? "").trim();
    if (raw) {
      const url = parseHttpUrl(raw);
      if (!url) throw new Error("The published link isn't a valid URL");
      extra.publishedUrl = url;
    }
  }

  const behalfOf = CLIENT_REVIEW_STAGE[item.status];
  const recordsClientApproval =
    !!behalfOf && to === CLIENT_DECISION_TARGET[behalfOf].APPROVED;

  // Compare-and-set on the current status so two people can't both apply the same move.
  const moved = await prisma.$transaction(async (tx) => {
    const res = await tx.contentItem.updateMany({
      where: { id: item.id, status: item.status },
      data: { status: to, updatedBy: user.id, ...extra },
    });
    if (res.count !== 1) return false;
    await tx.activityLog.create({
      data: { userId: user.id, action: "status", entityType: "ContentItem", entityId: item.id, metadata: { from: item.status, to } },
    });
    if (recordsClientApproval && behalfOf) {
      await tx.approval.create({
        data: {
          contentItemId: item.id,
          decidedById: user.id,
          decision: "APPROVED",
          stage: behalfOf,
          round: behalfOf === "CREATIVE" ? item.creativeRound : 1,
          note: "Recorded by the team on the client's behalf",
        },
      });
    }
    return true;
  });
  if (!moved) throw new Error("Someone else just changed this item — refresh and try again");

  await broadcast({
    organizationId: user.organizationId,
    clientId: item.brand.clientId,
    toClient: CLIENT_VISIBLE.includes(to),
    title:
      to === "CLIENT_REVIEW" ? "Plan ready for your review"
      : to === "CREATIVE_REVIEW" ? "Creative ready for your review"
      : `Moved to ${STATUS_LABEL[to]}`,
    body: item.title,
    contentId: item.id,
  });

  const stage = CLIENT_REVIEW_STAGE[to];
  if (stage) notifyClientReview({ clientId: item.brand.clientId, contentId: item.id, stage, title: item.title, brandName: item.brand.name });

  refresh(item.brand.clientId, item.brandId, item.id);
}

type Decision = "APPROVED" | "CHANGES_REQUESTED";

/** One client decision on one item. Shared by the single review form and bulk approve. */
async function applyClientDecision(
  user: Awaited<ReturnType<typeof requireUser>>,
  item: Awaited<ReturnType<typeof requireContent>>,
  decision: Decision,
  note: string,
) {
  const stage = CLIENT_REVIEW_STAGE[item.status];
  if (!stage) throw new Error("This item isn't awaiting your review");
  const to = CLIENT_DECISION_TARGET[stage][decision];
  const round = stage === "CREATIVE" ? item.creativeRound : 1;

  await prisma.$transaction(async (tx) => {
    // Only succeeds if it's still in review — a second click or a colleague's decision can't double-apply.
    const res = await tx.contentItem.updateMany({ where: { id: item.id, status: item.status }, data: { status: to, updatedBy: user.id } });
    if (res.count !== 1) throw new Error("This item has already been reviewed");
    await tx.approval.create({
      data: { contentItemId: item.id, decidedById: user.id, decision, stage, round, note: note || null },
    });
    await tx.activityLog.create({
      data: { userId: user.id, action: `${stage.toLowerCase()}_${decision.toLowerCase()}`, entityType: "ContentItem", entityId: item.id, metadata: { note, stage, round } },
    });
  });
  return { stage, to };
}

// The client's own decision at either gate. Managers recording a decision use changeStatus instead.
export async function decideContent(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !can(user.role, "content", "approve")) {
    throw new Error("Only the client can submit a review decision");
  }
  const decision = z.enum(["APPROVED", "CHANGES_REQUESTED"]).parse(formData.get("decision"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  if (decision === "CHANGES_REQUESTED" && !note) throw new Error("Please describe the changes you'd like");

  const item = await requireContent(String(formData.get("id")), user);
  const { stage } = await applyClientDecision(user, item, decision, note);

  const what = stage === "PLAN" ? "plan" : "creative";
  await broadcast({
    organizationId: user.organizationId,
    clientId: item.brand.clientId,
    toClient: true,
    title: decision === "APPROVED" ? `Client approved the ${what}` : `Client requested changes to the ${what}`,
    body: item.title,
    contentId: item.id,
  });
  refresh(item.brand.clientId, item.brandId, item.id);
}

// Approve a whole month in one go. Only approvals — asking for changes always needs a note, so it's per item.
export async function bulkApprove(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !can(user.role, "content", "approve")) throw new Error("Only the client can approve content");

  const ids = [...new Set(formData.getAll("ids").map(String))].slice(0, 100);
  if (ids.length === 0) throw new Error("Select at least one item first");

  let approved = 0;
  for (const id of ids) {
    try {
      const item = await requireContent(id, user);
      await applyClientDecision(user, item, "APPROVED", "");
      approved++;
    } catch {
      /* skip anything that already moved or isn't theirs to approve */
    }
  }
  if (approved > 0 && user.clientId) {
    await broadcast({
      organizationId: user.organizationId,
      clientId: user.clientId,
      toClient: true,
      title: `Client approved ${approved} item${approved === 1 ? "" : "s"}`,
    });
  }
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/clients", "layout");
}

export async function addComment(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "read")) throw new Error("Not permitted to comment");

  const body = z.string().trim().min(1, "Write something first").max(2000).parse(formData.get("body"));
  const item = await requireContent(String(formData.get("id")), user);

  await prisma.comment.create({ data: { contentItemId: item.id, authorId: user.id, body } });
  await broadcast({
    organizationId: user.organizationId,
    clientId: item.brand.clientId,
    toClient: CLIENT_VISIBLE.includes(item.status),
    title: "New comment",
    body: `${item.title}: ${body.slice(0, 80)}`,
    contentId: item.id,
  });
  revalidatePath(`/content/${item.id}`);
}

// Soft delete. Managers should normally archive instead; only Super Admin can delete.
export async function deleteContent(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "delete")) throw new Error("Only a Super Admin can delete content");

  const item = await requireContent(String(formData.get("id")), user);
  await prisma.contentItem.update({ where: { id: item.id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  revalidatePath(`/clients/${item.brand.clientId}/brands/${item.brandId}`);
  redirect(`/clients/${item.brand.clientId}/brands/${item.brandId}`);
}
