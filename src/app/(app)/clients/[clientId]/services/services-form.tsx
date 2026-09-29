"use client";

import { useActionState, type ReactNode } from "react";
import type { ServicesResult } from "@/app/(app)/actions/services";

export function ServicesForm({
  clientId,
  action,
  children,
}: {
  clientId: string;
  action: (prev: ServicesResult, formData: FormData) => Promise<ServicesResult>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ServicesResult, FormData>(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {children}
      {state && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
        {pending ? "Saving…" : "Save services"}
      </button>
    </form>
  );
}
