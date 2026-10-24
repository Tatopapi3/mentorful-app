import { createClient } from "@/lib/supabase/client";

/**
 * What the visit screen on /dashboard/v2 uses to reach the other teacher in a
 * pairing. The artifact page calls it as `window.MF_live`; outside the app the
 * page finds no MF_live and falls back to one device.
 *
 * Everything is scoped to one pairing and enforced by 016's policies, not by
 * this file:
 *  - `pair:<pairing_id>` is a private Realtime channel. It carries the WebRTC
 *    handshake, presence, the shared YouTube link and "files changed" pings.
 *    Audio and video go browser to browser; they never pass through Supabase.
 *  - Files live in the private `pair-files` bucket under `<pairing_id>/`.
 *  - New and submitted logs arrive as postgres_changes, filtered by RLS to the
 *    logs this teacher is a party to (011).
 */

export type PairFile = { name: string; label: string; size: number; created_at: string };

export type LiveHandlers = {
  onStatus?: (status: string) => void;
  onPresence?: (others: number) => void;
  onSignal?: (payload: Record<string, unknown>) => void;
  onYoutube?: (id: string | null) => void;
  onFiles?: () => void;
};

export type PairChannel = {
  send: (event: "signal" | "youtube" | "files", payload: Record<string, unknown>) => Promise<void>;
  leave: () => Promise<void>;
};

const BUCKET = "pair-files";

/** Public STUN only: enough on most school and home networks. Strict
 *  firewalls need a TURN server, set through NEXT_PUBLIC_TURN_URL and friends. */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

/** Keep the original name readable, but make the path safe and unique. */
function objectName(file: File) {
  const clean = file.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(0, 80) || "file";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${clean}`;
}

export function createLive(onLogsChanged: () => void) {
  const supabase = createClient();
  let logsChannel: ReturnType<typeof supabase.channel> | null = null;

  return {
    available: true as const,
    iceServers,

    /** Join one pairing's private channel. */
    async join(pairingId: string, h: LiveHandlers): Promise<PairChannel> {
      // Private channels authorise with the signed-in user's token.
      await supabase.realtime.setAuth();
      const channel = supabase.channel(`pair:${pairingId}`, {
        config: { private: true, broadcast: { self: false }, presence: { key: crypto.randomUUID() } },
      });
      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => h.onSignal?.(payload))
        .on("broadcast", { event: "youtube" }, ({ payload }) => h.onYoutube?.((payload?.id as string) ?? null))
        .on("broadcast", { event: "files" }, () => h.onFiles?.())
        .on("presence", { event: "sync" }, () => h.onPresence?.(Math.max(0, Object.keys(channel.presenceState()).length - 1)))
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track({ at: new Date().toISOString() });
          h.onStatus?.(status);
        });
      return {
        async send(event, payload) {
          await channel.send({ type: "broadcast", event, payload });
        },
        async leave() {
          await supabase.removeChannel(channel);
        },
      };
    },

    /** Refresh the dashboard whenever a log this teacher can read changes. */
    watchLogs() {
      if (logsChannel) return;
      logsChannel = supabase
        .channel("my-conversation-logs")
        .on("postgres_changes", { event: "*", schema: "public", table: "conversation_logs" }, () => onLogsChanged())
        .subscribe();
    },

    async listFiles(pairingId: string): Promise<PairFile[]> {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(pairingId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter((f) => f.name && f.id)
        .map((f) => ({
          name: f.name,
          label: f.name.replace(/^\d+-[a-z0-9]{5}-/, ""),
          size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
          created_at: f.created_at ?? "",
        }));
    },

    async upload(pairingId: string, files: File[]): Promise<{ ok: number; failed: string[] }> {
      let ok = 0;
      const failed: string[] = [];
      for (const file of files) {
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(`${pairingId}/${objectName(file)}`, file, { contentType: file.type || undefined, upsert: false });
        if (error) failed.push(file.name);
        else ok++;
      }
      return { ok, failed };
    },

    /** A short-lived link that downloads the file under its original name. */
    async downloadUrl(pairingId: string, file: PairFile): Promise<string> {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(`${pairingId}/${file.name}`, 120, { download: file.label });
      if (error || !data) throw new Error(error?.message ?? "No link");
      return data.signedUrl;
    },

    async close() {
      if (logsChannel) await supabase.removeChannel(logsChannel);
      logsChannel = null;
    },
  };
}

export type Live = ReturnType<typeof createLive>;
