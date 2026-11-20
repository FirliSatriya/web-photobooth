"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, ImageDown, Link2 } from "lucide-react";
import { Button } from "@/components/ui";
import { downloadAsset } from "@/lib/download";

export function ShareActions({
  shareUrl,
  imageUrl,
  videoUrl,
  filename,
}: {
  shareUrl: string;
  imageUrl: string;
  videoUrl: string | null;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:w-auto" onClick={() => void downloadAsset(imageUrl, `${filename}.png`)}>
          <ImageDown className="h-4 w-4" aria-hidden /> Unduh foto
        </Button>
        {videoUrl ? (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => void downloadAsset(videoUrl, `${filename}-boomerang.mp4`)}
          >
            <Download className="h-4 w-4" aria-hidden /> Unduh boomerang
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-canvas px-3 py-2.5">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <code className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{shareUrl}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 text-[11px] font-semibold text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-mint" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>

      <Link
        href="/"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border/60 px-4 text-xs font-semibold text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
      >
        Buat photostrip sendiri
      </Link>
    </div>
  );
}
