"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createUser, type AdminResult } from "@/app/(app)/actions/admin";
import { CredentialsCard } from "./credentials-card";

const TEAM_ROLES = [
  ["AGENCY_MANAGER", "Agency manager"],
  ["DESIGNER", "Designer"],
  ["VIDEO_EDITOR", "Video editor"],
  ["CONTENT_WRITER", "Content writer"],
  ["SEO_SPECIALIST", "SEO specialist"],
  ["MEDIA_BUYER", "Media buyer"],
  ["SUPER_ADMIN", "Super admin"],
] as const;

const field = "rounded-md border border-neutral px-3 py-2 text-sm";

export function CreateUserForm({
  clients,
  fixedClientId,
  canCreateTeam,
}: {
  clients: { id: string; name: string }[];
  fixedClientId?: string;
  canCreateTeam: boolean;
}) {
  const [state, action, pending] = useActionState<AdminResult | null, FormData>(createUser, null);
  const [kind, setKind] = useState<"client" | "team">("client");
  const formRef = useRef<HTMLFormElement>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const isClient = fixedClientId ? true : kind === "client";

  return (
    <div>
      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
        {!fixedClientId && canCreateTeam && (
          <div className="flex gap-1 rounded-md border border-neutral bg-white p-1 text-sm sm:col-span-2">
            {(["client", "team"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded px-3 py-1 ${kind === k ? "bg-primary text-white" : "text-primary hover:bg-background"}`}
              >
                {k === "client" ? "Client login" : "Team member"}
              </button>
            ))}
          </div>
        )}
        <input name="name" placeholder="Full name" required className={field} />
        <input name="email" type="email" placeholder="Email (used to sign in)" required className={field} />

        {isClient ? (
          <>
            <input type="hidden" name="role" value="CLIENT" />
            {fixedClientId ? (
              <input type="hidden" name="clientId" value={fixedClientId} />
            ) : (
              <select name="clientId" required defaultValue="" className={`${field} sm:col-span-2`}>
                <option value="" disabled>Which client?</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </>
        ) : (
          <select name="role" defaultValue="CONTENT_WRITER" className={`${field} sm:col-span-2`}>
            {TEAM_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}

        <label className="flex items-center gap-2 text-sm text-primary sm:col-span-2">
          <input type="checkbox" name="sendEmail" defaultChecked className="h-4 w-4 accent-primary" />
          Email the login details to them now
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : isClient ? "Create client login" : "Create team login"}
        </button>
      </form>

      {state && (
        <div role="status" className={`mt-3 text-sm ${state.ok ? "text-primary" : "text-danger"}`}>
          {state.emailed && <span className="mr-1 text-success">✓</span>}
          {state.message}
          {state.ok && state.tempPassword && (
            <CredentialsCard email={state.email} password={state.tempPassword} loginUrl={`${origin}/login`} />
          )}
        </div>
      )}
    </div>
  );
}
