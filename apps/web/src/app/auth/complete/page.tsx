"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteHeader from "@/components/SiteHeader";

/**
 * Where /auth/callback sends a sign-in that arrived without ?code=.
 *
 * Supabase sometimes answers in the URL fragment instead: either a session
 * (access_token + refresh_token, the implicit flow) or an error such as an
 * expired or already-used link. Fragments never reach the server, so only the
 * browser can read them. A redirect keeps the fragment, so it is still here.
 *
 * The allowlist still applies: the proxy checks the new session on the very
 * next request and ends it if the address isn't allowed.
 */
export default function AuthCompletePage() {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const next = query.get("next") || "/dashboard";

    const failure = hash.get("error_description") || query.get("error_description");
    if (failure) {
      window.location.replace(
        `/login?error=auth&reason=${encodeURIComponent(failure.replace(/\+/g, " "))}`
      );
      return;
    }

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) {
      window.location.replace("/login?error=auth");
      return;
    }

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setMessage("That sign-in link didn't work.");
          window.location.replace(`/login?error=auth&reason=${encodeURIComponent(error.message)}`);
        } else {
          // A full navigation, so the proxy sees the new session cookies.
          window.location.replace(next);
        }
      });
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <p role="status">{message}</p>
      </main>
    </>
  );
}
