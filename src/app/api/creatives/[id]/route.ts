import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, assertTenantScope } from "@/lib/rbac";
import { requireUser } from "@/lib/access";
import { CLIENT_VISIBLE, maxRoundVisibleToClient } from "@/lib/content";
import { parseHttpUrl } from "@/lib/creatives";
import { presignDownload, storageConfigured } from "@/lib/storage";

const noStore = { "Cache-Control": "private, no-store" };
const notFound = () => new NextResponse("Not found", { status: 404, headers: noStore });

// Every file is served through here: sign-in required, tenant checked, and clients only ever get
// work that has actually been sent to them. The browser is then redirected to a short-lived signed R2 URL.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let user;
  try {
    user = await requireUser();
  } catch {
    return new NextResponse("Unauthorized", { status: 401, headers: noStore });
  }
  if (!can(user.role, "content", "read")) return notFound();

  const c = await prisma.creative.findFirst({
    where: { id, deletedAt: null, contentItem: { deletedAt: null, brand: { deletedAt: null, client: { deletedAt: null } } } },
    include: { contentItem: { include: { brand: { include: { client: true } } } } },
  });
  if (!c) return notFound();

  try {
    assertTenantScope({
      sessionOrgId: user.organizationId,
      sessionClientId: user.clientId,
      role: user.role,
      targetOrgId: c.contentItem.brand.client.organizationId,
      targetClientId: c.contentItem.brand.client.id,
    });
  } catch {
    return notFound(); // don't reveal that it exists
  }

  if (user.role === "CLIENT") {
    const item = c.contentItem;
    if (!CLIENT_VISIBLE.includes(item.status) || c.round > maxRoundVisibleToClient(item.status, item.creativeRound)) return notFound();
  }

  if (c.kind === "LINK") {
    const url = c.linkUrl ? parseHttpUrl(c.linkUrl) : null;
    return url ? NextResponse.redirect(url, { status: 302, headers: noStore }) : notFound();
  }
  if (!c.storageKey) return notFound();
  if (!storageConfigured()) return new NextResponse("File storage isn't configured", { status: 503, headers: noStore });

  const signed = await presignDownload(c.storageKey, {
    fileName: c.fileName,
    download: req.nextUrl.searchParams.get("download") === "1",
    contentType: c.mimeType,
  });
  return NextResponse.redirect(signed, { status: 302, headers: noStore });
}
