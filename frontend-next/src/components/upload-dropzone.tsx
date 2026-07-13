"use client";

import { useCallback } from "react";
import type { ComponentType } from "react";
import { useDropzone } from "react-dropzone";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export type ChipTone = "blue" | "teal" | "amber" | "green" | "red";

const chipToneClasses: Record<ChipTone, string> = {
  blue: "bg-brand-500/15 text-brand-300 group-hover:bg-brand-500/25",
  teal: "bg-sky-500/15 text-sky-300 group-hover:bg-sky-500/25",
  amber: "bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25",
  green: "bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25",
  red: "bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/25",
};

export function DocUploadChip({
  label,
  sublabel,
  icon: Icon,
  tone = "blue",
  done,
  multiple = false,
  onFile,
}: {
  label: string;
  sublabel?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone?: ChipTone;
  done?: boolean;
  multiple?: boolean;
  onFile: (file: File) => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach((file) => onFile(file));
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple, accept: DEFAULT_ACCEPT });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative flex min-w-[168px] flex-1 cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-line bg-surface2/60 px-3 py-2.5 transition hover:border-brand-400 hover:bg-brand-500/5",
        isDragActive && "border-brand-400 bg-brand-500/10 ring-4 ring-brand-500/10",
        done && "border-solid border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <input {...getInputProps()} />
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md transition", chipToneClasses[tone])}>
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-ink">{label}</div>
        <div className="truncate text-[10px] text-ink3">{sublabel ?? "PDF, JPG, PNG"}</div>
      </div>
      {done && (
        <span className="absolute right-2 top-2 text-emerald-400">
          <CheckCircle2 size={13} />
        </span>
      )}
    </div>
  );
}
