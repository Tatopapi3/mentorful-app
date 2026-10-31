import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createPreviewClient, previewEnabled, type PreviewRole } from "@/lib/preview";
import { readJournal, writeJournal } from "@/lib/preview/journal";

export async function createClient() {
  const cookieStore = await cookies();

  const real = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware will refresh the session.
          }
        },
      },
    }
  );

  // Local preview only (see lib/preview). Never reaches Supabase.
  if (previewEnabled()) {
    const role: PreviewRole = cookieStore.get("preview_as")?.value === "teacher" ? "teacher" : "admin";
    const journal = await readJournal();
    return createPreviewClient(role, {
      who: cookieStore.get("preview_who")?.value === "second" ? "second" : undefined,
      journal,
      onWrite: async (w) => {
        journal.push(w);
        await writeJournal(journal);
      },
    }) as unknown as typeof real;
  }
  return real;
}
