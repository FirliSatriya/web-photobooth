"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressPrimitive } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

/**
 * App-level design-system kit.
 *
 * Every primitive here is a thin wrapper over the shadcn/ui component so the
 * product has exactly one button, one switch, one progress bar. Semantic
 * tokens (bg-primary, text-muted-foreground, border-border …) keep light and
 * dark mode consistent, and all interactive targets stay ≥ 44px on touch.
 */

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_14px_34px_-18px_var(--primary)] hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        secondary: "border border-border bg-card text-foreground shadow-sm hover:bg-secondary hover:text-secondary-foreground",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        outline: "border border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-secondary",
        danger:
          "bg-destructive text-destructive-foreground shadow-[0_14px_30px_-18px_var(--destructive)] hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-10 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-11 px-5 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-7 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type Size = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

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
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

const pillTones = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  live: "border-primary/30 bg-primary/10 text-primary",
  pro: "border-pro/35 bg-pro/10 text-pro",
  mint: "border-mint/35 bg-mint/10 text-mint",
  warn: "border-warn/40 bg-warn/10 text-warn",
} as const;

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof pillTones;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] [&>svg]:size-3",
        pillTones[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("surface rounded-3xl", className)}>{children}</div>;
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</span>
      {hint ? <span className="text-[11px] text-muted-foreground/80">{hint}</span> : null}
    </div>
  );
}

/** Native select styled like the shadcn Select trigger (keyboard + mobile safe). */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-input/60 bg-card px-3.5 pr-9 text-sm text-foreground shadow-xs transition-colors",
          "hover:border-input focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
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
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-0.5 shrink-0 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input/60"
      />
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <ProgressPrimitive
      value={Math.max(0, Math.min(100, value))}
      className={cn("h-1.5 bg-secondary", className)}
      aria-label="Progres sesi"
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary via-brand to-lilac text-primary-foreground shadow-[0_12px_26px_-14px_var(--primary)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" fill="currentColor" stroke="none" opacity="0.22" />
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" />
          <circle cx="12" cy="13" r="3.6" />
          <path d="M8.5 6.5l1.2-2.2h4.6L15.5 6.5" strokeLinecap="round" />
          <circle cx="17.8" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
        <span className="pointer-events-none absolute -right-1 -top-1 text-[9px] leading-none text-primary-foreground/95">
          ✦
        </span>
      </span>
      {!compact ? (
        <span className="text-[15px] font-bold tracking-tight text-foreground">
          Photobooth<span className="text-lilac">.</span>
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            remote
          </span>
        </span>
      ) : null}
    </span>
  );
}
