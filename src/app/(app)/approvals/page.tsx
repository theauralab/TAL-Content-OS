import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { STATUS_LABEL, STATUS_STYLE, TYPE_LABEL, formatDate } from "@/lib/content";
import { BulkApprove, type PendingGroup } from "@/components/content/bulk-approve";
import { LiveRefresh } from "@/components/common/live-refresh";
import { channelFor } from "@/lib/access";

const ago = (d: Date) => {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

const TEAM_SECTIONS: { title: string; sub: string; statuses: ContentStatus[] }[] = [
  { title: "Waiting on the client", sub: "Sent for review — nudge if it's been a few days.", statuses: ["CLIENT_REVIEW", "CREATIVE_REVIEW"] },
  { title: "Client asked for changes", sub: "Update and send back.", statuses: ["CHANGES_REQUESTED", "CREATIVE_CHANGES_REQUESTED"] },
  { title: "Plan approved — needs creative", sub: "Upload the reel / carousel / post.", statuses: ["APPROVED", "IN_PRODUCTION"] },
  { title: "Ready to publish", sub: "Approved by the client at both gates.", statuses: ["READY_TO_PUBLISH", "SCHEDULED"] },
];

export default async function ApprovalsPage() {
  const user = await requireUser();
  const isClient = user.role === "CLIENT";
  const brand = isClient
    ? { clientId: user.clientId ?? "__none__", deletedAt: null }
    : { deletedAt: null, client: { organizationId: user.organizationId, deletedAt: null } };

  if (isClient) {
    const items = await prisma.contentItem.findMany({
      where: { deletedAt: null, brand, status: { in: ["CLIENT_REVIEW", "CREATIVE_REVIEW"] } },
      include: { brand: { select: { name: true } } },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: 300,
    });
    const row = (i: (typeof items)[number]) => ({ id: i.id, title: i.title, type: TYPE_LABEL[i.type], brand: i.brand.name, date: formatDate(i.scheduledFor) });
    const groups: PendingGroup[] = [
      { key: "plan", heading: "Step 1 — Scripts & captions", sub: "Approve the plan and we'll start producing it.", rows: items.filter((i) => i.status === "CLIENT_REVIEW").map(row) },
      { key: "creative", heading: "Step 2 — Finished creatives", sub: "Approve the final reel, carousel or post and it's cleared to publish.", rows: items.filter((i) => i.status === "CREATIVE_REVIEW").map(row) },
    ].filter((g) => g.rows.length > 0);

    return (
      <div className="space-y-6">
        <LiveRefresh channel={channelFor(user)} />
        <div>
          <h1 className="text-lg font-semibold text-primary">Needs your review</h1>
          <p className="text-sm text-primary/60">Everything waiting for your approval, in one place.</p>
        </div>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-neutral bg-white p-8 text-center text-sm text-primary/60">You&apos;re all caught up — nothing is waiting for your review. 🎉</p>
        ) : (
          <BulkApprove groups={groups} />
        )}
      </div>
    );
  }

  const items = await prisma.contentItem.findMany({
    where: { deletedAt: null, brand, status: { in: TEAM_SECTIONS.flatMap((s) => s.statuses) } },
    include: { brand: { select: { name: true, client: { select: { name: true } } } } },
    orderBy: { updatedAt: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <LiveRefresh channel={channelFor(user)} />
      <div>
        <h1 className="text-lg font-semibold text-primary">Approvals &amp; publishing</h1>
        <p className="text-sm text-primary/60">Where every piece of content is in the two-step client approval.</p>
      </div>
      {TEAM_SECTIONS.map((sec) => {
        const list = items.filter((i) => sec.statuses.includes(i.status));
        return (
          <section key={sec.title} className="rounded-lg border border-neutral bg-white">
            <header className="border-b border-neutral px-4 py-2">
              <h2 className="text-sm font-semibold text-primary">{sec.title} <span className="font-normal text-primary/50">· {list.length}</span></h2>
              <p className="text-xs text-primary/50">{sec.sub}</p>
            </header>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-primary/40">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-neutral">
                {list.map((i) => (
                  <li key={i.id}>
                    <Link href={`/content/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-background">
                      <span className="min-w-0 flex-1 truncate font-medium text-primary">{i.title}</span>
                      <span className="text-xs text-primary/60">{i.brand.client.name} · {i.brand.name} · {TYPE_LABEL[i.type]}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                      <span className="w-20 text-right text-xs text-primary/50">{ago(i.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
