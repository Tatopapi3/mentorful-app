"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage } from "@/lib/teacher/hub-actions";
import { createLive, iceServers, liveAvailable, type Live, type PairChannel, type PairFile } from "@/lib/teacher/live";
import { Icon } from "./icons";
import { DEMO_INCOMING, OPEN_CALL } from "./open-events";
import { Overlay } from "./overlay";

/**
 * Video calling between co-mentors, built to feel like calling a friend rather than opening a room.
 *
 * Pressing "Video call" rings your co-mentor wherever they are in Mentorful: an incoming-call banner with Accept and
 * Decline appears for them, and their browser tab title flashes. If they answer, the two cameras connect directly
 * (browser to browser; the video never passes through Supabase). If they don't, after 45 seconds a "missed video call"
 * message is left in your pair chat.
 *
 * Underneath it is Bertrand's design from his visit screen: a private realtime channel per pairing (his 016 script),
 * and the rule that whoever has the smaller id makes the WebRTC offer so two people connecting at once get one
 * connection. A shared YouTube link and shared files from that screen live on in the call's Share panel.
 *
 * It rings only while the other person has Mentorful open: there are no push notifications. Strict school networks may
 * need a TURN server (NEXT_PUBLIC_TURN_URL) for video to connect.
 */

export type CallPair = { pairingId: string; partnerName: string; partnerFirst: string; initials: string };
type Phase = "calling" | "connecting" | "live" | "ended";
type CallState = { pairingId: string; phase: Phase; note: string };
type FileRow = { name: string; label: string; size: number };

const RING_MS = 45_000;
const MAX = 200 * 1024 * 1024;
const kb = (b: number) => (b < 1024 ? `${b} B` : b < 1_048_576 ? `${Math.round(b / 1024)} KB` : `${(b / 1_048_576).toFixed(1)} MB`);
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function youtubeId(s: string): string | null {
  try {
    const u = new URL(s.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12);
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

/** A soft two-note ring while a call comes in. Browsers may keep audio silent until the page has been used; the banner and the tab title carry the call either way. */
function startRing(): () => void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return () => {};
    const ctx = new Ctx();
    let on = true;
    const beep = (hz: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.3);
    };
    const ring = () => {
      if (!on) return;
      beep(523, 0);
      beep(659, 0.4);
    };
    ring();
    const id = setInterval(ring, 2200);
    return () => {
      on = false;
      clearInterval(id);
      void ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

type Api = {
  place: (pairingId?: string) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  play: (id: string) => void;
  addFiles: (files: File[]) => Promise<void>;
  download: (f: FileRow) => Promise<void>;
  refreshFiles: () => Promise<void>;
  close: () => void;
};

export function CallHost({ pairs, meId }: { pairs: CallPair[]; meId: string }) {
  const [incoming, setIncoming] = useState<string | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [remoteOn, setRemoteOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [panel, setPanel] = useState(false);
  const [note, setNote] = useState("");
  const [yt, setYt] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const selfEl = useRef<HTMLVideoElement | null>(null);
  const remoteEl = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const api = useRef<Api | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pairsKey = pairs.map((p) => p.pairingId).join(",");
  const byId = (id: string | null) => pairs.find((p) => p.pairingId === id) ?? null;

  // One long-lived session for the whole app: a channel per pairing so a call can ring anywhere, and the call machinery.
  useEffect(() => {
    let alive = true;
    const live = liveAvailable();
    const L: Live | null = live ? createLive(() => {}) : null;
    const channels = new Map<string, PairChannel>();
    const S = { callPair: null as string | null, phase: null as Phase | null, incoming: null as string | null, peer: null as RTCPeerConnection | null, ice: [] as RTCIceCandidateInit[], ringTimer: 0 as unknown as ReturnType<typeof setTimeout>, inTimer: 0 as unknown as ReturnType<typeof setTimeout>, stopRing: null as null | (() => void), title: "", startedAt: 0 };
    const name = (pid: string | null) => pairs.find((p) => p.pairingId === pid)?.partnerFirst ?? "your co-mentor";

    const send = (pid: string | null, event: "signal" | "youtube" | "files", payload: Record<string, unknown>) => {
      const ch = pid ? channels.get(pid) : undefined;
      return ch ? ch.send(event, payload).catch(() => {}) : Promise.resolve();
    };
    const sig = (pid: string | null, type: string, extra: Record<string, unknown> = {}) => send(pid, "signal", { type, from: meId, ...extra });

    const setPhase = (phase: Phase, noteText = "") => {
      S.phase = phase;
      if (alive) setCall((c) => (c ? { ...c, phase, note: noteText || c.note } : c));
    };

    const stopIncoming = () => {
      clearTimeout(S.inTimer);
      S.stopRing?.();
      S.stopRing = null;
      if (S.title) document.title = S.title;
      S.title = "";
      S.incoming = null;
      if (alive) setIncoming(null);
    };

    const stopMedia = () => {
      if (S.peer) {
        S.peer.ontrack = S.peer.onicecandidate = S.peer.onconnectionstatechange = null;
        S.peer.close();
      }
      S.peer = null;
      S.ice = [];
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      if (selfEl.current) selfEl.current.srcObject = null;
      if (remoteEl.current) remoteEl.current.srcObject = null;
      if (alive) setRemoteOn(false);
    };

    const endCall = (reason: string) => {
      clearTimeout(S.ringTimer);
      stopMedia();
      S.callPair = null;
      S.phase = "ended";
      if (alive) {
        setMuted(false);
        setCamOff(false);
        setCall((c) => (c ? { ...c, phase: "ended", note: reason } : c));
      }
    };

    const ensureLocal = async (): Promise<boolean> => {
      if (localRef.current) return true;
      if (!navigator.mediaDevices?.getUserMedia) {
        endCall("This browser can't open a camera for calls.");
        return false;
      }
      if (alive) setCall((c) => (c ? { ...c, note: "Allow camera and microphone access in your browser to start the call…" } : c));
      try {
        localRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        if (alive) setCall((c) => (c ? { ...c, note: "" } : c));
        if (selfEl.current) {
          selfEl.current.srcObject = localRef.current;
          void selfEl.current.play().catch(() => {});
        }
        return true;
      } catch (e) {
        endCall((e as Error)?.name === "NotAllowedError" ? "The camera or microphone was blocked. Allow access in your browser, then call again." : "No camera could be started.");
        return false;
      }
    };

    const makePeer = () => {
      if (S.peer) {
        S.peer.ontrack = S.peer.onicecandidate = S.peer.onconnectionstatechange = null;
        S.peer.close();
      }
      S.ice = [];
      const p = new RTCPeerConnection({ iceServers: iceServers() });
      S.peer = p;
      localRef.current?.getTracks().forEach((t) => p.addTrack(t, localRef.current!));
      p.onicecandidate = (e) => {
        if (e.candidate) void sig(S.callPair, "ice", { candidate: e.candidate.toJSON() });
      };
      p.ontrack = (e) => {
        if (remoteEl.current) {
          remoteEl.current.srcObject = e.streams[0];
          void remoteEl.current.play().catch(() => {});
        }
        S.startedAt = Date.now();
        if (alive) {
          setRemoteOn(true);
          setElapsed(0);
        }
        setPhase("live");
      };
      p.onconnectionstatechange = () => {
        const st = p.connectionState;
        if (st === "failed") endCall(`Couldn't connect to ${name(S.callPair)}. Strict school networks can block video; your admin may need to set up a TURN server.`);
        else if (st === "disconnected" || st === "closed") if (S.phase === "live") endCall(`${name(S.callPair)} left the call.`);
      };
    };
    const flushIce = async () => {
      for (const c of S.ice.splice(0)) await S.peer?.addIceCandidate(c).catch(() => {});
    };

    const handle = async (pid: string, m: Record<string, unknown>) => {
      if (!m || m.from === meId) return;
      try {
        switch (m.type) {
          case "ring":
            if (S.callPair) return void sig(pid, "busy");
            if (S.incoming) return;
            S.incoming = pid;
            if (alive) setIncoming(pid);
            S.stopRing = startRing();
            S.title = document.title;
            document.title = `Incoming call · ${name(pid)}`;
            S.inTimer = setTimeout(stopIncoming, RING_MS);
            return;
          case "cancel":
            if (S.incoming === pid) stopIncoming();
            return;
          case "accept":
            if (S.callPair === pid && S.phase === "calling") {
              clearTimeout(S.ringTimer);
              setPhase("connecting");
              void sig(pid, "hello");
            }
            return;
          case "decline":
          case "busy":
            if (S.callPair === pid) endCall(m.type === "busy" ? `${name(pid)} is on another call.` : `${name(pid)} can't talk right now.`);
            return;
          case "hello":
            if (S.callPair !== pid || !localRef.current) return;
            if (meId < String(m.from)) {
              makePeer();
              await S.peer!.setLocalDescription(await S.peer!.createOffer());
              void sig(pid, "offer", { sdp: S.peer!.localDescription!.toJSON() });
            } else void sig(pid, "hello");
            return;
          case "offer":
            if (S.callPair !== pid || !localRef.current) return;
            makePeer();
            await S.peer!.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
            await flushIce();
            await S.peer!.setLocalDescription(await S.peer!.createAnswer());
            void sig(pid, "answer", { sdp: S.peer!.localDescription!.toJSON() });
            return;
          case "answer":
            if (S.callPair === pid && S.peer && !S.peer.currentRemoteDescription) {
              await S.peer.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
              await flushIce();
            }
            return;
          case "ice":
            if (S.callPair !== pid) return;
            if (S.peer?.remoteDescription) await S.peer.addIceCandidate(m.candidate as RTCIceCandidateInit).catch(() => {});
            else S.ice.push(m.candidate as RTCIceCandidateInit);
            return;
          case "bye":
            if (S.callPair === pid) endCall(`${name(pid)} ended the call.`);
            return;
        }
      } catch {
        if (S.callPair === pid) endCall("The video connection hit a problem. Try calling again.");
      }
    };

    const refreshFiles = async () => {
      if (!L || !S.callPair) return;
      const pid = S.callPair;
      try {
        const list: PairFile[] = await L.listFiles(pid);
        if (alive && S.callPair === pid) setFiles(list.map((f) => ({ name: f.name, label: f.label, size: f.size })));
      } catch {
        if (alive) setFiles([]);
      }
    };

    const play = (id: string, share: boolean) => {
      if (!/^[\w-]{11}$/.test(id)) return;
      if (alive) {
        setYt(id);
        setNote(share ? `Playing for you and ${name(S.callPair)}.` : "");
      }
      if (share) void send(S.callPair, "youtube", { id });
    };

    // Join every pairing's private channel, so a ring reaches this person on any page.
    if (L) {
      for (const p of pairs) {
        L.join(p.pairingId, {
          onSignal: (m) => void handle(p.pairingId, m),
          onYoutube: (id) => id && S.callPair === p.pairingId && play(id, false),
          onFiles: () => void refreshFiles(),
        })
          .then((c) => (alive ? channels.set(p.pairingId, c) : void c.leave()))
          .catch(() => {});
      }
    }

    // Preview only: lets the incoming-call banner be seen without a second person.
    const onDemo = (e: Event) => {
      if (live || S.callPair) return;
      const pid = (e as CustomEvent<{ pairingId?: string }>).detail?.pairingId ?? pairs[0]?.pairingId ?? null;
      if (!pid) return;
      S.incoming = pid;
      setIncoming(pid);
      S.inTimer = setTimeout(stopIncoming, RING_MS);
    };
    window.addEventListener(DEMO_INCOMING, onDemo);

    const place = async (pidIn?: string) => {
      const pid = pidIn && pairs.some((p) => p.pairingId === pidIn) ? pidIn : pairs[0]?.pairingId;
      if (!pid || S.callPair) return;
      S.callPair = pid;
      S.phase = "calling";
      setCall({ pairingId: pid, phase: "calling", note: "" });
      setPanel(false);
      setYt(null);
      setFiles([]);
      setNote("");
      if (!(await ensureLocal())) return;
      if (!L) {
        // Offline preview: there is nobody to ring.
        S.ringTimer = setTimeout(() => S.callPair === pid && S.phase === "calling" && endCall(`Preview: with the live connection on, this rings ${name(pid)}. Nobody is connected here, so nobody answered.`), 3500);
        return;
      }
      void sig(pid, "ring");
      S.ringTimer = setTimeout(async () => {
        if (S.callPair !== pid || S.phase !== "calling") return;
        void sig(pid, "cancel");
        const r = await sendMessage(pid, "Missed video call. Call me back when you can.").catch(() => null);
        endCall(r && r.ok ? `${name(pid)} didn't answer. We left a message in your chat.` : `${name(pid)} didn't answer.`);
      }, RING_MS);
    };

    const accept = async () => {
      const pid = S.incoming;
      if (!pid) return;
      stopIncoming();
      S.callPair = pid;
      S.phase = "connecting";
      setCall({ pairingId: pid, phase: "connecting", note: "" });
      setPanel(false);
      setYt(null);
      setFiles([]);
      if (!(await ensureLocal())) {
        void sig(pid, "decline");
        return;
      }
      if (L) {
        void sig(pid, "accept");
        void sig(pid, "hello");
      } else {
        S.startedAt = Date.now();
        setElapsed(0);
        setPhase("live", "Preview: this is how it looks once connected. There is no second person here.");
      }
    };

    api.current = {
      place,
      accept,
      decline: () => {
        const pid = S.incoming;
        stopIncoming();
        if (pid) void sig(pid, "decline");
      },
      hangUp: () => {
        const pid = S.callPair;
        if (!pid) return;
        void sig(pid, S.phase === "calling" ? "cancel" : "bye");
        endCall(S.phase === "live" ? `Call ended · ${clock(Math.round((Date.now() - S.startedAt) / 1000))}` : "Call ended");
      },
      toggleMic: () =>
        setMuted((m) => {
          localRef.current?.getAudioTracks().forEach((t) => (t.enabled = m));
          return !m;
        }),
      toggleCam: () =>
        setCamOff((c) => {
          localRef.current?.getVideoTracks().forEach((t) => (t.enabled = c));
          return !c;
        }),
      play: (id) => play(id, true),
      refreshFiles,
      async addFiles(list) {
        const first = name(S.callPair);
        const ok = list.filter((f) => f.size <= MAX);
        const big = list.filter((f) => f.size > MAX);
        if (big.length) setNote(`${big.map((f) => f.name).join(", ")} ${big.length === 1 ? "is" : "are"} over 200 MB and wasn't added.`);
        if (!ok.length || !S.callPair) return;
        if (L) {
          setNote(`Sharing ${ok.length === 1 ? ok[0].name : `${ok.length} files`} with ${first}…`);
          const res = await L.upload(S.callPair, ok);
          setNote(res.failed.length ? `Couldn't share ${res.failed.join(", ")}. Try again.` : `Shared with ${first}.`);
          if (res.ok) {
            void send(S.callPair, "files", {});
            void refreshFiles();
          }
        } else {
          setFiles((cur) => [...cur, ...ok.map((f) => ({ name: f.name, label: f.name, size: f.size }))]);
          setNote("Kept on this device: file sharing needs the live connection.");
        }
      },
      async download(f) {
        if (!L || !S.callPair) return;
        try {
          const href = await L.downloadUrl(S.callPair, { name: f.name, label: f.label, size: f.size, created_at: "" });
          const a = document.createElement("a");
          a.href = href;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch {
          setNote("That file couldn't be downloaded. Try again.");
        }
      },
      close: () => {
        S.phase = null;
        setCall(null);
        setPanel(false);
        setNote("");
        setYt(null);
      },
    };

    const onOpen = (e: Event) => void api.current?.place((e as CustomEvent<{ pairingId?: string }>).detail?.pairingId);
    window.addEventListener(OPEN_CALL, onOpen);

    return () => {
      alive = false;
      window.removeEventListener(OPEN_CALL, onOpen);
      window.removeEventListener(DEMO_INCOMING, onDemo);
      clearTimeout(S.ringTimer);
      stopIncoming();
      stopMedia();
      for (const c of channels.values()) void c.leave();
      void L?.close();
      api.current = null;
    };
    // pairs is read through pairsKey so a page refresh handing over new objects never drops a live call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsKey, meId]);

  // The call timer.
  useEffect(() => {
    if (call?.phase !== "live") return;
    const t0 = Date.now() - elapsed * 1000;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.phase]);

  // Keep the self view attached when the call screen mounts after the camera is already on.
  const attachSelf = (el: HTMLVideoElement | null) => {
    selfEl.current = el;
    if (el && localRef.current && el.srcObject !== localRef.current) {
      el.srcObject = localRef.current;
      void el.play().catch(() => {});
    }
  };

  const incomingPair = byId(incoming);
  const callPair = byId(call?.pairingId ?? null);
  const connected = liveAvailable();

  return (
    <>
      {incomingPair ? (
        <div className="ta-incoming" role="alertdialog" aria-live="assertive" aria-label={`${incomingPair.partnerFirst} is calling`}>
          <span className="ta-incoming-av" aria-hidden>{incomingPair.initials}</span>
          <div>
            <strong>{incomingPair.partnerName}</strong>
            <small>is video calling you…</small>
          </div>
          <button type="button" className="ta-callbtn decline" onClick={() => api.current?.decline()} aria-label={`Decline the call from ${incomingPair.partnerFirst}`}>
            <Icon name="phone" size={20} />
          </button>
          <button type="button" className="ta-callbtn accept" onClick={() => void api.current?.accept()} aria-label={`Accept the call from ${incomingPair.partnerFirst}`}>
            <Icon name="video" size={20} />
          </button>
        </div>
      ) : null}

      {call && callPair ? (
        <Overlay>
          <div className="ta-call" role="dialog" aria-modal="true" aria-label={`Video call with ${callPair.partnerName}`} onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()} onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); void api.current?.addFiles([...e.dataTransfer.files]); }}>
            <div className="ta-call-top">
              <div>
                <strong>{callPair.partnerName}</strong>
                <small role="status">
                  {call.phase === "calling" ? "Calling…" : call.phase === "connecting" ? "Connecting…" : call.phase === "live" ? clock(elapsed) : "Call ended"}
                </small>
              </div>
            </div>

            <div className="ta-call-stage" data-live={remoteOn || call.phase === "live"}>
              {yt ? (
                <iframe title="Shared video" src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : null}
              <video ref={remoteEl} className={`ta-remote${yt ? " pip" : ""}`} playsInline hidden={!remoteOn} />
              {!remoteOn && !yt ? (
                <div className="ta-call-wait">
                  <span className="ta-call-av" data-ring={call.phase === "calling" || call.phase === "connecting"}>{callPair.initials}</span>
                  {call.phase === "calling" ? <p>Calling {callPair.partnerFirst}…</p> : call.phase === "connecting" ? <p>Connecting…</p> : null}
                  {call.note ? <p className="ta-call-note" role="status">{call.note}</p> : null}
                  {!connected && (call.phase === "calling" || call.phase === "connecting") ? <p className="ta-call-note">Preview: no live connection here.</p> : null}
                </div>
              ) : null}
              {call.phase === "ended" ? null : <video ref={attachSelf} className="ta-self" muted playsInline hidden={camOff} />}
            </div>

            {call.phase === "ended" ? (
              <div className="ta-call-ended">
                <p>{call.note || "Call ended"}</p>
                <div className="ta-row" style={{ marginTop: 0, justifyContent: "center" }}>
                  <button type="button" className="ev-btn primary" onClick={() => void api.current?.place(callPair.pairingId)}>
                    <Icon name="video" size={16} /> Call again
                  </button>
                  <button type="button" className="ev-btn" onClick={() => api.current?.close()}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="ta-call-bar" role="group" aria-label="Call controls">
                <button type="button" className="ta-callbtn" data-off={muted} onClick={() => api.current?.toggleMic()} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"}>
                  <Icon name={muted ? "micoff" : "mic"} size={20} />
                </button>
                <button type="button" className="ta-callbtn" data-off={camOff} onClick={() => api.current?.toggleCam()} aria-pressed={camOff} aria-label={camOff ? "Turn the camera on" : "Turn the camera off"}>
                  <Icon name={camOff ? "videooff" : "video"} size={20} />
                </button>
                <button type="button" className="ta-callbtn" data-off={panel} onClick={() => { setPanel((p) => !p); void api.current?.refreshFiles(); }} aria-pressed={panel} aria-label="Share a video link or files">
                  <Icon name="upload" size={20} />
                </button>
                <button type="button" className="ta-callbtn decline" onClick={() => api.current?.hangUp()} aria-label={call.phase === "calling" ? "Cancel the call" : "End the call"}>
                  <Icon name="phone" size={20} />
                </button>
              </div>
            )}

            {panel && call.phase !== "ended" ? (
              <aside className="ta-call-panel" aria-label="Share">
                <div className="ta-between">
                  <h3>Share</h3>
                  <button type="button" className="ta-iconbtn" onClick={() => setPanel(false)} aria-label="Close the share panel">
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <form
                  className="ta-visit-link"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const id = youtubeId(url);
                    if (!id || !/^[\w-]{11}$/.test(id)) return setNote("That doesn't look like a YouTube link. Paste one like https://www.youtube.com/watch?v=…");
                    api.current?.play(id);
                  }}
                >
                  <label className="sr-only" htmlFor="ta-yt">YouTube link</label>
                  <input id="ta-yt" className="ev-input" type="url" inputMode="url" placeholder="Paste a YouTube link" value={url} onChange={(e) => setUrl(e.target.value)} />
                  <button type="submit" className="ev-btn sm">Play for us both</button>
                </form>
                <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void api.current?.addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
                <button type="button" className="ev-btn sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={14} /> Share a file
                </button>
                {files.length ? (
                  <ul className="ta-visit-files" aria-label="Files shared in this pairing">
                    {files.map((f) => (
                      <li key={f.name}>
                        <Icon name={/\.(mp4|mov|webm|m4v)$/i.test(f.label) ? "video" : "file"} size={15} />
                        <span>{f.label}</span>
                        <small className="ev-muted">{kb(f.size)}</small>
                        {connected ? (
                          <button type="button" className="ev-btn quiet sm" onClick={() => void api.current?.download(f)}>Download</button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="ev-small" role="status">{note || (connected ? "Shared only with " + callPair.partnerFirst + "." : "Preview: kept on this device.")}</p>
              </aside>
            ) : null}
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
