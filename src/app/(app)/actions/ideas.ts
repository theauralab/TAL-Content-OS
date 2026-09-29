"use server";

import { z } from "zod";
import { ContentType, IdeaPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireBrand } from "@/lib/access";
import { allowedContentTypes, resolveIdeaContentType } from "@/lib/services";
import { getClientServiceState } from "@/app/(app)/actions/services";

async function loadIdea(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const idea = await prisma.contentIdea.findFirst({ where: { id, deletedAt: null }, include: { brand: { include: { client: true } } } });
  if (!idea) throw new Error("Idea not found");
  await requireBrand(idea.brandId, user); // tenant check, reuses the same scoping as brands
  return idea;
}

const createSchema = z.object({
  brandId: z.string().min(1),
  title: z.string().trim().min(2, "Give the idea a short title").max(200),
  notes: z.string().trim().max(4000).optional(),
  contentType: z.nativeEnum(ContentType).optional(),
  priority: z.nativeEnum(IdeaPriority).default("MEDIUM"),
  tags: z.string().optional(),
});

export async function addIdea(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "create")) throw new Error("Not permitted to add ideas");

  const parsed = createSchema.parse({
    brandId: formData.get("brandId"),
    title: formData.get("title"),
    notes: (formData.get("notes") as string) || undefined,
    contentType: (formData.get("contentType") as string) || undefined,
    priority: (formData.get("priority") as string) || "MEDIUM",
    tags: (formData.get("tags") as string) || undefined,
  });
  const brand = await requireBrand(parsed.brandId, user);
  const tags = (parsed.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);

  await prisma.contentIdea.create({
    data: {
      brandId: brand.id,
      title: parsed.title,
      notes: parsed.notes || null,
      contentType: parsed.contentType,
      priority: parsed.priority,
      tags,
      createdBy: user.id,
    },
  });
  revalidatePath(`/clients/${brand.clientId}/brands/${brand.id}`);
}

export async function updateIdeaStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const status = z.enum(["IDEA", "PLANNED", "USED", "ARCHIVED"]).parse(formData.get("status"));
  if (!can(user.role, "content", "update")) throw new Error("Not permitted to update ideas");

  const idea = await loadIdea(id, user);
  await prisma.contentIdea.update({ where: { id: idea.id }, data: { status } });
  revalidatePath(`/clients/${idea.brand.clientId}/brands/${idea.brandId}`);
}

export async function deleteIdea(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  if (!can(user.role, "content", "delete")) throw new Error("Not permitted to delete ideas");

  const idea = await loadIdea(id, user);
  await prisma.contentIdea.update({ where: { id: idea.id }, data: { deletedAt: new Date() } });
  revalidatePath(`/clients/${idea.brand.clientId}/brands/${idea.brandId}`);
}

/** Turns an idea into a real draft content item, pre-filled, and marks the idea used (kept for reference). */
export async function useIdea(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "content", "create")) throw new Error("Not permitted to create content");

  const id = z.string().min(1).parse(formData.get("id"));
  const idea = await loadIdea(id, user);
  if (idea.status === "USED") throw new Error("This idea has already been used");

  const state = await getClientServiceState(idea.brand.clientId);
  const type = resolveIdeaContentType(idea.contentType, allowedContentTypes(state));
  if (!type) throw new Error("No enabled service covers a plannable content type for this client yet");

  const scheduledFor = (() => {
    const raw = String(formData.get("scheduledFor") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const d = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  await prisma.$transaction(async (tx) => {
    const created = await tx.contentItem.create({
      data: {
        brandId: idea.brandId,
        type,
        title: idea.title,
        caption: idea.notes ?? null,
        scheduledFor,
        script: { hook: idea.title, blocks: [], cta: "" },
        createdBy: user.id,
        versions: { create: { versionNumber: 1, caption: idea.notes ?? null, createdBy: user.id } },
      },
    });
    await tx.contentIdea.update({ where: { id: idea.id }, data: { status: "USED", usedForId: created.id } });
    await tx.activityLog.create({
      data: { userId: user.id, action: "idea_used", entityType: "ContentItem", entityId: created.id, metadata: { ideaId: idea.id } },
    });
  });
  revalidatePath(`/clients/${idea.brand.clientId}/brands/${idea.brandId}`);
}
