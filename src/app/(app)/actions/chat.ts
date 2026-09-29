"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { requireUser, requireClient } from "@/lib/access";
import { triggerEvent } from "@/lib/pusher-server";
import { getOrCreateDiscussion } from "@/lib/chat";

export type ChatResult = { ok: boolean; message: string } | null;

const sendSchema = z.object({ clientId: z.string().min(1), body: z.string().trim().min(1).max(4000) });

export async function sendMessage(_prev: ChatResult, formData: FormData): Promise<ChatResult> {
  try {
    const user = await requireUser();
    if (!can(user.role, "chat", "create")) return { ok: false, message: "Not permitted to send messages" };

    const parsed = sendSchema.safeParse({ clientId: formData.get("clientId"), body: formData.get("body") });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

    const client = await requireClient(parsed.data.clientId, user); // tenant check
    const discussion = await getOrCreateDiscussion(client.id);

    const message = await prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { discussionId: discussion.id, senderId: user.id, body: parsed.data.body } });
      await tx.discussion.update({ where: { id: discussion.id }, data: { updatedAt: new Date() } });
      await tx.chatRead.upsert({
        where: { discussionId_userId: { discussionId: discussion.id, userId: user.id } },
        update: { lastReadAt: new Date() },
        create: { discussionId: discussion.id, userId: user.id },
      });
      return m;
    });

    // Both sides hear it: the client's own channel, and the agency org channel (so any teammate's inbox updates).
    const payload = { clientId: client.id, senderId: user.id, senderName: user.name ?? "Someone", body: message.body, createdAt: message.createdAt.toISOString() };
    await triggerEvent(`private-client-${client.id}`, "chat_message", payload);
    await triggerEvent(`private-org-${user.organizationId}`, "chat_message", payload);

    revalidatePath("/chat");
    return { ok: true, message: "Sent" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't send the message" };
  }
}

export async function markChatRead(formData: FormData): Promise<void> {
  const user = await requireUser();
  const clientId = z.string().min(1).parse(formData.get("clientId"));
  const client = await requireClient(clientId, user);
  const discussion = await getOrCreateDiscussion(client.id);
  await prisma.chatRead.upsert({
    where: { discussionId_userId: { discussionId: discussion.id, userId: user.id } },
    update: { lastReadAt: new Date() },
    create: { discussionId: discussion.id, userId: user.id },
  });
  revalidatePath("/chat");
}
