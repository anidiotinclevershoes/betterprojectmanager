import type { Metadata } from "next";
import { Source_Serif_4, Sora, Syne } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { MissionProvider } from "@/lib/store";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Mission Control — AI Chief Project Officer",
  description:
    "Your AI Chief Project Officer, Executive Coach and Second Brain. Built to make you a better Project Manager.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${syne.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full atmosphere text-ink">
        <MissionProvider>
          <AppShell>{children}</AppShell>
        </MissionProvider>
      </body>
    </html>
  );
}
