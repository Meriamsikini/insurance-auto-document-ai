"use client";

import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-brand-500 text-white shadow-card hover:bg-brand-600",
  secondary: "border border-line bg-surface2 text-ink shadow-card hover:border-brand-400 hover:bg-surface3",
  outline: "border border-line bg-transparent text-ink2 hover:border-brand-400 hover:text-ink",
  ghost: "border border-transparent bg-transparent text-ink2 hover:bg-surface2 hover:text-ink",
  danger: "border border-rose-500/25 bg-rose-500/10 text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/20",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2 text-xs gap-1",
  md: "h-8 px-2.5 text-sm gap-1.5",
  icon: "h-8 w-8 p-0", // h-8 is fine, let's not make it smaller
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ className, variant = "secondary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45",
      buttonVariants[variant],
      buttonSizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...props} size="icon" className={className} />;
}

/* ----------------------------------- Card ----------------------------------- */

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg border border-line bg-surface shadow-soft transition-all duration-200", className)}
    {...props}
  />
));
Card.displayName = "Card";

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft", className)}>{children}</section>;
}

export function PanelHead({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-line bg-surface2/70 px-3 py-2", className)}>{children}</div>;
}

export function PanelBody({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-2.5 scrollbar-thin", className)}>{children}</div>;
}

/* ----------------------------------- Field ---------------------------------- */

export function Field({ label, children, full, hint }: PropsWithChildren<{ label: string; full?: boolean; hint?: string }>) {
  return (
    <label className={cn("flex flex-col gap-1.5", full && "md:col-span-2")}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink3">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink3">{hint}</span>}
    </label>
  );
}

/* ------------------------------- Form controls ------------------------------ */

const controlBase =
  "w-full rounded-md border border-line bg-surface2 px-2.5 py-1.5 text-sm text-ink outline-none transition placeholder:text-ink3 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 disabled:bg-surface disabled:text-ink3";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlBase, className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlBase, className)} {...props} />
));
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlBase, "min-h-24 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

/* ----------------------------------- Badge ---------------------------------- */

export function Badge({
  children,
  tone = "slate",
  pulse = false,
}: PropsWithChildren<{ tone?: "slate" | "blue" | "green" | "amber" | "red"; pulse?: boolean }>) {
  const tones: Record<string, string> = {
    slate: "bg-surface3 text-ink2 border border-line",
    blue: "bg-brand-500/12 text-brand-300 border border-brand-500/25",
    green: "bg-emerald-500/12 text-emerald-400 border border-emerald-500/25",
    amber: "bg-amber-500/12 text-amber-400 border border-amber-500/25",
    red: "bg-rose-500/12 text-rose-400 border border-rose-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold transition-transform duration-150",
        tones[tone],
        pulse && "animate-pulse",
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- StatCard --------------------------------- */
// Mirrors the Supply Chain dashboard's KPICard: a tinted gradient icon tile,
// a big number, an optional trend arrow, and a soft hover lift + glow. Works
// unmodified in both the dark (default) and ".light" themes since every
// color here resolves through the shared --c-* design tokens.

const statTones: Record<string, string> = {
  brand: "from-brand-500 to-brand-600",
  teal: "from-sky-400 to-sky-500",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  slate: "from-surface3 to-surface3",
};

const statNumberTones: Record<string, string> = {
  brand: "text-brand-300",
  teal: "text-sky-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  slate: "text-ink",
};

const trendTones: Record<"up" | "down", string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  trend,
  emoji,
  hint,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone?: "brand" | "teal" | "amber" | "rose" | "slate";
  /** Optional % change vs. a previous period. Positive renders green/up, negative red/down. */
  trend?: number;
  /** Optional emoji shown next to the label, e.g. "🚗", "⚠️", "✅". Renders fine in both themes. */
  emoji?: string;
  /** Optional small muted line under the label. */
  hint?: string;
}) {
  const trendDirection = trend === undefined ? null : trend >= 0 ? "up" : "down";
  return (
    <Card className="group flex items-center gap-2.5 p-2.5 hover:-translate-y-0.5 hover:border-brand-400/40 hover:shadow-glow">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br text-white shadow-card transition-transform duration-200 group-hover:scale-110",
          statTones[tone],
        )}
      >
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <div className={cn("text-lg font-extrabold leading-none", statNumberTones[tone])}>{value}</div>
          {trendDirection && (
            <span className={cn("text-[11px] font-bold", trendTones[trendDirection])}>
              {trendDirection === "up" ? "▲" : "▼"} {Math.abs(trend as number).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 truncate text-xs font-semibold uppercase tracking-wide text-ink3">
          {emoji && <span className="text-sm not-italic">{emoji}</span>}
          {label}
        </div>
        {hint && <div className="truncate text-[10px] text-ink3">{hint}</div>}
      </div>
    </Card>
  );
}

/* -------------------------------- SegmentedTabs ------------------------------ */

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string; icon?: ComponentType<{ size?: number }> }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-surface2 p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-all duration-150",
              active ? "bg-surface text-brand-300 shadow-card" : "text-ink2 hover:text-ink",
            )}
          >
            {Icon && <Icon size={15} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- EmptyState -------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface2/40 p-5 text-center animate-fade-in">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-surface3 text-ink3">
        <Icon size={18} />
      </span>
      <p className="text-sm font-semibold text-ink2">{title}</p>
      {description && <p className="text-xs text-ink3">{description}</p>}
    </div>
  );
}

/* --------------------------------- ProgressBar -------------------------------- */

export function ProgressBar({ percent, tone = "brand" }: { percent: number; tone?: "brand" | "teal" | "amber" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const bar = clamped === 100 ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : tone === "teal" ? "bg-sky-400" : "bg-brand-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
      <div className={cn("h-full rounded-full transition-all duration-500 ease-out", bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ----------------------------------- Spinner ---------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500", className)} />;
}
