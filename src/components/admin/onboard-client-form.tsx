"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { onboardClient, type OnboardResult } from "@/app/(app)/actions/clients";
import { ServiceChecklist } from "./service-checklist";
import { DEFAULT_CATEGORIES } from "@/lib/services";
import { CredentialsCard } from "./credentials-card";

const field = "rounded-md border border-neutral px-3 py-2 text-sm";

export function OnboardClientForm() {
  const [state, action, pending] = useActionState<OnboardResult, FormData>(onboardClient, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div>
      <form ref={formRef} action={action} className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <input name="name" placeholder="Client / company name" required className={field} />
        <input name="brandName" placeholder="First brand (defaults to the client name)" className={field} />
        <input name="industry" placeholder="Industry (optional)" className={`${field} sm:col-span-2`} />

        <div className="sm:col-span-2 border-t border-neutral pt-3">
          <p className="mb-2 text-xs font-medium text-primary/70">Portal login — their approval workspace</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="contactName" placeholder="Contact name" className={field} />
            <input name="contactEmail" type="email" placeholder="Contact email" className={field} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-primary">
            <input type="checkbox" name="emailLogin" defaultChecked className="h-4 w-4 accent-primary" />
            Email their login details now
          </label>
          <p className="mt-1 text-xs text-primary/50">Leave the email blank to add the client without a login.</p>
        </div>

        <div className="sm:col-span-2 border-t border-neutral pt-3">
          <p className="mb-2 text-xs font-medium text-primary/70">Services this client has bought — controls what shows up in their content calendar and menus (edit anytime from the client page)</p>
          <ServiceChecklist defaultChecked={DEFAULT_CATEGORIES} />
        </div>

        <button type="submit" disabled={pending} className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {pending ? "Onboarding…" : "Onboard client"}
        </button>
      </form>

      {state && (
        <div role="status" className={`mt-3 max-w-2xl text-sm ${state.ok ? "text-primary" : "text-danger"}`}>
          {state.emailed && <span className="mr-1 text-success">✓</span>}
          {state.message}
          {state.ok && state.clientId && (
            <Link href={`/clients/${state.clientId}`} className="ml-2 text-secondary hover:underline">Open client →</Link>
          )}
          {state.ok && state.tempPassword && <CredentialsCard email={state.email} password={state.tempPassword} loginUrl={`${origin}/login`} />}
        </div>
      )}
    </div>
  );
}
