"use client";

import type { UseFormRegister } from "react-hook-form";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import type { CardDef } from "@/lib/document-schema";
import type { DocumentItem } from "@/lib/api";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";

function docStatusTone(status: string): "green" | "amber" | "red" | "blue" {
  if (status === "COMPLETED") return "green";
  if (status === "FAILED") return "red";
  if (status === "PROCESSING") return "blue";
  return "amber";
}

/**
 * Pure display + edit surface for one business document's fields.
 * Import/upload happens exclusively in the "Document Upload" section at the
 * top of the tab — this card never shows an upload control.
 */
export function DocumentCard({
  def,
  register,
  matchedDocuments,
  ocrExtracted,
  onDownload,
}: {
  def: CardDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  matchedDocuments: DocumentItem[];
  ocrExtracted: boolean;
  onDownload: (document: DocumentItem) => void;
}) {
  const Icon = def.icon;
  const provided = !def.documentType || matchedDocuments.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line bg-surface2/70 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-brand-300 shadow-card">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-ink">{def.title}</span>
              {def.required && <Badge tone="slate">Requis</Badge>}
              {ocrExtracted && (
                <Badge tone="blue">
                  <Sparkles size={11} /> Extrait
                </Badge>
              )}
            </div>
            <p className="text-xs text-ink3">{def.description}</p>
          </div>
        </div>
        {def.documentType && <Badge tone={provided ? "green" : "amber"}>{provided ? "Fourni" : "Manquant"}</Badge>}
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {def.fields.map((field) => (
          <Field key={field.name} label={field.required ? `${field.label} *` : field.label} full={field.full}>
            {field.type === "select" ? (
              <Select {...register(field.name)} defaultValue="" required={field.required}>
                <option value="">-</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea {...register(field.name)} readOnly={field.readOnly} required={field.required} />
            ) : (
              <Input
                type={field.type === "date" || field.type === "month" || field.type === "number" ? field.type : "text"}
                placeholder={field.placeholder}
                readOnly={field.readOnly}
                required={field.required}
                className={field.readOnly ? "text-brand-300" : undefined}
                {...register(field.name)}
              />
            )}
          </Field>
        ))}
      </div>

      {def.documentType && (
        <div className="border-t border-line bg-surface2/50 px-4 py-3">
          {matchedDocuments.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-ink3">
              <Circle size={13} /> Aucun document depose pour le moment
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {matchedDocuments.map((document) => (
                <button
                  key={document.id}
                  onClick={() => onDownload(document)}
                  className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition hover:bg-surface3"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-ink2">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                    <span className="truncate font-semibold">{document.original_filename}</span>
                  </span>
                  <Badge tone={docStatusTone(document.processing_status)}>
                    {document.processing_status === "PROCESSING" && <Loader2 size={10} className="animate-spin" />}
                    {document.processing_status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
