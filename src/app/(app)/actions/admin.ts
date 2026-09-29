"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireClient, type SessionUser } from "@/lib/access";
import { emailLogin } from "@/lib/invites";
import { generateTempPassword } from "@/lib/tokens";

export type AdminResult = {
  ok: boolean;
  message: string;
  /** Only returned when the email could not be sent (or was switched off): shown once, only the hash is stored. */
  tempPassword?: string;
  email?: string;
  emailed?: boolean;
};

const fail = (message: string): AdminResult => ({ ok: false, message });

async function admin(action: "create" | "update") {
  const user = await requireUser();
  if (!can(user.role, "user", action)) throw new Error("Not permitted to manage users");
  return user;
}

const isSuper = (u: SessionUser) => u.role === "SUPER_ADMIN";

/** Managers may only touch client logins; only a Super Admin manages team accounts. */
function assertCanManage(actor: SessionUser, targetRole: RoleName) {
  if (!isSuper(actor) && targetRole !== "CLIENT") {
    throw new Error("Only a Super Admin can manage team accounts");
  }
}

async function loadTarget(id: string, actor: SessionUser) {
  const target = await prisma.user.findFirst({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
    include: { role: true },
  });
  if (!target) throw new Error("User not found");
  assertCanManage(actor, target.role.name);
  return target;
}

async function log(actor: SessionUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  await prisma.activityLog.create({ data: { userId: actor.id, action, entityType: "User", entityId, metadata: metadata as object } });
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.nativeEnum(RoleName),
  clientId: z.string().optional(),
  sendEmail: z.boolean(),
});

export async function createUser(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  try {
    const actor = await admin("create");
    const parsed = createSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      clientId: (formData.get("clientId") as string) || undefined,
      sendEmail: formData.get("sendEmail") === "on",
    });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { name, email, role, clientId } = parsed.data;
    assertCanManage(actor, role);

    let scopedClientId: string | null = null;
    let clientName: string | null = null;
    if (role === "CLIENT") {
      if (!clientId) return fail("Pick which client this login belongs to");
      const c = await requireClient(clientId, actor);
      scopedClientId = c.id;
      clientName = c.name;
    }

    if (await prisma.user.findUnique({ where: { email } })) return fail("That email already has an account");
    const roleRow = await prisma.role.findUnique({
      where: { organizationId_name: { organizationId: actor.organizationId, name: role } },
    });
    if (!roleRow) return fail(`Role ${role} isn't set up — run the seed script`);

    const password = generateTempPassword();
    const created = await prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        name,
        email,
        roleId: roleRow.id,
        clientId: scopedClientId,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
      },
    });
    await log(actor, "created", created.id, { email, role, clientId: scopedClientId });
    revalidatePath("/admin/users");
    if (scopedClientId) revalidatePath(`/clients/${scopedClientId}`);
    if (!parsed.data.sendEmail) {
      return { ok: true, message: `Login created for ${name}. Share these details — the password is shown only once.`, tempPassword: password, email };
    }
    const sent = await emailLogin({ userId: created.id, name, email, password, clientName });
    if (sent.emailed) return { ok: true, emailed: true, email, message: `Login created and emailed to ${email}. They'll set their own password on first sign-in.` };
    return {
      ok: true,
      email,
      tempPassword: password,
      message: `Login created, but the email couldn't be sent (${sent.message}). Share these details yourself — the password is shown only once.`,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong");
  }
}

export async function resetPassword(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  try {
    const actor = await admin("update");
    const target = await loadTarget(String(formData.get("id")), actor);
    if (!target.isActive) return fail("Reactivate this login before resetting its password");
    const password = generateTempPassword();
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
    });
    await log(actor, "password_reset", target.id, { email: target.email });
    revalidatePath("/admin/users");
    const clientName = target.clientId ? (await prisma.client.findUnique({ where: { id: target.clientId }, select: { name: true } }))?.name : null;
    const sent = await emailLogin({ userId: target.id, name: target.name, email: target.email, password, clientName, reset: true });
    if (sent.emailed) return { ok: true, emailed: true, email: target.email, message: `New temporary password emailed to ${target.email}.` };
    return {
      ok: true,
      email: target.email,
      tempPassword: password,
      message: `Password reset, but the email couldn't be sent (${sent.message}). New temporary password for ${target.name} — shown only once.`,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong");
  }
}

export async function setUserActive(formData: FormData): Promise<void> {
  const actor = await admin("update");
  const target = await loadTarget(String(formData.get("id")), actor);
  const active = formData.get("active") === "1";
  if (target.id === actor.id) throw new Error("You can't deactivate your own account");
  await prisma.user.update({ where: { id: target.id }, data: { isActive: active } });
  await log(actor, active ? "reactivated" : "deactivated", target.id, { email: target.email });
  revalidatePath("/admin/users");
  if (target.clientId) revalidatePath(`/clients/${target.clientId}`);
}

export async function changeUserRole(formData: FormData): Promise<void> {
  const actor = await admin("update");
  if (!isSuper(actor)) throw new Error("Only a Super Admin can change roles");
  const target = await loadTarget(String(formData.get("id")), actor);
  const role = z.nativeEnum(RoleName).parse(formData.get("role"));
  if (target.role.name === "CLIENT" || role === "CLIENT") throw new Error("Client logins can't be converted to or from team roles");
  if (target.id === actor.id) throw new Error("You can't change your own role");

  const roleRow = await prisma.role.findUnique({
    where: { organizationId_name: { organizationId: actor.organizationId, name: role } },
  });
  if (!roleRow) throw new Error(`Role ${role} isn't set up`);
  await prisma.user.update({ where: { id: target.id }, data: { roleId: roleRow.id } });
  await log(actor, "role_changed", target.id, { from: target.role.name, to: role });
  revalidatePath("/admin/users");
}

// ---------- Client profile (admin panel) ----------

const profileSchema = z.object({
  status: z.enum(["active", "paused", "churned"]),
  industry: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Contact email isn't valid")]).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export async function updateClientProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "client", "update")) throw new Error("Not permitted to edit clients");
  const client = await requireClient(String(formData.get("id")), user);

  const parsed = profileSchema.safeParse({
    status: formData.get("status"),
    industry: (formData.get("industry") as string) ?? "",
    contactName: (formData.get("contactName") as string) ?? "",
    contactEmail: (formData.get("contactEmail") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const d = parsed.data;

  await prisma.client.update({
    where: { id: client.id },
    data: {
      status: d.status,
      industry: d.industry || null,
      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
      notes: d.notes || null,
      updatedBy: user.id,
    },
  });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "profile_updated", entityType: "Client", entityId: client.id, metadata: { status: d.status } },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/admin");
}
