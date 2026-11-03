"use client";

import { useRef, useState } from "react";
import {
  csvTemplateContent,
  downloadExcelTemplate,
  fileToImportCsvText,
  importWinesFromCsv,
  type CsvImportResult,
} from "@/lib/import-cellar-csv";
import type { CellarUnit, WineDraft } from "@/lib/types";
import { downloadTextFile } from "@/lib/export-cellar";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  cellars: CellarUnit[];
  activeCellarId: string | null;
  onClose: () => void;
  onImport: (drafts: WineDraft[]) => void;
};

export function ImportCsvModal({
  open,
  cellars,
  activeCellarId,
  onClose,
  onImport,
}: Props) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);

  if (!open) return null;

  function reset() {
    setResult(null);
    setFileName("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const text = await fileToImportCsvText(file);
      const parsed = importWinesFromCsv(text, {
        defaultCellarId: activeCellarId,
        resolveCellarId: (name) => {
          const n = name.trim().toLowerCase();
          return (
            cellars.find((c) => c.name.trim().toLowerCase() === n)?.id ?? null
          );
        },
      });
      setResult(parsed);
    } catch {
      setResult({
        ok: [],
        errors: [{ row: 1, message: t("importCsv.readFailed") }],
        headers: [],
        totalRows: 0,
      });
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (!result?.ok.length) return;
    onImport(result.ok.map((r) => r.draft));
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-csv-title"
      onClick={handleClose}
    >
      <div
        className="panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] p-4 sm:rounded-[14px] sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="import-csv-title" className="display text-2xl text-ink">
              {t("importCsv.title")}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{t("importCsv.lead")}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] px-3 text-sm"
            onClick={handleClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="btn btn-primary min-h-[44px] w-full cursor-pointer text-center text-sm">
            {busy ? t("importCsv.reading") : t("importCsv.chooseFile")}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              disabled={busy}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-ghost min-h-[44px] flex-1 border border-[var(--line)] text-sm disabled:opacity-50"
              disabled={templateBusy}
              onClick={() => {
                void (async () => {
                  setTemplateBusy(true);
                  try {
                    await downloadExcelTemplate();
                  } finally {
                    setTemplateBusy(false);
                  }
                })();
              }}
            >
              {templateBusy
                ? t("importCsv.preparingTemplate")
                : t("importCsv.downloadExcel")}
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[44px] flex-1 border border-[var(--line)] text-sm"
              onClick={() =>
                downloadTextFile(
                  csvTemplateContent(),
                  "cavatale-plantilla.csv",
                  "text/csv;charset=utf-8"
                )
              }
            >
              {t("importCsv.downloadTemplate")}
            </button>
          </div>
        </div>

        {fileName ? (
          <p className="mt-3 text-xs text-ink-soft">{fileName}</p>
        ) : null}

        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">
              {t("importCsv.summary", {
                ok: result.ok.length,
                errors: result.errors.length,
                total: result.totalRows,
              })}
            </p>

            {result.errors.length > 0 ? (
              <div className="rounded-[10px] border border-[rgba(110,31,44,0.25)] bg-[rgba(110,31,44,0.05)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                  {t("importCsv.errorsTitle")}
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink">
                  {result.errors.slice(0, 40).map((e, i) => (
                    <li key={`${e.row}-${i}`}>
                      {t("importCsv.errorLine", {
                        row: e.row,
                        message: e.column
                          ? `${e.column}: ${e.message}`
                          : e.message,
                      })}
                    </li>
                  ))}
                  {result.errors.length > 40 ? (
                    <li className="text-ink-soft">
                      {t("importCsv.moreErrors", {
                        count: result.errors.length - 40,
                      })}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {result.ok.length > 0 ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-ink-soft">
                {result.ok.slice(0, 12).map((r) => (
                  <li key={r.row}>
                    #{r.row} · {r.draft.name}
                    {r.draft.winery ? ` · ${r.draft.winery}` : ""}
                    {r.draft.vintage != null ? ` · ${r.draft.vintage}` : ""}
                  </li>
                ))}
                {result.ok.length > 12 ? (
                  <li>
                    {t("importCsv.moreOk", { count: result.ok.length - 12 })}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            onClick={handleClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-[44px] disabled:opacity-50"
            disabled={!result?.ok.length}
            onClick={confirmImport}
          >
            {t("importCsv.confirm", { count: result?.ok.length ?? 0 })}
          </button>
        </div>
      </div>
    </div>
  );
}
