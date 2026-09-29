"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { triggerEvent } from "@/lib/pusher-server";
import { requireUser, requireClient, requireBrand } from "@/lib/access";

const nameSchema = z.object({ name: z.string().trim().min(2, "Brand name is required").max(120) });

export async function createBrand(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "brand", "create")) throw new Error("Not permitted to create brands");

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const client = await requireClient(String(formData.get("clientId")), user);
  const brand = await prisma.brand.create({ data: { clientId: client.id, name: parsed.data.name } });

  const payload = { title: "New brand added", body: `${brand.name} — ${client.name}`, createdAt: new Date().toISOString() };
  await triggerEvent(`private-org-${user.organizationId}`, "activity", payload);
  await triggerEvent(`private-client-${client.id}`, "activity", payload);
  revalidatePath(`/clients/${client.id}`);
}

export async function updateBrand(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "brand", "update")) throw new Error("Not permitted to edit brands");

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const brand = await requireBrand(String(formData.get("id")), user);
  await prisma.brand.update({ where: { id: brand.id }, data: { name: parsed.data.name } });
  revalidatePath(`/clients/${brand.clientId}`);
  revalidatePath(`/clients/${brand.clientId}/brands/${brand.id}`);
}

export async function deleteBrand(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "brand", "delete")) throw new Error("Only a Super Admin can delete brands");

  const brand = await requireBrand(String(formData.get("id")), user);
  await prisma.brand.update({ where: { id: brand.id }, data: { deletedAt: new Date() } });
  revalidatePath(`/clients/${brand.clientId}`);
  redirect(`/clients/${brand.clientId}`);
}
