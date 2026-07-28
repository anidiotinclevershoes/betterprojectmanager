import type { Metadata } from "next";
import { Source_Serif_4, Sora, Syne } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AppearanceProvider } from "@/lib/appearance";
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

const themeBootScript = `
(function(){
  try {
    var stored = localStorage.getItem('mc-appearance-v1');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${sora.variable} ${syne.variable} ${sourceSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)]">
        <AppearanceProvider>
          <MissionProvider>
            <AppShell>{children}</AppShell>
          </MissionProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
