"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkApprove } from "@/app/(app)/actions/content";

export type PendingRow = { id: string; title: string; type: string; brand: string; date: string };
export type PendingGroup = { key: string; heading: string; sub: string; rows: PendingRow[] };

/** Review a whole month in one sitting: open items to check them, tick the ones you're happy with, approve together. */
export function BulkApprove({ groups }: { groups: PendingGroup[] }) {
  const all = groups.flatMap((g) => g.rows.map((r) => r.id));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <form
      action={bulkApprove}
      onSubmit={(e) => {
        if (!window.confirm(`Approve ${picked.size} item${picked.size === 1 ? "" : "s"}? This tells the team they're good to go.`)) e.preventDefault();
      }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={() => setPicked(picked.size === all.length ? new Set() : new Set(all))} className="rounded-md border border-neutral bg-white px-3 py-1.5 hover:border-secondary">
          {picked.size === all.length ? "Clear selection" : "Select all"}
        </button>
        <button type="submit" disabled={picked.size === 0} className="rounded-md bg-success px-4 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-40">
          Approve selected{picked.size > 0 ? ` (${picked.size})` : ""}
        </button>
        <span className="text-xs text-primary/50">Need changes? Open the item and use “Request changes”.</span>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="rounded-lg border border-neutral bg-white">
          <header className="border-b border-neutral px-4 py-2">
            <h2 className="text-sm font-semibold text-primary">{g.heading} <span className="font-normal text-primary/50">· {g.rows.length}</span></h2>
            <p className="text-xs text-primary/50">{g.sub}</p>
          </header>
          <ul className="divide-y divide-neutral">
            {g.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <input type="checkbox" name="ids" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} className="h-4 w-4 accent-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-primary">{r.title}</div>
                  <div className="text-xs text-primary/60">{r.type} · {r.brand} · {r.date}</div>
                </div>
                <Link href={`/content/${r.id}`} className="shrink-0 text-secondary hover:underline">Review →</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </form>
  );
}
