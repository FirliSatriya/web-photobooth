"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The product ships light-first: the ambient gradients, photograph mattes and
 * scrim overlays were tuned against the light palette. We still mount the
 * provider so `next-themes` consumers (sonner toasts) resolve a deterministic
 * theme, and so the `.dark` token block in globals.css can be switched on later
 * by flipping `defaultTheme` — no component changes required.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
