"use client";

import { useActionState } from "react";
import { changePassword, type AccountResult } from "@/app/(app)/actions/account";

const field = "w-full rounded-md border border-neutral px-3 py-2 text-sm outline-none focus:border-secondary";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountResult, FormData>(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{state.message}</p>}
      <input name="current" type="password" placeholder="Current (temporary) password" required autoComplete="current-password" className={field} />
      <input name="next" type="password" placeholder="New password (10+ characters)" required minLength={10} autoComplete="new-password" className={field} />
      <input name="confirm" type="password" placeholder="Confirm new password" required minLength={10} autoComplete="new-password" className={field} />
      <button type="submit" disabled={pending} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
