"use client";

import type { ReactNode } from "react";

// The chat drawer and the visit screen live once in the layout; any page can open them with an event, so no page has
// to know where they are mounted.
export const OPEN_CHAT = "ta-open-chat";
export const OPEN_VISIT = "ta-open-visit";

export const openChat = (pairingId?: string) => window.dispatchEvent(new CustomEvent(OPEN_CHAT, { detail: { pairingId } }));
export const openVisit = (pairingId?: string) => window.dispatchEvent(new CustomEvent(OPEN_VISIT, { detail: { pairingId } }));

export function OpenChat({ pairingId, className = "ev-btn", children }: { pairingId?: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openChat(pairingId)}>
      {children}
    </button>
  );
}

export function OpenVisit({ pairingId, className = "ev-btn", children }: { pairingId?: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openVisit(pairingId)}>
      {children}
    </button>
  );
}
