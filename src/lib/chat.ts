import { prisma } from "@/lib/prisma";

/** One thread per client. Created lazily on first message so onboarding a client doesn't spam empty threads. */
export async function getOrCreateDiscussion(clientId: string) {
  return prisma.discussion.upsert({
    where: { clientId },
    update: {},
    create: { clientId, title: "General" },
  });
}

/** Read-only lookup — use this on read paths (page loads, badges) so viewing a client's page
 *  never writes a row for a client that's never been messaged. */
export async function findDiscussion(clientId: string) {
  return prisma.discussion.findUnique({ where: { clientId } });
}

/** Unread count for one user across their thread(s). Cheap: at most one row per discussion. */
export async function unreadCount(discussionId: string, userId: string) {
  const read = await prisma.chatRead.findUnique({ where: { discussionId_userId: { discussionId, userId } } });
  return prisma.message.count({
    where: { discussionId, senderId: { not: userId }, createdAt: read ? { gt: read.lastReadAt } : undefined },
  });
}

export type ChatPreview = {
  clientId: string;
  clientName: string;
  discussionId: string | null;
  lastBody: string | null;
  lastCreatedAt: Date | null;
  unread: number;
};

/**
 * Every client's chat preview (last message + unread count) for the team inbox, in one round
 * trip instead of ~2 queries per client. Previously this page ran an upsert (a write!) plus two
 * reads for every single client on every load — with dozens of clients that's 60+ sequential
 * DB calls, and each upsert created a Discussion row even for clients nobody had ever messaged.
 */
export async function listChatPreviews(organizationId: string, userId: string): Promise<ChatPreview[]> {
  const rows = await prisma.$queryRaw<
    { clientId: string; clientName: string; discussionId: string | null; lastBody: string | null; lastCreatedAt: Date | null; unread: number }[]
  >`
    SELECT
      c.id AS "clientId",
      c.name AS "clientName",
      d.id AS "discussionId",
      lm.body AS "lastBody",
      lm."createdAt" AS "lastCreatedAt",
      COALESCE(uc.count, 0) AS "unread"
    FROM "Client" c
    LEFT JOIN "Discussion" d ON d."clientId" = c.id
    LEFT JOIN LATERAL (
      SELECT body, "createdAt" FROM "Message" m WHERE m."discussionId" = d.id ORDER BY m."createdAt" DESC LIMIT 1
    ) lm ON true
    LEFT JOIN "ChatRead" r ON r."discussionId" = d.id AND r."userId" = ${userId}
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count FROM "Message" m2
      WHERE m2."discussionId" = d.id AND m2."senderId" != ${userId}
        AND (r."lastReadAt" IS NULL OR m2."createdAt" > r."lastReadAt")
    ) uc ON true
    WHERE c."organizationId" = ${organizationId} AND c."deletedAt" IS NULL
    ORDER BY lm."createdAt" DESC NULLS LAST, c.name ASC
  `;
  return rows.map((r) => ({ ...r, unread: Number(r.unread) })); // Number() is a no-op here but keeps this resilient if the driver ever returns bigint
}

/** Total unread across every client thread — for the nav badge. One query, no writes. */
export async function totalUnreadForOrg(organizationId: string, userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(uc.count), 0) AS total
    FROM "Client" c
    JOIN "Discussion" d ON d."clientId" = c.id
    LEFT JOIN "ChatRead" r ON r."discussionId" = d.id AND r."userId" = ${userId}
    JOIN LATERAL (
      SELECT COUNT(*)::int AS count FROM "Message" m
      WHERE m."discussionId" = d.id AND m."senderId" != ${userId}
        AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")
    ) uc ON true
    WHERE c."organizationId" = ${organizationId} AND c."deletedAt" IS NULL
  `;
  return Number(rows[0]?.total ?? 0);
}
