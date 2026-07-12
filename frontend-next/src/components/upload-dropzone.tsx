"use client";

import { useCallback } from "react";
import type { ComponentType } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

const DEFAULT_ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function DocUploadChip({
  label,
  icon: Icon,
  onFile,
}: {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onFile: (file: File) => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: DEFAULT_ACCEPT,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-white/70 px-3 py-3 text-center transition hover:border-brand-300 hover:bg-brand-50/60",
        isDragActive && "border-brand-500 bg-brand-50 ring-4 ring-brand-100",
      )}
    >
      <input {...getInputProps()} />
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-brand-100 group-hover:text-brand-700">
        <Icon size={16} />
      </span>
      <span className="text-xs font-semibold leading-tight text-slate-700">{label}</span>
    </div>
  );
}
