"use client";

import { useState } from "react";
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
          <ImageDown className="h-4 w-4" /> Unduh foto
        </Button>
        {videoUrl ? (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => void downloadAsset(videoUrl, `${filename}-boomerang.mp4`)}
          >
            <Download className="h-4 w-4" /> Unduh boomerang
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-white/35" />
        <code className="min-w-0 flex-1 truncate text-[11px] text-white/55">{shareUrl}</code>
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>

      <a
        href="/"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
      >
        Buat photostrip sendiri
      </a>
    </div>
  );
}
