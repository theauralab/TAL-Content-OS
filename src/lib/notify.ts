import { after } from "next/server";
import type { ApprovalStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl, reviewEmail, sendEmail } from "@/lib/email";

/**
 * Emails every active login of a client when something is waiting for their decision.
 * Runs after the response is sent, so it never slows the action down and never fails it.
 */
export function notifyClientReview(p: { clientId: string; contentId: string; stage: ApprovalStage; title: string; brandName: string }) {
  after(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { clientId: p.clientId, isActive: true, deletedAt: null },
        select: { name: true, email: true },
      });
      await Promise.all(
        users.map((u) => {
          const m = reviewEmail({ name: u.name, stage: p.stage, title: p.title, brand: p.brandName, url: `${appUrl()}/content/${p.contentId}` });
          return sendEmail({ to: u.email, ...m });
        }),
      );
    } catch (e) {
      console.error("Review notification failed", e);
    }
  });
}
