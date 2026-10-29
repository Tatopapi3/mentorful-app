"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fetchMessages, sendMessage } from "@/app/dashboard/aurora/hub-actions";
import { createLive, liveAvailable } from "@/lib/teacher/live";
import type { Message } from "@/lib/teacher/hub-data";
import { Icon } from "./icons";
import { OPEN_CHAT, openVisit } from "./open-events";
import { Stamp } from "./stamp";

export type ChatPair = { pairingId: string; partnerName: string; partnerFirst: string; initials: string };

// What the teacher has read, per pairing, kept on this device. It only drives the little unread dot.
const SEEN_KEY = "mentorful:pair-chat-seen";
const SEEN_EVENT = "ta-chat-seen";
const subscribeSeen = (cb: () => void) => {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SEEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "{}";
  } catch {
    return "{}";
  }
};
const markSeen = (pairingId: string, at: string) => {
  try {
    const cur = JSON.parse(readSeen()) as Record<string, string>;
    if ((cur[pairingId] ?? "") >= at) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...cur, [pairingId]: at }));
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // storage blocked: the dot just stays
  }
};

const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today.getTime() - 86_400_000);
  return d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

export function ChatDrawer({ pairs, initial }: { pairs: ChatPair[]; initial: Message[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(pairs[0]?.pairingId ?? "");
  const [byPair, setByPair] = useState<Record<string, Message[]>>(() => {
    const m: Record<string, Message[]> = {};
    for (const p of pairs) m[p.pairingId] = initial.filter((x) => x.pairingId === p.pairingId);
    return m;
  });
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => "{}");
  const pair = pairs.find((p) => p.pairingId === active) ?? pairs[0];

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ pairingId?: string }>).detail?.pairingId;
      if (id && pairs.some((p) => p.pairingId === id)) setActive(id);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHAT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT, onOpen);
  }, [pairs]);

  // Pick up new messages: quickly while the drawer is open, slowly while it is closed (just for the unread dot).
  const poll = useCallback(async () => {
    for (const p of pairs) {
      if (document.visibilityState !== "visible") return;
      const rows = await fetchMessages(p.pairingId).catch(() => null);
      if (rows) setByPair((cur) => (cur[p.pairingId]?.length === rows.length && cur[p.pairingId]?.at(-1)?.id === rows.at(-1)?.id ? cur : { ...cur, [p.pairingId]: rows }));
    }
  }, [pairs]);
  useEffect(() => {
    if (!pairs.length) return;
    const id = setInterval(() => void poll(), open ? 5_000 : 30_000);
    return () => clearInterval(id);
  }, [open, poll, pairs.length]);

  const messages = useMemo(() => byPair[pair?.pairingId ?? ""] ?? [], [byPair, pair]);
  const lastAt = messages.at(-1)?.at;

  // While the drawer shows a conversation, it counts as read; keep the view pinned to the newest message.
  useEffect(() => {
    if (open && pair && lastAt) markSeen(pair.pairingId, lastAt);
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, pair, lastAt]);

  const unread = useMemo(() => {
    const s = JSON.parse(seen) as Record<string, string>;
    return pairs.reduce((n, p) => n + (byPair[p.pairingId] ?? []).filter((m) => !m.mine && m.at > (s[p.pairingId] ?? "")).length, 0);
  }, [seen, byPair, pairs]);

  if (!pairs.length || !pair) return null;

  async function send(body: string) {
    setSending(true);
    setError("");
    const r = await sendMessage(pair.pairingId, body);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setByPair((cur) => ({ ...cur, [pair.pairingId]: r.messages }));
    setText("");
  }

  async function share(files: File[]) {
    if (!files.length) return;
    if (!liveAvailable()) return setError("File sharing needs the live connection. It isn't on in this preview.");
    setSharing(true);
    setError("");
    const res = await createLive(() => {}).upload(pair.pairingId, files);
    setSharing(false);
    if (res.failed.length) setError(`Couldn't share ${res.failed.join(", ")}. Files up to 200 MB work.`);
    if (res.ok) await send(`Shared ${res.ok === 1 ? files[0].name : `${res.ok} files`} in our visit screen.`);
  }

  let lastDay = "";
  return (
    <>
      <button type="button" className="ta-chatfab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="ta-chat" aria-label={`Pair chat${unread ? `, ${unread} unread` : ""}`}>
        <Icon name="chat" size={22} />
        <span className="ta-chatfab-label">Chat</span>
        {unread > 0 ? <span className="ta-unread">{unread}</span> : null}
      </button>

      {open ? (
        <section id="ta-chat" className="ta-chat" role="dialog" aria-label="Pair chat">
          <header className="ta-chat-head">
            <div>
              <h3>Pair chat</h3>
              <small className="ev-privacy">
                <Icon name="lock" size={12} /> Only you and {pairs.length > 1 ? "each co-mentor" : pair.partnerFirst}
              </small>
            </div>
            <span className="ta-spacer" />
            <button type="button" className="ta-iconbtn" onClick={() => openVisit(pair.pairingId)} aria-label={`Start a visit with ${pair.partnerFirst}`} title="Visit screen">
              <Icon name="video" size={16} />
            </button>
            <button type="button" className="ta-iconbtn" onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="close" size={16} />
            </button>
          </header>

          {pairs.length > 1 ? (
            <div className="ev-tabs ta-chat-tabs" role="tablist" aria-label="Choose a co-mentor">
              {pairs.map((p) => {
                const s = (JSON.parse(seen) as Record<string, string>)[p.pairingId] ?? "";
                const n = (byPair[p.pairingId] ?? []).filter((m) => !m.mine && m.at > s).length;
                return (
                  <button key={p.pairingId} role="tab" aria-selected={p.pairingId === pair.pairingId} className={p.pairingId === pair.pairingId ? "on" : ""} onClick={() => setActive(p.pairingId)}>
                    {p.partnerFirst}
                    {n > 0 ? <span className="ta-dot" aria-label={`${n} unread`} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="ta-msgs" ref={listRef} role="log" aria-label={`Messages with ${pair.partnerName}`}>
            {messages.length === 0 ? (
              <p className="ev-muted ta-msgs-empty">Nothing here yet. Say hello to {pair.partnerFirst}: a line about what you&rsquo;re each trying this week is a good start.</p>
            ) : (
              messages.map((m) => {
                const k = dayKey(m.at);
                const head = k !== lastDay ? <div className="ta-day">{dayLabel(m.at)}</div> : null;
                lastDay = k;
                return (
                  <div key={m.id}>
                    {head}
                    <div className={`ta-msg${m.mine ? " me" : ""}`}>
                      <p>{m.text}</p>
                      <small>
                        {m.mine ? "You" : pair.partnerFirst} · <Stamp iso={m.at} kind="time" />
                      </small>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error ? (
            <p className="ev-alert ta-chat-err" role="alert">
              {error}
            </p>
          ) : null}
          <form
            className="ta-compose"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send(text);
            }}
          >
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void share([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <button type="button" className="ta-iconbtn" onClick={() => fileRef.current?.click()} disabled={sharing} aria-label="Share a file" title="Share a file">
              <Icon name="paperclip" size={16} />
            </button>
            <label className="sr-only" htmlFor="ta-chat-in">
              Message {pair.partnerFirst}
            </label>
            <input id="ta-chat-in" className="ev-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${pair.partnerFirst}…`} maxLength={2000} autoComplete="off" />
            <button type="submit" className="ev-btn primary sm" disabled={sending || !text.trim()} aria-label="Send message">
              <Icon name="send" size={15} />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
