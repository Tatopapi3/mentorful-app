import type { Metadata } from "next";
import { Lora, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BranchBadge from "@/components/BranchBadge";
import { branchLabel } from "@/lib/branch";
import { cookies } from "next/headers";
import { DemoSwitcher, type StageRole } from "@/components/demo/switcher";

// Type system ported from the app-screens prototype: Lora for headings and the
// wordmark, Public Sans for body, JetBrains Mono for small uppercase labels.
// Geist was create-next-app scaffolding and was referenced by nothing.

const lora = Lora({
  variable: "--font-serif",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const branch = branchLabel();

export const metadata: Metadata = {
  // `template` applies to child pages that export their own title, so
  // /report renders as "Culture Scan report | Mentorful". `default` is what
  // pages without a title get — including the link preview when a report
  // URL is shared.
  title: {
    default: branch ? `${branch} · Mentorful` : "Mentorful",
    template: branch ? `%s | ${branch}` : "%s | Mentorful",
  },
  description:
    "The school culture platform for teachers and the people who lead them.",
};

// Demo Day only: the stage dataset adds a bar for switching between the principal and the two teachers.
const STAGE = process.env.PREVIEW_MOCK === "1" && process.env.PREVIEW_DATASET === "stage";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let who: StageRole = "admin";
  if (STAGE) {
    const jar = await cookies();
    who = jar.get("preview_as")?.value === "teacher" ? (jar.get("preview_who")?.value === "second" ? "second" : "first") : "admin";
  }
  return (
    <html lang="en">
      <body
        className={`${lora.variable} ${publicSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
        {STAGE ? <DemoSwitcher current={who} /> : null}
        <BranchBadge />
      </body>
    </html>
  );
}
