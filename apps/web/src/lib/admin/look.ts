import { notFound } from "next/navigation";
import { lookEnabled } from "./looks";

/** The two looks that share the Aurora layout. Nick's own look lives under /admin without a prefix. */
export type Look = "aurora" | "blend";

export async function lookOf(params: Promise<{ look: string }>): Promise<Look> {
  const { look } = await params;
  if ((look !== "aurora" && look !== "blend") || !lookEnabled(look)) notFound();
  return look;
}

export const lookBase = (look: Look) => `/admin/${look}` as const;
