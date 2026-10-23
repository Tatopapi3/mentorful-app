import { createBrowserClient } from "@supabase/ssr";
import { createPreviewBrowserClient, previewBrowserEnabled } from "@/lib/preview/browser";

export function createClient() {
  const real = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // Local preview only (see lib/preview). Never reaches Supabase.
  if (previewBrowserEnabled()) return createPreviewBrowserClient() as unknown as typeof real;
  return real;
}
