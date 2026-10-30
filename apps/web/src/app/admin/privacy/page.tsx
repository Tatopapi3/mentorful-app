import { LOOK } from "@/lib/admin/look";
import PrivacyView from "@/components/admin/privacy-view";


export const dynamic = "force-dynamic";

export default async function Page() {

  return <PrivacyView skin={LOOK} />;
}
