"use client";

import { useId } from "react";
import { useT, wineTypeLabel, useLocale } from "@/lib/i18n";
import { wineAtmosphereKind, type WineAtmosphereKind } from "@/lib/wines";

type Props = {
  type: string;
  place?: string | null;
  className?: string;
};

/**
 * No-label stand-in: vineyard atmosphere + the real Cavatale mark
 * (exact brand bottle — never a fake label photo).
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
      <SceneBackdrop kind={kind} uid={uid} />
      <div className="wine-atmosphere__vignette" aria-hidden />
      {kind === "espumoso" ? (
        <div className="wine-atmosphere__bubbles" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div className="wine-atmosphere__stage">
        <div className="wine-atmosphere__mark-wrap">
          {/* Exact brand silhouette — same asset as nav mark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/cavatale-mark.png"
            alt=""
            className="wine-atmosphere__mark"
            width={160}
            height={160}
          />
        </div>
        <div className="wine-atmosphere__caption">
          <p className="wine-atmosphere__eyebrow">{t("wine.atmosphereHint")}</p>
          <p className="wine-atmosphere__type">{typeName}</p>
          {placeLine ? (
            <p className="wine-atmosphere__place">{placeLine}</p>
          ) : (
            <p className="wine-atmosphere__place">
              {t("wine.atmosphereAddPhoto")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SceneBackdrop({
  kind,
  uid,
}: {
  kind: WineAtmosphereKind;
  uid: string;
}) {
  const sunId = `atm-sun-${uid}`;
  const hazeId = `atm-haze-${uid}`;

  const sky =
    kind === "blanco"
      ? ["#f7f0e2", "#e8d7b0", "#c4a06a"]
      : kind === "rosado"
        ? ["#f6e8ea", "#e4b8be", "#b86a72"]
        : kind === "espumoso"
          ? ["#eef3ea", "#c8d6bc", "#6a8064"]
          : ["#f3e6e4", "#d4a0a4", "#7a2a34"];

  const hillFar =
    kind === "blanco"
      ? "#b0986c"
      : kind === "rosado"
        ? "#a87880"
        : kind === "espumoso"
          ? "#6a7e66"
          : "#8a5058";
  const hillNear =
    kind === "blanco"
      ? "#7a6440"
      : kind === "rosado"
        ? "#7a4850"
        : kind === "espumoso"
          ? "#3d5240"
          : "#5a2430";

  return (
    <svg
      className="wine-atmosphere__scene"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id={sunId} cx="78%" cy="16%" r="36%">
          <stop offset="0%" stopColor="rgba(255,250,235,0.9)" />
          <stop offset="45%" stopColor="rgba(255,220,160,0.25)" />
          <stop offset="100%" stopColor="rgba(255,220,160,0)" />
        </radialGradient>
        <linearGradient id={hazeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="50%" stopColor={sky[1]} />
          <stop offset="100%" stopColor={sky[2]} />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#${hazeId})`} />
      <circle cx="312" cy="40" r="72" fill={`url(#${sunId})`} />
      <path
        d="M0 128 C60 112 110 124 160 114 C220 102 270 122 320 112 C360 104 400 110 400 110 L400 240 L0 240 Z"
        fill={hillFar}
        opacity="0.32"
      />
      <path
        d="M0 168 C70 154 120 172 180 160 C250 146 300 168 400 156 L400 240 L0 240 Z"
        fill={hillNear}
        opacity="0.4"
      />
    </svg>
  );
}
