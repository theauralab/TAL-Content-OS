"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { triggerEvent } from "@/lib/pusher-server";
import { requireUser, requireClient } from "@/lib/access";
import { emailLogin } from "@/lib/invites";
import { generateTempPassword } from "@/lib/tokens";
import bcrypt from "bcryptjs";
import { SERVICE_ORDER } from "@/lib/services";

const nameSchema = z.object({ name: z.string().trim().min(2, "Client name is required").max(120) });

export async function createClient(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "client", "create")) throw new Error("Not permitted to create clients");

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const client = await prisma.client.create({
    data: { organizationId: user.organizationId, name: parsed.data.name, createdBy: user.id },
  });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "created", entityType: "Client", entityId: client.id, metadata: { name: client.name } },
  });
  await triggerEvent(`private-org-${user.organizationId}`, "activity", {
    title: "New client added",
    body: client.name,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/clients");
}

export async function updateClient(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "client", "update")) throw new Error("Not permitted to edit clients");

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const client = await requireClient(String(formData.get("id")), user);
  await prisma.client.update({ where: { id: client.id }, data: { name: parsed.data.name, updatedBy: user.id } });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "renamed", entityType: "Client", entityId: client.id, metadata: { from: client.name, to: parsed.data.name } },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${client.id}`);
}

// Soft delete: data is kept (deletedAt), the client and its brands disappear from the app.
export async function deleteClient(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "client", "delete")) throw new Error("Only a Super Admin can delete clients");

  const client = await requireClient(String(formData.get("id")), user);
  const now = new Date();
  await prisma.$transaction([
    prisma.brand.updateMany({ where: { clientId: client.id, deletedAt: null }, data: { deletedAt: now } }),
    prisma.client.update({ where: { id: client.id }, data: { deletedAt: now, updatedBy: user.id } }),
    prisma.activityLog.create({
      data: { userId: user.id, action: "deleted", entityType: "Client", entityId: client.id, metadata: { name: client.name } },
    }),
  ]);
  revalidatePath("/clients");
  redirect("/clients");
}

// ---------- Onboarding: client + first brand + portal login, credentials emailed straight away ----------

export type OnboardResult = {
  ok: boolean;
  message: string;
  clientId?: string;
  email?: string;
  /** Only present when the email couldn't be sent or was switched off. Shown once. */
  tempPassword?: string;
  emailed?: boolean;
} | null;

const onboardSchema = z.object({
  name: z.string().trim().min(2, "Client name is required").max(120),
  brandName: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Contact email isn't valid")]).optional(),
  emailLogin: z.boolean(),
});

export async function onboardClient(_prev: OnboardResult, formData: FormData): Promise<OnboardResult> {
  try {
    const user = await requireUser();
    if (!can(user.role, "client", "create")) return { ok: false, message: "Not permitted to create clients" };

    const parsed = onboardSchema.safeParse({
      name: formData.get("name"),
      brandName: (formData.get("brandName") as string) ?? "",
      industry: (formData.get("industry") as string) ?? "",
      contactName: (formData.get("contactName") as string) ?? "",
      contactEmail: (formData.get("contactEmail") as string) ?? "",
      emailLogin: formData.get("emailLogin") === "on",
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    const d = parsed.data;

    const wantsLogin = !!d.contactEmail;
    if (wantsLogin) {
      if (!can(user.role, "user", "create")) return { ok: false, message: "Not permitted to create logins" };
      if (!d.contactName || d.contactName.length < 2) return { ok: false, message: "Add the contact's name so their login can be created" };
      if (await prisma.user.findUnique({ where: { email: d.contactEmail! } })) {
        return { ok: false, message: "That email already has an account. Use a different email, or add the login from the existing client's page." };
      }
    }
    const clientRole = wantsLogin
      ? await prisma.role.findUnique({ where: { organizationId_name: { organizationId: user.organizationId, name: "CLIENT" } } })
      : null;
    if (wantsLogin && !clientRole) return { ok: false, message: "The Client role isn't set up — run the seed script" };

    const password = wantsLogin ? generateTempPassword() : null;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // One transaction: never leave a client with no brand, or a brand with no client.
    const { client, login } = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: user.organizationId,
          name: d.name,
          industry: d.industry || null,
          contactName: d.contactName || null,
          contactEmail: d.contactEmail || null,
          createdBy: user.id,
        },
      });
      await tx.brand.create({ data: { clientId: client.id, name: d.brandName || d.name } });

      const checked = new Set(formData.getAll("categories").map(String));
      if (checked.size > 0) {
        await tx.clientService.createMany({
          data: SERVICE_ORDER.filter((c) => checked.has(c)).map((category) => ({ clientId: client.id, category, enabled: true })),
        });
      }
      const login = wantsLogin
        ? await tx.user.create({
            data: {
              organizationId: user.organizationId,
              name: d.contactName!,
              email: d.contactEmail!,
              roleId: clientRole!.id,
              clientId: client.id,
              passwordHash,
              mustChangePassword: true,
            },
          })
        : null;
      await tx.activityLog.create({
        data: { userId: user.id, action: "onboarded", entityType: "Client", entityId: client.id, metadata: { name: client.name, login: !!login } },
      });
      return { client, login };
    });

    await triggerEvent(`private-org-${user.organizationId}`, "activity", {
      title: "New client onboarded",
      body: client.name,
      createdAt: new Date().toISOString(),
    });
    revalidatePath("/clients");
    revalidatePath("/admin");

    if (!login || !password) {
      return { ok: true, clientId: client.id, message: `${client.name} added. Add a contact email later to give them portal access.` };
    }
    if (!d.emailLogin) {
      return { ok: true, clientId: client.id, email: login.email, tempPassword: password, message: `${client.name} added. Share these login details — the password is shown only once.` };
    }
    const sent = await emailLogin({ userId: login.id, name: login.name, email: login.email, password, clientName: client.name });
    if (sent.emailed) {
      return { ok: true, clientId: client.id, email: login.email, emailed: true, message: `${client.name} added and their login was emailed to ${login.email}.` };
    }
    return {
      ok: true,
      clientId: client.id,
      email: login.email,
      tempPassword: password,
      message: `${client.name} added, but the email couldn't be sent (${sent.message}). Share these details yourself — the password is shown only once.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong" };
  }
}
