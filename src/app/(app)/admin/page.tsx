import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/access";
import { STATUS_LABEL } from "@/lib/content";

const STATUS_DOT: Record<string, string> = { active: "bg-success", paused: "bg-warning", churned: "bg-neutral" };

export default async function AdminOverviewPage() {
  const user = await requireUser();
  if (!can(user.role, "client", "update")) notFound();
  const org = user.organizationId;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const inOrg = { deletedAt: null, brand: { deletedAt: null, client: { organizationId: org, deletedAt: null } } };

  const [clients, teamCount, clientLogins, byStatus, thisMonth] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: org, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        brands: { where: { deletedAt: null }, select: { id: true, contentItems: { where: { deletedAt: null, status: { in: ["CLIENT_REVIEW", "CHANGES_REQUESTED", "APPROVED", "IN_PRODUCTION", "CREATIVE_REVIEW", "CREATIVE_CHANGES_REQUESTED", "READY_TO_PUBLISH"] } }, select: { status: true } } } },
        users: { where: { deletedAt: null }, select: { isActive: true, lastLoginAt: true, invitedAt: true } },
      },
    }),
    prisma.user.count({ where: { organizationId: org, deletedAt: null, isActive: true, role: { name: { not: "CLIENT" } } } }),
    prisma.user.count({ where: { organizationId: org, deletedAt: null, isActive: true, role: { name: "CLIENT" } } }),
    prisma.contentItem.groupBy({ by: ["status"], where: inOrg, _count: true }),
    prisma.contentItem.count({ where: { ...inOrg, scheduledFor: { gte: monthStart, lt: monthEnd }, status: { not: "ARCHIVED" } } }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const cards = [
    { label: "Active clients", value: clients.filter((c) => c.status === "active").length },
    { label: "Client logins", value: clientLogins },
    { label: "Team members", value: teamCount },
    { label: "Planned this month", value: thisMonth },
    { label: "Changes requested", value: count("CHANGES_REQUESTED") + count("CREATIVE_CHANGES_REQUESTED") },
    { label: STATUS_LABEL.CLIENT_REVIEW, value: count("CLIENT_REVIEW") },
    { label: STATUS_LABEL.CREATIVE_REVIEW, value: count("CREATIVE_REVIEW") },
    { label: "In production", value: count("APPROVED") + count("IN_PRODUCTION") },
    { label: STATUS_LABEL.READY_TO_PUBLISH, value: count("READY_TO_PUBLISH") },
  ];

  const ago = (d: Date | null | undefined) => {
    if (!d) return "Never";
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-primary">Admin panel</h1>
        <Link href="/admin/users" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">Manage logins</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-neutral bg-white p-4">
            <div className="text-2xl font-semibold text-primary">{c.value}</div>
            <div className="text-sm text-primary/60">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-neutral text-xs uppercase text-primary/60">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Brands</th>
              <th className="px-3 py-2">Plan with client</th>
              <th className="px-3 py-2">Creative with client</th>
              <th className="px-3 py-2">Changes requested</th>
              <th className="px-3 py-2">In production</th>
              <th className="px-3 py-2">Ready to publish</th>
              <th className="px-3 py-2">Logins</th>
              <th className="px-3 py-2">Last client login</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const items = c.brands.flatMap((b) => b.contentItems);
              const active = c.users.filter((u) => u.isActive);
              const last = c.users.map((u) => u.lastLoginAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
              const invited = c.users.map((u) => u.invitedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
              return (
                <tr key={c.id} className="border-b border-neutral last:border-0 hover:bg-background">
                  <td className="px-3 py-2"><Link href={`/clients/${c.id}`} className="font-medium text-primary hover:text-secondary">{c.name}</Link></td>
                  <td className="px-3 py-2 capitalize"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_DOT[c.status] ?? "bg-neutral"}`} />{c.status}</td>
                  <td className="px-3 py-2">{c.brands.length}</td>
                  <td className="px-3 py-2">{items.filter((i) => i.status === "CLIENT_REVIEW").length}</td>
                  <td className="px-3 py-2">{items.filter((i) => i.status === "CREATIVE_REVIEW").length}</td>
                  <td className="px-3 py-2">{items.filter((i) => i.status === "CHANGES_REQUESTED" || i.status === "CREATIVE_CHANGES_REQUESTED").length}</td>
                  <td className="px-3 py-2">{items.filter((i) => i.status === "APPROVED" || i.status === "IN_PRODUCTION").length}</td>
                  <td className="px-3 py-2">{items.filter((i) => i.status === "READY_TO_PUBLISH").length}</td>
                  <td className="px-3 py-2">
                    {active.length === 0 ? <Link href={`/clients/${c.id}`} className="text-warning hover:underline">No login yet</Link> : active.length}
                  </td>
                  <td className="px-3 py-2 text-primary/70">{last ? ago(last) : invited ? `Invited ${ago(invited)}` : "Never"}</td>
                </tr>
              );
            })}
            {clients.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-primary/60">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
