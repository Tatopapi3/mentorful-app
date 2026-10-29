"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { saveEntry } from "@/app/dashboard/aurora/actions";
import { CONCERN_DOMAINS, DOMAIN_LABEL } from "@/lib/domains";
import { Icon } from "./icons";
import { openCall } from "./open-events";
import { useNowStamp } from "./stamp";

export type PairOption = { id: string; partnerName: string; partnerFirst: string; domain: string | null; visitsMe: boolean };
type State = { ok: boolean; error?: string; n?: number } | null;

/**
 * Log a conversation in about a minute. The two prompts the protocol cares most about come first and are always
 * open (what they are working toward, what you saw working); the three data fields sit behind one disclosure so
 * the form never looks like homework. It saves as a draft because the database's insert rule requires it, and the
 * draft shows at the top of the notebook beside this form with its Submit button.
 */
export function LogComposer({ pairs, defaultPairing, prefill }: { pairs: PairOption[]; defaultPairing?: string; prefill?: string }) {
  const now = useNowStamp();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, fd) => {
    const r = await saveEntry(fd);
    return r.ok ? { ok: true, n: Date.now() } : r;
  }, null);

  // Clear the form once a draft is saved, so a second entry starts blank.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (pairs.length === 0) {
    return (
      <section className="ev-panel ta-composer" id="log">
        <p className="ev-eyebrow">Quick log</p>
        <h2>Nobody to log with yet.</h2>
        <p className="ev-muted">You aren&rsquo;t in a pairing this cycle. When your school lead confirms your partner, you can write down your conversations here.</p>
      </section>
    );
  }

  const start = pairs.find((p) => p.id === defaultPairing) ?? pairs[0];

  return (
    <section className="ev-panel ta-composer" id="log">
      <p className="ev-eyebrow">Quick log</p>
      <h2>
        Log a <em>conversation</em>.
      </h2>
      <p className="ev-muted">A short record of connection, not another form. About a minute.</p>
      <p className="ta-stampnote">
        <Icon name="clock" size={14} /> Time-stamped <strong>{now}</strong> when you save
      </p>

      <form action={action} ref={formRef} key={`${start.id}:${prefill ?? ""}`}>
        <div className="ta-step">
          <span className="ta-num">1</span>
          <div>
            <h3>Who was it with?</h3>
            {pairs.length === 1 ? (
              <>
                <input type="hidden" name="pairing_id" value={start.id} />
                <p className="ta-with">
                  <span className="ev-avatar sm">{start.partnerName.split(" ").map((s) => s[0]).slice(0, 2).join("")}</span>
                  {start.partnerName}
                  <small className="ev-muted">{start.visitsMe ? "visits your classroom" : "you visit theirs"}</small>
                </p>
              </>
            ) : (
              <select name="pairing_id" className="ev-input" defaultValue={start.id} aria-label="Who the conversation was with">
                {pairs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partnerName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="ta-step">
          <span className="ta-num">2</span>
          <div>
            <h3>What did you talk about?</h3>
            <div className="ev-chips" role="radiogroup" aria-label="Domain">
              {CONCERN_DOMAINS.map((d) => (
                <label key={d}>
                  <input type="radio" name="domain" value={d} defaultChecked={(start.domain ?? "CLASSROOM") === d} />
                  {DOMAIN_LABEL[d]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="ta-step">
          <span className="ta-num">3</span>
          <div>
            <h3>What stood out?</h3>
            <div className="ev-field">
              <label htmlFor="ta-vision">What they&rsquo;re working toward</label>
              <textarea id="ta-vision" name="vision" rows={2} maxLength={400} defaultValue={prefill} placeholder="The outcome or focus that is driving them" />
            </div>
            <div className="ev-field">
              <label htmlFor="ta-strength">What you noticed working</label>
              <textarea id="ta-strength" name="strength_noted" rows={2} maxLength={400} placeholder="A strength worth naming" />
            </div>
            <details className="ta-more">
              <summary>Add more detail <small className="ev-muted">Optional</small></summary>
              <div className="ev-field">
                <label htmlFor="ta-more">More of</label>
                <textarea id="ta-more" name="more_frequently" rows={2} maxLength={400} />
              </div>
              <div className="ev-field">
                <label htmlFor="ta-less">Less of</label>
                <textarea id="ta-less" name="less_frequently" rows={2} maxLength={400} />
              </div>
              <div className="ev-field">
                <label htmlFor="ta-res">What you&rsquo;re swapping</label>
                <textarea id="ta-res" name="resources" rows={2} maxLength={400} />
              </div>
            </details>
          </div>
        </div>

        <div className="ta-foot">
          <span className="ev-privacy">
            <Icon name="lock" size={14} /> Only you and {start.partnerFirst} can read this
          </span>
          <button className="ev-btn" type="button" onClick={() => openCall(start.id)} title="Video call">
            <Icon name="video" size={16} /> Video call
          </button>
          <button className="ev-btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
            <Icon name="check" size={16} />
          </button>
        </div>

        {state && !state.ok && (
          <p className="ev-alert" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="ev-note" role="status">
            Saved as a draft. It is at the top of your notebook; submit it when you&rsquo;re ready.{" "}
            <Link href="#notebook">See it</Link>
          </p>
        )}
      </form>
    </section>
  );
}
