import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { LiveActivityFeed } from "@/components/layout/live-activity-feed";

export default async function DashboardPage() {
  const user = await requireUser();
  const { organizationId, role, clientId } = user;
  const isClient = role === "CLIENT";

  const brandWhere = isClient
    ? { clientId: clientId ?? "__none__", deletedAt: null }
    : { deletedAt: null, client: { organizationId, deletedAt: null } };
  const inScope = {
    deletedAt: null,
    brand: isClient
      ? { clientId: clientId ?? "__none__", deletedAt: null }
      : { deletedAt: null, client: { organizationId, deletedAt: null } },
  };
  const count = (statuses: ContentStatus[]) => prisma.contentItem.count({ where: { ...inScope, status: { in: statuses } } });

  const [clientCount, brandCount, pending, production, ready] = await Promise.all([
    isClient ? Promise.resolve(1) : prisma.client.count({ where: { organizationId, deletedAt: null } }),
    prisma.brand.count({ where: brandWhere }),
    count(["CLIENT_REVIEW", "CREATIVE_REVIEW"]),
    count(["APPROVED", "IN_PRODUCTION"]),
    count(["READY_TO_PUBLISH", "SCHEDULED"]),
  ]);

  const cards: { label: string; value: number; href?: string }[] = isClient
    ? [
        { label: "Needs your review", value: pending, href: "/approvals" },
        { label: "Being produced", value: production },
        { label: "Approved & ready to go", value: ready },
      ]
    : [
        { label: "Total clients", value: clientCount, href: "/clients" },
        { label: "Active brands", value: brandCount },
        { label: "Awaiting client approval", value: pending, href: "/approvals" },
        { label: "In production", value: production, href: "/approvals" },
        { label: "Ready to publish", value: ready, href: "/approvals" },
      ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-primary">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-2xl font-semibold text-primary">{c.value}</div>
              <div className="text-sm text-primary/60">{c.label}</div>
            </>
          );
          const cls = "rounded-lg border border-neutral bg-white p-4";
          return c.href ? (
            <Link key={c.label} href={c.href} className={`${cls} hover:border-secondary`}>{inner}</Link>
          ) : (
            <div key={c.label} className={cls}>{inner}</div>
          );
        })}
      </div>
      <LiveActivityFeed organizationId={organizationId} clientId={clientId} role={role} />
    </div>
  );
}
