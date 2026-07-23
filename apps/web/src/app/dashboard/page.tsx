import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CultureScanCard from "./CultureScanCard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Signed in as <strong>{user.email}</strong></p>
      <CultureScanCard />
    </main>
  );
}
