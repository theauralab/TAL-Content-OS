"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireClient } from "@/lib/access";
import { SERVICE_ORDER, type ServiceState } from "@/lib/services";

export async function getClientServiceState(clientId: string): Promise<ServiceState> {
  const rows = await prisma.clientService.findMany({ where: { clientId } });
  const state: ServiceState = {};
  for (const r of rows) state[r.category] = { enabled: r.enabled, scopeItems: r.scopeItems, notes: r.notes };
  return state;
}

export type ServicesResult = { ok: boolean; message: string } | null;

/** Full replace: every category present in the form is written (checked = enabled, unchecked = disabled). */
export async function updateClientServices(_prev: ServicesResult, formData: FormData): Promise<ServicesResult> {
  try {
    const user = await requireUser();
    if (!can(user.role, "client", "update")) return { ok: false, message: "Not permitted to change services" };

    const clientId = z.string().min(1).parse(formData.get("clientId"));
    const client = await requireClient(clientId, user);
    const checked = new Set(formData.getAll("categories").map(String));

    await prisma.$transaction(
      SERVICE_ORDER.map((category) => {
        const scopeRaw = String(formData.get(`scope_${category}`) ?? "");
        const scopeItems = scopeRaw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 60);
        return prisma.clientService.upsert({
          where: { clientId_category: { clientId: client.id, category } },
          update: { enabled: checked.has(category), scopeItems, updatedBy: user.id },
          create: { clientId: client.id, category, enabled: checked.has(category), scopeItems, updatedBy: user.id },
        });
      }),
    );

    await prisma.activityLog.create({
      data: { userId: user.id, action: "services_updated", entityType: "Client", entityId: client.id, metadata: { enabled: [...checked] } },
    });
    revalidatePath(`/clients/${client.id}`);
    revalidatePath(`/clients/${client.id}/services`);
    return { ok: true, message: "Services updated. The content calendar and menus for this client now reflect what's enabled." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't update services" };
  }
}

