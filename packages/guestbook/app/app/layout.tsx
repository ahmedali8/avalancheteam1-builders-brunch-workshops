import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

// The deck's typefaces, reused from ../fonts so the demo matches the slides.
const kanit = localFont({
  variable: "--font-kanit",
  src: [
    { path: "../fonts/kanit-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/kanit-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/kanit-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/kanit-700.woff2", weight: "700", style: "normal" },
  ],
});

const aeonik = localFont({
  variable: "--font-aeonik",
  src: [
    { path: "../fonts/aeonik-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/aeonik-500.woff2", weight: "500", style: "normal" },
  ],
});

const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Builders Brunch · Guestbook",
  description: "Sign the wall on Avalanche. On-chain, owned by you, final in under a second.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read the cookie here (server) and hand it to Providers. This never imports the wagmi
  // config, so the client-only getDefaultConfig is never called on the server.
  const cookie = (await headers()).get("cookie");

  return (
    <html lang="en" className={`${kanit.variable} ${aeonik.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers cookie={cookie}>{children}</Providers>
      </body>
    </html>
  );
}
