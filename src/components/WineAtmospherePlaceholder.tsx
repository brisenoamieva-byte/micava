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
 * Honest stand-in when there is no label photo: place + light + bottle silhouette
 * by wine type — never pretending to be the real bottle label.
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
      {kind === "espumoso" ? (
        <div className="wine-atmosphere__bubbles" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <div className="wine-atmosphere__stage">
        <BottleSilhouette kind={kind} uid={uid} />
        <div className="wine-atmosphere__caption">
          <p className="wine-atmosphere__eyebrow">{t("wine.atmosphereHint")}</p>
          <p className="wine-atmosphere__type">{typeName}</p>
          {placeLine ? (
            <p className="wine-atmosphere__place">{placeLine}</p>
          ) : null}
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
      ? ["#f3ead6", "#e4d2a8", "#cbb07a"]
      : kind === "rosado"
        ? ["#f2e0e2", "#e0b4b8", "#b86a72"]
        : kind === "espumoso"
          ? ["#e8efe4", "#c5d4ba", "#6a7f62"]
          : ["#e8d6d4", "#c48a8e", "#6a1a28"];

  const hillFar =
    kind === "blanco"
      ? "#9a8458"
      : kind === "rosado"
        ? "#8a555c"
        : kind === "espumoso"
          ? "#4a5c48"
          : "#5c2a32";
  const hillNear =
    kind === "blanco"
      ? "#6e5a38"
      : kind === "rosado"
        ? "#6a3840"
        : kind === "espumoso"
          ? "#2f4234"
          : "#3d1218";

  return (
    <svg
      className="wine-atmosphere__scene"
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id={sunId} cx="78%" cy="22%" r="42%">
          <stop offset="0%" stopColor="rgba(255,248,230,0.95)" />
          <stop offset="35%" stopColor="rgba(255,220,160,0.35)" />
          <stop offset="100%" stopColor="rgba(255,220,160,0)" />
        </radialGradient>
        <linearGradient id={hazeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky[0]} />
          <stop offset="55%" stopColor={sky[1]} />
          <stop offset="100%" stopColor={sky[2]} />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill={`url(#${hazeId})`} />
      <circle cx="312" cy="48" r="90" fill={`url(#${sunId})`} />

      {/* Distant hills */}
      <path
        d="M0 128 C48 112 86 118 128 108 C176 96 210 118 248 112 C292 104 330 92 400 104 L400 220 L0 220 Z"
        fill={hillFar}
        opacity="0.35"
      />
      {/* Near vineyard ridge */}
      <path
        d="M0 152 C40 140 72 156 110 148 C158 136 190 158 236 150 C286 140 330 158 400 146 L400 220 L0 220 Z"
        fill={hillNear}
        opacity="0.55"
      />
      {/* Soft vine rows */}
      <g opacity="0.28" stroke="rgba(255,252,247,0.55)" fill="none" strokeWidth="1.2">
        <path d="M20 168 C70 160 120 176 180 166 C240 156 300 172 380 162" />
        <path d="M10 178 C80 170 140 186 210 176 C280 166 340 182 400 174" />
        <path d="M0 188 C90 182 160 196 240 188 C310 180 360 192 400 186" />
      </g>
      {/* Ground wash under bottle */}
      <ellipse
        cx="92"
        cy="198"
        rx="56"
        ry="10"
        fill="rgba(20,18,16,0.22)"
      />
    </svg>
  );
}

function BottleSilhouette({
  kind,
  uid,
}: {
  kind: WineAtmosphereKind;
  uid: string;
}) {
  const fillId = `atm-bot-${uid}`;
  const shadeId = `atm-shade-${uid}`;
  const fill = `url(#${fillId})`;

  const stops =
    kind === "blanco" ? (
      <>
        <stop offset="0%" stopColor="#f0e2bc" />
        <stop offset="42%" stopColor="#d4b878" />
        <stop offset="100%" stopColor="#8a6a3a" />
      </>
    ) : kind === "rosado" ? (
      <>
        <stop offset="0%" stopColor="#e8a8b0" />
        <stop offset="45%" stopColor="#b85a64" />
        <stop offset="100%" stopColor="#5a2430" />
      </>
    ) : kind === "espumoso" ? (
      <>
        <stop offset="0%" stopColor="#e8f0e0" />
        <stop offset="40%" stopColor="#a8c098" />
        <stop offset="100%" stopColor="#2a3a2e" />
      </>
    ) : (
      <>
        <stop offset="0%" stopColor="#9a3644" />
        <stop offset="40%" stopColor="#6a1a28" />
        <stop offset="100%" stopColor="#1e0a10" />
      </>
    );

  // Bordeaux-ish silhouette: long neck, clear shoulders, straight body.
  const body =
    "M52 28 L52 68 C52 74 50 80 46 86 C40 96 36 108 36 124 L36 198 C36 206 42 212 52 212 L68 212 C78 212 84 206 84 198 L84 124 C84 108 80 96 74 86 C70 80 68 74 68 68 L68 28 Z";

  return (
    <svg
      className="wine-atmosphere__bottle"
      viewBox="0 0 120 220"
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0.2" y1="0" x2="0.85" y2="1">
          {stops}
        </linearGradient>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,252,247,0.2)" />
          <stop offset="40%" stopColor="rgba(255,252,247,0)" />
          <stop offset="100%" stopColor="rgba(20,18,16,0.22)" />
        </linearGradient>
      </defs>

      {/* Capsule / foil */}
      <rect
        x="50"
        y="6"
        width="20"
        height="22"
        rx="2"
        fill={kind === "espumoso" ? "#c4a35a" : "#1a1214"}
      />
      {kind === "espumoso" ? (
        <path
          d="M54 6 L60 1 L66 6"
          fill="none"
          stroke="#a88440"
          strokeWidth="1.4"
        />
      ) : (
        <rect x="50" y="14" width="20" height="2" fill="rgba(255,252,247,0.12)" />
      )}

      {/* Glass: neck + shoulders + body as one shape */}
      <path d={body} fill={fill} />
      <path d={body} fill={`url(#${shadeId})`} />

      {/* Neck ring / lip under capsule */}
      <rect x="51" y="26" width="18" height="3" rx="1" fill="rgba(20,18,16,0.35)" />

      {/* Glass highlight along left flank */}
      <path
        d="M42 100 C40 130 40 160 42 198"
        fill="none"
        stroke="rgba(255,252,247,0.32)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M56 34 L56 66"
        fill="none"
        stroke="rgba(255,252,247,0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
