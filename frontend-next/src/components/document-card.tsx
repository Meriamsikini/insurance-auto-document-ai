"use client";

import { useState } from "react";
import type { UseFormRegister } from "react-hook-form";
import { CheckCircle2, Circle, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
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
 * Task 5: "Restaurer" button — clears card fields without deleting the file or re-running OCR.
 *
 * Task 2 (new): Delete button (XCircle) on FAILED documents only.
 *   - Visible only when processing_status === "FAILED".
 *   - Calls onDeleteDocument(doc) → backend DELETE + store/OCR cleanup in parent.
 *   - Row fades out smoothly; no page reload needed.
 *   - Red hover colour, pointer cursor, subtle scale animation.
 */
export function DocumentCard({
  def,
  register,
  resetFields,
  matchedDocuments,
  ocrExtracted,
  onDownload,
  onDeleteDocument,
}: {
  def: CardDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  /** Task 5: reset all form fields of this card */
  resetFields: (fieldNames: string[]) => void;
  matchedDocuments: DocumentItem[];
  ocrExtracted: boolean;
  onDownload: (document: DocumentItem) => void;
  /** Task 2: delete a FAILED document from the workflow entirely */
  onDeleteDocument?: (document: DocumentItem) => Promise<void>;
}) {
  const Icon = def.icon;
  const provided = !def.documentType || matchedDocuments.length > 0;

  // IDs currently being deleted (show spinner)
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  // IDs whose deletion succeeded (trigger CSS fade-out before parent re-renders)
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

  // Task 5 — restore
  function handleRestore() {
    resetFields(def.fields.map((f) => f.name));
    toast.info(`Carte « ${def.title} » réinitialisée. Vous pouvez saisir de nouvelles données.`);
  }

  // Task 2 — delete FAILED document
  async function handleDelete(e: React.MouseEvent, document: DocumentItem) {
    e.stopPropagation();
    e.preventDefault();
    if (!onDeleteDocument) return;

    setDeletingIds((prev) => new Set(prev).add(document.id));
    try {
      await onDeleteDocument(document);
      // Trigger fade-out; parent will remove it from the list after invalidation
      setDeletedIds((prev) => new Set(prev).add(document.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(document.id);
        return next;
      });
    }
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

        {/* Status badge + Restore button */}
        <div className="flex shrink-0 items-center gap-2">
          {def.documentType && (
            <Badge tone={provided ? "green" : "amber"}>
              {provided ? "Fourni" : "Manquant"}
            </Badge>
          )}
          {/* Task 5 */}
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
              <Select {...register(field.name)} defaultValue="" required={field.required}>
                <option value="">-</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>{option}</option>
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

      {/* ── Linked documents list ── */}
      {def.documentType && (
        <div className="border-t border-line bg-surface2/50 px-4 py-3">
          {matchedDocuments.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-ink3">
              <Circle size={13} /> Aucun document déposé pour le moment
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {matchedDocuments.map((document) => {
                const isFailed   = document.processing_status === "FAILED";
                const isDeleting = deletingIds.has(document.id);
                const isDeleted  = deletedIds.has(document.id);

                return (
                  <div
                    key={document.id}
                    style={{ transition: "opacity 300ms ease, transform 300ms ease" }}
                    className={[
                      "flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs",
                      isDeleted
                        ? "pointer-events-none -translate-y-1 opacity-0"
                        : "translate-y-0 opacity-100",
                    ].join(" ")}
                  >
                    {/* Filename + download trigger (disabled for FAILED) */}
                    <button
                      type="button"
                      onClick={() => !isFailed && onDownload(document)}
                      disabled={isFailed}
                      className={[
                        "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition",
                        isFailed ? "cursor-default" : "hover:bg-surface3",
                      ].join(" ")}
                    >
                      {isFailed ? (
                        <XCircle size={13} className="shrink-0 text-rose-400" />
                      ) : (
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                      )}
                      <span
                        className={[
                          "truncate font-semibold",
                          isFailed ? "text-ink3 line-through decoration-rose-400/60" : "text-ink2",
                        ].join(" ")}
                      >
                        {document.original_filename}
                      </span>
                    </button>

                    {/* Status badge */}
                    <Badge tone={docStatusTone(document.processing_status)}>
                      {document.processing_status === "PROCESSING" && (
                        <Loader2 size={10} className="animate-spin" />
                      )}
                      {document.processing_status}
                    </Badge>

                    {/* ── Task 2: X delete button — FAILED rows only ── */}
                    {isFailed && onDeleteDocument && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDelete(e, document)}
                        title="Supprimer ce document du workflow"
                        className={[
                          "group ml-0.5 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md border transition-all duration-150",
                          isDeleting
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            : "border-transparent text-ink3 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400",
                        ].join(" ")}
                      >
                        {isDeleting ? (
                          <Loader2 size={12} className="animate-spin text-rose-400" />
                        ) : (
                          <XCircle
                            size={13}
                            className="transition-transform duration-150 group-hover:scale-110"
                          />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
