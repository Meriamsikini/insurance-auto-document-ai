import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...props} className={cn("h-9 w-9 px-0", props.className)} />;
}

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/88 shadow-soft backdrop-blur", className)}>{children}</section>;
}

export function PanelHead({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3", className)}>{children}</div>;
}

export function PanelBody({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("min-h-0 flex-1 overflow-auto p-4 scrollbar-thin", className)}>{children}</div>;
}

export function Field({ label, children, full }: PropsWithChildren<{ label: string; full?: boolean }>) {
  return (
    <label className={cn("flex flex-col gap-1.5", full && "md:col-span-2")}>
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100", props.className)} />;
}

export function Badge({ children, tone = "slate" }: PropsWithChildren<{ tone?: "slate" | "blue" | "green" | "amber" | "red" }>) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold", tones[tone])}>{children}</span>;
}
