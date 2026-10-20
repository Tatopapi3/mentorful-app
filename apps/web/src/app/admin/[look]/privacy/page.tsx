import { lookOf } from "@/lib/admin/look";
import PrivacyView from "@/components/admin/privacy-view";


export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ look: string }> }) {

  return <PrivacyView skin={await lookOf(params)} />;
}
