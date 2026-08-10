"use client";

import { useId } from "react";
import { useT, wineTypeLabel, useLocale } from "@/lib/i18n";
import { wineAtmosphereKind, type WineAtmosphereKind } from "@/lib/wines";

type Props = {
  type: string;
  /** Optional secondary line (region / country). */
  place?: string | null;
  className?: string;
};

/**
 * Honest stand-in when there is no label photo: atmosphere by wine type,
 * never pretending to be the real bottle label.
 */
export function WineAtmospherePlaceholder({
  type,
  place,
  className = "",
}: Props) {
  const t = useT();
  const { dict } = useLocale();
  const kind = wineAtmosphereKind(type);
  const typeName = wineTypeLabel(dict, type);
  const placeLine = (place ?? "").trim();
  const uid = useId().replace(/:/g, "");

  return (
    <div
      className={[
        "wine-atmosphere",
        `wine-atmosphere--${kind}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={t("wine.atmosphereAlt", { type: typeName })}
    >
      <div className="wine-atmosphere__glow" aria-hidden />
      {kind === "espumoso" ? (
        <div className="wine-atmosphere__bubbles" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <BottleSilhouette kind={kind} uid={uid} />
      <div className="wine-atmosphere__caption">
        <p className="wine-atmosphere__eyebrow">{t("wine.atmosphereHint")}</p>
        <p className="wine-atmosphere__type">{typeName}</p>
        {placeLine ? (
          <p className="wine-atmosphere__place">{placeLine}</p>
        ) : null}
      </div>
    </div>
  );
}

function BottleSilhouette({
  kind,
  uid,
}: {
  kind: WineAtmosphereKind;
  uid: string;
}) {
  const fillId = `atm-${kind}-${uid}`;
  const fill = `url(#${fillId})`;

  const stops =
    kind === "blanco" ? (
      <>
        <stop offset="0%" stopColor="#e8d5a8" />
        <stop offset="50%" stopColor="#c9a66b" />
        <stop offset="100%" stopColor="#8a6a3a" />
      </>
    ) : kind === "rosado" ? (
      <>
        <stop offset="0%" stopColor="#d48a92" />
        <stop offset="55%" stopColor="#a04d56" />
        <stop offset="100%" stopColor="#6a2a32" />
      </>
    ) : kind === "espumoso" ? (
      <>
        <stop offset="0%" stopColor="#dce8d4" />
        <stop offset="45%" stopColor="#9bb08a" />
        <stop offset="100%" stopColor="#2f4234" />
      </>
    ) : (
      <>
        <stop offset="0%" stopColor="#8a2a38" />
        <stop offset="55%" stopColor="#5a1520" />
        <stop offset="100%" stopColor="#2a0c12" />
      </>
    );

  return (
    <svg
      className="wine-atmosphere__bottle"
      viewBox="0 0 120 220"
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          {stops}
        </linearGradient>
      </defs>
      <rect
        x="52"
        y="8"
        width="16"
        height="36"
        rx="3"
        fill="#1a1714"
        opacity="0.88"
      />
      <rect
        x="50"
        y="4"
        width="20"
        height="14"
        rx="2"
        fill={kind === "espumoso" ? "#c4a35a" : "#3d1218"}
        opacity="0.95"
      />
      <path
        d="M44 44
           C44 44 40 58 36 72
           C30 92 28 110 28 128
           L28 198
           C28 208 36 214 46 214
           L74 214
           C84 214 92 208 92 198
           L92 128
           C92 110 90 92 84 72
           C80 58 76 44 76 44
           Z"
        fill={fill}
        opacity="0.92"
      />
      <path
        d="M40 80 C38 110 38 150 40 190"
        fill="none"
        stroke="rgba(255,252,247,0.28)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Soft glass wash — not a blank paper label */}
      <ellipse
        cx="58"
        cy="145"
        rx="18"
        ry="28"
        fill="rgba(255,252,247,0.08)"
      />
      <path
        d="M48 100 C62 108 70 130 68 158"
        fill="none"
        stroke="rgba(255,252,247,0.16)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
