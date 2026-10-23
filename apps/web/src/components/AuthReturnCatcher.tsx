"use client";

import { useEffect } from "react";

/**
 * Catches a magic-link return that landed somewhere other than /auth/callback.
 *
 * When the requested redirect isn't on Supabase's Redirect URLs list, Supabase
 * falls back to the project's Site URL (usually "/"), with the session or error
 * in the URL fragment. Only the browser can see a fragment, so this hands it to
 * /auth/complete. The ?code= case is handled server-side in src/proxy.ts.
 */
export default function AuthReturnCatcher() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname.startsWith("/auth/")) return;
    if (/[#&](access_token|error_description)=/.test(hash)) {
      window.location.replace(`/auth/complete${hash}`);
    }
  }, []);
  return null;
}
