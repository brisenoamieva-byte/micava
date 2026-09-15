"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * Prefer rear camera via getUserMedia (facingMode environment).
 * Live preview opens as a full-viewport overlay (no scroll inside the modal).
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [targetSlot, setTargetSlot] = useState<0 | 1 | "next">("next");
  const [staging, setStaging] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
    return () => {
      stopLiveStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  useEffect(() => {
    if (!liveOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      /* autoplay may need a gesture — already in gesture path */
    });
  }, [liveOpen]);

  useEffect(() => {
    if (!liveOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [liveOpen]);

  function stopLiveStream() {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function closeLiveCamera() {
    stopLiveStream();
    setLiveOpen(false);
    setLiveError(null);
  }

  async function openRearCamera(slot: 0 | 1 | "next") {
    if (scanning || staging || liveOpen) return;
    setTargetSlot(slot);
    setLiveError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      openFileCameraFallback();
      return;
    }

    try {
      let stream = await requestRearStream();
      stream = (await preferLabeledRearDevice(stream)) ?? stream;

      // Some phones ignore facingMode ideal and still open the selfie cam.
      const facing = stream.getVideoTracks()[0]?.getSettings().facingMode;
      if (facing === "user") {
        try {
          const rearOnly = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { exact: "environment" } },
          });
          for (const track of stream.getTracks()) track.stop();
          stream = rearOnly;
        } catch {
          /* keep stream — exact rear unavailable */
        }
      }

      streamRef.current = stream;
      setLiveOpen(true);
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: string }).name)
          : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setLiveError(t("scan.cameraPermissionDenied"));
        return;
      }
      openFileCameraFallback();
    }
  }

  async function requestRearStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
    }
  }

  /** After permission, labels exist — switch to an explicit rear device if listed. */
  async function preferLabeledRearDevice(
    stream: MediaStream
  ): Promise<MediaStream | null> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const rear = devices.find(
        (d) =>
          d.kind === "videoinput" &&
          /back|rear|environment|trasera|posterior|world/i.test(d.label || "")
      );
      const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (!rear?.deviceId || rear.deviceId === currentId) return stream;
      for (const track of stream.getTracks()) track.stop();
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: rear.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch {
      return stream;
    }
  }

  /** Last-resort: OS camera via file input (capture=environment). */
  function openFileCameraFallback() {
    const input = cameraInputRef.current;
    if (!input) return;
    input.setAttribute("capture", "environment");
    input.setAttribute("accept", "image/*");
    input.click();
  }

  async function snapLivePhoto() {
    const video = videoRef.current;
    if (!video || scanning || staging) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setStaging(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onImagesChange(placeImage(images, dataUrl, targetSlot));
      setTargetSlot("next");
      closeLiveCamera();
    } finally {
      setStaging(false);
    }
  }

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

  const canIdentify = images.length > 0 && !scanning && !staging && !liveOpen;
  const busy = scanning || staging;
  const liveSlotLabel =
    targetSlot === 1
      ? t("scan.photoBack")
      : targetSlot === 0
        ? t("scan.photoFront")
        : images.length === 0
          ? t("scan.photoFront")
          : t("scan.photoBack");

  const liveOverlay =
    portalReady && liveOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex flex-col bg-black"
            role="dialog"
            aria-modal="true"
            aria-label={t("scan.takePhoto")}
          >
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <p className="text-center text-[11px] uppercase tracking-[0.16em] text-white/85">
                  {liveSlotLabel}
                </p>
              </div>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full min-h-0 w-full flex-1 object-cover"
                // Mirror off — labels must read normally (rear camera).
                style={{ transform: "none" }}
              />
            </div>
            <div className="flex shrink-0 gap-2 border-t border-white/15 bg-[rgba(12,10,9,0.96)] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="btn btn-ghost min-h-[48px] flex-1 border border-[rgba(255,252,247,0.25)] text-[var(--cream)]"
                onClick={closeLiveCamera}
                disabled={staging}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary min-h-[48px] flex-1 disabled:opacity-60"
                onClick={() => void snapLivePhoto()}
                disabled={staging}
              >
                {staging ? t("scan.scanning") : t("scan.takePhoto")}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

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
                    disabled={busy || liveOpen}
                  >
                    {t("common.delete")}
                  </button>
                  <button
                    type="button"
                    className="absolute bottom-1.5 left-1.5 rounded-md bg-[rgba(20,18,16,0.72)] px-2 py-1 text-[11px] text-[var(--cream)]"
                    onClick={() => void openRearCamera(slot)}
                    disabled={busy || liveOpen}
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
                  disabled={busy || liveOpen}
                  onClick={() => void openRearCamera(slot)}
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

      {liveError && !liveOpen ? (
        <div className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[rgba(20,18,16,0.92)]">
          <p className="px-3 py-2 text-xs text-[var(--cream)]" role="alert">
            {liveError}
          </p>
          <div className="flex gap-2 p-3">
            <button
              type="button"
              className="btn btn-ghost min-h-[44px] flex-1 border border-[rgba(255,252,247,0.25)] text-[var(--cream)]"
              onClick={() => setLiveError(null)}
              disabled={staging}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary min-h-[44px] flex-1 disabled:opacity-60"
              onClick={() =>
                void openRearCamera(targetSlot === "next" ? 0 : targetSlot)
              }
              disabled={staging}
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      ) : null}

      {liveOverlay}

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
              disabled={busy || liveOpen}
              onClick={() => void openRearCamera("next")}
            >
              {t("scan.takePhoto")}
            </button>
            <button
              type="button"
              className="btn btn-ghost flex min-h-[44px] w-full items-center justify-center border border-[var(--line)] disabled:opacity-60"
              disabled={busy || liveOpen}
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
    return current.length === 0
      ? [dataUrl]
      : [dataUrl, ...current.slice(1)].slice(0, 2);
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
