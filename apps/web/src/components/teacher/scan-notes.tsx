"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addGrowthEntry } from "@/lib/teacher/hub-actions";
import { readNotes } from "@/lib/teacher/scan-actions";
import { MAX_NOTE } from "@/lib/teacher/scan";
import { Icon } from "./icons";
import { useBase } from "./use-base";

type Step = "idle" | "camera" | "reading" | "review" | "saved";

/** A photo taken in the browser, shrunk to a size that reads well and uploads quickly. */
function shrink(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

const fromFile = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = shrink(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => reject(new Error("That file isn't a photo we can open."));
    img.src = url;
  });

/**
 * Scan notes: photograph a handwritten page, check the text it was read into, and save it as a private note. The photo is
 * looked at and dropped: it is never stored, and only the text you save is kept (a private growth entry that only you can read).
 * While reading is a prepared sample (see lib/teacher/scan.ts), the screen says "Sample reading" so nobody mistakes it.
 */
export function ScanNotes({ ready }: { ready: boolean }) {
  const base = useBase();
  const [step, setStep] = useState<Step>("idle");
  const [shot, setShot] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [source, setSource] = useState<"sample" | "ai">("sample");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  function reset() {
    stopCamera();
    setStep("idle");
    setShot(null);
    setText("");
    setError(null);
  }

  async function read(image: string) {
    stopCamera();
    setShot(image);
    setStep("reading");
    setError(null);
    const r = await readNotes(image);
    if (!r.ok) {
      setError(r.error);
      setStep("idle");
      return;
    }
    setText(r.text);
    setSource(r.source);
    setStep("review");
  }

  async function openCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError("The camera isn't available in this browser. Choose a photo instead.");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      stream.current = s;
      setStep("camera");
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setError("We couldn't open the camera. Allow it in your browser, or choose a photo instead.");
    }
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    void read(shrink(v, v.videoWidth, v.videoHeight));
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      await read(await fromFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file isn't a photo we can open.");
    }
  }

  async function useSample() {
    try {
      const res = await fetch("/scan/sample-notes.jpg");
      await read(await fromFile(await res.blob()));
    } catch {
      setError("The sample page couldn't load. Check your connection and try again.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const r = await addGrowthEntry("observation", text, null, null);
    setSaving(false);
    if (!r.ok) return setError(r.error);
    setStep("saved");
    setShot(null);
  }

  return (
    <section className="ev-panel ta-composer ta-scan" id="scan" aria-labelledby="ta-scan-h">
      <p className="ev-eyebrow">Scan notes</p>
      <h2 id="ta-scan-h">
        From paper to <em>notes</em>.
      </h2>
      <p className="ev-muted">Photograph a handwritten page, such as notes from a classroom visit. Check the text, edit it, and save it as a private note.</p>
      <p className="ev-privacy">
        <Icon name="lock" size={13} /> The photo isn&rsquo;t kept. Only the text you save is, and only you can read it.
      </p>

      {!ready ? (
        <p className="ev-hold">Notes aren&rsquo;t switched on for your school yet. Your school lead needs to apply the update first.</p>
      ) : (
        <div aria-live="polite">
          {step === "idle" ? (
            <div className="ta-scan-actions">
              <button type="button" className="ev-btn primary" onClick={openCamera}>
                <Icon name="camera" size={16} /> Use the camera
              </button>
              <label className="ev-btn">
                <Icon name="upload" size={16} /> Choose a photo
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
              </label>
              <button type="button" className="ev-btn" onClick={useSample}>
                <Icon name="file" size={16} /> Try a sample page
              </button>
            </div>
          ) : null}

          {step === "camera" ? (
            <div className="ta-scan-camera">
              <video ref={video} playsInline muted aria-label="Camera preview" />
              <div className="ta-scan-actions">
                <button type="button" className="ev-btn primary" onClick={capture}>
                  <Icon name="camera" size={16} /> Take photo
                </button>
                <button type="button" className="ev-btn" onClick={reset}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {step === "reading" ? (
            <div className="ta-scan-reading">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shot ? <img src={shot} alt="The page you photographed" className="ta-scan-shot" /> : null}
              <p role="status" className="ev-muted">
                Reading the page…
              </p>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="ta-scan-review">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shot ? <img src={shot} alt="The page you photographed" className="ta-scan-shot" /> : null}
              <div className="ev-field">
                <label htmlFor="ta-scan-text">
                  What we read {source === "sample" ? <span className="ev-badge">Sample reading</span> : null}
                </label>
                <textarea id="ta-scan-text" value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={MAX_NOTE} />
                <small className="ev-muted">
                  {text.length} of {MAX_NOTE} characters. Fix anything it got wrong before you save.
                </small>
              </div>
              <div className="ta-scan-actions">
                <button type="button" className="ev-btn primary" disabled={saving || !text.trim()} onClick={save}>
                  {saving ? "Saving…" : "Save to my notes"}
                </button>
                <button type="button" className="ev-btn" onClick={reset} disabled={saving}>
                  Scan another page
                </button>
              </div>
            </div>
          ) : null}

          {step === "saved" ? (
            <div className="ta-scan-saved">
              <p role="status">
                <Icon name="check" size={16} /> Saved privately. It&rsquo;s in your Growth notes, and only you can read it.
              </p>
              <div className="ta-scan-actions">
                <Link href={`${base}/growth`} className="ev-btn primary">
                  Open my Growth notes
                </Link>
                <button type="button" className="ev-btn" onClick={reset}>
                  Scan another page
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="ap-error" role="alert" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
