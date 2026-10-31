"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuroraPublic } from "@/components/aurora/public-frame";

/**
 * Login and check-your-email screens, ported from the app-screens prototype.
 *
 * In the Aurora look, inside the same frame as the rest of the app. All copy is
 * verbatim, except the address on the sent screen, which is the one the person
 * actually typed rather than the prototype's placeholder.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  // Separate from `status` so a failed resend doesn't drop the person back to
  // the form — they still have a valid link from the first send.
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendLink(address: string) {
    const supabase = createClient();
    return supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const { error } = await sendLink(email);

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }

    setResend("idle");
    setStatus("sent");
  }

  async function handleResend() {
    setResend("sending");
    const { error } = await sendLink(email);
    setResend(error ? "error" : "sent");
  }

  function handleStartOver() {
    // Keep the address in the field — "wrong address?" means correct it, not
    // retype it from scratch.
    setStatus("idle");
    setResend("idle");
    setError(null);
  }

  if (status === "sent") {
    return (
      <AuroraPublic>
        <div className="ap-auth">
          <div className="ap-card">
            <div className="ap-sent" aria-hidden>
              ✉
            </div>
            <h1>Check your email</h1>
            <p className="ap-lead" style={{ fontSize: 17 }}>
              A sign-in link is on its way to <strong>{email}</strong>. It works once and expires in an hour.
            </p>
            <p className="ap-muted" style={{ fontSize: 15 }}>
              Nothing after a minute? School spam filters are the usual culprit. Look for a message from Mentorful, or send another link.
            </p>
            <button type="button" className="ev-btn" style={{ marginTop: 6 }} onClick={handleResend} disabled={resend === "sending"}>
              {resend === "sending" ? "Sending…" : "Send another link"}
            </button>
            {resend === "sent" && <p className="ap-status">Another link is on its way.</p>}
            {resend === "error" && <p className="ap-error">{"That didn't send. Wait a moment and try again — your first link should still work."}</p>}
            <p className="ap-help">
              Wrong address?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleStartOver();
                }}
              >
                Start over
              </a>
            </p>
          </div>
          <aside className="ap-aside">
            <h2>{"Still can't get in?"}</h2>
            <p>
              Some school districts block outside links entirely. If nothing arrives after two attempts, email{" "}
              <a href="mailto:hello@mentorful.co">hello@mentorful.co</a>{" "}
              {"and we'll sort it out with your administrator. You won't be the only one."}
            </p>
          </aside>
        </div>
      </AuroraPublic>
    );
  }

  return (
    <AuroraPublic>
      <div className="ap-auth">
        <div className="ap-card">
          <p className="ev-eyebrow">Sign in</p>
          <h1>
            Sign in with your <em>school email</em>
          </h1>
          <p className="ap-lead" style={{ fontSize: 17 }}>
            {"No password. We'll email you a link that signs you in."}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="ev-field">
              <label htmlFor="email">School email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourschool.org"
                autoComplete="email"
              />
            </div>
            <button type="submit" className="ev-btn primary" style={{ width: "100%", marginTop: 14, justifyContent: "center" }} disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send my link"}
            </button>
            {error && <p className="ap-error">{error}</p>}
          </form>
          <p className="ap-help">
            {"Your school set up your account, so there's nothing to create. Can't get in? "}
            <a href="mailto:hello@mentorful.co">hello@mentorful.co</a>
          </p>
        </div>
        <aside className="ap-aside">
          <h2>{"You're here because your school is running a Culture Scan."}</h2>
          <p>{"It takes about six minutes, once. Here's the whole thing:"}</p>
          <ol className="ap-steps">
            <li>
              <i>01</i>
              <span>Answer 26 questions about the school around you.</span>
            </li>
            <li>
              <i>02</i>
              <span>Your answers are unlinked from you the moment you submit.</span>
            </li>
            <li>
              <i>03</i>
              <span>Your school gets the combined picture. Nobody gets yours.</span>
            </li>
          </ol>
        </aside>
      </div>
    </AuroraPublic>
  );
}
