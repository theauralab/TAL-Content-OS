import { ServiceCategory } from "@prisma/client";
import { SERVICE_CATALOG, SERVICE_ORDER, type ServiceState } from "@/lib/services";

/**
 * Shared by onboarding (compact, no scope textareas) and the client services page (full, with scope
 * items per category). One checkbox per category drives the whole app — see lib/services.ts.
 */
export function ServiceChecklist({
  initial,
  detailed = false,
  defaultChecked = [],
}: {
  initial?: ServiceState;
  detailed?: boolean;
  defaultChecked?: ServiceCategory[];
}) {
  const isChecked = (c: ServiceCategory) => (initial ? !!initial[c]?.enabled : defaultChecked.includes(c));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SERVICE_ORDER.map((c) => {
        const cat = SERVICE_CATALOG[c];
        return (
          <div key={c} className={`rounded-md border border-neutral bg-background px-3 py-2 ${detailed ? "sm:col-span-1" : ""}`}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" name="categories" value={c} defaultChecked={isChecked(c)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span className="text-primary">{cat.label}</span>
            </label>
            {detailed && (
              <textarea
                name={`scope_${c}`}
                rows={2}
                placeholder={`Scope items purchased (one per line) — e.g. ${cat.items.slice(0, 2).join(", ")}…`}
                defaultValue={(initial?.[c]?.scopeItems ?? []).join("\n")}
                className="mt-2 w-full rounded-md border border-neutral bg-white px-2 py-1.5 text-xs"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
