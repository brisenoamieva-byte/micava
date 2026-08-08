"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useT } from "@/lib/i18n";
import {
  imageFileToDataUrl,
  MAX_SCAN_LABEL_IMAGES,
} from "@/lib/scan-label";

type Props = {
  images: string[];
  onImagesChange: (next: string[]) => void;
  scanning: boolean;
  onIdentify: (images: string[]) => void;
  /** Primary identify button label override. */
  identifyLabel?: string;
  /** Extra actions under the capture buttons (e.g. write by hand). */
  footer?: ReactNode;
  /** Visual tone for the busy indicator on identify. */
  busyTone?: "cream" | "wine";
};

/**
 * Stage up to 2 label photos (front + optional back) before identifying.
 */
export function LabelPhotoCapture({
  images,
  onImagesChange,
  scanning,
  onIdentify,
  identifyLabel,
  footer,
  busyTone = "cream",
}: Props) {
  const t = useT();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [targetSlot, setTargetSlot] = useState<0 | 1 | "next">("next");
  const [staging, setStaging] = useState(false);

  async function addFile(file: File | undefined) {
    if (!file || scanning || staging) return;
    setStaging(true);
    try {
      const { dataUrl } = await imageFileToDataUrl(file);
      onImagesChange(placeImage(images, dataUrl, targetSlot));
      setTargetSlot("next");
    } finally {
      setStaging(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onImagesChange(images.filter((_, i) => i !== index));
    setTargetSlot("next");
  }

  const canIdentify = images.length > 0 && !scanning && !staging;
  const busy = scanning || staging;

  return (
    <div className="space-y-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void addFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void addFile(e.target.files?.[0])}
      />

      <p className="text-xs leading-relaxed text-ink-soft">
        {t("scan.twoPhotosHint")}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((slot) => {
          const src = images[slot];
          const label =
            slot === 0 ? t("scan.photoFront") : t("scan.photoBack");
          const selected = targetSlot === slot;
          return (
            <div key={slot} className="min-w-0">
              <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {label}
                {slot === 1 ? (
                  <span className="normal-case tracking-normal">
                    {" "}
                    ({t("scan.optional")})
                  </span>
                ) : null}
              </p>
              {src ? (
                <div className="relative overflow-hidden rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={label}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 rounded-md bg-[rgba(20,18,16,0.72)] px-2 py-1 text-[11px] text-[var(--cream)]"
                    onClick={() => removeAt(slot)}
                    disabled={busy}
                  >
                    {t("common.delete")}
                  </button>
                  <button
                    type="button"
                    className="absolute bottom-1.5 left-1.5 rounded-md bg-[rgba(20,18,16,0.72)] px-2 py-1 text-[11px] text-[var(--cream)]"
                    onClick={() => {
                      setTargetSlot(slot);
                      cameraInputRef.current?.click();
                    }}
                    disabled={busy}
                  >
                    {t("scan.retake")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed px-2 text-center text-xs text-ink-soft transition ${
                    selected
                      ? "border-[rgba(110,31,44,0.55)] bg-[rgba(110,31,44,0.06)]"
                      : "border-[var(--line)] bg-[rgba(255,252,247,0.35)]"
                  }`}
                  disabled={busy}
                  onClick={() => {
                    setTargetSlot(slot);
                    cameraInputRef.current?.click();
                  }}
                >
                  <span>{label}</span>
                  <span className="text-[11px] opacity-80">
                    {t("scan.tapToCapture")}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {busy && scanning ? (
        <div
          className="btn btn-primary flex min-h-[48px] w-full items-center justify-center opacity-60"
          aria-busy="true"
        >
          <ThinkingIndicator
            tone={busyTone}
            size="sm"
            label={t("scan.scanning")}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-primary flex min-h-[48px] w-full items-center justify-center disabled:opacity-60"
            disabled={!canIdentify}
            onClick={() => onIdentify(images)}
          >
            {identifyLabel ?? t("scan.identifyPhotos")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-ghost flex min-h-[44px] w-full items-center justify-center border border-[var(--line)] disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setTargetSlot("next");
                cameraInputRef.current?.click();
              }}
            >
              {t("scan.takePhoto")}
            </button>
            <button
              type="button"
              className="btn btn-ghost flex min-h-[44px] w-full items-center justify-center border border-[var(--line)] disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setTargetSlot("next");
                galleryInputRef.current?.click();
              }}
            >
              {t("scan.upload")}
            </button>
          </div>
          {images.length >= MAX_SCAN_LABEL_IMAGES ? (
            <p className="text-center text-[11px] text-ink-soft">
              {t("scan.twoPhotosMax")}
            </p>
          ) : images.length === 1 ? (
            <p className="text-center text-[11px] text-ink-soft">
              {t("scan.addBackOptional")}
            </p>
          ) : null}
        </div>
      )}

      {footer}
    </div>
  );
}

function placeImage(
  current: string[],
  dataUrl: string,
  target: 0 | 1 | "next"
): string[] {
  if (target === 0) {
    return current.length === 0 ? [dataUrl] : [dataUrl, ...current.slice(1)].slice(0, 2);
  }
  if (target === 1) {
    if (current.length === 0) return [dataUrl];
    if (current.length === 1) return [current[0], dataUrl];
    return [current[0], dataUrl];
  }
  if (current.length === 0) return [dataUrl];
  if (current.length === 1) return [current[0], dataUrl];
  return [current[0], dataUrl];
}
