import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { ConfirmHost } from "@/components/confirm";
import { APP_NAME } from "@/lib/brand";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

// Same faces as the main app (Geist stands in for ABC Diatype).
const ui = Geist({ variable: "--font-ui", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} Admin`, template: `%s · ${APP_NAME} Admin` },
  // Never in search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${ui.variable} ${mono.variable} ${serif.variable} antialiased`}>
        {children}
        <ConfirmHost />
      </body>
    </html>
  );
}
