"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";

/** Refreshes the chat page when a message arrives on this channel — same low-tech pattern as LiveRefresh. */
export function ChatRefresh({ channel }: { channel: string }) {
  const router = useRouter();
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;
    const pusher = new Pusher(key, { cluster, authEndpoint: "/api/pusher/auth" });
    const ch = pusher.subscribe(channel);
    ch.bind("chat_message", () => router.refresh());
    return () => {
      pusher.unsubscribe(channel);
      pusher.disconnect();
    };
  }, [channel, router]);
  return null;
}
