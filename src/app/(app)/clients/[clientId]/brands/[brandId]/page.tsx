import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireBrand, channelFor } from "@/lib/access";
import { BOARD_COLUMNS, CLIENT_VISIBLE, STATUS_LABEL, STATUS_STYLE, TYPE_LABEL, TYPE_SHORT, dayOrder, formatDate } from "@/lib/content";
import { planCompleteness } from "@/lib/script";
import { createContent } from "@/app/(app)/actions/content";
import { LiveRefresh } from "@/components/common/live-refresh";
import { IdeaBank } from "@/components/content/idea-bank";
import { getClientServiceState } from "@/app/(app)/actions/services";
import { allowedContentTypes } from "@/lib/services";

type Item = ContentItem & { _count: { creatives: number } };
type SP = { view?: string; month?: string; add?: string; date?: string };
const VIEWS = ["calendar", "day", "board", "list"] as const;
const VIEW_LABEL: Record<(typeof VIEWS)[number], string> = { calendar: "Calendar", day: "Day plan", board: "Board", list: "List" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseMonth(v?: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  const now = new Date();
  const y = m ? Number(m[1]) : now.getUTCFullYear();
  const mo = m ? Math.min(Math.max(Number(m[2]) - 1, 0), 11) : now.getUTCMonth();
  return { y, mo };
}
function monthKey(y: number, mo: number) {
  const d = new Date(Date.UTC(y, mo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateKey(y: number, mo: number, d: number) {
  return `${monthKey(y, mo)}-${String(d).padStart(2, "0")}`;
}

function Chip({ item }: { item: ContentItem }) {
  return (
    <Link
      href={`/content/${item.id}`}
      className={`mb-1 block truncate rounded px-1.5 py-0.5 text-[11px] ${STATUS_STYLE[item.status]}`}
      title={`${item.title} — ${STATUS_LABEL[item.status]}`}
    >
      <span className="font-semibold">{TYPE_SHORT[item.type]}</span> · {item.title}
    </Link>
  );
}

export default async function BrandHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; brandId: string }>;
  searchParams: Promise<SP>;
}) {
  const { clientId, brandId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const brand = await requireBrand(brandId, user).catch(() => null);
  if (!brand || brand.clientId !== clientId) notFound();

  const view = (VIEWS as readonly string[]).includes(sp.view ?? "") ? (sp.view as (typeof VIEWS)[number]) : "calendar";
  const { y, mo } = parseMonth(sp.month);

  const items = await prisma.contentItem.findMany({
    where: {
      brandId: brand.id,
      deletedAt: null,
      ...(user.role === "CLIENT" ? { status: { in: CLIENT_VISIBLE } } : {}),
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { creatives: { where: { deletedAt: null } } } } },
    take: 500,
  });
  const active = items.filter((i) => i.status !== "ARCHIVED");

  const canCreate = can(user.role, "content", "create");
  const ideas = user.role === "CLIENT" ? [] : await prisma.contentIdea.findMany({ where: { brandId: brand.id, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const serviceState = await getClientServiceState(clientId);
  const creatableTypes = allowedContentTypes(serviceState);
  const base = `/clients/${clientId}/brands/${brandId}`;
  const monthLabel = new Date(Date.UTC(y, mo, 1)).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

  // Calendar grid (Monday-first)
  const startOffset = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const byDay = new Map<number, Item[]>();
  const unscheduled: Item[] = [];
  for (const it of active) {
    if (!it.scheduledFor) {
      unscheduled.push(it);
    } else if (it.scheduledFor.getUTCFullYear() === y && it.scheduledFor.getUTCMonth() === mo) {
      const d = it.scheduledFor.getUTCDate();
      byDay.set(d, [...(byDay.get(d) ?? []), it]);
    }
  }

  return (
    <div className="space-y-6">
      <LiveRefresh channel={channelFor(user)} />

      <div>
        <div className="text-sm text-primary/60">
          <Link href="/clients" className="hover:text-primary">Clients</Link> /{" "}
          <Link href={`/clients/${clientId}`} className="hover:text-primary">{brand.client.name}</Link>
        </div>
        <h1 className="mt-1 text-lg font-semibold text-primary">{brand.name}</h1>
      </div>

      {canCreate && creatableTypes.length === 0 && (
        <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No enabled service currently covers a plannable content type for this client.{" "}
          <Link href={`/clients/${clientId}/services`} className="underline">Review their services →</Link>
        </p>
      )}
      {canCreate && creatableTypes.length > 0 && (
        <details open={sp.add === "1"} className="rounded-lg border border-neutral bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">+ New content</summary>
          <form action={createContent} className="mt-3 grid max-w-xl gap-3 text-sm">
            <input type="hidden" name="brandId" value={brand.id} />
            <input name="title" placeholder="Title / hook" required className="rounded-md border border-neutral px-3 py-2" />
            <div className="flex gap-3">
              <select name="type" className="flex-1 rounded-md border border-neutral px-3 py-2">
                {Object.entries(TYPE_LABEL).filter(([k]) => creatableTypes.includes(k as never)).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <input type="date" name="scheduledFor" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date : ""} className="rounded-md border border-neutral px-3 py-2" />
              <input type="time" name="scheduledTime" className="rounded-md border border-neutral px-3 py-2" />
            </div>
            <textarea name="caption" rows={3} placeholder="Caption (optional) — script, SEO keywords and hashtags come next" className="rounded-md border border-neutral px-3 py-2" />
            <button type="submit" className="w-fit rounded-md bg-primary px-4 py-2 font-medium text-white hover:opacity-90">
              Create &amp; plan
            </button>
          </form>
        </details>
      )}

      {user.role !== "CLIENT" && <IdeaBank brandId={brand.id} ideas={ideas} creatableTypes={creatableTypes} canManage={canCreate} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-neutral bg-white p-1 text-sm">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`${base}?view=${v}&month=${monthKey(y, mo)}`}
              className={`rounded px-3 py-1 ${view === v ? "bg-primary text-white" : "text-primary hover:bg-background"}`}
            >
              {VIEW_LABEL[v]}
            </Link>
          ))}
        </div>
        {(view === "calendar" || view === "day") && (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`${base}?view=${view}&month=${monthKey(y, mo - 1)}`} className="rounded border border-neutral bg-white px-2 py-1 hover:bg-background">←</Link>
            <span className="w-36 text-center font-medium text-primary">{monthLabel}</span>
            <Link href={`${base}?view=${view}&month=${monthKey(y, mo + 1)}`} className="rounded border border-neutral bg-white px-2 py-1 hover:bg-background">→</Link>
          </div>
        )}
      </div>

      {view === "calendar" && (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral bg-neutral text-xs">
              {WEEKDAYS.map((d) => (
                <div key={d} className="bg-background px-2 py-1 font-medium text-primary">{d}</div>
              ))}
              {Array.from({ length: totalCells }, (_, i) => {
                const day = i - startOffset + 1;
                const valid = day >= 1 && day <= daysInMonth;
                return (
                  <div key={i} className="min-h-24 bg-white p-1.5">
                    {valid && (
                      <>
                        <Link href={`${base}?view=day&month=${monthKey(y, mo)}#d-${day}`} className="mb-1 block text-primary/50 hover:text-primary">{day}</Link>
                        {(byDay.get(day) ?? []).map((it) => <Chip key={it.id} item={it} />)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {unscheduled.length > 0 && (
            <div className="rounded-lg border border-neutral bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-primary">Unscheduled</h3>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {unscheduled.map((it) => <Chip key={it.id} item={it} />)}
              </div>
            </div>
          )}
        </>
      )}

      {view === "day" && (
        <div className="space-y-4">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1)
            .filter((d) => (byDay.get(d)?.length ?? 0) > 0 || sp.date === dateKey(y, mo, d))
            .map((d) => {
              const list = [...(byDay.get(d) ?? [])].sort(dayOrder);
              const weekday = new Date(Date.UTC(y, mo, d)).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long" });
              return (
                <section key={d} id={`d-${d}`} className="rounded-lg border border-neutral bg-white">
                  <header className="flex items-center justify-between border-b border-neutral px-4 py-2">
                    <h3 className="text-sm font-semibold text-primary">
                      {weekday}, {d} {monthLabel}
                      <span className="ml-2 font-normal text-primary/50">{list.length} planned</span>
                    </h3>
                    {canCreate && (
                      <Link href={`${base}?view=day&month=${monthKey(y, mo)}&add=1&date=${dateKey(y, mo, d)}#d-${d}`} className="text-xs text-secondary hover:underline">
                        + Add to this day
                      </Link>
                    )}
                  </header>
                  <ul className="divide-y divide-neutral">
                    {list.map((it) => {
                      const c = planCompleteness(it);
                      const badge = (ok: boolean, text: string) => (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${ok ? "bg-green-100 text-green-800" : "bg-neutral text-primary/50"}`}>{text}</span>
                      );
                      return (
                        <li key={it.id}>
                          <Link href={`/content/${it.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm hover:bg-background">
                            <span className="w-12 shrink-0 text-xs text-primary/50">{it.scheduledTime ?? "—"}</span>
                            <span className="w-20 shrink-0 text-xs font-semibold text-primary">{TYPE_SHORT[it.type]}</span>
                            <span className="min-w-0 flex-1 truncate text-primary">{it.title}</span>
                            <span className="flex gap-1">
                              {badge(c.script, "Script")}
                              {badge(c.caption, "Caption")}
                              {badge(c.seo, "SEO")}
                              {badge(c.hashtags, `#${it.hashtags.length}`)}
                              {it.type === "BLOG" && badge(c.body, "Body")}
                              {user.role !== "CLIENT" && it.type !== "BLOG" && it.type !== "EMAIL_CAMPAIGN" && badge(it._count.creatives > 0, "Creative")}
                            </span>
                            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          {active.every((i) => !i.scheduledFor || i.scheduledFor.getUTCFullYear() !== y || i.scheduledFor.getUTCMonth() !== mo) && (
            <p className="rounded-lg border border-neutral bg-white p-6 text-center text-sm text-primary/60">Nothing planned for {monthLabel} yet.</p>
          )}
          {unscheduled.length > 0 && (
            <div className="rounded-lg border border-neutral bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-primary">Unscheduled</h3>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {unscheduled.map((it) => <Chip key={it.id} item={it} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "board" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {BOARD_COLUMNS.filter((s) => user.role !== "CLIENT" || CLIENT_VISIBLE.includes(s)).map((status) => {
              const col = active.filter((i) => i.status === status);
              return (
                <div key={status} className="w-56 shrink-0 rounded-lg border border-neutral bg-white p-2">
                  <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-primary">
                    {STATUS_LABEL[status]} <span className="text-primary/50">{col.length}</span>
                  </div>
                  {col.map((it) => (
                    <Link key={it.id} href={`/content/${it.id}`} className="mb-2 block rounded-md border border-neutral bg-background p-2 text-xs hover:border-secondary">
                      <div className="font-medium text-primary">{it.title}</div>
                      <div className="mt-1 text-primary/60">{TYPE_LABEL[it.type]} · {formatDate(it.scheduledFor)}</div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border border-neutral bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral text-xs uppercase text-primary/60">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-neutral last:border-0 hover:bg-background">
                  <td className="px-3 py-2"><Link href={`/content/${it.id}`} className="font-medium text-primary hover:text-secondary">{it.title}</Link></td>
                  <td className="px-3 py-2 text-primary/70">{TYPE_LABEL[it.type]}</td>
                  <td className="px-3 py-2 text-primary/70">{formatDate(it.scheduledFor)}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[it.status]}`}>{STATUS_LABEL[it.status]}</span></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-primary/60">No content yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
