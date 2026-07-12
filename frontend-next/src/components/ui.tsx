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
  primary: "border border-transparent bg-brand-600 text-white shadow-card hover:bg-brand-700",
  secondary: "border border-line bg-white text-slate-700 shadow-card hover:border-brand-300 hover:text-brand-700",
  outline: "border border-line bg-transparent text-slate-600 hover:border-brand-300 hover:text-brand-700",
  ghost: "border border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  danger: "border border-rose-200 bg-white text-rose-600 hover:border-rose-400 hover:bg-rose-50",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ className, variant = "secondary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
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
  <div ref={ref} className={cn("rounded-2xl border border-line bg-white shadow-soft", className)} {...props} />
));
Card.displayName = "Card";

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft", className)}>{children}</section>;
}

export function PanelHead({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-4 py-3.5", className)}>{children}</div>;
}

export function PanelBody({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin", className)}>{children}</div>;
}

/* ----------------------------------- Field ---------------------------------- */

export function Field({ label, children, full, hint }: PropsWithChildren<{ label: string; full?: boolean; hint?: string }>) {
  return (
    <label className={cn("flex flex-col gap-1.5", full && "md:col-span-2")}>
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/* ------------------------------- Form controls ------------------------------ */

const controlBase =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

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

export function Badge({ children, tone = "slate" }: PropsWithChildren<{ tone?: "slate" | "blue" | "green" | "amber" | "red" }>) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-brand-100 text-brand-700",
    green: "bg-teal-100 text-teal-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold", tones[tone])}>{children}</span>;
}

/* --------------------------------- StatCard --------------------------------- */

const statTones: Record<string, string> = {
  brand: "from-brand-500 to-brand-600",
  teal: "from-teal-500 to-teal-600",
  amber: "from-amber-500 to-amber-600",
  slate: "from-slate-500 to-slate-600",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone?: "brand" | "teal" | "amber" | "slate";
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white", statTones[tone])}>
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-ink">{value}</div>
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
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
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition",
              active ? "bg-white text-brand-700 shadow-card" : "text-slate-500 hover:text-slate-700",
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-slate-50/60 p-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={18} />
      </span>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  );
}

/* ----------------------------------- Spinner ---------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600", className)} />;
}
