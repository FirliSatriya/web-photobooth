"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-flame text-white shadow-[0_10px_30px_-12px_rgba(226,82,58,0.9)] hover:bg-[#ef6249] active:translate-y-px",
  secondary: "bg-white/10 text-white hover:bg-white/16 active:translate-y-px",
  ghost: "text-white/70 hover:text-white hover:bg-white/8",
  outline: "border border-white/18 text-white/85 hover:border-white/35 hover:bg-white/5",
  danger: "bg-[#c8372a] text-white hover:bg-[#d8483a]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-13 px-7 text-[15px] gap-2.5 rounded-2xl",
  icon: "h-10 w-10 rounded-xl justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium tracking-tight transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
});

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "pro" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/8 text-white/70 border-white/10",
    live: "bg-flame/15 text-[#ff9d8b] border-flame/30",
    pro: "bg-[#f6d9a8]/12 text-[#f6d9a8] border-[#f6d9a8]/30",
    warn: "bg-amber-400/12 text-amber-200 border-amber-300/30",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("surface rounded-3xl", className)}>{children}</div>;
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{children}</span>
      {hint ? <span className="text-[11px] text-white/35">{hint}</span> : null}
    </div>
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 pr-9 text-sm text-white/90",
          "focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm text-white/85">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-relaxed text-white/40">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-flame/50 bg-flame" : "border-white/15 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </label>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-flame to-[#f2a08f] transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-flame/90 text-ink shadow-[0_8px_24px_-10px_rgba(226,82,58,0.9)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" fill="currentColor" stroke="none" opacity="0.18" />
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" />
          <circle cx="12" cy="13" r="3.6" />
          <path d="M8.5 6.5l1.2-2.2h4.6L15.5 6.5" strokeLinecap="round" />
          <circle cx="17.8" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight">
          Photobooth<span className="text-white/35">.</span>
          <span className="ml-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">remote</span>
        </span>
      ) : null}
    </span>
  );
}
