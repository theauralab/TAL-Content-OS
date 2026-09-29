import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  // Check up front so someone with a dead link is told so, instead of filling in a form that can't work.
  const row = token
    ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { isActive: true, deletedAt: true } } } })
    : null;
  const valid = !!row && !row.usedAt && row.expiresAt > new Date() && row.user.isActive && !row.user.deletedAt;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral bg-white p-8 shadow-sm">
        {valid && token ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-primary">Choose a new password</h1>
            <p className="mb-6 text-sm text-primary/60">Use at least 10 characters.</p>
            <ResetForm token={token} />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold text-primary">This link has expired</h1>
            <p className="mb-6 text-sm text-primary/60">Reset links work once and last 60 minutes. Request a fresh one and you&apos;ll be back in a minute.</p>
            <Link href="/forgot-password" className="block w-full rounded-md bg-primary py-2 text-center text-sm font-medium text-white hover:opacity-90">Get a new link</Link>
          </>
        )}
      </div>
    </main>
  );
}
