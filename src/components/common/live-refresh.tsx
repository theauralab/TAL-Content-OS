"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";

// Re-renders the current server page when a real-time event arrives.
// Pass contentId to react only to events about that content item.
export function LiveRefresh({ channel, contentId }: { channel: string; contentId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const pusher = new Pusher(key, { cluster, authEndpoint: "/api/pusher/auth" });
    const ch = pusher.subscribe(channel);
    ch.bind("activity", (payload: { contentId?: string }) => {
      if (!contentId || payload.contentId === contentId) router.refresh();
    });
    return () => {
      pusher.unsubscribe(channel);
      pusher.disconnect();
    };
  }, [channel, contentId, router]);

  return null;
}
