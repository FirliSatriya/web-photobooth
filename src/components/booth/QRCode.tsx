"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { cn } from "@/lib/utils";

export function QRCode({
  value,
  size = 176,
  className,
  caption,
}: {
  value: string;
  size?: number;
  className?: string;
  caption?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    void toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#3b2233", light: "#fffafd" },
    })
      .then((dataUrl) => {
        if (alive) setSrc(dataUrl);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="grid place-items-center overflow-hidden rounded-2xl border border-border/50 bg-card p-2 shadow-sm"
        style={{ width: size, height: size }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Kode QR untuk membuka tautan hasil" width={size} height={size} />
        ) : (
          <span className="h-full w-full animate-pulse rounded-xl bg-secondary" role="status" aria-label="Menyiapkan QR" />
        )}
      </div>
      {caption ? (
        <figcaption className="max-w-[200px] text-center text-[11px] leading-relaxed text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
