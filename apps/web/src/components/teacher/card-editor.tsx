"use client";

import { useRef, useState } from "react";
import { removePhoto, saveCard, uploadPhoto } from "@/lib/teacher/card-actions";
import { LIMITS, WANTS, type Card, type CardInput, type Experience } from "@/lib/teacher/lookbook";
import { Icon } from "./icons";
import { LookbookCard } from "./lookbook-card";

type Identity = Pick<Card, "name" | "initials" | "department" | "yearsTeaching" | "strengthTags" | "domains" | "style" | "archetype" | "inspiration">;

/** Crops to 3:4 and shrinks to 600x800 in the browser, so what is uploaded is small and always the same shape. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const W = 600;
  const H = 800;
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const w = bmp.width * scale;
  const h = bmp.height * scale;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/jpeg", 0.85));
}

export function CardEditor({ initial, photoUrl: initialPhoto, saved, identity, ready }: { initial: CardInput; photoUrl: string | null; saved: boolean; identity: Identity; ready: boolean }) {
  const [c, setC] = useState<CardInput>(initial);
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [grow, setGrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<CardInput>) => {
    setC((cur) => ({ ...cur, ...patch }));
    setMsg(null);
  };

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoMsg("Preparing your photo…");
    try {
      const blob = await shrink(file);
      setPhoto(URL.createObjectURL(blob));
      const form = new FormData();
      form.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const r = await uploadPhoto(form);
      setPhotoMsg(r.ok ? "Photo saved." : r.error);
    } catch {
      setPhotoMsg("That image couldn't be read. Try a JPEG or PNG.");
    }
  }
  async function dropPhoto() {
    const r = await removePhoto();
    if (r.ok) {
      setPhoto(null);
      setPhotoMsg("Photo removed.");
    } else setPhotoMsg(r.error);
  }

  async function save() {
    setBusy(true);
    const r = await saveCard(c);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: c.published ? "Saved. Your card is visible to colleagues in your school." : "Saved. Only you can see your card until you share it." } : { ok: false, text: r.error });
  }

  const preview: Card = {
    profileId: "me",
    ...identity,
    headline: c.headline,
    bio: c.bio,
    photoUrl: photo,
    experience: c.experience,
    achievements: c.achievements,
    growingIn: c.showGrowth ? c.growingIn : [],
    wants: c.wants,
    wantsText: c.wantsText,
    updatedAt: "",
  };
  const setExp = (i: number, p: Partial<Experience>) => set({ experience: c.experience.map((e, j) => (j === i ? { ...e, ...p } : e)) });
  const setAch = (i: number, v: string) => set({ achievements: c.achievements.map((a, j) => (j === i ? v : a)) });
  const addGrow = () => {
    const v = grow.trim().slice(0, LIMITS.growing);
    if (v && !c.growingIn.some((g) => g.toLowerCase() === v.toLowerCase()) && c.growingIn.length < LIMITS.growingIn) set({ growingIn: [...c.growingIn, v] });
    setGrow("");
  };

  return (
    <div className="ta-ed">
      <form
        className="ta-ed-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!ready ? <p className="ev-hold">The lookbook isn&rsquo;t switched on for your school yet, so cards can&rsquo;t be saved. Your school lead needs to apply the update first.</p> : null}

        <section className="ev-panel ta-ed-share">
          <label className="ev-check">
            <input type="checkbox" checked={c.published} onChange={(e) => set({ published: e.target.checked })} />
            <span>
              <strong>Share my card with colleagues in my school</strong>
              <small className="ev-muted">Off by default. While it&rsquo;s off, only you can see it. School leadership never sees the lookbook, and you can switch this off at any time.</small>
            </span>
          </label>
        </section>

        <section className="ev-panel">
          <h3>Photo</h3>
          <div className="ta-ed-photo">
            <div className="ta-ed-thumb" style={photo ? { backgroundImage: `url(${photo})` } : undefined} aria-hidden>
              {photo ? null : identity.initials}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="ta-row" style={{ marginTop: 0 }}>
                <button type="button" className="ev-btn sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" size={14} /> {photo ? "Change photo" : "Add a photo"}
                </button>
                {photo ? (
                  <button type="button" className="ev-btn quiet sm" onClick={() => void dropPhoto()}>
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="ev-small" role="status">{photoMsg || "Optional. A friendly, clear photo helps colleagues recognise you. It is cropped to a portrait in your browser."}</p>
            </div>
          </div>
        </section>

        <section className="ev-panel">
          <h3>About me</h3>
          <div className="ev-field">
            <label htmlFor="ed-headline">Headline <small className="ev-muted">{c.headline.length}/{LIMITS.headline}</small></label>
            <input id="ed-headline" type="text" maxLength={LIMITS.headline} value={c.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="e.g. 7th grade science, loves labs and student-led talk" />
          </div>
          <div className="ev-field">
            <label htmlFor="ed-bio">A few words about you <small className="ev-muted">{c.bio.length}/{LIMITS.bio}</small></label>
            <textarea id="ed-bio" rows={4} maxLength={LIMITS.bio} value={c.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="What brought you to teaching? What do you love about it?" />
          </div>
          <p className="ev-small">Your name, department, years teaching, strengths and teaching style come from your profile.</p>
        </section>

        <section className="ev-panel">
          <div className="ta-between"><h3>Experience</h3>
            {c.experience.length < LIMITS.experience ? <button type="button" className="ev-btn sm" onClick={() => set({ experience: [...c.experience, { role: "", place: "", years: "" }] })}><Icon name="plus" size={14} /> Add</button> : null}
          </div>
          {c.experience.length === 0 ? <p className="ev-muted">Roles and places that shaped your teaching. Optional.</p> : null}
          {c.experience.map((e, i) => (
            <div className="ta-ed-row" key={i}>
              <input aria-label="Role" placeholder="Role" maxLength={LIMITS.role} value={e.role} onChange={(ev) => setExp(i, { role: ev.target.value })} />
              <input aria-label="Where" placeholder="Where" maxLength={LIMITS.place} value={e.place} onChange={(ev) => setExp(i, { place: ev.target.value })} />
              <input aria-label="Years" placeholder="e.g. 2019–2023" maxLength={LIMITS.years} value={e.years} onChange={(ev) => setExp(i, { years: ev.target.value })} />
              <button type="button" className="ta-iconbtn" aria-label="Remove this role" onClick={() => set({ experience: c.experience.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </section>

        <section className="ev-panel">
          <div className="ta-between"><h3>Achievements</h3>
            {c.achievements.length < LIMITS.achievements ? <button type="button" className="ev-btn sm" onClick={() => set({ achievements: [...c.achievements, ""] })}><Icon name="plus" size={14} /> Add</button> : null}
          </div>
          {c.achievements.length === 0 ? <p className="ev-muted">Something you&rsquo;re proud of: an award, a unit that landed, a student who grew. Optional.</p> : null}
          {c.achievements.map((a, i) => (
            <div className="ta-ed-row one" key={i}>
              <input aria-label={`Achievement ${i + 1}`} maxLength={LIMITS.achievement} value={a} onChange={(ev) => setAch(i, ev.target.value)} placeholder="e.g. Our department's reteach routine cut Ds by a third" />
              <button type="button" className="ta-iconbtn" aria-label="Remove this achievement" onClick={() => set({ achievements: c.achievements.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </section>

        <section className="ev-panel">
          <h3>What I want out of Mentorful</h3>
          <div className="ev-chips" role="group" aria-label="What you are looking for">
            {WANTS.map((w) => (
              <label key={w}>
                <input type="checkbox" checked={c.wants.includes(w)} onChange={() => set({ wants: c.wants.includes(w) ? c.wants.filter((x) => x !== w) : [...c.wants, w].slice(0, LIMITS.wants) })} />
                {w}
              </label>
            ))}
          </div>
          <div className="ev-field">
            <label htmlFor="ed-wants">In your own words <small className="ev-muted">{c.wantsText.length}/{LIMITS.wantsText}</small></label>
            <textarea id="ed-wants" rows={3} maxLength={LIMITS.wantsText} value={c.wantsText} onChange={(e) => set({ wantsText: e.target.value })} placeholder="The kind of co-mentor or conversations that would help you most" />
          </div>
        </section>

        <section className="ev-panel">
          <h3>Currently growing in</h3>
          <p className="ev-muted">Things you&rsquo;re working on, in your own words. This is yours: nobody else can add to it, and it is only shown on your card if you switch it on.</p>
          <div className="ta-ed-tags">
            {c.growingIn.map((g) => (
              <span className="ev-tag" key={g}>
                {g}
                <button type="button" aria-label={`Remove ${g}`} onClick={() => set({ growingIn: c.growingIn.filter((x) => x !== g) })}>×</button>
              </span>
            ))}
          </div>
          <div className="ta-inline">
            <input className="ev-input" value={grow} maxLength={LIMITS.growing} onChange={(e) => setGrow(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGrow(); } }} placeholder="e.g. Wait time, student-led discussion" aria-label="Add something you're growing in" />
            <button type="button" className="ev-btn" onClick={addGrow} disabled={!grow.trim() || c.growingIn.length >= LIMITS.growingIn}>Add</button>
          </div>
          <label className="ev-check">
            <input type="checkbox" checked={c.showGrowth} onChange={(e) => set({ showGrowth: e.target.checked })} disabled={c.growingIn.length === 0} />
            <span><strong>Show this on my card</strong><small className="ev-muted">Off by default. Some teachers like to share it so a co-mentor can help.</small></span>
          </label>
        </section>

        <div className="ta-ed-save">
          <button className="ev-btn primary" type="submit" disabled={busy || !ready}>
            {busy ? "Saving…" : saved ? "Save changes" : "Save my card"} <Icon name="check" size={16} />
          </button>
          {msg ? <p className={msg.ok ? "ev-note" : "ev-alert"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
        </div>
      </form>

      <aside className="ta-ed-preview" aria-label="Preview of your card">
        <p className="ev-eyebrow">How colleagues see it</p>
        {!c.published ? <p className="ev-small ta-ed-private"><Icon name="lock" size={13} /> Only you can see this until you share it.</p> : null}
        <LookbookCard card={preview} badge="You" />
      </aside>
    </div>
  );
}
