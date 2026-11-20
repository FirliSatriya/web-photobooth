import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Remote Photobooth — foto bareng walau beda kota",
  description:
    "Bilik photobooth virtual: live preview gabungan, jepretan sinkron, filter WebGL, dan hasil resolusi tinggi siap unduh.",
  applicationName: "Remote Photobooth",
  keywords: ["photobooth", "webrtc", "photo strip", "remote", "boomerang"],
  openGraph: {
    title: "Remote Photobooth",
    description: "Foto bareng teman walau beda kota — sinkron, tajam, siap unduh.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffafd" },
    { media: "(prefers-color-scheme: dark)", color: "#241426" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" closeButton className="font-sans" />
        </ThemeProvider>
      </body>
    </html>
  );
}
