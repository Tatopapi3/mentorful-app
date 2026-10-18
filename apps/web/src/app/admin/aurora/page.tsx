import { redirect } from "next/navigation";

// Pulse is the landing page of the leadership views; the overview is the detail page behind it.
export default function AuroraAdminIndex() {
  redirect("/admin/aurora/pulse");
}
