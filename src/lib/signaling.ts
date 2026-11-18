import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { SignalMessage } from "./types";

export type SignalHandler = (message: SignalMessage) => void;
export type StatusHandler = (status: SignalStatus) => void;
export type SignalStatus = "connecting" | "connected" | "closed" | "error";

export interface SignalTransport {
  readonly kind: "supabase" | "broadcast-channel";
  send(message: SignalMessage): void;
  close(): void;
  onStatus?: StatusHandler;
}

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!supabase) {
    supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 40 } },
      auth: { persistSession: false },
    });
  }
  return supabase;
}

export function signalingMode(): "supabase" | "broadcast-channel" {
  return getSupabase() ? "supabase" : "broadcast-channel";
}

export function createTransport(
  roomCode: string,
  selfId: string,
  onMessage: SignalHandler,
  onStatus?: StatusHandler,
): SignalTransport {
  const client = getSupabase();
  if (client) {
    const channel: RealtimeChannel = client.channel(`pb:${roomCode}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: selfId } },
    });
    channel.on("broadcast", { event: "signal" }, (payload) => {
      const message = payload.payload as SignalMessage & { from?: string };
      onMessage(message);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus?.("connected");
      else if (status === "CHANNEL_ERROR") onStatus?.("error");
      else if (status === "CLOSED") onStatus?.("closed");
      else onStatus?.("connecting");
    });

    return {
      kind: "supabase",
      send(message) {
        void channel.send({ type: "broadcast", event: "signal", payload: message });
      },
      close() {
        void client.removeChannel(channel);
      },
      onStatus,
    };
  }

  // Demo mode: BroadcastChannel keeps multi-tab testing on one machine working
  // (open the room in a second tab, invite yourself).
  const channel = new BroadcastChannel(`pb:${roomCode}`);
  channel.onmessage = (event: MessageEvent<SignalMessage>) => {
    const message = event.data;
    if (!message) return;
    onMessage(message);
  };
  onStatus?.("connected");

  return {
    kind: "broadcast-channel",
    send(message) {
      channel.postMessage(message);
    },
    close() {
      channel.close();
    },
    onStatus,
  };
}
