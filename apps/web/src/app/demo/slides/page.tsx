import { AuroraPublic } from "@/components/aurora/public-frame";
import { Slides } from "./slides-client";

export const metadata = { title: "Demo Day slides" };

export default function SlidesPage() {
  return (
    <AuroraPublic>
      <Slides />
    </AuroraPublic>
  );
}
