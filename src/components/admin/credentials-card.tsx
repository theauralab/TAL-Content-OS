"use client";

import { CopyButton } from "@/components/content/copy-button";

export function CredentialsCard({ email, password, loginUrl }: { email?: string; password: string; loginUrl: string }) {
  const text = `Login: ${loginUrl}\nEmail: ${email ?? ""}\nTemporary password: ${password}\n(You'll be asked to set your own password on first sign-in.)`;
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="grid gap-1 font-mono text-xs text-primary">
        <div>Login: {loginUrl}</div>
        {email && <div>Email: {email}</div>}
        <div>Temporary password: <span className="font-semibold">{password}</span></div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <CopyButton text={text} label="Copy login details" />
        <span className="text-xs text-amber-800">Shown once — it can&apos;t be retrieved later, only reset.</span>
      </div>
    </div>
  );
}
