import { prisma } from "@/lib/prisma";
import { appUrl, credentialsEmail, sendEmail } from "@/lib/email";

export type InviteOutcome =
  | { emailed: true }
  | { emailed: false; reason: "not_configured" | "bad_from_domain" | "failed"; message: string };

/** Emails a login (or a reset) to its owner. On failure the caller shows the password to the admin instead. */
export async function emailLogin(p: {
  userId: string;
  name: string;
  email: string;
  password: string;
  clientName?: string | null;
  reset?: boolean;
}): Promise<InviteOutcome> {
  const mail = credentialsEmail({
    name: p.name,
    email: p.email,
    password: p.password,
    loginUrl: `${appUrl()}/login`,
    clientName: p.clientName,
    reset: p.reset,
  });
  const r = await sendEmail({ to: p.email, ...mail });
  if (!r.ok) return { emailed: false, reason: r.reason, message: r.message };
  await prisma.user.update({ where: { id: p.userId }, data: { invitedAt: new Date() } });
  return { emailed: true };
}
