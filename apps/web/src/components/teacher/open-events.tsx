"use client";

import type { ReactNode } from "react";

// The chat drawer and the video call live once in the layout; any page can open them with an event, so no page has
// to know where they are mounted.
export const OPEN_CHAT = "ta-open-chat";
export const OPEN_CALL = "ta-open-call";
/** Preview only: shows the incoming-call banner so it can be seen without a second person. */
export const DEMO_INCOMING = "ta-demo-incoming-call";

export const openChat = (pairingId?: string) => window.dispatchEvent(new CustomEvent(OPEN_CHAT, { detail: { pairingId } }));
/** Places a video call to the co-mentor in this pairing. */
export const openCall = (pairingId?: string) => window.dispatchEvent(new CustomEvent(OPEN_CALL, { detail: { pairingId } }));

export function OpenChat({ pairingId, className = "ev-btn", children }: { pairingId?: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openChat(pairingId)}>
      {children}
    </button>
  );
}

export function OpenCall({ pairingId, className = "ev-btn", children }: { pairingId?: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openCall(pairingId)}>
      {children}
    </button>
  );
}
