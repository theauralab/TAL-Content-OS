"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AccountResult } from "@/app/(app)/actions/account";

export function ForgotForm() {
  const [state, action, pending] = useActionState<AccountResult, FormData>(requestPasswordReset, null);

  if (state?.ok) {
    return <p role="status" className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">{state.message}</p>;
  }
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{state.message}</p>}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-primary">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="w-full rounded-md border border-neutral px-3 py-2 text-sm outline-none focus:border-secondary" />
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
