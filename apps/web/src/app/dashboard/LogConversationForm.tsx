"use client";

import { useActionState } from "react";
import { createLog } from "./actions";
import { CONCERN_DOMAINS, DOMAIN_LABEL } from "@/lib/domains";

type PairOption = { id: string; partnerName: string; domain: string | null };

type State = { ok: boolean; error?: string } | null;

/**
 * Log a conversation. Deliberately a disclosure rather than a separate route:
 * the journal is the context for writing another entry, and a teacher with two
 * minutes between classes should not have to navigate anywhere.
 *
 * Saves as a DRAFT. 011's insert policy requires status = 'draft', so a log
 * becomes a record in two deliberate steps rather than one — which also means
 * a half-written thought is never posted to the pair by accident.
 */
export default function LogConversationForm({ pairs }: { pairs: PairOption[] }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => createLog(formData),
    null
  );

  if (pairs.length === 0) {
    return (
      <p className="tch-empty">
        You aren’t in a pairing this cycle, so there’s nobody to log a conversation with yet.
      </p>
    );
  }

  return (
    <details className="tch-log">
      <summary>Log a conversation</summary>

      <form action={action} className="tch-form">
        <div className="tch-row">
          <label>
            <span className="mono">With</span>
            <select name="pairing_id" className="field" required defaultValue={pairs[0].id}>
              {pairs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partnerName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mono">Domain</span>
            <select name="domain" className="field" defaultValue={pairs[0].domain ?? "CLASSROOM"}>
              {CONCERN_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span className="mono">What they’re working toward</span>
          <textarea name="vision" className="field" rows={2} />
        </label>

        <label>
          <span className="mono">What you noticed working</span>
          <textarea name="strength_noted" className="field" rows={2} />
        </label>

        <label>
          <span className="mono">More of</span>
          <textarea name="more_frequently" className="field" rows={2} />
        </label>

        <label>
          <span className="mono">Less of</span>
          <textarea name="less_frequently" className="field" rows={2} />
        </label>

        <label>
          <span className="mono">What you’re swapping</span>
          <textarea name="resources" className="field" rows={2} />
        </label>

        <div className="tch-form-foot">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </button>
          <span className="tch-fine">
            Saved as a draft, visible only to the two of you. Submit it when you’re ready.
          </span>
        </div>

        {state && !state.ok ? <p className="tch-error">{state.error}</p> : null}
        {state && state.ok ? <p className="tch-ok">Draft saved.</p> : null}
      </form>
    </details>
  );
}
