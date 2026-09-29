"use client";

import { useEffect, useState } from "react";
import Pusher from "pusher-js";

type ActivityEvent = { title: string; body?: string; createdAt: string };

export function LiveActivityFeed({
  organizationId,
  clientId,
  role,
}: {
  organizationId: string;
  clientId: string | null;
  role: string;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channelName = role === "CLIENT" && clientId
      ? `private-client-${clientId}`
      : `private-org-${organizationId}`;

    const channel = pusher.subscribe(channelName);
    channel.bind("activity", (payload: ActivityEvent) => {
      setEvents((prev) => [payload, ...prev].slice(0, 20));
    });

    return () => {
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [organizationId, clientId, role]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#002A38]">Live activity</h3>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing yet — activity will appear here in real time.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-[#002A38]">{e.title}</span>
              {e.body && <span className="text-neutral-500"> — {e.body}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
