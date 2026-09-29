"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { appUrl, emailConfigured, passwordResetEmail, sendEmail } from "@/lib/email";
import { RESET_MAX_PER_HOUR, RESET_TTL_MINUTES, hashToken, newResetToken } from "@/lib/tokens";

export type AccountResult = { ok: boolean; message: string } | null;

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "New passwords don't match", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Choose a different password", path: ["next"] });

export async function changePassword(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.passwordHash || !(await bcrypt.compare(parsed.data.current, row.passwordHash))) {
    return { ok: false, message: "Current password is incorrect" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10), mustChangePassword: false },
  });
  redirect("/dashboard");
}

// ---------- Forgot / reset password (public, no session) ----------

const GENERIC = {
  ok: true,
  message: `If that email belongs to an account, a reset link is on its way. It expires in ${RESET_TTL_MINUTES} minutes.`,
} as const;

/**
 * Always answers the same way, whether or not the email exists, so this can't be used to find out
 * who has an account. At most RESET_MAX_PER_HOUR links per account per hour.
 */
export async function requestPasswordReset(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Enter a valid email address" };

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (!user || !user.isActive || user.deletedAt) return GENERIC;

  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  if (recent >= RESET_MAX_PER_HOUR) return GENERIC;

  const { raw, hash } = newResetToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) },
  });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "password_reset_requested", entityType: "User", entityId: user.id },
  });

  const resetUrl = `${appUrl()}/reset-password?token=${raw}`;
  if (!emailConfigured() && process.env.NODE_ENV !== "production") {
    console.warn(`[dev] RESEND_API_KEY not set — reset link for ${user.email}: ${resetUrl}`);
  }
  const mail = passwordResetEmail({ name: user.name, resetUrl, minutes: RESET_TTL_MINUTES });
  // Sent after the response so a real account and a fake one take the same time to answer.
  after(async () => {
    const r = await sendEmail({ to: user.email, ...mail });
    if (!r.ok) console.error("Password reset email failed:", r.message);
  });
  return GENERIC;
}

const resetSchema = z
  .object({
    token: z.string().min(20).max(200),
    next: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function resetPasswordWithToken(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const parsed = resetSchema.safeParse({ token: formData.get("token"), next: formData.get("next"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const invalid = { ok: false, message: "This reset link is invalid or has expired. Request a new one." } as const;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.isActive || row.user.deletedAt) return invalid;

  const passwordHash = await bcrypt.hash(parsed.data.next, 10);
  const done = await prisma.$transaction(async (tx) => {
    // Claim the token first: of two simultaneous submissions only one gets past this.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) return false;
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }); // kill any other open links
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.activityLog.create({ data: { userId: row.userId, action: "password_reset_completed", entityType: "User", entityId: row.userId } });
    return true;
  });
  if (!done) return invalid;
  redirect("/login?reset=1");
}
