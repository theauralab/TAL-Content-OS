import PusherServer from "pusher";

let instance: PusherServer | null = null;

export function getPusherServer(): PusherServer | null {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null;
  if (!instance) {
    instance = new PusherServer({
      appId: PUSHER_APP_ID,
      key: PUSHER_KEY,
      secret: PUSHER_SECRET,
      cluster: PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return instance;
}

/**
 * Channel convention: private-org-{orgId} (agency-wide), private-client-{clientId}.
 * Never throws: real-time is best-effort and must not break the write that triggered it.
 */
export async function triggerEvent(channel: string, event: string, payload: unknown) {
  const pusher = getPusherServer();
  if (!pusher) return;
  try {
    await pusher.trigger(channel, event, payload);
  } catch (err) {
    console.error("Pusher trigger failed", err);
  }
}
