import type { Metadata } from "next";
import { Lora, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  // `template` applies to child pages that export their own title, so
  // /report renders as "Culture Scan report | Mentorful". `default` is what
  // pages without a title get — including the link preview when a report
  // URL is shared.
  title: {
    default: "Mentorful",
    template: "%s | Mentorful",
  },
  description:
    "The school culture platform for teachers and the people who lead them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${lora.variable} ${publicSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
