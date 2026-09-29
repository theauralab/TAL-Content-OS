import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/access";

export async function listClients() {
  const user = await requireUser();
  if (!can(user.role, "client", "read")) throw new Error("Not permitted to view clients");

  const brands = { where: { deletedAt: null } };
  if (user.role === "CLIENT") {
    return prisma.client.findMany({
      where: { id: user.clientId ?? "__none__", deletedAt: null },
      include: { brands },
    });
  }
  return prisma.client.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { brands },
    orderBy: { createdAt: "desc" },
  });
}
