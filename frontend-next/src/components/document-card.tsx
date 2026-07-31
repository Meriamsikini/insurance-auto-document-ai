"use client";

import type { UseFormRegister } from "react-hook-form";
import { CheckCircle2, Circle, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
 * DocumentCard — display + edit surface for one document type.
 *
 * Task 5: Added "Restaurer" button in the card header.
 * - Clears all form fields belonging to this card.
 * - Does NOT delete the uploaded file.
 * - Does NOT re-trigger OCR.
 * - Allows fresh manual entry.
 */
export function DocumentCard({
  def,
  register,
  resetFields,
  matchedDocuments,
  ocrExtracted,
  onDownload,
}: {
  def: CardDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  /** Task 5: callback to reset the fields belonging to this card */
  resetFields: (fieldNames: string[]) => void;
  matchedDocuments: DocumentItem[];
  ocrExtracted: boolean;
  onDownload: (document: DocumentItem) => void;
}) {
  const Icon = def.icon;
  const provided = !def.documentType || matchedDocuments.length > 0;

  // Task 5: Collect all field names for this card and reset them
  function handleRestore() {
    const names = def.fields.map((f) => f.name);
    resetFields(names);
    toast.info(`Carte « ${def.title} » réinitialisée. Vous pouvez saisir de nouvelles données.`);
  }

  return (
    <Card className="overflow-hidden">
      {/* ── Card header ── */}
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

        {/* Right side: status badge + restore button */}
        <div className="flex shrink-0 items-center gap-2">
          {def.documentType && (
            <Badge tone={provided ? "green" : "amber"}>
              {provided ? "Fourni" : "Manquant"}
            </Badge>
          )}

          {/* Task 5: Restore button */}
          <button
            type="button"
            onClick={handleRestore}
            title="Restaurer — vider les champs de cette carte (conserve le fichier)"
            className="flex items-center gap-1 rounded-lg border border-line bg-surface2 px-2 py-1 text-[11px] font-semibold text-ink3 transition hover:border-amber-500/40 hover:bg-amber-500/8 hover:text-amber-400"
          >
            <RotateCcw size={12} />
            Restaurer
          </button>
        </div>
      </div>

      {/* ── Fields grid ── */}
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {def.fields.map((field) => (
          <Field
            key={field.name}
            label={field.required ? `${field.label} *` : field.label}
            full={field.full}
          >
            {field.type === "select" ? (
              <Select
                {...register(field.name)}
                defaultValue=""
                required={field.required}
              >
                <option value="">-</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea
                {...register(field.name)}
                readOnly={field.readOnly}
                required={field.required}
              />
            ) : (
              <Input
                type={
                  field.type === "date" || field.type === "month" || field.type === "number"
                    ? field.type
                    : "text"
                }
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

      {/* ── Linked documents ── */}
      {def.documentType && (
        <div className="border-t border-line bg-surface2/50 px-4 py-3">
          {matchedDocuments.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-ink3">
              <Circle size={13} /> Aucun document déposé pour le moment
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
                    {document.processing_status === "PROCESSING" && (
                      <Loader2 size={10} className="animate-spin" />
                    )}
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
