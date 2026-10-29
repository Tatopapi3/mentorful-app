"use client";

import { useState } from "react";
import { Icon } from "./icons";

/**
 * A graceful way out of a pairing that is not working, kept private from the partner. PREVIEW: nothing is sent yet.
 * Delivery to the school lead needs a table and a policy that shows it to the admin without the partner seeing it,
 * which doesn't exist in the schema, so the screen says so instead of pretending.
 */
export function AdjustRequest({ partnerFirst }: { partnerFirst: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState("");
  const close = () => {
    setOpen(false);
    setSent(false);
    setReason("");
  };
  return (
    <aside className="ev-panel ta-adjust">
      <span className="ta-iconchip" aria-hidden>
        <Icon name="sliders" size={20} />
      </span>
      <h3>Need something different?</h3>
      <p className="ev-muted">Pairings don&rsquo;t always fit, and that&rsquo;s okay. You can ask your school lead for a change at any time.</p>
      <p className="ta-privnote">
        <Icon name="lock" size={15} />
        <span>
          <strong>Private request.</strong> Only your school lead would see it. {partnerFirst} would not be told.
        </span>
      </p>
      <button className="ev-btn" type="button" onClick={() => setOpen(true)}>
        Request a partner change
        <Icon name="arrow" size={16} />
      </button>
      <small className="ev-muted">Preview: requests aren&rsquo;t delivered yet.</small>

      {open && (
        <div className="ev-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="ta-modal" role="dialog" aria-modal="true" aria-labelledby="ta-adjust-title">
            <button className="ta-modal-x" type="button" aria-label="Close" onClick={close}>
              <Icon name="close" size={18} />
            </button>
            {sent ? (
              <div className="ta-success">
                <span className="ta-bigcheck">
                  <Icon name="check" size={26} />
                </span>
                <h3 id="ta-adjust-title">Thanks. That&rsquo;s noted.</h3>
                <p className="ev-muted">This is a preview, so nothing was sent. When it is switched on, only your school lead would receive it.</p>
                <button className="ev-btn primary" type="button" onClick={close}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="ev-eyebrow">Private request</p>
                <h3 id="ta-adjust-title">Ask for a partner change</h3>
                <p className="ev-muted">Share only what feels useful. A schedule that doesn&rsquo;t line up, a different area of experience, or anything else.</p>
                <div className="ev-field">
                  <label htmlFor="ta-reason">
                    What would be most helpful? <small className="ev-muted">Optional</small>
                  </label>
                  <textarea id="ta-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Anything you want your school lead to know…" />
                </div>
                <button className="ev-btn primary" type="button" onClick={() => setSent(true)}>
                  Send privately
                  <Icon name="arrow" size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
