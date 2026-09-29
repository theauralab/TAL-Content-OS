import { auth } from "@/auth";
import { getPusherServer } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";

// Authorizes a browser to subscribe to a private-* Pusher channel. We only
// authorize channels that match the caller's own org/client — this is the
// real tenant-isolation boundary for real-time data, not the client SDK.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData();
  const socketId = form.get("socket_id") as string;
  const channel = form.get("channel_name") as string;

  const { organizationId, clientId, role } = session.user as any;

  const allowedOrgChannel = `private-org-${organizationId}`;
  const allowedClientChannel = clientId ? `private-client-${clientId}` : null;

  if (channel !== allowedOrgChannel && channel !== allowedClientChannel) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // CLIENT-role users only ever get their own client channel, never the org one.
  if (role === "CLIENT" && channel === allowedOrgChannel) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) return new NextResponse("Realtime not configured", { status: 503 });

  const authResponse = pusher.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
