"use client";

import { use, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkSignIn } from "@/lib/auth/actions";
import SiteHeader from "@/components/SiteHeader";

// Set by the auth callback and the proxy (src/lib/supabase/proxy.ts).
const REDIRECT_ERRORS: Record<string, string> = {
  auth: "That sign-in link didn't work. It may have expired or already been used. Send a new one.",
  not_allowed: "That email isn't authorized to sign in here.",
};

/**
 * Login and check-your-email screens, ported from the app-screens prototype.
 *
 * The prototype repeated the logo inside the left column; here the shared
 * SiteHeader sits above both screens instead, so the mark isn't rendered twice.
 * All other copy is verbatim, except the address on the sent screen, which is
 * the one the person actually typed rather than the prototype's placeholder.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const params = use(searchParams);
  const known = REDIRECT_ERRORS[params.error ?? ""];
  // Supabase's own reason (e.g. "Email link is invalid or has expired"), when the callback had one.
  const redirectError = known ? (params.reason ? `${known} (${params.reason})` : known) : null;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(redirectError);
  // Separate from `status` so a failed resend doesn't drop the person back to
  // the form — they still have a valid link from the first send.
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");


  async function sendLink(address: string, existingOnly: boolean) {
    const supabase = createClient();
    return supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // With an allowlist on, never create an account from this form.
        shouldCreateUser: !existingOnly,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const check = await checkSignIn(email);
    if (!check.allowed) {
      setStatus("error");
      setError(REDIRECT_ERRORS.not_allowed);
      return;
    }

    const { error } = await sendLink(email, check.existingOnly);

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
    const check = await checkSignIn(email);
    const { error } = await sendLink(email, check.existingOnly);
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
      <>
        <SiteHeader />
        <div className="auth">
          <div className="auth-left">
            <div className="auth-box">
              <div className="sent-icon" aria-hidden>
                ✉
              </div>
              <h1>Check your email</h1>
              <p className="sub">
                A sign-in link is on its way to <strong>{email}</strong>. It works once and
                expires in an hour.
              </p>
              <p style={{ fontSize: 15, color: "#6B6459" }}>
                Nothing after a minute? School spam filters are the usual culprit. Look for a
                message from Mentorful, or send another link.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 10 }}
                onClick={handleResend}
                disabled={resend === "sending"}
              >
                {resend === "sending" ? "Sending…" : "Send another link"}
              </button>
              {resend === "sent" && (
                <p className="auth-status">Another link is on its way.</p>
              )}
              {resend === "error" && (
                <p className="auth-error">
                  {"That didn't send. Wait a moment and try again — your first link should still work."}
                </p>
              )}
              <p className="help">
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
          </div>
          <div className="auth-right">
            <h2>{"Still can't get in?"}</h2>
            <p>
              Some school districts block outside links entirely. If nothing arrives after two
              attempts, email <a href="mailto:hello@mentorful.co">hello@mentorful.co</a>{" "}
              {"and we'll sort it out with your administrator. You won't be the only one."}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="auth">
        <div className="auth-left">
          <div className="auth-box">
            <h1>Sign in with your school email</h1>
            <p className="sub">{"No password. We'll email you a link that signs you in."}</p>
            <form onSubmit={handleSubmit}>
              <label className="mono auth-label" htmlFor="email">
                School email
              </label>
              <input
                id="email"
                className="field"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourschool.org"
                autoComplete="email"
              />
              <button
                type="submit"
                className="btn"
                style={{ width: "100%", marginTop: 14 }}
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Send my link"}
              </button>
              {error && <p className="auth-error">{error}</p>}
            </form>
            {process.env.NODE_ENV === "development" ? (
              // Local only: /auth/dev-login refuses outside `next dev` on localhost.
              <form method="post" action="/auth/dev-login" style={{ marginTop: 10 }}>
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  className="btn btn-ghost"
                  style={{ width: "100%" }}
                  disabled={!email}
                >
                  Sign in without email (localhost)
                </button>
              </form>
            ) : null}
            <p className="help">
              {"Your school set up your account, so there's nothing to create. Can't get in? "}
              <a href="mailto:hello@mentorful.co">hello@mentorful.co</a>
            </p>
          </div>
        </div>
        <div className="auth-right">
          <h2>{"You're here because your school is running a Culture Scan."}</h2>
          <p>{"It takes about six minutes, once. Here's the whole thing:"}</p>
          <div className="steps-mini">
            <div>
              <i>01</i>
              <span>Answer 26 questions about the school around you.</span>
            </div>
            <div>
              <i>02</i>
              <span>Your answers are unlinked from you the moment you submit.</span>
            </div>
            <div>
              <i>03</i>
              <span>Your school gets the combined picture. Nobody gets yours.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
