import { NoticePage } from "@/components/aurora/notice-page";

export default function NotFound() {
  return (
    <NoticePage eyebrow="404" title="That page isn’t here">
      <p>The link may be old, or the address may have a typo. The home page is the best place to start again.</p>
    </NoticePage>
  );
}
