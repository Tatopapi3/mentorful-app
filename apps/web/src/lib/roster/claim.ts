/**
 * Asks the database to link the signed-in person's login to the roster profile that carries their email (script 026,
 * `claim_my_profile`). Returns true when a profile is now linked. It never throws: on a database where 026 has not been run
 * the call simply fails, and the person sees the same "not linked yet" page as before, not an error.
 */
type Rpc = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> };

export async function claimProfile(supabase: Rpc): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("claim_my_profile");
    return !error && typeof data === "string" && data.length > 0;
  } catch {
    return false;
  }
}
