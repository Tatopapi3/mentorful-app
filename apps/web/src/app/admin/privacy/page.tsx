import PrivacyView from "@/components/admin/privacy-view";
import { NickDenied } from "@/components/nick/page";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await requireAdmin())) return <NickDenied />;
  return <PrivacyView skin="nick" />;
}
