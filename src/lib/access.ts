import type { RoleName } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertTenantScope } from "@/lib/rbac";
import { triggerEvent } from "@/lib/pusher-server";
import { CLIENT_VISIBLE } from "@/lib/content";

export type SessionUser = {
  id: string;
  name?: string | null;
  organizationId: string;
  role: RoleName;
  clientId: string | null;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const sid = (session?.user as { id?: string } | undefined)?.id;
  if (!sid) throw new Error("Unauthorized");

  // JWT sessions outlive the account, so re-read the user: deactivating a login or changing a
  // role in the admin panel takes effect on the very next request.
  const u = await prisma.user.findUnique({ where: { id: sid }, include: { role: true } });
  if (!u || u.deletedAt || !u.isActive) throw new Error("Unauthorized");
  return { id: u.id, name: u.name, organizationId: u.organizationId, role: u.role.name, clientId: u.clientId };
}

export async function requireClient(clientId: string, user: SessionUser) {
  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!client) throw new Error("Client not found");
  assertTenantScope({
    sessionOrgId: user.organizationId,
    sessionClientId: user.clientId,
    role: user.role,
    targetOrgId: client.organizationId,
    targetClientId: client.id,
  });
  return client;
}

export async function requireBrand(brandId: string, user: SessionUser) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, deletedAt: null, client: { deletedAt: null } },
    include: { client: true },
  });
  if (!brand) throw new Error("Brand not found");
  assertTenantScope({
    sessionOrgId: user.organizationId,
    sessionClientId: user.clientId,
    role: user.role,
    targetOrgId: brand.client.organizationId,
    targetClientId: brand.client.id,
  });
  return brand;
}

export async function requireContent(contentId: string, user: SessionUser) {
  const item = await prisma.contentItem.findFirst({
    where: { id: contentId, deletedAt: null, brand: { deletedAt: null, client: { deletedAt: null } } },
    include: { brand: { include: { client: true } } },
  });
  if (!item) throw new Error("Content not found");
  assertTenantScope({
    sessionOrgId: user.organizationId,
    sessionClientId: user.clientId,
    role: user.role,
    targetOrgId: item.brand.client.organizationId,
    targetClientId: item.brand.client.id,
  });
  if (user.role === "CLIENT" && !CLIENT_VISIBLE.includes(item.status)) {
    throw new Error("Content not found");
  }
  return item;
}

export function channelFor(user: SessionUser) {
  return user.role === "CLIENT" && user.clientId
    ? `private-client-${user.clientId}`
    : `private-org-${user.organizationId}`;
}

/** Real-time broadcast. The org channel always hears it; the client channel only when toClient. */
export async function broadcast(p: {
  organizationId: string;
  clientId: string;
  toClient: boolean;
  title: string;
  body?: string;
  contentId?: string;
}) {
  const payload = { title: p.title, body: p.body, contentId: p.contentId, createdAt: new Date().toISOString() };
  await triggerEvent(`private-org-${p.organizationId}`, "activity", payload);
  if (p.toClient) await triggerEvent(`private-client-${p.clientId}`, "activity", payload);
}
