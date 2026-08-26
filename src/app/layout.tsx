import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AppearanceProvider } from "@/lib/appearance";
import { MissionProvider } from "@/lib/store";
import { MISSION_MESSAGE, MISSION_NAME, MISSION_TAGLINE } from "@/lib/mission";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${MISSION_NAME} — ${MISSION_TAGLINE}`,
  description: MISSION_MESSAGE,
};

const themeBootScript = `
(function(){
  try {
    var v = localStorage.getItem('mc-appearance-v1');
    document.documentElement.dataset.theme = v === 'desert' ? 'desert' : 'dark';
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
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)] font-sans">
        <AppearanceProvider>
          <MissionProvider>
            <AppShell>{children}</AppShell>
          </MissionProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
