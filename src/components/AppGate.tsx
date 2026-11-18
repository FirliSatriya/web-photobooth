"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Smartphone } from "lucide-react";
import { describeUnsupported, detectCapabilities } from "@/lib/capabilities";
import { isInAppBrowser } from "@/lib/utils";
import { Button, Pill } from "@/components/ui";

/**
 * PRD edge case #1: social in-app browsers (Instagram / TikTok / LINE) either
 * refuse `getUserMedia` or ship a crippled WebCodecs build. We detect the UA
 * before the booth mounts and hand the user explicit instructions plus a copy
 * of the URL, instead of letting the camera prompt fail silently.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ inApp: boolean; issues: string[]; webcodecs: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const capabilities = detectCapabilities();
    setState({
      inApp: isInAppBrowser(navigator.userAgent),
      issues: describeUnsupported(),
      webcodecs: capabilities.webcodecs,
    });
  }, []);

  const canContinue = useMemo(() => (state ? state.issues.length === 0 : false), [state]);

  if (!state) return <>{children}</>;
  if ((!state.inApp && canContinue) || dismissed) return <>{children}</>;

  const isFatal = state.issues.length > 0;
  const url = typeof window === "undefined" ? "" : window.location.href;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-12">
      <div className="surface rounded-3xl p-7">
        <Pill tone="warn">
          <AlertTriangle className="h-3 w-3" /> Perlu perhatian
        </Pill>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {state.inApp ? "Buka di browser sungguhan" : "Peramban belum didukung penuh"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          {state.inApp
            ? "Browser bawaan Instagram/TikTok/LINE memblokir akses kamera dan WebCodecs. Salin tautan ini lalu buka di Safari atau Chrome."
            : "Sebagian fitur inti tidak tersedia di peramban ini."}
        </p>

        {state.issues.length > 0 ? (
          <ul className="mt-5 space-y-2 text-sm text-white/65">
            {state.issues.map((issue) => (
              <li key={issue} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                {issue}
              </li>
            ))}
          </ul>
        ) : null}

        {!state.webcodecs ? (
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-white/50">
            Video boomerang (MP4) butuh WebCodecs. Foto tetap bisa diambil dan diunduh sebagai PNG, dan filter
            otomatis turun ke Canvas 2D jika WebGL2 tidak tersedia.
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <Smartphone className="h-4 w-4 shrink-0 text-white/40" />
            <code className="min-w-0 flex-1 truncate text-xs text-white/70">{url}</code>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
              }}
            >
              Salin tautan
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Coba buka di luar
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          {!isFatal ? (
            <Button variant="ghost" className="w-full" onClick={() => setDismissed(true)}>
              Lanjut saja (fitur terbatas)
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
