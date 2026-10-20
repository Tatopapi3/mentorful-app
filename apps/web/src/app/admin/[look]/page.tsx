import { redirect } from "next/navigation";
import { lookBase, lookOf } from "@/lib/admin/look";

export default async function LookIndex({ params }: { params: Promise<{ look: string }> }) {
  redirect(`${lookBase(await lookOf(params))}/pulse`);
}
