"use client";

import { useEffect, useRef, useState } from "react";
import { createLive, iceServers, liveAvailable, type Live, type PairChannel, type PairFile } from "@/lib/teacher/live";
import { Icon } from "./icons";
import { OPEN_VISIT } from "./open-events";

/**
 * The visit screen, ported from Bertrand's artifact (public/dashboard-v2/dashboard.html). Two teachers in one pairing
 * open the same private channel; Live connects their cameras browser to browser (the video never touches Supabase),
 * a pasted YouTube link plays on both screens, and files go to the pair's own private bucket. Without the live
 * connection (the offline preview) it still works on this device: your camera, a video link, files kept in the page.
 *
 * The signalling rule is his: whoever has the smaller id makes the offer, so two people pressing Live together still
 * end up with one connection.
 */

export type VisitPair = { pairingId: string; partnerName: string; partnerFirst: string };
type LocalFile = { name: string; label: string; size: number };

const MAX = 200 * 1024 * 1024;
const kb = (b: number) => (b < 1024 ? `${b} B` : b < 1_048_576 ? `${Math.round(b / 1024)} KB` : `${(b / 1_048_576).toFixed(1)} MB`);

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

type Api = {
  goLive: () => Promise<void>;
  stop: () => void;
  play: (id: string, share: boolean) => void;
  addFiles: (files: File[]) => Promise<void>;
  download: (f: LocalFile) => Promise<void>;
};

export function VisitHost({ pairs, meId }: { pairs: VisitPair[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [pairId, setPairId] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [note, setNote] = useState("");
  const [liveOn, setLiveOn] = useState(false);
  const [remoteOn, setRemoteOn] = useState(false);
  const [others, setOthers] = useState(0);
  const [yt, setYt] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [stage, setStage] = useState("Press Live to start your camera, or add a video link.");
  const selfRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const clipRef = useRef<HTMLInputElement>(null);
  const api = useRef<Api | null>(null);
  const pair = pairs.find((p) => p.pairingId === pairId) ?? null;

  // A fresh pair starts from a clean screen.
  const choose = (id: string | null) => {
    setPairId(id);
    setStage("Press Live to start your camera, or add a video link.");
    setNote("");
    setYt(null);
    setFiles([]);
    setOthers(0);
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ pairingId?: string }>).detail?.pairingId;
      choose(id && pairs.some((p) => p.pairingId === id) ? id : (pairs[0]?.pairingId ?? null));
      setOpen(true);
    };
    window.addEventListener(OPEN_VISIT, onOpen);
    return () => window.removeEventListener(OPEN_VISIT, onOpen);
  }, [pairs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // One session per open pair: join the channel, wire the video, and tear it all down on close or when the pair changes.
  useEffect(() => {
    if (!open || !pairId || !pair) return;
    let alive = true;
    const first = pair.partnerFirst;
    const L: Live | null = liveAvailable() ? createLive(() => {}) : null;
    let ch: PairChannel | null = null;
    let local: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;
    let pendingIce: RTCIceCandidateInit[] = [];
    let youtube: string | null = null;
    let count = 0;

    const say = (t: string) => alive && setNote(t);
    const send = (event: "signal" | "youtube" | "files", payload: Record<string, unknown>) => (ch ? ch.send(event, payload).catch(() => {}) : Promise.resolve());
    const message = (t: string) => {
      if (!youtube && alive) setStage(t);
    };

    const hangUp = (quiet: boolean) => {
      if (peer) {
        peer.ontrack = peer.onicecandidate = peer.onconnectionstatechange = null;
        peer.close();
      }
      peer = null;
      pendingIce = [];
      if (remoteRef.current) remoteRef.current.srcObject = null;
      if (alive) setRemoteOn(false);
      if (!quiet) void send("signal", { type: "bye", from: meId });
    };
    const stopCamera = () => {
      local?.getTracks().forEach((t) => t.stop());
      local = null;
      if (selfRef.current) selfRef.current.srcObject = null;
      hangUp(false);
      if (alive) setLiveOn(false);
    };
    const makePeer = () => {
      hangUp(true);
      const p = new RTCPeerConnection({ iceServers: iceServers() });
      peer = p;
      local?.getTracks().forEach((t) => p.addTrack(t, local!));
      p.onicecandidate = (e) => {
        if (e.candidate) void send("signal", { type: "ice", candidate: e.candidate.toJSON(), from: meId });
      };
      p.ontrack = (e) => {
        if (remoteRef.current) {
          remoteRef.current.srcObject = e.streams[0];
          void remoteRef.current.play().catch(() => {});
        }
        setRemoteOn(true);
        say(`You and ${first} are live.`);
      };
      p.onconnectionstatechange = () => {
        const s = peer?.connectionState;
        if (s === "failed") {
          say(`Couldn't connect to ${first}. Strict school networks can block video; ask your admin about a TURN server.`);
          hangUp(true);
        }
        if (s === "disconnected" || s === "closed") {
          setRemoteOn(false);
          message(`${first} left the visit.`);
        }
      };
    };
    const flushIce = async () => {
      for (const c of pendingIce.splice(0)) await peer?.addIceCandidate(c).catch(() => {});
    };

    const onSignal = async (m: Record<string, unknown>) => {
      if (!m || m.from === meId) return;
      try {
        if (m.type === "hello") {
          if (!local) {
            say(`${first} is live. Press Live to join.`);
            return;
          }
          if (meId < String(m.from)) {
            makePeer();
            await peer!.setLocalDescription(await peer!.createOffer());
            void send("signal", { type: "offer", sdp: peer!.localDescription!.toJSON(), from: meId });
          } else {
            void send("signal", { type: "hello", from: meId });
          }
        } else if (m.type === "offer") {
          if (!local) return;
          makePeer();
          await peer!.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
          await flushIce();
          await peer!.setLocalDescription(await peer!.createAnswer());
          void send("signal", { type: "answer", sdp: peer!.localDescription!.toJSON(), from: meId });
        } else if (m.type === "answer") {
          if (peer && !peer.currentRemoteDescription) {
            await peer.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
            await flushIce();
          }
        } else if (m.type === "ice") {
          if (peer?.remoteDescription) await peer.addIceCandidate(m.candidate as RTCIceCandidateInit).catch(() => {});
          else pendingIce.push(m.candidate as RTCIceCandidateInit);
        } else if (m.type === "bye") {
          hangUp(true);
          message(`${first} ended their camera.`);
          say(`${first} ended their camera.`);
        }
      } catch {
        say("The video connection hit a problem. Press Live again to retry.");
      }
    };

    const refreshFiles = async () => {
      if (!L) return;
      try {
        const list: PairFile[] = await L.listFiles(pairId);
        if (alive) setFiles(list.map((f) => ({ name: f.name, label: f.label, size: f.size })));
      } catch {
        if (alive) setFiles([]);
      }
    };

    const play = (id: string, share: boolean) => {
      if (!/^[\w-]{11}$/.test(id)) return;
      youtube = id;
      setYt(id);
      say(share && ch ? `Playing for you and ${first}.` : "Playing in the screen.");
      if (share) void send("youtube", { id });
    };

    api.current = {
      async goLive() {
        if (local) {
          stopCamera();
          say("Camera off.");
          message("Press Live to start your camera, or add a video link.");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          say("This browser can't open a live camera. Use Record a clip instead.");
          return;
        }
        try {
          local = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
        } catch (e) {
          local = null;
          say((e as Error)?.name === "NotAllowedError" ? "The camera was blocked. Allow camera access in your browser, or use Record a clip." : "No camera could be started. Use Record a clip instead.");
          return;
        }
        if (selfRef.current) {
          selfRef.current.srcObject = local;
          void selfRef.current.play().catch(() => {});
        }
        setLiveOn(true);
        if (L && ch) {
          message(count > 0 ? `Calling ${first}…` : `Waiting for ${first} to open the visit screen and press Live.`);
          say("Your camera is on.");
          void send("signal", { type: "hello", from: meId });
        } else {
          message(`You're live on this device only: ${first}'s screen isn't connected.`);
          say("Your camera is on.");
        }
      },
      stop: stopCamera,
      play,
      async addFiles(list) {
        const ok = list.filter((f) => f.size <= MAX);
        const bigOnes = list.filter((f) => f.size > MAX);
        if (bigOnes.length) say(`${bigOnes.map((f) => f.name).join(", ")} ${bigOnes.length === 1 ? "is" : "are"} over 200 MB and wasn't added.`);
        if (!ok.length) return;
        if (L) {
          say(`Sharing ${ok.length === 1 ? ok[0].name : `${ok.length} files`} with ${first}…`);
          const res = await L.upload(pairId, ok);
          say(res.failed.length ? `Couldn't share ${res.failed.join(", ")}. Try again.` : `Shared with ${first}.`);
          if (res.ok) {
            void send("files", {});
            void refreshFiles();
          }
        } else {
          setFiles((cur) => [...cur, ...ok.map((f) => ({ name: f.name, label: f.name, size: f.size }))]);
          say("Kept on this device: file sharing needs the live connection.");
        }
      },
      async download(f) {
        if (!L) return;
        try {
          const href = await L.downloadUrl(pairId, { name: f.name, label: f.label, size: f.size, created_at: "" });
          const a = document.createElement("a");
          a.href = href;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch {
          say("That file couldn't be downloaded. Try again.");
        }
      },
    };

    if (L) {
      L.join(pairId, {
        onPresence: (n) => {
          count = n;
          if (alive) setOthers(n);
        },
        onSignal,
        onYoutube: (id) => {
          if (id) {
            play(id, false);
            say(`${first} shared a video.`);
          }
        },
        onFiles: refreshFiles,
        onStatus: (s) => {
          if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") say(`Couldn't connect to ${first}'s screen. Check your connection and try again.`);
        },
      })
        .then((c) => {
          if (!alive) void c.leave();
          else ch = c;
        })
        .catch(() => {});
      void refreshFiles();
    }

    return () => {
      alive = false;
      stopCamera();
      void ch?.leave();
      void L?.close();
      api.current = null;
    };
  }, [open, pairId, pair, meId]);

  if (!open || !pair) return null;
  const connected = liveAvailable();

  return (
    <div className="ev-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div
        className={`ta-visit${big ? " big" : ""}${liveOn ? " live" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ta-visit-h"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          void api.current?.addFiles([...e.dataTransfer.files]);
        }}
      >
        <div className="ta-visit-head">
          <span className="ta-livedot" aria-hidden />
          <h3 id="ta-visit-h">Visit screen</h3>
          {pairs.length > 1 ? (
            <select className="ev-input" value={pair.pairingId} onChange={(e) => choose(e.target.value)} aria-label="Who the visit is with">
              {pairs.map((p) => (
                <option key={p.pairingId} value={p.pairingId}>
                  with {p.partnerName}
                </option>
              ))}
            </select>
          ) : (
            <span className="ev-muted">with {pair.partnerName}</span>
          )}
          {connected && others > 0 ? <span className="ta-here">{pair.partnerFirst} is here</span> : null}
          <span className="ta-spacer" />
          <button type="button" className="ta-iconbtn" aria-label={big ? "Make the visit screen smaller" : "Enlarge the visit screen"} onClick={() => setBig((b) => !b)}>
            <Icon name={big ? "shrink" : "expand"} size={16} />
          </button>
          <button type="button" className="ta-iconbtn" aria-label="Close the visit screen" onClick={() => setOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="ta-stage">
          {yt ? (
            <iframe
              title="Shared video"
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="ta-stage-msg">{stage}</p>
          )}
          <video ref={remoteRef} className={`ta-remote${yt ? " pip" : ""}`} playsInline hidden={!remoteOn} />
          <video ref={selfRef} className="ta-self" muted playsInline hidden={!liveOn} />
        </div>

        <div className="ta-visit-controls">
          <button type="button" className={`ev-btn ${liveOn ? "" : "primary"}`} aria-pressed={liveOn} onClick={() => void api.current?.goLive()}>
            <span className="ta-livedot solid" aria-hidden /> {liveOn ? "End live" : "Live"}
          </button>
          <button type="button" className="ev-btn" onClick={() => clipRef.current?.click()}>
            <Icon name="video" size={16} /> Record a clip
          </button>
          <button type="button" className="ev-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} /> Share a file
          </button>
          <input ref={clipRef} type="file" accept="video/*" capture="user" hidden onChange={(e) => { void api.current?.addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void api.current?.addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>

        <form
          className="ta-visit-link"
          onSubmit={(e) => {
            e.preventDefault();
            const id = youtubeId(url);
            if (!id || !/^[\w-]{11}$/.test(id)) return setNote("That doesn't look like a YouTube link. Paste one like https://www.youtube.com/watch?v=…");
            api.current?.play(id, true);
          }}
        >
          <label className="sr-only" htmlFor="ta-yt">YouTube link</label>
          <input id="ta-yt" className="ev-input" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit" className="ev-btn">Play for us both</button>
        </form>

        {files.length ? (
          <ul className="ta-visit-files" aria-label="Files shared in this pairing">
            {files.map((f) => (
              <li key={f.name}>
                <Icon name={/\.(mp4|mov|webm|m4v)$/i.test(f.label) ? "video" : "file"} size={15} />
                <span>{f.label}</span>
                <small className="ev-muted">{kb(f.size)}</small>
                {connected ? (
                  <button type="button" className="ev-btn quiet sm" onClick={() => void api.current?.download(f)}>
                    Download
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="ev-small ta-visit-note" role="status">
          {note || (connected ? "Private to you and your co-mentor. Video goes straight between your browsers." : "Preview: this runs on your device only. With the live connection on, it joins your co-mentor's screen.")}
        </p>
      </div>
    </div>
  );
}
